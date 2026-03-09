"use client";

import type { AnalysisSnapshot } from "@/types/entity";

type Props = {
  snapshots: AnalysisSnapshot[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SnapshotCard({ snapshot }: { snapshot: AnalysisSnapshot }) {
  const content = snapshot.content_json;

  const score = typeof content.score === "number" ? content.score : null;
  const verdict = typeof content.verdict === "string" ? content.verdict : null;
  const summary = typeof content.summary === "string" ? content.summary : null;
  const riskFlags = Array.isArray(content.risk_flags) ? content.risk_flags as string[] : [];
  const missingInfo = Array.isArray(content.missing_information) ? content.missing_information as string[] : [];
  const questions = Array.isArray(content.broker_questions) ? content.broker_questions as string[] : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          {score !== null && (
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
              ${score >= 70 ? "bg-emerald-100 text-emerald-700" :
                score >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"}
            `}>
              {score}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {snapshot.title ?? "AI Analysis"}
            </div>
            <div className="text-xs text-slate-400">{formatDate(snapshot.created_at)}</div>
          </div>
        </div>
        {verdict && (
          <span className={`
            px-2.5 py-1 text-xs font-semibold rounded-full
            ${verdict === "strong_buy" || verdict === "buy" ? "bg-emerald-100 text-emerald-700" :
              verdict === "hold" ? "bg-amber-100 text-amber-700" :
              verdict === "pass" ? "bg-red-100 text-red-700" :
              "bg-slate-100 text-slate-600"}
          `}>
            {verdict.replace(/_/g, " ").toUpperCase()}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {summary && (
          <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
        )}

        {riskFlags.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1.5">
              Risk Flags
            </div>
            <ul className="space-y-1">
              {riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {missingInfo.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
              Missing Information
            </div>
            <ul className="space-y-1">
              {missingInfo.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {questions.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">
              Suggested Questions
            </div>
            <ul className="space-y-1">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-indigo-400 shrink-0 font-bold">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {snapshot.model_name && (
        <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
          Model: {snapshot.model_name}
          {snapshot.prompt_version && ` · Prompt: ${snapshot.prompt_version}`}
        </div>
      )}
    </div>
  );
}

export default function AIAnalysisTab({ snapshots }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No AI analysis yet</p>
        <p className="text-slate-400 text-xs mt-1">
          Upload documents or paste text to trigger automatic analysis.
        </p>
      </div>
    );
  }

  // Group by analysis type
  const byType = new Map<string, AnalysisSnapshot[]>();
  for (const snap of snapshots) {
    const list = byType.get(snap.analysis_type) ?? [];
    list.push(snap);
    byType.set(snap.analysis_type, list);
  }

  // Show latest of each type
  const latestByType = Array.from(byType.entries()).map(([, snaps]) => snaps[0]);

  return (
    <div className="space-y-4">
      {latestByType.map((snap) => (
        <SnapshotCard key={snap.id} snapshot={snap} />
      ))}

      {snapshots.length > latestByType.length && (
        <p className="text-xs text-slate-400 text-center">
          Showing latest analysis per type. {snapshots.length} total snapshots.
        </p>
      )}
    </div>
  );
}
