import IdentityGate from "@/components/IdentityGate";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <header className="mb-8">
        <div className="brutal-card rotate-[-1deg] px-4 py-3">
          <p className="text-sm font-black uppercase tracking-[0.25em]">
            Smash Bill
          </p>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <IdentityGate />
      </section>
    </main>
  );
}
