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
    headline: "Collect Evidence",
    description:
      "Drop in files, paste broker emails, add photos, and record audio. Everything lands in one deal workspace with an automatic timeline — so you always know what you have and when it arrived.",
    bullets: [
      "Capture files, notes, photos, and audio in one place",
      "Automatic activity timeline built as you add evidence",
      "Useful as a standalone deal workspace, even without AI",
    ],
  },
  {
    tab: "Facts",
    color: "bg-[#1F7A63]",
    textColor: "text-white",
    accentBg: "bg-[#F0FAF7]",
    accentBorder: "border-[#A3DFD0]",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    headline: "Extract Facts",
    description:
      "Revenue, SDE, employees, lease terms, customer concentration — AI pulls key numbers from your documents and links each fact back to its source. Review, confirm, or override before they go into scoring.",
    bullets: [
      "Key facts extracted automatically from uploaded documents",
      "Every fact linked to its source evidence",
      "Fully editable — review, confirm, or override any value",
    ],
  },
  {
    tab: "Analysis",
    color: "bg-slate-700",
    textColor: "text-white",
    accentBg: "bg-slate-50",
    accentBorder: "border-slate-200",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    headline: "Analyze the Deal",
    description:
      "Get a deal score, a triage verdict, and a breakdown of risks and strengths — all grounded in the facts you've collected. Track how the score changes as new information arrives.",
    bullets: [
      "Deal scorecard with verdict and score history",
      "AI-identified risks, strengths, and broker questions",
      "Export your deal package to any AI tool you prefer",
    ],
  },
];

export default function SolutionSection() {
  return (
    <section className="py-24 px-6 bg-white" id="pillars">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-semibold uppercase tracking-widest text-[#1F7A63] mb-4 text-center">
          How DealHub works
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          Three steps. One workspace.
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-14 text-base leading-relaxed">
          Collect the evidence, extract the facts, and analyze the deal — all in one place, with a clear record of where every number came from.
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
                      <svg className="w-4 h-4 text-[#1F7A63] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
