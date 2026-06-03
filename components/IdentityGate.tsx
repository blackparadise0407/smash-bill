"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getClientIdentity } from "@/lib/client-identity";

type IdentityState =
  | { status: "loading" }
  | {
      status: "needs_username";
      deviceUuid: string;
      fingerprintVisitorId: string;
    }
  | { status: "error"; message: string };

export default function IdentityGate() {
  const router = useRouter();
  const [state, setState] = useState<IdentityState>({ status: "loading" });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function runHandshake() {
      try {
        const identity = await getClientIdentity();
        const response = await fetch("/api/auth/handshake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(identity),
        });
        const data = await response.json();

        if (cancelled) return;

        if (data.status === "ok") {
          router.replace("/vote");
          return;
        }

        if (data.status === "needs_username") {
          setState({ status: "needs_username", ...identity });
          return;
        }

        setState({
          status: "error",
          message: data.message ?? "Unable to initialize session.",
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Unable to read browser identity.",
          });
        }
      }
    }

    runHandshake();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function submitUsername(formData: FormData) {
    if (state.status !== "needs_username") return;

    const username = String(formData.get("username") ?? "").trim();

    startTransition(async () => {
      const response = await fetch("/api/auth/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUuid: state.deviceUuid,
          fingerprintVisitorId: state.fingerprintVisitorId,
          username,
        }),
      });
      const data = await response.json();

      if (data.status === "ok") {
        router.replace("/vote");
        return;
      }

      setState({
        status: "error",
        message: data.message ?? "Unable to save display name.",
      });
    });
  }

  if (state.status === "loading") {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <p className="mb-4 inline-block border-[3px] border-black bg-[#5dc9ff] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Handshake
        </p>
        <h2 className="text-3xl font-black">Identifying device...</h2>
        <p className="mt-4 font-bold">
          Reading browser fingerprint and device UUID to issue an internal
          session.
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <p className="mb-4 inline-block border-[3px] border-black bg-[#ff5fb7] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Error
        </p>
        <h2 className="text-3xl font-black">Something went wrong</h2>
        <p className="mt-4 font-bold text-red-700">{state.message}</p>
        <button
          className="brutal-button mt-6 px-5 py-3 font-black"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="brutal-card bg-[#fff7e6] p-6">
      <p className="mb-4 inline-block border-[3px] border-black bg-[#7dff7a] px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
        First time?
      </p>
      <h2 className="text-3xl font-black">Enter display name</h2>
      <p className="mt-4 font-bold">
        This name will be linked to your device for voting and bill splitting in
        the group.
      </p>

      <form action={submitUsername} className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block font-black uppercase">Your name</span>
          <input
            name="username"
            required
            minLength={1}
            maxLength={80}
            placeholder="Example: Alex / Sam / Jordan"
            className="brutal-input w-full px-4 py-3 text-lg font-bold"
          />
        </label>
        <button
          disabled={isPending}
          className="brutal-button w-full px-5 py-3 text-lg font-black disabled:opacity-60"
        >
          {isPending ? "Creating session..." : "Go vote now"}
        </button>
      </form>
    </section>
  );
}
