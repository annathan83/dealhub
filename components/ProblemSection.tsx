const fragments = [
  {
    label: "Broker emails",
    where: "scattered across inboxes",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Financials and CIMs",
    where: "buried in Drive folders",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Notes and impressions",
    where: "in your phone or a notepad",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: "Photos and site visit images",
    where: "buried in your camera roll",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Call recordings",
    where: "somewhere in a voice app",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    label: "AI analysis",
    where: "copied into random threads",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export default function ProblemSection() {
  return (
    <section className="py-24 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-semibold uppercase tracking-widest text-[#1F7A63] mb-4 text-center">
          The problem
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          Acquisition deals become fragmented fast
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-14 text-base leading-relaxed">
          By the time you&apos;re deep in a deal, your information is spread across a dozen places. Nothing is connected. Nothing is traceable.
        </p>

        {/* Fragment grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {fragments.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 rounded-xl bg-white border border-slate-100 px-5 py-4 shadow-sm"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-400 mt-0.5">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-snug">{f.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{f.where}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resolution callout */}
        <div className="rounded-2xl bg-white border border-[#A3DFD0] px-8 py-7 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800 mb-1">
            DealHub gives you one structured place for the whole deal.
          </p>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Files, notes, photos, transcripts, facts, and analysis — all connected, all traceable, all in one workspace.
          </p>
        </div>

      </div>
    </section>
  );
}
