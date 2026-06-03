import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getAuthenticatedDevice } from "@/lib/auth/session";

export const runtime = "nodejs";

const eventIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DeleteEventResult = {
  event_id: string | null;
  event_name: string | null;
  deleted_vote_count: string | number;
  deleted_billing_detail_count: string | number;
  deleted_billing_count: string | number;
  deleted_debt_count: string | number;
};

export async function DELETE(_request: Request, context: RouteContext) {
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

  const rows = (await sql`
    with
      target_event as materialized (
        select id, name
        from events
        where id = ${eventId.data}
        limit 1
      ),
      deleted_billing_details as (
        delete from billing_details bd
        using billings b, target_event te
        where bd.billing_id = b.id
          and b.event_id = te.id
        returning bd.id
      ),
      deleted_billings as (
        delete from billings b
        using target_event te
        where b.event_id = te.id
        returning b.id
      ),
      deleted_debts as (
        delete from event_debts ed
        using target_event te
        where ed.event_id = te.id
        returning ed.id
      ),
      deleted_votes as (
        delete from event_voters ev
        using target_event te
        where ev.event_id = te.id
        returning ev.id
      ),
      deleted_event as (
        delete from events e
        using target_event te
        where e.id = te.id
        returning e.id, e.name
      )
    select
      (select id from deleted_event) as event_id,
      (select name from deleted_event) as event_name,
      (select count(*) from deleted_votes) as deleted_vote_count,
      (select count(*) from deleted_billing_details) as deleted_billing_detail_count,
      (select count(*) from deleted_billings) as deleted_billing_count,
      (select count(*) from deleted_debts) as deleted_debt_count
  `) as DeleteEventResult[];

  const deletedEvent = rows[0];

  if (!deletedEvent?.event_id) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: `Deleted event: ${deletedEvent.event_name}.`,
    deleted: {
      eventId: deletedEvent.event_id,
      eventName: deletedEvent.event_name,
      votes: Number(deletedEvent.deleted_vote_count),
      billingDetails: Number(deletedEvent.deleted_billing_detail_count),
      billings: Number(deletedEvent.deleted_billing_count),
      debts: Number(deletedEvent.deleted_debt_count),
    },
  });
}
