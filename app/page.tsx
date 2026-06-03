import IdentityGate from '@/components/IdentityGate'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="brutal-card rotate-[-1deg] px-4 py-3">
          <p className="text-sm font-black uppercase tracking-[0.25em]">Smash Bill</p>
        </div>
        <div className="border-[3px] border-black bg-[#5dc9ff] px-4 py-2 font-black shadow-[5px_5px_0_#111]">
          1 LINK · NO PASSWORD
        </div>
      </header>

      <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="brutal-card bg-[#ff5fb7] p-6 md:p-10">
          <p className="mb-4 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
            Internal Voting MVP
          </p>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Vote lịch cầu lông. Chia bill gọn.
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-bold leading-relaxed">
            Next.js cân frontend/backend, Neon Postgres giữ dữ liệu, session bằng fingerprint + UUID + JWT HttpOnly Cookie.
          </p>
          <div className="mt-8 grid gap-3 text-base font-black md:grid-cols-3">
            <div className="border-[3px] border-black bg-[#7dff7a] p-3 shadow-[4px_4px_0_#111]">Fingerprint</div>
            <div className="border-[3px] border-black bg-[#5dc9ff] p-3 shadow-[4px_4px_0_#111]">Device UUID</div>
            <div className="border-[3px] border-black bg-[#ff9f1c] p-3 shadow-[4px_4px_0_#111]">Neon DB</div>
          </div>
        </div>

        <IdentityGate />
      </section>
    </main>
  )
}
