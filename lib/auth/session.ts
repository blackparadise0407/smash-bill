import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { verifySessionJwt } from '@/lib/jwt'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie'

export type AuthenticatedDevice = {
  id: string
  username: string
  device_uuid_hash: string
  fingerprint_hash: string
  session_version: number
}

export async function getAuthenticatedDevice() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  const session = await verifySessionJwt(token).catch(() => null)

  if (!session) {
    return null
  }

  const rows = (await sql`
    select id, username, device_uuid_hash, fingerprint_hash, session_version
    from devices
    where id = ${session.deviceId}
    limit 1
  `) as AuthenticatedDevice[]
  const device = rows[0]

  if (!device || device.session_version !== session.sessionVersion) {
    return null
  }

  return device
}
