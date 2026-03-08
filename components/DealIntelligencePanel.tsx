import type {
  DealSourceAnalysis,
  DealChangeLogItem,
  DealInsight,
  ExtractedFacts,
} from "@/types";
import ExtractedFactsCard from "./ExtractedFactsCard";
import ChangeLogList from "./ChangeLogList";

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function StringList({ items, accent }: { items: string[]; accent?: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400 italic">None identified.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${accent ?? "bg-slate-300"}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function mergeExtractedFacts(analyses: DealSourceAnalysis[]): ExtractedFacts {
  const base: ExtractedFacts = {
    business_name: null,
    asking_price: null,
    revenue: null,
    sde: null,
    ebitda: null,
    industry: null,
    location: null,
    employees: null,
    rent: null,
    lease_term: null,
    ff_and_e: null,
    inventory: null,
    growth_claims: [],
    other_key_facts: [],
  };

  for (const a of analyses) {
    const f = a.extracted_facts;
    if (!f) continue;
    const scalarKeys = [
      "business_name", "asking_price", "revenue", "sde", "ebitda",
      "industry", "location", "employees", "rent", "lease_term",
      "ff_and_e", "inventory",
    ] as const;
    for (const key of scalarKeys) {
      if (f[key] !== null && f[key] !== undefined) {
        (base as Record<string, unknown>)[key] = f[key];
      }
    }
    if (Array.isArray(f.growth_claims)) {
      base.growth_claims = [...new Set([...base.growth_claims, ...f.growth_claims])];
    }
    if (Array.isArray(f.other_key_facts)) {
      base.other_key_facts = [...new Set([...base.other_key_facts, ...f.other_key_facts])];
    }
  }

  return base;
}

export default function DealIntelligencePanel({
  analyses,
  changeLog,
  // latestInsight is fetched but not yet rendered — Phase 3 will wire it to DealScorePanel
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  latestInsight: _latestInsight,
}: {
  analyses: DealSourceAnalysis[];
  changeLog: DealChangeLogItem[];
  latestInsight?: DealInsight | null;
}) {
  const hasData = analyses.length > 0;
  const latest = analyses[0] ?? null;

  const allRedFlags = [...new Set(analyses.flatMap((a) => a.red_flags ?? []))];
  const allMissing = [...new Set(analyses.flatMap((a) => a.missing_information ?? []))];
  const allQuestions = [...new Set(analyses.flatMap((a) => a.broker_questions ?? []))];
  const mergedFacts = mergeExtractedFacts(analyses);

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 shrink-0">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">AI Intelligence</h3>
          {hasData && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {analyses.length} entr{analyses.length === 1 ? "y" : "ies"} analyzed
            </p>
          )}
        </div>
      </div>

      {!hasData && changeLog.length === 0 ? (
        <div className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">No analysis yet</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[220px]">
            Add an entry or upload a file to generate the first AI assessment.
          </p>
        </div>
      ) : (
        <div className="px-5 py-5 flex flex-col gap-6">
          {/* Latest summary */}
          {hasData && latest?.summary && (
            <Section
              title="Latest Analysis"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            >
              <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2.5">
                <p className="text-xs text-slate-700 leading-relaxed">{latest.summary}</p>
              </div>
            </Section>
          )}

          {/* Extracted facts */}
          {hasData && (
            <>
              <Section
                title="Extracted Facts"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
              >
                <ExtractedFactsCard facts={mergedFacts} />
              </Section>

              {allRedFlags.length > 0 && (
                <Section
                  title="Red Flags"
                  icon={
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                >
                  <StringList items={allRedFlags} accent="bg-red-400" />
                </Section>
              )}

              {allMissing.length > 0 && (
                <Section
                  title="Missing Information"
                  icon={
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <StringList items={allMissing} accent="bg-amber-400" />
                </Section>
              )}

              {allQuestions.length > 0 && (
                <Section
                  title="Broker Questions"
                  icon={
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  }
                >
                  <StringList items={allQuestions} accent="bg-blue-400" />
                </Section>
              )}
            </>
          )}

          {/* Change log */}
          {changeLog.length > 0 && (
            <Section
              title="Change Log"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <ChangeLogList items={changeLog} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
