import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getAuthenticatedDevice } from "@/lib/auth/session";
import {
  invoiceDebtStatusSchema,
  invoicePayloadSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

const eventIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type ParticipantRow = {
  id: string;
  username: string;
};

type DebtRow = {
  username: string;
  total_debt: string | number;
  status: "UNPAID" | "PAID";
};

type BillingRow = {
  id: string;
  category: string;
  total_amount: string | number;
  details: {
    username: string;
    hours: string | number;
    amount: string | number;
  }[];
};

export async function GET(_request: Request, context: RouteContext) {
  const device = await getAuthenticatedDevice();

  if (!device) {
    return NextResponse.json(
      { message: "You do not have a valid session." },
      { status: 401 },
    );
  }

  if (!device.is_admin) {
    return NextResponse.json(
      { message: "You do not have admin permission." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const eventId = eventIdSchema.safeParse(id);

  if (!eventId.success) {
    return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
  }

  const events = (await sql`
    select id, name, description, status
    from events
    where id = ${eventId.data}
    limit 1
  `) as EventRow[];

  if (!events[0]) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  const participants = (await sql`
    select distinct d.id, d.username
    from event_voters ev
    join devices d on d.id = ev.voter_id
    where ev.event_id = ${eventId.data}
    order by d.username asc
  `) as ParticipantRow[];

  const debts = (await sql`
    select username, total_debt, status
    from event_debts
    where event_id = ${eventId.data}
    order by username asc
  `) as DebtRow[];

  const billings = (await sql`
    select
      b.id,
      b.category,
      b.total_amount,
      coalesce(
        json_agg(
          json_build_object(
            'username', bd.username,
            'hours', bd.hours,
            'amount', bd.amount
          )
          order by bd.username
        ) filter (where bd.id is not null),
        '[]'::json
      ) as details
    from billings b
    left join billing_details bd on bd.billing_id = b.id
    where b.event_id = ${eventId.data}
    group by b.id, b.category, b.total_amount, b.created_at
    order by b.created_at asc, b.category asc
  `) as BillingRow[];

  return NextResponse.json({
    event: events[0],
    participants,
    billings: billings.map((billing) => ({
      id: billing.id,
      category: billing.category,
      totalAmount: Number(billing.total_amount),
      details: billing.details.map((detail) => ({
        username: detail.username,
        hours: Number(detail.hours),
        amount: Number(detail.amount),
      })),
    })),
    debts: debts.map((debt) => ({
      username: debt.username,
      totalDebt: Number(debt.total_debt),
      status: debt.status,
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const device = await getAuthenticatedDevice();

  if (!device) {
    return NextResponse.json(
      { message: "You do not have a valid session." },
      { status: 401 },
    );
  }

  if (!device.is_admin) {
    return NextResponse.json(
      { message: "You do not have admin permission." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const eventId = eventIdSchema.safeParse(id);

  if (!eventId.success) {
    return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = invoicePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid invoice payload." },
      { status: 400 },
    );
  }

  const eventRows = (await sql`
    select id
    from events
    where id = ${eventId.data}
    limit 1
  `) as { id: string }[];

  if (!eventRows[0]) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  const billingsJson = JSON.stringify(parsed.data.billings);

  // A single SQL statement with multiple CTEs so Neon executes atomically:
  // 1. Delete existing invoices for the event.
  // 2. Reinsert billings and billing_details from JSON payload.
  // 3. Aggregate and upsert event_debts by username to avoid unique conflicts on re-finalization.
  // 4. Switch event status to COLLECTING to indicate collection is in progress.
  const result = (await sql`
    with
      input_billings as materialized (
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
    billing_count: string | number;
    event_status: string | null;
    debts: { username: string; totalDebt: string | number; status: string }[];
  }[];

  const invoice = result[0];

  return NextResponse.json({
    message: "Invoice finalized and event moved to collecting status.",
    billingCount: Number(invoice?.billing_count ?? 0),
    debts: (invoice?.debts ?? []).map((debt) => ({
      ...debt,
      totalDebt: Number(debt.totalDebt),
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const device = await getAuthenticatedDevice();

  if (!device) {
    return NextResponse.json(
      { message: "You do not have a valid session." },
      { status: 401 },
    );
  }

  if (!device.is_admin) {
    return NextResponse.json(
      { message: "You do not have admin permission." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const eventId = eventIdSchema.safeParse(id);

  if (!eventId.success) {
    return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = invoiceDebtStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payment status payload." },
      { status: 400 },
    );
  }

  const result = (await sql`
    with updated_debt as (
      update event_debts
      set status = ${parsed.data.status},
          updated_at = now()
      where event_id = ${eventId.data}
        and username = ${parsed.data.username}
      returning username, total_debt, status
    ),
    event_status as (
      update events
      set status = case
        when ${parsed.data.status} = 'UNPAID'
          or exists (
            select 1
            from event_debts
            where event_id = ${eventId.data}
              and username <> ${parsed.data.username}
              and status = 'UNPAID'
          ) then 'COLLECTING'
        else 'SETTLED'
      end
      where id = ${eventId.data}
        and exists (select 1 from updated_debt)
      returning status
    )
    select
      updated_debt.username,
      updated_debt.total_debt,
      updated_debt.status,
      (select status from event_status) as event_status
    from updated_debt
  `) as {
    username: string;
    total_debt: string | number;
    status: "UNPAID" | "PAID";
    event_status: string | null;
  }[];

  const updatedDebt = result[0];

  if (!updatedDebt) {
    return NextResponse.json(
      { message: "Debt row not found for this event." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    message:
      updatedDebt.status === "PAID"
        ? `${updatedDebt.username} marked as paid.`
        : `${updatedDebt.username} marked as unpaid.`,
    debt: {
      username: updatedDebt.username,
      totalDebt: Number(updatedDebt.total_debt),
      status: updatedDebt.status,
    },
    eventStatus: updatedDebt.event_status,
  });
}
