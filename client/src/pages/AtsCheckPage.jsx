import React, { useMemo, useState } from 'react';
import { FileSearch, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

/**
 * Honest ATS resume check.
 *
 * Every result below is a deterministic, explainable check computed locally
 * in the browser - the resume text never leaves the device. We deliberately
 * do NOT show a single "ATS score": real applicant tracking systems are
 * proprietary and differ per company, so any single number would be made up.
 */

const ACTION_VERBS = ['built', 'developed', 'designed', 'implemented', 'led', 'created', 'improved', 'automated', 'launched', 'optimized', 'reduced', 'increased', 'managed', 'delivered', 'engineered', 'analyzed', 'tested', 'deployed', 'migrated', 'mentored'];
const SECTION_PATTERNS = [
  { key: 'contact', label: 'Contact details', test: t => /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) && /(\+?\d[\d\s-]{8,}\d)/.test(t) },
  { key: 'education', label: 'Education section', test: t => /\beducation\b|\bdegree\b|\bb\.?\s?tech\b|\bbachelor|\bmaster|\buniversity\b|\bcollege\b/i.test(t) },
  { key: 'experience', label: 'Experience / internships section', test: t => /\bexperience\b|\bintern(ship)?\b|\bworked\b|\bemployment\b/i.test(t) },
  { key: 'skills', label: 'Skills section', test: t => /\bskills?\b|\btechnologies\b|\btech stack\b/i.test(t) },
  { key: 'projects', label: 'Projects section', test: t => /\bprojects?\b|\bportfolio\b|\bgithub\b/i.test(t) },
];

const ROLE_KEYWORDS = {
  'web developer': ['html', 'css', 'javascript', 'react', 'node', 'api', 'responsive', 'git', 'frontend', 'backend'],
  'data analyst': ['sql', 'excel', 'python', 'pandas', 'dashboard', 'visualization', 'statistics', 'power bi', 'tableau', 'analysis'],
  'python developer': ['python', 'django', 'flask', 'api', 'pandas', 'sql', 'git', 'testing', 'automation', 'rest'],
  'machine learning': ['python', 'machine learning', 'model', 'training', 'dataset', 'tensorflow', 'pytorch', 'scikit', 'evaluation', 'features'],
};

function analyze(text, role) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[-•*▪]/.test(l) || /^\d+[.)]/.test(l));
  const longBullets = bullets.filter(b => b.split(/\s+/).length > 30);
  const weakWords = ['responsible for', 'worked on', 'helped with', 'various', 'stuff', 'things', 'etc.'];
  const foundWeak = weakWords.filter(w => lower.includes(w));
  const numbers = (text.match(/\d+%|\d+\+|\d+x|\b\d{2,}\b/g) || []).length;
  const foundVerbs = ACTION_VERBS.filter(v => new RegExp(`\\b${v}`, 'i').test(text));
  const roleKeys = ROLE_KEYWORDS[role] || [];
  const matchedKeys = roleKeys.filter(k => lower.includes(k));
  const missingKeys = roleKeys.filter(k => !lower.includes(k));

  return {
    words: words.length,
    sections: SECTION_PATTERNS.map(s => ({ label: s.label, ok: s.test(text) })),
    bulletCount: bullets.length,
    longBullets: longBullets.length,
    weakWords: foundWeak,
    numbers,
    foundVerbs,
    matchedKeys,
    missingKeys,
    hasTablesHint: /\|/.test(text) || /\t{2,}/.test(text),
  };
}

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
          Honest by design: your text never leaves this page (all checks run in your browser), and we do not show a made-up "ATS score". Real screening software differs per company; these checks cover the commonly documented basics.
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
                {result.numbers} measurable results found (numbers, percentages). Quantified outcomes ("reduced load time 40%") are the strongest resume content.
              </Verdict>
              <Verdict ok={result.foundVerbs.length >= 5} warn={result.foundVerbs.length > 0}>
                {result.foundVerbs.length} action verbs detected{result.foundVerbs.length > 0 ? ` (${result.foundVerbs.slice(0, 5).join(', ')}${result.foundVerbs.length > 5 ? ', ...' : ''})` : ''}. Start bullets with verbs like built, led, improved.
              </Verdict>
              <Verdict ok={result.weakWords.length === 0}>
                {result.weakWords.length === 0 ? 'No vague phrases detected.' : `Vague phrases found: "${result.weakWords.join('", "')}". Replace with what you specifically did and the outcome.`}
              </Verdict>
              <Verdict ok={result.longBullets === 0} warn={result.bulletCount > 0}>
                {result.longBullets === 0 ? 'All bullets are a scannable length.' : `${result.longBullets} bullet(s) run over 30 words - split or tighten them.`}
              </Verdict>
              <Verdict ok={result.words >= 200 && result.words <= 900} warn={result.words > 900}>
                {result.words} words total. One page (roughly 300-600 words) is the common expectation for students and freshers.
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
