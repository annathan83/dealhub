const CHECKLIST_ITEMS = [
  "Revenue and SDE review",
  "Valuation logic",
  "Missing information",
  "Broker questions",
  "Risk flags",
];

export default function InitialAssessmentCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50">
          <svg
            className="w-5 h-5 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Initial Assessment
          </h3>
          <span className="text-xs text-indigo-500 font-medium">Coming in next version</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-500 leading-relaxed">
        AI-powered deal triage will appear here in the next version. This section will summarize the opportunity, highlight missing information, identify red flags, and suggest broker follow-up questions.
      </p>

      {/* Checklist */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Analysis areas
        </p>
        <ul className="flex flex-col gap-2">
          {CHECKLIST_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-4 h-4 rounded border border-slate-200 bg-slate-50" />
              <span className="text-sm text-slate-500">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA hint */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
        <p className="text-xs text-indigo-600 leading-relaxed">
          Add sources and notes on the left to build context for the AI analysis.
        </p>
      </div>
    </div>
  );
}
