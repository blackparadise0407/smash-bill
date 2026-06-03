import AdminEventsCreator from '@/components/AdminEventsCreator'

export default function EventsAdminPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
      <header className="brutal-card mb-8 bg-[#ff5fb7] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
              Admin events
            </p>
            <h1 className="text-5xl font-black leading-none md:text-6xl">Tạo event cầu lông</h1>
          </div>
          <a
            className="border-[3px] border-black bg-[#7dff7a] px-4 py-3 font-black shadow-[5px_5px_0_#111]"
            href="/vote"
          >
            Trang vote
          </a>
        </div>
        <p className="mt-4 max-w-3xl text-lg font-bold">
          Trang dành cho admin tạo event mới qua API hiện có, sau đó mở vote hoặc billing cho từng event.
        </p>
      </header>

      <AdminEventsCreator />
    </main>
  )
}
