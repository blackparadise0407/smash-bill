import IdentityGate from "@/components/IdentityGate";

export default function HomePage() {
  return (
    <main className="mx-auto flex justify-center min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <IdentityGate />
    </main>
  );
}
