import { createHash } from 'crypto'

export function hashIdentity(value: string) {
  const pepper = process.env.IDENTITY_PEPPER

  if (!pepper) {
    throw new Error('IDENTITY_PEPPER is required')
  }

  return createHash('sha256').update(`${pepper}:${value}`).digest('hex')
}
