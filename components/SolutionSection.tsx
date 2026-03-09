const pillars = [
  {
    tab: "Workspace",
    color: "bg-slate-800",
    textColor: "text-white",
    accentBg: "bg-slate-50",
    accentBorder: "border-slate-200",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    headline: "Your deal folder, organized",
    description:
      "Upload files, paste notes, add photos, and record audio. DealHub keeps everything in one place and builds a timeline of what happened — useful even if you never touch the AI features.",
    bullets: [
      "Files, notes, photos, and audio in one place",
      "Automatic activity timeline",
      "Works as a standalone deal workspace",
    ],
  },
  {
    tab: "Facts",
    color: "bg-indigo-600",
    textColor: "text-white",
    accentBg: "bg-indigo-50",
    accentBorder: "border-indigo-100",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    headline: "Structured deal knowledge",
    description:
      "Key facts — revenue, SDE, employees, lease terms, customer concentration — are extracted from your documents and linked back to their source. No more hunting for where a number came from.",
    bullets: [
      "Facts extracted from documents",
      "Each fact linked to evidence",
      "Editable with manual override",
    ],
  },
  {
    tab: "Analysis",
    color: "bg-violet-600",
    textColor: "text-white",
    accentBg: "bg-violet-50",
    accentBorder: "border-violet-100",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    headline: "AI interpretation, on your terms",
    description:
      "Score the deal, review risks, strengths, and broker questions. Track how the score changes as new information arrives. Or skip our AI entirely and export your organized deal to ChatGPT, Claude, or any tool you prefer.",
    bullets: [
      "Deal scorecard with score history",
      "AI-generated risks and strengths",
      "Export your deal for any AI tool",
    ],
  },
];

export default function SolutionSection() {
  return (
    <section className="py-24 px-6 bg-white" id="pillars">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4 text-center">
          How DealHub works
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          Three layers. One workspace.
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-14 text-base leading-relaxed">
          DealHub separates raw information, structured facts, and AI analysis so you always know what you have and where it came from.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((pillar) => (
            <div
              key={pillar.tab}
              className={`flex flex-col rounded-2xl border ${pillar.accentBorder} ${pillar.accentBg} overflow-hidden`}
            >
              {/* Tab label */}
              <div className={`flex items-center gap-3 px-5 py-4 ${pillar.color}`}>
                <div className="text-white opacity-90">{pillar.icon}</div>
                <span className={`text-sm font-bold tracking-wide ${pillar.textColor}`}>{pillar.tab}</span>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 px-5 py-5 gap-3">
                <h3 className="text-base font-semibold text-slate-900">{pillar.headline}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{pillar.description}</p>

                <ul className="mt-auto space-y-2 pt-3">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
