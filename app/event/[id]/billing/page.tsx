import { redirect } from 'next/navigation'
import BillingClient from '@/components/BillingClient'
import { getAuthenticatedDevice } from '@/lib/auth/session'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventBillingPage({ params }: Props) {
  const device = await getAuthenticatedDevice()

  if (!device?.is_admin) {
    redirect('/vote')
  }

  const { id } = await params

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
      <BillingClient eventId={id} />
    </main>
  )
}
