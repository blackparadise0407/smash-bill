import type { NextRequest } from 'next/server'

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  return realIp
}
