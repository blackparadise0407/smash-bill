'use client'

import FingerprintJS from '@fingerprintjs/fingerprintjs'

const DEVICE_UUID_KEY = 'smash_bill_device_uuid'

let fingerprintAgentPromise: ReturnType<typeof FingerprintJS.load> | null = null

function getFingerprintAgent() {
  fingerprintAgentPromise ??= FingerprintJS.load()
  return fingerprintAgentPromise
}

export async function getClientIdentity() {
  const fingerprintAgent = await getFingerprintAgent()
  const fingerprint = await fingerprintAgent.get()

  let deviceUuid = window.localStorage.getItem(DEVICE_UUID_KEY)

  if (!deviceUuid) {
    deviceUuid = window.crypto.randomUUID()
    window.localStorage.setItem(DEVICE_UUID_KEY, deviceUuid)
  }

  return {
    deviceUuid,
    fingerprintVisitorId: fingerprint.visitorId,
  }
}
