const aiTools = [
  { name: "ChatGPT", color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
  { name: "Claude", color: "bg-orange-50 border-orange-100 text-orange-700" },
  { name: "NotebookLM", color: "bg-blue-50 border-blue-100 text-blue-700" },
  { name: "Your workflow", color: "bg-slate-50 border-slate-200 text-slate-600" },
];

const controlPoints = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    text: "Keep control of your data and process",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    text: "Use built-in analysis when it helps",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    text: "Bring your deal to any external AI tool",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: "Get value even without automated scoring",
  },
];

export default function OwnAiSection() {
  return (
    <section className="py-24 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left: copy */}
          <div className="flex-1 max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1F7A63] mb-4">
              Open by design
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-5 tracking-tight leading-tight">
              Use DealHub with any AI,{" "}
              <span className="text-[#1F7A63]">not just ours</span>
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-8">
              DealHub organizes the messy part of deal evaluation first. Once your files, notes, facts, and timeline are in one place, you can use our built-in analysis — or bring the deal into ChatGPT, Claude, NotebookLM, or your preferred workflow.
            </p>

            <ul className="space-y-4">
              {controlPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm">
                    {point.icon}
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-snug pt-2">{point.text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: export concept */}
          <div className="flex-1 w-full max-w-sm mx-auto lg:mx-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100/80 overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#1F7A63] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Export for AI</p>
                    <p className="text-xs text-slate-400">Metro HVAC Services</p>
                  </div>
                </div>
              </div>

              {/* Export contents */}
              <div className="px-5 py-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">What&apos;s included</p>
                {[
                  { label: "3 source documents", detail: "CIM, P&L, broker email", icon: "📄" },
                  { label: "14 extracted facts", detail: "Revenue, SDE, employees…", icon: "🔍" },
                  { label: "Activity timeline", detail: "12 events, last 14 days", icon: "📋" },
                  { label: "Deal summary", detail: "AI-generated overview", icon: "✨" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3.5 py-2.5">
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                      <p className="text-[11px] text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI tool chips */}
              <div className="px-5 pb-5">
                <p className="text-xs text-slate-400 mb-2.5">Use with</p>
                <div className="flex flex-wrap gap-2">
                  {aiTools.map((tool) => (
                    <span
                      key={tool.name}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tool.color}`}
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
