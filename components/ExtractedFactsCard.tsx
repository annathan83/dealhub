import type { ExtractedFacts } from "@/types";

const FACT_LABELS: { key: keyof ExtractedFacts; label: string }[] = [
  { key: "business_name", label: "Business Name" },
  { key: "asking_price", label: "Asking Price" },
  { key: "revenue", label: "Revenue" },
  { key: "sde", label: "SDE" },
  { key: "ebitda", label: "EBITDA" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location" },
  { key: "employees", label: "Employees" },
  { key: "rent", label: "Rent" },
  { key: "lease_term", label: "Lease Term" },
  { key: "ff_and_e", label: "FF&E" },
  { key: "inventory", label: "Inventory" },
];

export default function ExtractedFactsCard({
  facts,
}: {
  facts: ExtractedFacts;
}) {
  const scalarFacts = FACT_LABELS.filter(({ key }) => facts[key] !== null);
  const hasFacts =
    scalarFacts.length > 0 ||
    facts.growth_claims.length > 0 ||
    facts.other_key_facts.length > 0;

  if (!hasFacts) {
    return (
      <p className="text-xs text-slate-400 italic">
        No structured facts extracted yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Scalar facts grid */}
      {scalarFacts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {scalarFacts.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="text-sm font-medium text-slate-800">
                {facts[key] as string}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Growth claims */}
      {facts.growth_claims.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">
            Growth Claims
          </p>
          <ul className="flex flex-col gap-1">
            {facts.growth_claims.map((claim, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-1 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                {claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Other key facts */}
      {facts.other_key_facts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">
            Other Key Facts
          </p>
          <ul className="flex flex-col gap-1">
            {facts.other_key_facts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-1 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
