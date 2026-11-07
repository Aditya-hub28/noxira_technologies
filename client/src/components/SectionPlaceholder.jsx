import React from 'react';

// Layout-only shells. No claims, external submissions or invented business data.
export default function SectionPlaceholder({ id, title, slots = 1, action }) {
  return (
    <section id={id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">Section placeholder</span>
        <h2 id={`${id}-title`} className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      </div>
      <div className={`grid gap-5 ${slots > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {Array.from({ length: slots }, (_, index) => (
          <div key={index} className="min-h-36 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-xs text-slate-500">Content pending</span>
            {action && <button type="button" disabled title="Layout placeholder only. This feature is not available." className="rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed">{action}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
