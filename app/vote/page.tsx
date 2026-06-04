import EventsDashboard from "@/components/EventsDashboard";
import { getAuthenticatedDevice } from "@/lib/auth/session";

export default async function VotePage() {
  const device = await getAuthenticatedDevice();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-8">
      <header className="brutal-card court-card mb-8 flex flex-wrap items-start justify-between gap-5 bg-[#ff5fb7] p-6">
        <p className="shuttle-badge mb-3 inline-flex border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Smash Bill
        </p>
        <div className="max-w-xl">
          <h1 className="text-4xl font-black leading-none md:text-6xl">
            Vote your court time
          </h1>
          <p className="mt-3 text-lg font-bold">
            Tap a slot like a quick smash: green means you are in, blue is still open.
          </p>
        </div>

        {device?.is_admin ? (
          <a
            className="block w-fit border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
            href="/event"
          >
            Admin event creation
          </a>
        ) : null}
      </header>

      <EventsDashboard device={device} />
    </main>
  );
}
