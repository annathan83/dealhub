const principles = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: "Evidence first",
    detail: "Every fact links back to the document it came from.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: "Facts before opinions",
    detail: "Structured data is separated from AI interpretation.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    label: "AI as assistant",
    detail: "You decide when to use AI and how much to trust it.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    label: "Useful without AI",
    detail: "The workspace delivers value on its own, no scoring required.",
  },
];

export default function TrustSection() {
  return (
    <section className="py-24 px-6 bg-slate-900">
      <div className="max-w-5xl mx-auto">

        <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-20">

          {/* Left: headline */}
          <div className="flex-1 max-w-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">
              Our philosophy
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 tracking-tight leading-tight">
              Built for serious buyers,{" "}
              <span className="text-indigo-400">not AI hype</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              DealHub does not ask you to blindly trust a black box. It gives you a clean workspace, transparent facts, evidence-backed deal knowledge, and optional AI support. You stay in control of your process.
            </p>
          </div>

          {/* Right: principles */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {principles.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 px-5 py-4"
              >
                <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 mt-0.5">
                  {p.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-snug">{p.label}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
