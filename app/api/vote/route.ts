import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAuthenticatedDevice } from "@/lib/auth/session";
import { eventVoterSchema, removeEventVoterSchema } from "@/lib/validation";

export const runtime = "nodejs";

type EventRow = {
  id: string;
  choices: string[];
};

type EventVoterRow = {
  id: string;
  event_id: string;
  voter_id: string;
  voted_choice: number;
};

export async function POST(request: Request) {
  const device = await getAuthenticatedDevice();

  if (!device) {
    return NextResponse.json(
      { message: "You do not have a valid session." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = eventVoterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid event voter payload." },
      { status: 400 },
    );
  }

  const { eventId, votedChoice } = parsed.data;
  const eventRows = (await sql`
    select id, choices
    from events
    where id = ${eventId}
    limit 1
  `) as EventRow[];
  const event = eventRows[0];

  if (!event) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  const selectedChoice = event.choices[votedChoice];

  if (!selectedChoice) {
    return NextResponse.json(
      { message: "This option does not belong to the event." },
      { status: 400 },
    );
  }

  const rows = (await sql`
    insert into event_voters (event_id, voter_id, voted_choice)
    values (${eventId}, ${device.id}, ${votedChoice})
    on conflict (event_id, voter_id, voted_choice) do update set voted_choice = excluded.voted_choice
    returning id, event_id, voter_id, voted_choice
  `) as EventVoterRow[];

  return NextResponse.json(
    {
      message: `Your vote was recorded for option: ${selectedChoice}.`,
      eventVoter: rows[0],
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const device = await getAuthenticatedDevice();

  if (!device) {
    return NextResponse.json(
      { message: "You do not have a valid session." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = removeEventVoterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid event voter payload." },
      { status: 400 },
    );
  }

  const { eventId, votedChoice } = parsed.data;

  if (votedChoice === undefined) {
    await sql`
      delete from event_voters
      where event_id = ${eventId}
        and voter_id = ${device.id}
    `;

    return NextResponse.json({
      message: "All of your votes were removed from this event.",
    });
  }

  await sql`
    delete from event_voters
    where event_id = ${eventId}
      and voter_id = ${device.id}
      and voted_choice = ${votedChoice}
  `;

  return NextResponse.json({
    message: "Your vote for this option was removed.",
  });
}
