"use client";

import { AuthenticatedDevice } from "@/lib/auth/session";
import { formatEventDate, isEventExpired } from "@/lib/event-date";
import { useCallback, useEffect, useState, useTransition } from "react";

type VoteBreakdown = {
  choiceIndex: number;
  choiceText: string;
  voters: {
    id: string;
    username: string;
  }[];
};

type EventItem = {
  id: string;
  name: string;
  choices: string[];
  description: string | null;
  event_date: string;
  voter_count: number;
  has_voted: boolean;
  current_user_voted_choices: number[];
  vote_breakdown: VoteBreakdown[];
};

type PaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type EventsDashboardProps = {
  device: AuthenticatedDevice | null;
};

const EVENT_PAGE_SIZE = 5;

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: EVENT_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export default function EventsDashboard({ device }: EventsDashboardProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(EVENT_PAGE_SIZE),
    });
    const response = await fetch(`/api/event?${params}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Unable to load event list.");
      setIsLoading(false);
      return;
    }

    setEvents(data.events ?? []);
    setPagination(data.pagination ?? DEFAULT_PAGINATION);
    setIsLoading(false);
  }, [page]);

  useEffect(() => {
    void Promise.resolve().then(loadEvents);
  }, [loadEvents]);

  function goToPage(nextPage: number) {
    setIsLoading(true);
    setPage(Math.max(1, Math.min(nextPage, pagination.totalPages)));
  }

  function voteForChoice(eventId: string, votedChoice: number) {
    startTransition(async () => {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, votedChoice }),
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok ? "Vote recorded." : "Unable to vote for this option."),
      );

      if (response.ok) {
        await loadEvents();
      }
    });
  }

  function removeVote(eventId: string, votedChoice?: number) {
    startTransition(async () => {
      const response = await fetch("/api/vote", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, votedChoice }),
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok ? "Vote removed." : "Unable to remove vote."),
      );

      if (response.ok) {
        await loadEvents();
      }
    });
  }

  function deleteEvent(event: EventItem) {
    const shouldDelete = window.confirm(
      `Delete "${event.name}" and all related votes, invoices, billing details, and debts? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/event/${event.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok ? "Event deleted." : "Unable to delete event."),
      );

      if (!response.ok) {
        return;
      }

      if (events.length === 1 && page > 1) {
        setPage(page - 1);
        return;
      }

      await loadEvents();
    });
  }

  if (isLoading) {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Loading schedule...</h2>
        <p className="mt-3 font-bold">Fetching events from Neon Postgres.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {message ? (
        <p className="border-[3px] border-black bg-[#5dc9ff] px-4 py-3 font-black shadow-[4px_4px_0_#111]">
          {message}
        </p>
      ) : null}

      {events.length === 0 ? (
        <div className="brutal-card bg-[#fff7e6] p-6">
          <h2 className="text-3xl font-black">No events yet</h2>
        </div>
      ) : null}

      <div className="grid gap-6">
        {events.map((event) => {
          const votedChoices = new Set(event.current_user_voted_choices);
          const eventExpired = isEventExpired(event.event_date);

          return (
            <article
              key={event.id}
              className={`brutal-card p-6 ${
                eventExpired ? "bg-[#ffe0e0]" : "bg-[#fff7e6]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="mb-3 inline-block border-[3px] border-black bg-[#ff9f1c] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
                  {event.voter_count} voted{" "}
                  {!event.has_voted ? <small>(Not voted)</small> : null}
                </div>
                <div className="grow"></div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <p
                    className={`w-fit border-[3px] border-black px-3 py-1 text-sm font-black uppercase shadow-[3px_3px_0_#111] ${
                      eventExpired ? "bg-[#ff3131] text-white" : "bg-[#7dff7a]"
                    }`}
                  >
                    {formatEventDate(event.event_date)}
                  </p>
                  {eventExpired ? (
                    <p className="w-fit border-[3px] border-black bg-white px-3 py-1 text-sm font-black uppercase text-[#ff3131] shadow-[3px_3px_0_#111]">
                      Expired
                    </p>
                  ) : null}
                </div>
              </div>

              <h2 className="text-3xl font-black">{event.name}</h2>
              {event.description ? (
                <p className="mt-3 font-bold">{event.description}</p>
              ) : null}

              <div className="mt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {event.choices.map((choice, choiceIndex) => {
                    const hasVotedChoice = votedChoices.has(choiceIndex);

                    return (
                      <button
                        key={`${choice}-${choiceIndex}`}
                        disabled={isPending || eventExpired}
                        className={`cursor-pointer border-[3px] border-black px-4 py-3 text-left text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60 ${
                          hasVotedChoice ? "bg-[#7dff7a]" : "bg-[#5dc9ff]"
                        }`}
                        onClick={() =>
                          hasVotedChoice
                            ? removeVote(event.id, choiceIndex)
                            : voteForChoice(event.id, choiceIndex)
                        }
                      >
                        <span className="block">{choice}</span>
                        <span className="mt-1 block text-sm uppercase">
                          {hasVotedChoice
                            ? "Selected · click to remove"
                            : "Click to select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="mt-6 border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_#111]">
                <h3 className="text-2xl font-black">
                  Who voted for each option?
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {event.vote_breakdown.map((choice) => (
                    <div
                      key={choice.choiceIndex}
                      className="border-[3px] border-black bg-[#fff7e6] p-3"
                    >
                      <p className="font-black">{choice.choiceText}</p>
                      {choice.voters.length === 0 ? (
                        <p className="mt-2 text-sm font-bold uppercase opacity-70">
                          No one selected this option yet
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {choice.voters.map((voter) => (
                            <span
                              key={voter.id}
                              className="border-2 border-black bg-[#ff9f1c] px-2 py-1 text-sm font-black"
                            >
                              {voter.username}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  disabled={isPending || !event.has_voted || eventExpired}
                  className="border-[3px] border-black bg-[#ff5fb7] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60"
                  onClick={() => removeVote(event.id)}
                >
                  Remove all votes
                </button>
                {device?.is_admin ? (
                  <>
                    <a
                      className="border-[3px] border-black bg-[#7dff7a] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111]"
                      href={`/event/${event.id}/billing`}
                    >
                      Create invoice
                    </a>
                    <button
                      type="button"
                      disabled={isPending}
                      className="border-[3px] border-black bg-[#ff3131] px-5 py-3 text-left text-lg font-black text-white shadow-[5px_5px_0_#111] disabled:opacity-60"
                      onClick={() => deleteEvent(event)}
                    >
                      Delete event
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {events.length > 0 ? (
        <nav
          className="brutal-card flex flex-wrap items-center justify-between gap-3 bg-white p-4"
          aria-label="Event pagination"
        >
          <p className="font-black uppercase">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.totalItems} events
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage || isLoading}
              className="border-[3px] border-black bg-[#5dc9ff] px-4 py-2 font-black shadow-[4px_4px_0_#111] disabled:opacity-50"
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage || isLoading}
              className="border-[3px] border-black bg-[#7dff7a] px-4 py-2 font-black shadow-[4px_4px_0_#111] disabled:opacity-50"
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
