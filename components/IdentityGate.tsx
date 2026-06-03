'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getClientIdentity } from '@/lib/client-identity'

type IdentityState =
  | { status: 'loading' }
  | { status: 'needs_username'; deviceUuid: string; fingerprintVisitorId: string }
  | { status: 'error'; message: string }

export default function IdentityGate() {
  const router = useRouter()
  const [state, setState] = useState<IdentityState>({ status: 'loading' })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function runHandshake() {
      try {
        const identity = await getClientIdentity()
        const response = await fetch('/api/auth/handshake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(identity),
        })
        const data = await response.json()

        if (cancelled) return

        if (data.status === 'ok') {
          router.replace('/vote')
          return
        }

        if (data.status === 'needs_username') {
          setState({ status: 'needs_username', ...identity })
          return
        }

        setState({ status: 'error', message: data.message ?? 'Không thể khởi tạo phiên.' })
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'Không thể đọc định danh trình duyệt.' })
        }
      }
    }

    runHandshake()

    return () => {
      cancelled = true
    }
  }, [router])

  function submitUsername(formData: FormData) {
    if (state.status !== 'needs_username') return

    const username = String(formData.get('username') ?? '').trim()

    startTransition(async () => {
      const response = await fetch('/api/auth/handshake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceUuid: state.deviceUuid,
          fingerprintVisitorId: state.fingerprintVisitorId,
          username,
        }),
      })
      const data = await response.json()

      if (data.status === 'ok') {
        router.replace('/vote')
        return
      }

      setState({ status: 'error', message: data.message ?? 'Không thể lưu tên hiển thị.' })
    })
  }

  if (state.status === 'loading') {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <p className="mb-4 inline-block border-[3px] border-black bg-[#5dc9ff] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Handshake
        </p>
        <h2 className="text-3xl font-black">Đang nhận diện thiết bị...</h2>
        <p className="mt-4 font-bold">Đọc Browser Fingerprint và Device UUID để cấp session nội bộ.</p>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <p className="mb-4 inline-block border-[3px] border-black bg-[#ff5fb7] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Error
        </p>
        <h2 className="text-3xl font-black">Có lỗi xảy ra</h2>
        <p className="mt-4 font-bold text-red-700">{state.message}</p>
        <button className="brutal-button mt-6 px-5 py-3 font-black" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </section>
    )
  }

  return (
    <section className="brutal-card bg-[#fff7e6] p-6">
      <p className="mb-4 inline-block border-[3px] border-black bg-[#7dff7a] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
        First time?
      </p>
      <h2 className="text-3xl font-black">Nhập tên hiển thị</h2>
      <p className="mt-4 font-bold">Tên này sẽ được gắn với thiết bị để vote và chia bill trong nhóm.</p>

      <form action={submitUsername} className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block font-black uppercase">Tên của bạn</span>
          <input
            name="username"
            required
            minLength={1}
            maxLength={80}
            placeholder="Ví dụ: An / Bình / Minh"
            className="brutal-input w-full px-4 py-3 text-lg font-bold"
          />
        </label>
        <button disabled={isPending} className="brutal-button w-full px-5 py-3 text-lg font-black disabled:opacity-60">
          {isPending ? 'Đang tạo session...' : 'Vào vote ngay'}
        </button>
      </form>
    </section>
  )
}
