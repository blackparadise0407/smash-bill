"use client";

import {
  formatEventDate,
  getTodayDateValue,
  isEventExpired,
} from "@/lib/event-date";
import type { FormEvent } from "react";
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

const DEFAULT_CHOICES = ["8h-10h", "9h-11h"];
const EVENT_PAGE_SIZE = 5;

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: EVENT_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export default function AdminEventsCreator() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [choicesText, setChoicesText] = useState(DEFAULT_CHOICES.join("\n"));
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

  function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const choices = choicesText
      .split("\n")
      .map((choice) => choice.trim())
      .filter(Boolean);

    startTransition(async () => {
      const response = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? "").trim(),
          description:
            String(formData.get("description") ?? "").trim() || undefined,
          eventDate: String(formData.get("eventDate") ?? ""),
          choices,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Unable to create event.");
        return;
      }

      form.reset();
      setChoicesText(DEFAULT_CHOICES.join("\n"));
      setMessage(`Event created: ${data.event.name}`);

      if (page === 1) {
        await loadEvents();
      } else {
        setPage(1);
      }
    });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form
        onSubmit={createEvent}
        className="brutal-card h-fit bg-[#fff7e6] p-6"
      >
        <p className="mb-4 inline-block border-[3px] border-black bg-[#7dff7a] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Admin form
        </p>
        <h2 className="text-3xl font-black">Create new event</h2>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block font-black uppercase">Event name</span>
            <input
              name="name"
              required
              minLength={1}
              maxLength={160}
              placeholder="Example: Tuesday badminton · 19:00-21:00"
              className="brutal-input w-full px-4 py-3 text-lg font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">Event date</span>
            <input
              name="eventDate"
              type="date"
              required
              defaultValue={getTodayDateValue()}
              className="brutal-input w-full px-4 py-3 text-lg font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">Description</span>
            <textarea
              name="description"
              maxLength={1000}
              rows={4}
              placeholder="Court, time, internal notes..."
              className="brutal-input w-full resize-y px-4 py-3 text-lg font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">
              Options vote
            </span>
            <textarea
              required
              rows={5}
              value={choicesText}
              onChange={(event) => setChoicesText(event.target.value)}
              className="brutal-input w-full resize-y px-4 py-3 text-lg font-bold"
            />
            <span className="mt-2 block text-sm font-black uppercase">
              Up to 10 options, each option up to 80 characters.
            </span>
          </label>
        </div>

        <button
          disabled={isPending}
          className="brutal-button mt-6 w-full px-5 py-3 text-lg font-black disabled:opacity-60"
        >
          {isPending ? "Creating event..." : "Create event"}
        </button>

        {message ? (
          <p className="mt-5 border-[3px] border-black bg-[#5dc9ff] px-4 py-3 font-black shadow-[4px_4px_0_#111]">
            {message}
          </p>
        ) : null}
      </form>

      <div className="space-y-4">
        <div className="brutal-card bg-[#ff5fb7] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
                Event list
              </p>
              <h2 className="text-3xl font-black">Existing events</h2>
            </div>
            <a
              className="border-[3px] border-black bg-[#7dff7a] px-4 py-2 font-black shadow-[4px_4px_0_#111]"
              href="/vote"
            >
              View voting page
            </a>
          </div>
        </div>

        {isLoading ? (
          <article className="brutal-card bg-[#fff7e6] p-6">
            <h3 className="text-2xl font-black">Loading events...</h3>
          </article>
        ) : null}

        {!isLoading && events.length === 0 ? (
          <article className="brutal-card bg-[#fff7e6] p-6">
            <h3 className="text-2xl font-black">No events yet</h3>
            <p className="mt-3 font-bold">
              Create your first event using the form on the left.
            </p>
          </article>
        ) : null}

        {events.map((event) => {
          const eventExpired = isEventExpired(event.event_date);

          return (
            <article
              key={event.id}
              className={`brutal-card p-6 ${
                eventExpired ? "bg-[#ffe0e0]" : "bg-[#fff7e6]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <p
                      className={`w-fit border-[3px] border-black px-3 py-1 text-sm font-black uppercase shadow-[3px_3px_0_#111] ${
                        eventExpired
                          ? "bg-[#ff3131] text-white"
                          : "bg-[#7dff7a]"
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
                  <h3 className="text-2xl font-black">{event.name}</h3>
                  {event.description ? (
                    <p className="mt-2 font-bold">{event.description}</p>
                  ) : null}
                </div>
                <span className="border-[3px] border-black bg-[#ff9f1c] px-3 py-2 font-black shadow-[4px_4px_0_#111]">
                  {event.voter_count} voters
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.choices.map((choice, choiceIndex) => (
                  <span
                    key={`${choice}-${choiceIndex}`}
                    className="border-[3px] border-black bg-white px-3 py-1 font-black shadow-[3px_3px_0_#111]"
                  >
                    {choice}
                  </span>
                ))}
              </div>
              <section className="mt-5 border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_#111]">
                <h4 className="text-xl font-black">Voters by option</h4>
                <div className="mt-3 grid gap-3">
                  {event.vote_breakdown.map((choice) => (
                    <div
                      key={choice.choiceIndex}
                      className="border-[3px] border-black bg-[#fff7e6] p-3"
                    >
                      <p className="font-black">
                        #{choice.choiceIndex} · {choice.choiceText}
                      </p>
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
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <a
                  className="border-[3px] border-black bg-[#5dc9ff] px-4 py-3 text-center font-black shadow-[4px_4px_0_#111]"
                  href={`/event/${event.id}/billing`}
                >
                  Open billing
                </a>
                <a
                  className="border-[3px] border-black bg-[#7dff7a] px-4 py-3 text-center font-black shadow-[4px_4px_0_#111]"
                  href="/vote"
                >
                  Open voting
                </a>
              </div>
            </article>
          );
        })}

        {events.length > 0 ? (
          <nav
            className="brutal-card flex flex-wrap items-center justify-between gap-3 bg-white p-4"
            aria-label="Admin event pagination"
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
      </div>
    </section>
  );
}
