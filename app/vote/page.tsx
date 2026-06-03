import EventsDashboard from "@/components/EventsDashboard";
import { getAuthenticatedDevice } from "@/lib/auth/session";

export default async function VotePage() {
  const device = await getAuthenticatedDevice();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-8">
      <header className="brutal-card mb-8 bg-[#ff5fb7] p-6">
        <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Smash Bill
        </p>
        {device?.is_admin ? (
          <a
            className="mt-5 block w-fit border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
            href="/event"
          >
            Admin tạo event
          </a>
        ) : null}
      </header>

      <EventsDashboard />
    </main>
  );
}
