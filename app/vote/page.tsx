import EventsDashboard from "@/components/EventsDashboard";
import { getAuthenticatedDevice } from "@/lib/auth/session";

export default async function VotePage() {
  const device = await getAuthenticatedDevice();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-8">
      {device?.is_admin ? (
        <a
          className="mb-5 block w-fit border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
          href="/event"
        >
          Admin event creation
        </a>
      ) : null}

      <EventsDashboard device={device} />
    </main>
  );
}
