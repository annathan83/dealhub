const steps = [
  {
    number: "01",
    title: "Create a deal",
    description:
      "Start a new deal workspace in seconds. Give it a name, set a stage, and you're ready to go.",
  },
  {
    number: "02",
    title: "Add listing text, files, and notes",
    description:
      "Paste in listing copy, upload the CIM or financials, and jot down your initial impressions — all in one place.",
  },
  {
    number: "03",
    title: "Review analysis and next questions",
    description:
      "DealHub surfaces AI-driven insights, flags gaps in your diligence, and keeps your open questions front and center.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4 text-center">
          How It Works
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          From listing to decision in three steps
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-16 text-base leading-relaxed">
          DealHub is designed to get out of your way and let you focus on evaluating the deal.
        </p>

        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-indigo-100" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-4">
                {/* Step number bubble */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-white border-2 border-indigo-100 shadow-sm">
                  <span className="text-2xl font-extrabold text-indigo-600">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
