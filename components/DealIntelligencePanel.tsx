import type {
  DealSourceAnalysis,
  DealChangeLogItem,
  ExtractedFacts,
} from "@/types";
import ExtractedFactsCard from "./ExtractedFactsCard";
import ChangeLogList from "./ChangeLogList";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400 italic">None identified.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// Merge extracted facts from all analyses — later analyses override earlier ones
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
}: {
  analyses: DealSourceAnalysis[];
  changeLog: DealChangeLogItem[];
}) {
  const hasData = analyses.length > 0;
  const latest = analyses[0] ?? null;

  const allRedFlags = [...new Set(analyses.flatMap((a) => a.red_flags ?? []))];
  const allMissing = [...new Set(analyses.flatMap((a) => a.missing_information ?? []))];
  const allQuestions = [...new Set(analyses.flatMap((a) => a.broker_questions ?? []))];
  const mergedFacts = mergeExtractedFacts(analyses);

  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Deal Intelligence</h3>
          {hasData && (
            <p className="text-xs text-slate-400">
              {analyses.length} entr{analyses.length === 1 ? "y" : "ies"} analyzed
            </p>
          )}
        </div>
      </div>

      {!hasData && changeLog.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-400 leading-relaxed">
            Add an entry or upload a file to generate the first AI assessment.
          </p>
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-5">
          {/* Latest summary */}
          {hasData && latest?.summary && (
            <Section title="Latest Analysis">
              <p className="text-sm text-slate-600 leading-relaxed">
                {latest.summary}
              </p>
            </Section>
          )}

          {/* Extracted facts */}
          {hasData && (
            <>
              <Section title="Extracted Facts">
                <ExtractedFactsCard facts={mergedFacts} />
              </Section>

              <Section title="Red Flags">
                <StringList items={allRedFlags} />
              </Section>

              <Section title="Missing Information">
                <StringList items={allMissing} />
              </Section>

              <Section title="Suggested Broker Questions">
                <StringList items={allQuestions} />
              </Section>
            </>
          )}

          {/* Change log — always show when there are items */}
          <Section title="Change Log">
            <ChangeLogList items={changeLog} />
          </Section>
        </div>
      )}
    </div>
  );
}
