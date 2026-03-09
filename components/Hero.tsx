import Link from "next/link";

// ─── Product mockup: 3-tab workspace visual ───────────────────────────────────

function ProductMockup() {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">

      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <span className="w-3 h-3 rounded-full bg-slate-200" />
        <span className="w-3 h-3 rounded-full bg-slate-200" />
        <span className="w-3 h-3 rounded-full bg-slate-200" />
        <div className="flex-1 mx-3">
          <div className="h-5 rounded-md bg-slate-100 w-48" />
        </div>
      </div>

      {/* Deal header strip */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <div className="h-4 w-44 bg-slate-800 rounded-md mb-1.5" />
          <div className="h-3 w-28 bg-slate-200 rounded" />
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-1 py-1">
          <span className="rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-3 py-1">Active</span>
          <span className="text-[10px] font-medium text-slate-400 px-3 py-1">Closed</span>
          <span className="text-[10px] font-medium text-slate-400 px-3 py-1">Passed</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-white">
        {[
          { label: "Workspace", active: true },
          { label: "Facts", badge: "3" },
          { label: "Analysis", badge: "72" },
        ].map((tab) => (
          <div
            key={tab.label}
            className={`flex-1 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-1.5 ${
              tab.active
                ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                : "text-slate-400"
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                tab.label === "Facts" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
              }`}>
                {tab.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Workspace tab content */}
      <div className="px-4 py-4 space-y-4">

        {/* Quick-add buttons */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Note", color: "bg-slate-50 border-slate-200 text-slate-600" },
            { label: "File", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
            { label: "Photo", color: "bg-slate-50 border-slate-200 text-slate-600" },
            { label: "Audio", color: "bg-slate-50 border-slate-200 text-slate-600" },
          ].map((btn) => (
            <div key={btn.label} className={`rounded-xl border py-2.5 text-center text-xs font-semibold ${btn.color}`}>
              {btn.label}
            </div>
          ))}
        </div>

        {/* File explorer */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-xs font-semibold text-slate-600 flex-1">Metro HVAC Services</span>
            <span className="text-[10px] text-slate-400">3 files</span>
          </div>
          {[
            { name: "CIM_MetroHVAC.pdf", kind: "PDF", time: "2d ago", dot: "bg-emerald-400" },
            { name: "P&L_2023_2024.xlsx", kind: "Spreadsheet", time: "2d ago", dot: "bg-emerald-400" },
            { name: "Broker Email Mar 8.txt", kind: "Note", time: "1d ago", dot: "bg-amber-400 animate-pulse" },
          ].map((file) => (
            <div key={file.name} className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${file.dot}`} />
              <span className="text-xs font-mono font-semibold text-slate-700 flex-1 truncate">{file.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{file.time}</span>
            </div>
          ))}
        </div>

        {/* Timeline preview */}
        <div className="space-y-0">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activity</p>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          {[
            { icon: "bg-red-50 text-red-500", label: "PDF uploaded", sub: "CIM processed, 8 facts extracted.", time: "2d ago" },
            { icon: "bg-emerald-50 text-emerald-600", label: "Document analyzed", sub: "Spreadsheet uploaded, text extracted.", time: "2d ago" },
            { icon: "bg-indigo-50 text-indigo-600", label: "Deal created", sub: "Metro HVAC Services added to pipeline.", time: "3d ago", anchor: true },
          ].map((event, i) => (
            <div key={i} className="flex gap-0">
              <div className="flex flex-col items-center" style={{ width: 24, minWidth: 24 }}>
                <div style={{ width: 1.5, height: 8, background: i === 0 ? "transparent" : "#cbd5e1" }} />
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ring-2 shadow-[0_0_0_2px_white] z-10 ${event.anchor ? "bg-indigo-600 ring-indigo-300" : `${event.icon} ring-slate-200`}`}>
                  {event.anchor ? (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                {i < 2 && <div className="flex-1 min-h-[10px]" style={{ width: 1.5, background: "#cbd5e1" }} />}
              </div>
              <div className="flex-1 min-w-0 pl-2.5 pb-2.5" style={{ paddingTop: 3 }}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 leading-snug">{event.label}</p>
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{event.time}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-1">{event.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export default function Hero() {
  return (
    <section className="pt-28 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto">

        {/* Two-column layout on large screens */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left max-w-xl mx-auto lg:mx-0">

            {/* Label */}
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700 tracking-wide">
                Built for acquisition buyers
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-5">
              The workspace for{" "}
              <span className="text-indigo-600">acquisition deals</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              Store files, organize evidence, track what happened, and analyze deals with our AI — or your own.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
              >
                Start a deal
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                See how it works
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>

            <p className="mt-5 text-sm text-slate-400 text-center lg:text-left">
              Free to start &middot; No credit card required
            </p>
          </div>

          {/* Right: product mockup */}
          <div className="flex-1 w-full max-w-lg lg:max-w-none">
            <ProductMockup />
          </div>

        </div>
      </div>
    </section>
  );
}
