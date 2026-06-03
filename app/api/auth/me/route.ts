import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verifySessionJwt } from '@/lib/jwt'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie'

export const runtime = 'nodejs'

type DeviceRow = {
  id: string
  username: string
  session_version: number
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  try {
    const session = await verifySessionJwt(token)
    const rows = (await sql`
      select id, username, session_version
      from devices
      where id = ${session.deviceId}
      limit 1
    `) as DeviceRow[]
    const device = rows[0]

    if (!device || device.session_version !== session.sessionVersion) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        deviceId: device.id,
        username: device.username,
      },
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
