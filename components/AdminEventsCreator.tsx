"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";

type EventItem = {
  id: string;
  name: string;
  choices: string[];
  description: string | null;
  voter_count: number;
  has_voted: boolean;
};

const DEFAULT_CHOICES = ["8h-10h", "9h-11h"];

export default function AdminEventsCreator() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [choicesText, setChoicesText] = useState(DEFAULT_CHOICES.join("\n"));
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
          choices,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Không thể tạo event.");
        return;
      }

      form.reset();
      setChoicesText(DEFAULT_CHOICES.join("\n"));
      setMessage(`Đã tạo event: ${data.event.name}`);
      await loadEvents();
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
        <h2 className="text-3xl font-black">Tạo event mới</h2>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block font-black uppercase">Tên event</span>
            <input
              name="name"
              required
              minLength={1}
              maxLength={160}
              placeholder="Ví dụ: Cầu lông thứ 3 · 19:00-21:00"
              className="brutal-input w-full px-4 py-3 text-lg font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">Mô tả</span>
            <textarea
              name="description"
              maxLength={1000}
              rows={4}
              placeholder="Sân, giờ, ghi chú nội bộ..."
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
              Tối đa 10 options, mỗi option tối đa 80 ký tự.
            </span>
          </label>
        </div>

        <button
          disabled={isPending}
          className="brutal-button mt-6 w-full px-5 py-3 text-lg font-black disabled:opacity-60"
        >
          {isPending ? "Đang tạo event..." : "Tạo event"}
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
              <h2 className="text-3xl font-black">Events hiện có</h2>
            </div>
            <a
              className="border-[3px] border-black bg-[#7dff7a] px-4 py-2 font-black shadow-[4px_4px_0_#111]"
              href="/vote"
            >
              Xem trang vote
            </a>
          </div>
        </div>

        {isLoading ? (
          <article className="brutal-card bg-[#fff7e6] p-6">
            <h3 className="text-2xl font-black">Đang tải events...</h3>
          </article>
        ) : null}

        {!isLoading && events.length === 0 ? (
          <article className="brutal-card bg-[#fff7e6] p-6">
            <h3 className="text-2xl font-black">Chưa có event nào</h3>
            <p className="mt-3 font-bold">
              Tạo event đầu tiên bằng form bên trái.
            </p>
          </article>
        ) : null}

        {events.map((event) => (
          <article key={event.id} className="brutal-card bg-[#fff7e6] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
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
              {event.choices.map((choice) => (
                <span
                  key={choice}
                  className="border-[3px] border-black bg-white px-3 py-1 font-black shadow-[3px_3px_0_#111]"
                >
                  {choice}
                </span>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                className="border-[3px] border-black bg-[#5dc9ff] px-4 py-3 text-center font-black shadow-[4px_4px_0_#111]"
                href={`/event/${event.id}/billing`}
              >
                Mở billing
              </a>
              <a
                className="border-[3px] border-black bg-[#7dff7a] px-4 py-3 text-center font-black shadow-[4px_4px_0_#111]"
                href="/vote"
              >
                Mở vote
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
