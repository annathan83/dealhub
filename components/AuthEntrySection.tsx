import Link from "next/link";

export default function AuthEntrySection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-2xl mx-auto text-center">

        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4">
          Get started
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
          Run every deal from one place
        </h2>
        <p className="text-slate-500 text-base leading-relaxed mb-10 max-w-lg mx-auto">
          From first listing to final decision — keep your files, facts, history, and analysis together in a single structured workspace.
        </p>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 shadow-sm">

          {/* Primary CTA */}
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 mb-4"
          >
            Start your first deal — it&apos;s free
          </Link>

          <p className="text-xs text-slate-400 mb-6">No credit card required</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">already have an account?</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Link
            href="/signin"
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            Sign in
          </Link>
        </div>

      </div>
    </section>
  );
}
