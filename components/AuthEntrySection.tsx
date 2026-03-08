import Link from "next/link";

export default function AuthEntrySection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-lg mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4">
          Get Started
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
          Ready to take control of your deal flow?
        </h2>
        <p className="text-slate-500 text-base leading-relaxed mb-10">
          Join acquisition entrepreneurs who use DealHub to evaluate deals with clarity and confidence.
        </p>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 shadow-sm">
          {/* New user */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-700 mb-1">New to DealHub?</p>
            <p className="text-sm text-slate-400 mb-4">
              Create a free account and start organizing your first deal today.
            </p>
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              Create Account — It&apos;s Free
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Existing user */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Already have an account?</p>
            <p className="text-sm text-slate-400 mb-4">
              Sign in to pick up where you left off.
            </p>
            <Link
              href="/signin"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
