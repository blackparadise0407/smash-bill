import BillingClient from '@/components/BillingClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventBillingPage({ params }: Props) {
  const { id } = await params

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
      <BillingClient eventId={id} />
    </main>
  )
}
