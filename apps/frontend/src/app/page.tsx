export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold">Admin Consorcios</h1>
      <p className="text-neutral-600">
        Sistema de administración de consorcios. El backend corre en{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">
          localhost:4000/api
        </code>{' '}
        y la documentación de la API en{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">
          localhost:4000/docs
        </code>
        .
      </p>
    </main>
  );
}
