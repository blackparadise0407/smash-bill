import IdentityGate from "@/components/IdentityGate";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="brutal-card court-card bg-[#ff5fb7] p-6 md:p-8">
          <p className="shuttle-badge mb-4 inline-flex border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
            Badminton night
          </p>
          <h1 className="text-5xl font-black leading-none md:text-7xl">
            Split court fees after every rally.
          </h1>
          <p className="mt-5 max-w-xl text-lg font-bold">
            Pick your preferred court time, keep the squad vote transparent, and
            settle shuttle, court, and snack costs without post-match confusion.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-black uppercase sm:grid-cols-3">
            <span className="border-[3px] border-black bg-[#7dff7a] px-3 py-2 shadow-[3px_3px_0_#111]">
              Vote slots
            </span>
            <span className="border-[3px] border-black bg-[#5dc9ff] px-3 py-2 shadow-[3px_3px_0_#111]">
              Track players
            </span>
            <span className="border-[3px] border-black bg-[#ff9f1c] px-3 py-2 shadow-[3px_3px_0_#111]">
              Clear bills
            </span>
          </div>
        </div>
        <IdentityGate />
      </section>
    </main>
  );
}
