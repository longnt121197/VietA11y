export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16 sm:px-10">
      <section aria-labelledby="page-title" className="w-full">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
          Vietnamese Web Accessibility Scanner
        </p>
        <h1
          id="page-title"
          className="text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl"
        >
          VietA11y
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
          VietA11y helps developers identify automated accessibility issues and
          understand selected findings through clear guidance in Vietnamese.
        </p>

        <aside
          aria-label="Project status"
          className="mt-10 border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-amber-950"
        >
          <p>
            <strong>Early development:</strong> VietA11y is currently under active
            development.
          </p>
        </aside>
      </section>
    </main>
  );
}
