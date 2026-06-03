import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAuthenticatedDevice } from "@/lib/auth/session";
import { createEventSchema } from "@/lib/validation";

export const runtime = "nodejs";

type VoteBreakdown = {
  choiceIndex: number;
  choiceText: string;
  voters: {
    id: string;
    username: string;
  }[];
};

type EventRow = {
  id: string;
  name: string;
  choices: string[];
  description: string | null;
  event_date: string;
  voter_count: string | number;
  has_voted: boolean | null;
  current_user_voted_choices: number[] | null;
  vote_breakdown: VoteBreakdown[] | null;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 20;

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const device = await getAuthenticatedDevice();
  const { searchParams } = new URL(request.url);
  const page = getPositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const requestedPageSize = getPositiveInteger(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  const totalRows = (await sql`
    select count(*) as total
    from events
  `) as { total: string | number }[];
  const totalItems = Number(totalRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const rows = (await sql`
    select
      e.id,
      e.name,
      e.choices,
      e.description,
      to_char(e.event_date, 'YYYY-MM-DD') as event_date,
      (
        select count(distinct ev.voter_id)
        from event_voters ev
        where ev.event_id = e.id
      ) as voter_count,
      exists (
        select 1
        from event_voters ev
        where ev.event_id = e.id
          and ev.voter_id = ${device?.id ?? null}
      ) as has_voted,
      coalesce(
        (
          select array_agg(ev.voted_choice order by ev.voted_choice)
          from event_voters ev
          where ev.event_id = e.id
            and ev.voter_id = ${device?.id ?? null}
        ),
        array[]::integer[]
      ) as current_user_voted_choices,
      coalesce(
        (
          select json_agg(
            json_build_object(
              'choiceIndex', choice.choice_ordinal - 1,
              'choiceText', choice.choice_text,
              'voters', coalesce(
                (
                  select json_agg(
                    json_build_object(
                      'id', d.id,
                      'username', d.username
                    )
                    order by d.username asc
                  )
                  from event_voters ev
                  join devices d on d.id = ev.voter_id
                  where ev.event_id = e.id
                    and ev.voted_choice = choice.choice_ordinal - 1
                ),
                '[]'::json
              )
            )
            order by choice.choice_ordinal asc
          )
          from unnest(e.choices) with ordinality as choice(choice_text, choice_ordinal)
        ),
        '[]'::json
      ) as vote_breakdown
    from events e
    order by e.event_date desc, e.name asc
    limit ${pageSize}
    offset ${offset}
  `) as EventRow[];

  return NextResponse.json({
    events: rows.map((event) => ({
      ...event,
      event_date: String(event.event_date),
      voter_count: Number(event.voter_count),
      has_voted: Boolean(event.has_voted),
      current_user_voted_choices: event.current_user_voted_choices ?? [],
      vote_breakdown: event.vote_breakdown ?? [],
    })),
    pagination: {
      page: currentPage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid event payload." },
      { status: 400 },
    );
  }

  const { name, choices, description, eventDate } = parsed.data;
  const rows = (await sql`
    insert into events (name, choices, description, event_date)
    values (${name}, ${choices}, ${description ?? null}, ${eventDate})
    returning id, name, choices, description, event_date
  `) as Pick<
    EventRow,
    "id" | "name" | "choices" | "description" | "event_date"
  >[];

  return NextResponse.json({ event: rows[0] }, { status: 201 });
}
