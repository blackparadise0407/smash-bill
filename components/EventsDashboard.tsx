"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type EventItem = {
  id: string;
  name: string;
  choices: string[];
  description: string | null;
  voter_count: number;
  has_voted: boolean;
};

export default function EventsDashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/event", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Không thể tải danh sách event.");
      setIsLoading(false);
      return;
    }

    setEvents(data.events ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function voteForChoice(eventId: string, choice: string) {
    startTransition(async () => {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, choice }),
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok ? "Đã ghi nhận vote." : "Không thể vote option này."),
      );

      if (response.ok) {
        await loadEvents();
      }
    });
  }

  function removeVote(eventId: string) {
    startTransition(async () => {
      const response = await fetch("/api/vote", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await response.json();

      setMessage(
        data.message ?? (response.ok ? "Đã xóa vote." : "Không thể xóa vote."),
      );

      if (response.ok) {
        await loadEvents();
      }
    });
  }

  if (isLoading) {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Đang tải lịch...</h2>
        <p className="mt-3 font-bold">Đọc events từ Neon Postgres.</p>
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
          <h2 className="text-3xl font-black">Chưa có event nào</h2>
        </div>
      ) : null}

      <div className="grid gap-6">
        {events.map((event) => (
          <article key={event.id} className="brutal-card bg-[#fff7e6] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-3 inline-block border-[3px] border-black bg-[#ff9f1c] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
                  {event.voter_count} thiết bị đã vote
                </p>
                <h2 className="text-3xl font-black">{event.name}</h2>
                {event.description ? (
                  <p className="mt-3 font-bold">{event.description}</p>
                ) : null}
              </div>

              <div className="border-[3px] border-black bg-white px-3 py-2 font-black shadow-[4px_4px_0_#111]">
                {event.has_voted ? "Đã vote" : "Chưa vote"}
              </div>
            </div>

            <div className="mt-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {event.choices.map((choice) => (
                  <button
                    key={choice}
                    disabled={isPending || event.has_voted}
                    className="border-[3px] border-black bg-[#5dc9ff] px-4 py-3 text-left text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60"
                    onClick={() => voteForChoice(event.id, choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                disabled={isPending || !event.has_voted}
                className="border-[3px] border-black bg-[#ff5fb7] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60"
                onClick={() => removeVote(event.id)}
              >
                Xóa vote khỏi event
              </button>
              <a
                className="border-[3px] border-black bg-[#7dff7a] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111]"
                href={`/event/${event.id}/billing`}
              >
                Tạo hóa đơn
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
