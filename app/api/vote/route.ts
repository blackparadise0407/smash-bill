import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthenticatedDevice } from '@/lib/auth/session'
import { eventVoterSchema, removeEventVoterSchema } from '@/lib/validation'

export const runtime = 'nodejs'

type EventRow = {
  id: string
  choices: string[]
}

type EventVoterRow = {
  id: string
  event_id: string
  voter_id: string
}

export async function POST(request: Request) {
  const device = await getAuthenticatedDevice()

  if (!device) {
    return NextResponse.json({ message: 'Bạn chưa có session hợp lệ.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = eventVoterSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Event voter payload không hợp lệ.' }, { status: 400 })
  }

  const { eventId, choice } = parsed.data
  const eventRows = (await sql`
    select id, choices
    from events
    where id = ${eventId}
    limit 1
  `) as EventRow[]
  const event = eventRows[0]

  if (!event) {
    return NextResponse.json({ message: 'Không tìm thấy event.' }, { status: 404 })
  }

  if (!event.choices.includes(choice)) {
    return NextResponse.json({ message: 'Option này không thuộc event.' }, { status: 400 })
  }

  const rows = (await sql`
    insert into event_voters (event_id, voter_id)
    values (${eventId}, ${device.id})
    on conflict (event_id, voter_id) do update set event_id = excluded.event_id
    returning id, event_id, voter_id
  `) as EventVoterRow[]

  return NextResponse.json(
    {
      message: `Đã ghi nhận bạn vote option: ${choice}.`,
      eventVoter: rows[0],
    },
    { status: 201 },
  )
}

export async function DELETE(request: Request) {
  const device = await getAuthenticatedDevice()

  if (!device) {
    return NextResponse.json({ message: 'Bạn chưa có session hợp lệ.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = removeEventVoterSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Event voter payload không hợp lệ.' }, { status: 400 })
  }

  const { eventId } = parsed.data

  await sql`
    delete from event_voters
    where event_id = ${eventId}
      and voter_id = ${device.id}
  `

  return NextResponse.json({ message: 'Đã xóa lượt vote của bạn khỏi event này.' })
}
