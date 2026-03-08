const painPoints = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    text: "Broker emails scattered across multiple inboxes",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    text: "PDFs and financials living in different folders and drives",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    text: "Valuation assumptions constantly changing with no audit trail",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: "Missing questions and follow-ups that slip through the cracks",
  },
];

export default function ProblemSection() {
  return (
    <section className="py-24 px-6 bg-slate-50" id="features">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4 text-center">
          The Problem
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          Evaluating acquisition deals is messy
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-14 text-base leading-relaxed">
          Most entrepreneurs are juggling spreadsheets, email threads, and cloud folders — losing time and missing critical details.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {painPoints.map((point, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl bg-white border border-slate-100 p-6 shadow-sm"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-500">
                {point.icon}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed font-medium pt-2">
                {point.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
