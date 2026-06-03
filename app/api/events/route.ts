import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthenticatedDevice } from '@/lib/auth/session'
import { createEventSchema } from '@/lib/validation'

export const runtime = 'nodejs'

type EventRow = {
  id: string
  name: string
  choices: string[]
  description: string | null
  voter_count: string | number
  has_voted: boolean | null
}

export async function GET() {
  const device = await getAuthenticatedDevice()
  const rows = (await sql`
    select
      e.id,
      e.name,
      e.choices,
      e.description,
      count(ev.id) as voter_count,
      bool_or(ev.voter_id = ${device?.id ?? null}) as has_voted
    from events e
    left join event_voters ev on ev.event_id = e.id
    group by e.id
    order by e.name asc
  `) as EventRow[]

  return NextResponse.json({
    events: rows.map((event) => ({
      ...event,
      voter_count: Number(event.voter_count),
      has_voted: Boolean(event.has_voted),
    })),
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createEventSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Event payload không hợp lệ.' }, { status: 400 })
  }

  const { name, choices, description } = parsed.data
  const rows = (await sql`
    insert into events (name, choices, description)
    values (${name}, ${choices}, ${description ?? null})
    returning id, name, choices, description
  `) as Pick<EventRow, 'id' | 'name' | 'choices' | 'description'>[]

  return NextResponse.json({ event: rows[0] }, { status: 201 })
}
