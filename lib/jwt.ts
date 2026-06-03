import { SignJWT, jwtVerify } from 'jose'

export type SessionJwtPayload = {
  deviceId: string
  username: string
  deviceUuidHash: string
  fingerprintHash: string
  sessionVersion: number
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is required')
  }

  return new TextEncoder().encode(secret)
}

export async function signSessionJwt(payload: SessionJwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('smash-bill')
    .setAudience('smash-bill-users')
    .setExpirationTime('30d')
    .sign(getJwtSecret())
}

export async function verifySessionJwt(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: 'smash-bill',
    audience: 'smash-bill-users',
  })

  if (
    typeof payload.deviceId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.deviceUuidHash !== 'string' ||
    typeof payload.fingerprintHash !== 'string' ||
    typeof payload.sessionVersion !== 'number'
  ) {
    throw new Error('Invalid session payload')
  }

  return payload as SessionJwtPayload
}
