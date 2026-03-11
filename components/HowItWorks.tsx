const steps = [
  {
    number: "01",
    title: "Add the deal",
    description:
      "Paste a listing or fill in the key numbers. AI extracts facts automatically so you start with a scored deal, not a blank page.",
  },
  {
    number: "02",
    title: "Build the evidence",
    description:
      "Upload the CIM, financials, photos, and notes. Every file is processed, facts are updated, and the timeline grows as you dig in.",
  },
  {
    number: "03",
    title: "Make the call",
    description:
      "Review the score, triage verdict, risks, and strengths. Confirm the facts, ask the right broker questions, and decide with confidence.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-white" id="how-it-works">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-semibold uppercase tracking-widest text-[#1F7A63] mb-4 text-center">
          How it works
        </p>

        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4 tracking-tight">
          From first listing to final decision
        </h2>
        <p className="text-slate-500 text-center max-w-xl mx-auto mb-16 text-base leading-relaxed">
          Three steps to go from a scattered inbox to a structured, scored, decision-ready deal.
        </p>

        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-[#A3DFD0]" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-4">
                {/* Step bubble */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-white border-2 border-[#A3DFD0] shadow-sm">
                  <span className="text-2xl font-extrabold text-[#1F7A63]">{step.number}</span>
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
