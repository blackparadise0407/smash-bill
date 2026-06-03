"use client";

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
  voter_count: number;
  has_voted: boolean;
  current_user_voted_choices: number[];
  vote_breakdown: VoteBreakdown[];
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
          (response.ok ? "Đã ghi nhận vote." : "Không thể vote option này."),
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
        {events.map((event) => {
          const votedChoices = new Set(event.current_user_voted_choices);

          return (
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
                  {event.choices.map((choice, choiceIndex) => {
                    const hasVotedChoice = votedChoices.has(choiceIndex);

                    return (
                      <button
                        key={`${choice}-${choiceIndex}`}
                        disabled={isPending}
                        className={`border-[3px] border-black px-4 py-3 text-left text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60 ${
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
                          {hasVotedChoice ? "Đã chọn · bấm để bỏ" : "Bấm để chọn"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="mt-6 border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_#111]">
                <h3 className="text-2xl font-black">Ai vote option nào?</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                          Chưa có ai chọn
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {choice.voters.map((voter) => (
                            <span
                              key={voter.id}
                              className="border-[2px] border-black bg-[#ff9f1c] px-2 py-1 text-sm font-black"
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  disabled={isPending || !event.has_voted}
                  className="border-[3px] border-black bg-[#ff5fb7] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111] disabled:opacity-60"
                  onClick={() => removeVote(event.id)}
                >
                  Xóa tất cả vote khỏi event
                </button>
                <a
                  className="border-[3px] border-black bg-[#7dff7a] px-5 py-3 text-lg font-black shadow-[5px_5px_0_#111]"
                  href={`/event/${event.id}/billing`}
                >
                  Tạo hóa đơn
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
