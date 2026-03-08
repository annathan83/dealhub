import Link from "next/link";

export default function Hero() {
  return (
    <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase">
            Built for acquisition entrepreneurs
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
          Organize and Analyze{" "}
          <span className="text-indigo-600">Business Acquisition</span>{" "}
          Deals in One Place
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
          DealHub helps acquisition entrepreneurs centralize listings, notes, documents, and AI-driven insights so they can evaluate deals faster and with more confidence.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            Create Account
          </Link>
          <Link
            href="/signin"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Social proof hint */}
        <p className="mt-8 text-sm text-slate-400">
          No credit card required &middot; Free to get started
        </p>
      </div>
    </section>
  );
}
