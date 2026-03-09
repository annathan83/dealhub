"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";

const CATEGORIES = [
  { value: "bug",     label: "Bug",         icon: "🐛" },
  { value: "feature", label: "Idea",         icon: "💡" },
  { value: "ux",      label: "UX / Design",  icon: "🎨" },
  { value: "other",   label: "Other",        icon: "💬" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

type State = "idle" | "open" | "submitting" | "success" | "error";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>("other");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close on outside click
  useEffect(() => {
    if (state !== "open") return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setState("idle");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [state]);

  // Close on Escape
  useEffect(() => {
    if (state !== "open") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setState("idle");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (state === "open") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [state]);

  function open() {
    setRating(null);
    setHoverRating(null);
    setCategory("other");
    setMessage("");
    setErrorMsg(null);
    setState("open");
  }

  function handleSubmit() {
    if (!message.trim()) {
      setErrorMsg("Please write a message before submitting.");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      setState("submitting");
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.trim(),
            rating,
            category,
            page_path: pathname,
            page_context: deriveContext(pathname),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to submit");
        }
        setState("success");
        setTimeout(() => setState("idle"), 3000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
        setState("open");
      }
    });
  }

  const displayRating = hoverRating ?? rating;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {(state === "open" || state === "submitting") && (
        <div
          ref={panelRef}
          className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-sm font-semibold text-white">Share Feedback</span>
            </div>
            <button
              onClick={() => setState("idle")}
              className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Star rating */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">How is your experience so far?</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    disabled={state === "submitting"}
                    className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                    aria-label={`${star} star`}
                  >
                    <svg
                      className={`w-7 h-7 transition-colors ${
                        displayRating !== null && star <= displayRating
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-200 fill-slate-200"
                      }`}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                ))}
                {rating !== null && (
                  <span className="ml-1 text-xs text-slate-400">
                    {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Category chips */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">What type of feedback?</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    disabled={state === "submitting"}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                      category === c.value
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <textarea
                ref={textareaRef}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={state === "submitting"}
                placeholder="Tell us what's on your mind — bugs, ideas, anything…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none disabled:opacity-60"
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[10px] tabular-nums ${message.length > 1800 ? "text-amber-500" : "text-slate-300"}`}>
                  {message.length}/2000
                </span>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-xs text-red-500 -mt-2">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={state === "submitting" || isPending || !message.trim()}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {state === "submitting" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Sending…
                </>
              ) : (
                "Send Feedback"
              )}
            </button>

            <p className="text-[10px] text-slate-400 text-center -mt-2">
              Your feedback goes directly to the team.
            </p>
          </div>
        </div>
      )}

      {/* Success toast */}
      {state === "success" && (
        <div className="bg-emerald-600 text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">Thanks for your feedback!</span>
        </div>
      )}

      {/* Trigger button */}
      {state !== "success" && (
        <button
          onClick={state === "open" || state === "submitting" ? () => setState("idle") : open}
          className={`flex items-center gap-2 rounded-full shadow-lg transition-all duration-200 font-medium text-sm ${
            state === "open" || state === "submitting"
              ? "bg-slate-700 text-white pl-3 pr-4 py-2.5 hover:bg-slate-800"
              : "bg-indigo-600 text-white pl-3 pr-4 py-2.5 hover:bg-indigo-700 hover:shadow-xl hover:scale-105"
          }`}
          aria-label="Give feedback"
        >
          {state === "open" || state === "submitting" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
          {state === "open" || state === "submitting" ? "Close" : "Feedback"}
        </button>
      )}
    </div>
  );
}

function deriveContext(path: string): string {
  if (path === "/dashboard") return "dashboard";
  if (path.startsWith("/deals/new")) return "create_deal";
  if (path.startsWith("/deals/")) return "deal_detail";
  if (path.startsWith("/settings")) return "settings";
  if (path === "/signin" || path === "/signup") return "auth";
  return "other";
}
