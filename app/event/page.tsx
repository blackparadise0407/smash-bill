import { redirect } from "next/navigation";
import AdminEventsCreator from "@/components/AdminEventsCreator";
import { getAuthenticatedDevice } from "@/lib/auth/session";

export default async function EventsAdminPage() {
  const device = await getAuthenticatedDevice();

  if (!device?.is_admin) {
    redirect("/vote");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
      <header className="brutal-card mb-8 bg-[#ff5fb7] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
              Admin events
            </p>
            <h1 className="text-5xl font-black leading-none md:text-6xl">
              Create badminton events
            </h1>
          </div>
          <a
            className="border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
            href="/vote"
          >
            Voting page
          </a>
        </div>
        <p className="mt-4 max-w-3xl text-lg font-bold">
          Admin page for creating new events through the existing API, then
          opening voting or billing for each event.
        </p>
      </header>

      <AdminEventsCreator />
    </main>
  );
}
