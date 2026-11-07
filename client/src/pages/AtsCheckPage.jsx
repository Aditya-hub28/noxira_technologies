import React, { useMemo, useState } from 'react';
import { FileSearch, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { analyze, ROLE_KEYWORDS } from '../lib/atsAnalyzer';

/**
 * Honest ATS resume check.
 *
 * Every result below is a deterministic, explainable check computed locally
 * in the browser - the resume text never leaves the device. We deliberately
 * do NOT show a single "ATS score": real applicant tracking systems are
 * proprietary and differ per company, so any single number would be made up.
 */

function Verdict({ ok, warn, children }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const color = ok ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600';
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon className={`w-4.5 h-4.5 w-5 h-5 ${color} shrink-0 mt-0.5`} />
      <span className="text-slate-600 leading-relaxed">{children}</span>
    </li>
  );
}

export default function AtsCheckPage() {
  const [text, setText] = useState('');
  const [role, setRole] = useState('web developer');
  const result = useMemo(() => (text.trim().length >= 200 ? analyze(text, role) : null), [text, role]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="text-center mb-10 space-y-3">
        <div className="inline-flex items-center justify-center p-3 bg-ink-950 rounded-2xl shadow-md">
          <FileSearch className="w-7 h-7 text-cyan-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">Resume readiness check</h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Paste your resume below. We run transparent, explainable checks - the same things recruiters and parsing software commonly look for.
        </p>
      </div>

      <div className="flex items-start gap-2.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 mb-6">
        <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Honest by design: your text is analysed in your browser only - it is not sent to any server, stored, or logged anywhere. And we do not show a made-up "ATS score": real screening software differs per company, so these checks cover the commonly documented basics instead.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5" htmlFor="ats-role">Target role</label>
          <select id="ats-role" value={role} onChange={e => setRole(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-300 text-sm px-3.5 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
            {Object.keys(ROLE_KEYWORDS).map(r => <option key={r} value={r}>{r.replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5" htmlFor="ats-text">Resume text</label>
          <textarea id="ats-text" rows={12} value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste the full text of your resume here (Ctrl+A, Ctrl+C in your PDF viewer, then Ctrl+V)..."
            className="w-full rounded-xl border border-slate-300 text-sm px-3.5 py-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono" />
          <p className="text-[11px] text-slate-400 mt-1">{text.trim() ? `${text.trim().split(/\s+/).filter(Boolean).length} words` : 'Minimum 200 words for a meaningful check.'}</p>
        </div>
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mt-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-ink-950 mb-3">Structure</h2>
            <ul className="space-y-2.5">
              {result.sections.map(s => (
                <Verdict key={s.label} ok={s.ok}>{s.ok ? `${s.label} found.` : `${s.label} not detected - add a clearly labeled section.`}</Verdict>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-ink-950 mb-3">Content quality</h2>
            <ul className="space-y-2.5">
              <Verdict ok={result.bulletCount >= 5} warn={result.bulletCount > 0 && result.bulletCount < 5}>
                {result.bulletCount} bullet points detected. Recruiters scan bullets first - aim for 3-6 per role or project.
              </Verdict>
              <Verdict ok={result.numbers >= 3} warn={result.numbers > 0}>
                {result.numbers} numeric mentions detected. Numbers only help when tied to an outcome ("reduced load time 40%") - this check counts mentions, so read your bullets and make each number prove a result.
              </Verdict>
              <Verdict ok={result.foundVerbs.length >= 5} warn={result.foundVerbs.length > 0}>
                {result.foundVerbs.length} distinct action verbs present{result.foundVerbs.length > 0 ? ` (${result.foundVerbs.slice(0, 5).join(', ')}${result.foundVerbs.length > 5 ? ', ...' : ''})` : ''}. This checks presence anywhere in the text - for the full effect, start each bullet with one.
              </Verdict>
              <Verdict ok={result.weakWords.length === 0}>
                {result.weakWords.length === 0 ? 'No vague phrases detected.' : `Vague phrases found: "${result.weakWords.join('", "')}". Replace with what you specifically did and the outcome.`}
              </Verdict>
              <Verdict ok={result.longBullets === 0} warn={result.bulletCount > 0}>
                {result.longBullets === 0 ? 'All bullets are a scannable length.' : `${result.longBullets} bullet(s) run over 30 words - split or tighten them.`}
              </Verdict>
              <Verdict ok>
                {result.words} words total. For reference, one page (roughly 300-600 words) is the common expectation for students and freshers - this is guidance, not a pass/fail rule.
              </Verdict>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-bold text-ink-950 mb-3">Keywords for: {role.replace(/\b\w/g, c => c.toUpperCase())}</h2>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">Common terms for this role found in your resume. Only add ones that honestly describe your experience - keyword-stuffing is easy for humans to spot.</p>
            <div className="flex flex-wrap gap-1.5">
              {result.matchedKeys.map(k => (
                <span key={k} className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">{k}</span>
              ))}
              {result.missingKeys.map(k => (
                <span key={k} className="text-[11px] font-semibold bg-slate-50 text-slate-400 border border-slate-200 rounded-full px-2.5 py-1 line-through">{k}</span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{result.matchedKeys.length} of {result.matchedKeys.length + result.missingKeys.length} common terms present.</p>
          </div>
        </div>
      )}
    </div>
  );
}
