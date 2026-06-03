import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashIdentity } from "@/lib/crypto";
import { signSessionJwt } from "@/lib/jwt";
import { getClientIp } from "@/lib/request";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";
import { handshakeSchema } from "@/lib/validation";

export const runtime = "nodejs";

type DeviceRow = {
  id: string;
  username: string;
  device_uuid_hash: string;
  fingerprint_hash: string;
  session_version: number;
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function createSessionResponse(
  device: DeviceRow,
  deviceUuidHash: string,
  fingerprintHash: string,
) {
  const token = await signSessionJwt({
    deviceId: device.id,
    username: device.username,
    deviceUuidHash,
    fingerprintHash,
    sessionVersion: device.session_version,
  });

  const response = NextResponse.json({
    status: "ok",
    username: device.username,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = handshakeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: "Invalid identity payload." },
      { status: 400 },
    );
  }

  const { deviceUuid, fingerprintVisitorId, username } = parsed.data;
  const deviceUuidHash = hashIdentity(deviceUuid);
  const fingerprintHash = hashIdentity(fingerprintVisitorId);
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const existingRows = (await sql`
    select id, username, device_uuid_hash, fingerprint_hash, session_version
    from devices
    where device_uuid_hash = ${deviceUuidHash}
       or fingerprint_hash = ${fingerprintHash}
    order by case when device_uuid_hash = ${deviceUuidHash} then 0 else 1 end
    limit 1
  `) as DeviceRow[];

  const existingDevice = existingRows[0];

  if (existingDevice) {
    await sql`
      update devices
      set
        last_seen_at = now(),
        updated_at = now(),
        last_ip = ${ip},
        user_agent = ${userAgent},
        device_uuid_hash = ${deviceUuidHash},
        fingerprint_hash = ${fingerprintHash}
      where id = ${existingDevice.id}
    `;

    return createSessionResponse(
      {
        ...existingDevice,
        device_uuid_hash: deviceUuidHash,
        fingerprint_hash: fingerprintHash,
      },
      deviceUuidHash,
      fingerprintHash,
    );
  }

  if (!username) {
    return NextResponse.json({ status: "needs_username" });
  }

  try {
    const insertedRows = (await sql`
      insert into devices (
        device_uuid_hash,
        fingerprint_hash,
        username,
        user_agent,
        first_ip,
        last_ip
      )
      values (
        ${deviceUuidHash},
        ${fingerprintHash},
        ${username},
        ${userAgent},
        ${ip},
        ${ip}
      )
      returning id, username, device_uuid_hash, fingerprint_hash, session_version
    `) as DeviceRow[];

    return createSessionResponse(
      insertedRows[0],
      deviceUuidHash,
      fingerprintHash,
    );
  } catch (error) {
    if (!isUniqueViolation(error)) {
      return NextResponse.json(
        { status: "error", message: "Failed to create a new device." },
        { status: 500 },
      );
    }

    const recoveredRows = (await sql`
      select id, username, device_uuid_hash, fingerprint_hash, session_version
      from devices
      where device_uuid_hash = ${deviceUuidHash}
         or fingerprint_hash = ${fingerprintHash}
      limit 1
    `) as DeviceRow[];

    const recoveredDevice = recoveredRows[0];

    if (!recoveredDevice) {
      return NextResponse.json(
        {
          status: "error",
          message: "Could not recover session after conflict.",
        },
        { status: 409 },
      );
    }

    return createSessionResponse(
      recoveredDevice,
      deviceUuidHash,
      fingerprintHash,
    );
  }
}
