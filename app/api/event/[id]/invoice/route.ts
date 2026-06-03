import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { invoicePayloadSchema } from '@/lib/validation'

export const runtime = 'nodejs'

const eventIdSchema = z.string().uuid()

type RouteContext = {
  params: Promise<{ id: string }>
}

type EventRow = {
  id: string
  name: string
  description: string | null
  status: string
}

type ParticipantRow = {
  id: string
  username: string
}

type DebtRow = {
  username: string
  total_debt: string | number
  status: 'UNPAID' | 'PAID'
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const eventId = eventIdSchema.safeParse(id)

  if (!eventId.success) {
    return NextResponse.json({ message: 'Event id không hợp lệ.' }, { status: 400 })
  }

  const events = (await sql`
    select id, name, description, status
    from events
    where id = ${eventId.data}
    limit 1
  `) as EventRow[]

  if (!events[0]) {
    return NextResponse.json({ message: 'Không tìm thấy event.' }, { status: 404 })
  }

  const participants = (await sql`
    select d.id, d.username
    from event_voters ev
    join devices d on d.id = ev.voter_id
    where ev.event_id = ${eventId.data}
    order by d.username asc
  `) as ParticipantRow[]

  const debts = (await sql`
    select username, total_debt, status
    from event_debts
    where event_id = ${eventId.data}
    order by username asc
  `) as DebtRow[]

  return NextResponse.json({
    event: events[0],
    participants,
    debts: debts.map((debt) => ({
      ...debt,
      total_debt: Number(debt.total_debt),
    })),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const eventId = eventIdSchema.safeParse(id)

  if (!eventId.success) {
    return NextResponse.json({ message: 'Event id không hợp lệ.' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = invoicePayloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invoice payload không hợp lệ.' }, { status: 400 })
  }

  const eventRows = (await sql`
    select id
    from events
    where id = ${eventId.data}
    limit 1
  `) as { id: string }[]

  if (!eventRows[0]) {
    return NextResponse.json({ message: 'Không tìm thấy event.' }, { status: 404 })
  }

  const billingsJson = JSON.stringify(parsed.data.billings)

  // Một câu SQL duy nhất với nhiều CTE để Neon thực thi atomically:
  // 1. Xóa hóa đơn cũ của event.
  // 2. Insert lại billings và billing_details từ payload JSON.
  // 3. Tổng hợp rồi upsert event_debts theo username để tránh xung đột unique khi chốt lại hóa đơn.
  // 4. Đổi trạng thái event sang COLLECTING để báo đang thu tiền.
  const result = (await sql`
    with
      input_billings as (
        select
          gen_random_uuid() as billing_id,
          item ->> 'category' as category,
          (item ->> 'totalAmount')::numeric as total_amount,
          item -> 'details' as details
        from jsonb_array_elements(${billingsJson}::jsonb) as input(item)
      ),
      deleted_billings as (
        delete from billings
        where event_id = ${eventId.data}
      ),
      inserted_billings as (
        insert into billings (id, event_id, category, total_amount)
        select billing_id, ${eventId.data}, category, total_amount
        from input_billings
        returning id
      ),
      inserted_details as (
        insert into billing_details (billing_id, username, hours, amount)
        select
          inserted_billings.id,
          detail.username,
          detail.hours,
          detail.amount
        from input_billings
        join inserted_billings on inserted_billings.id = input_billings.billing_id
        cross join lateral jsonb_to_recordset(input_billings.details) as detail(
          username text,
          hours numeric,
          amount numeric
        )
        returning username, amount
      ),
      invoice_debts as (
        select username, sum(amount) as total_debt
        from inserted_details
        group by username
      ),
      deleted_stale_debts as (
        delete from event_debts
        where event_id = ${eventId.data}
          and username not in (select username from invoice_debts)
      ),
      inserted_debts as (
        insert into event_debts (event_id, username, total_debt, status)
        select ${eventId.data}, username, total_debt, 'UNPAID'
        from invoice_debts
        on conflict (event_id, username) do update
          set total_debt = excluded.total_debt,
              status = 'UNPAID',
              updated_at = now()
        returning username, total_debt, status
      ),
      updated_event as (
        update events
        set status = 'COLLECTING'
        where id = ${eventId.data}
        returning id, status
      )
    select
      (select count(*) from inserted_billings) as billing_count,
      (select status from updated_event) as event_status,
      coalesce(
        json_agg(
          json_build_object(
            'username', inserted_debts.username,
            'totalDebt', inserted_debts.total_debt,
            'status', inserted_debts.status
          )
          order by inserted_debts.username
        ),
        '[]'::json
      ) as debts
    from inserted_debts
  `) as {
    billing_count: string | number
    event_status: string | null
    debts: { username: string; totalDebt: string | number; status: string }[]
  }[]

  const invoice = result[0]

  return NextResponse.json({
    message: 'Đã chốt hóa đơn và chuyển event sang trạng thái đang thu tiền.',
    billingCount: Number(invoice?.billing_count ?? 0),
    debts: (invoice?.debts ?? []).map((debt) => ({
      ...debt,
      totalDebt: Number(debt.totalDebt),
    })),
  })
}
