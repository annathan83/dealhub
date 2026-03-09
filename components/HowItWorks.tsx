const steps = [
  {
    number: "01",
    title: "Add the deal",
    description:
      "Create a deal from a listing, broker email, or document. Give it a name and you have a workspace ready to fill.",
  },
  {
    number: "02",
    title: "Build the workspace",
    description:
      "Upload files, paste notes, add photos, and record audio. DealHub keeps the timeline and organizes the evidence automatically.",
  },
  {
    number: "03",
    title: "Turn information into decisions",
    description:
      "Review extracted facts, AI analysis, scoring, and risks — or export your organized deal package to any AI tool you prefer.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-white" id="how-it-works">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4 text-center">
          How it works
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          From first listing to final decision
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-16 text-base leading-relaxed">
          Three steps to go from scattered information to a structured, analyzable deal.
        </p>

        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-indigo-100" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-4">
                {/* Step bubble */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-white border-2 border-indigo-100 shadow-sm">
                  <span className="text-2xl font-extrabold text-indigo-600">{step.number}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
