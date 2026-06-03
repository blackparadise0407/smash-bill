import EventsDashboard from "@/components/EventsDashboard";

export default function VotePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-8">
      <header className="brutal-card mb-8 bg-[#ff5fb7] p-6">
        <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Smash Bill
        </p>
        <a
          className="mt-5 inline-block border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
          href="/events"
        >
          Admin tạo event
        </a>
      </header>

      <EventsDashboard />
    </main>
  );
}
