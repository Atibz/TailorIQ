import React from "react";

function GuidelineChecklist({ guidelineLabels, guidelines, poseMessage, poseStatus }) {
  const entries = Object.entries(guidelineLabels);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">Automatic checks</p>
          <p className="mt-1 text-xs text-stone-500">{poseMessage}</p>
        </div>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
          {entries.filter(([key]) => guidelines[key]).length}/{entries.length}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-amber-700">{poseStatus}</p>
      <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {entries.map(([key, label]) => (
          <div key={key} className="flex min-h-6 items-center gap-2 text-stone-700">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${guidelines[key] ? "bg-emerald-500" : "bg-stone-300"}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GuidelineChecklist;
