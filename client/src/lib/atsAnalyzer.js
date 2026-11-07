/** Honest ATS resume checks - pure functions, no I/O, unit-testable. */

const ACTION_VERBS = ['built', 'developed', 'designed', 'implemented', 'led', 'created', 'improved', 'automated', 'launched', 'optimized', 'reduced', 'increased', 'managed', 'delivered', 'engineered', 'analyzed', 'tested', 'deployed', 'migrated', 'mentored'];
const SECTION_PATTERNS = [
  { key: 'contact', label: 'Contact details', test: t => /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) && /(\+?\d[\d\s-]{8,}\d)/.test(t) },
  { key: 'education', label: 'Education section', test: t => /\beducation\b|\bdegree\b|\bb\.?\s?tech\b|\bbachelor|\bmaster|\buniversity\b|\bcollege\b/i.test(t) },
  { key: 'experience', label: 'Experience / internships section', test: t => /\bexperience\b|\bintern(ship)?\b|\bworked\b|\bemployment\b/i.test(t) },
  { key: 'skills', label: 'Skills section', test: t => /\bskills?\b|\btechnologies\b|\btech stack\b/i.test(t) },
  { key: 'projects', label: 'Projects section', test: t => /\bprojects?\b|\bportfolio\b|\bgithub\b/i.test(t) },
];

export const ROLE_KEYWORDS = {
  'web developer': ['html', 'css', 'javascript', 'react', 'node', 'api', 'responsive', 'git', 'frontend', 'backend'],
  'data analyst': ['sql', 'excel', 'python', 'pandas', 'dashboard', 'visualization', 'statistics', 'power bi', 'tableau', 'analysis'],
  'python developer': ['python', 'django', 'flask', 'api', 'pandas', 'sql', 'git', 'testing', 'automation', 'rest'],
  'machine learning': ['python', 'machine learning', 'model', 'training', 'dataset', 'tensorflow', 'pytorch', 'scikit', 'evaluation', 'features'],
};

export function analyze(text, role) {
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

