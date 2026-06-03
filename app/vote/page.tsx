import EventsDashboard from "@/components/EventsDashboard";

export default function VotePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 md:px-8">
      <header className="brutal-card mb-8 bg-[#ff5fb7] p-6">
        <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Events MVP
        </p>
        <h1 className="text-5xl font-black leading-none md:text-6xl">
          Vote lịch cầu lông
        </h1>
      </header>

      <EventsDashboard />
    </main>
  );
}
