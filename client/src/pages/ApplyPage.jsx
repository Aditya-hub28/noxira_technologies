import '../programme-cards.css';
import React, { useState, useMemo } from 'react';
import { INTERNSHIP_EMAIL } from '../config/supportContact';
import '../components/email-link.css';
import { PROGRAMME_IMAGES } from '../config/programmeImages';
import { useProgrammeCatalogue } from '../utils/useProgrammeCatalogue';
import { resolveProgramDescription } from '../utils/programUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';
import {
  Clock,
  Users,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Search
} from 'lucide-react';

export default function ApplyPage() {
  const { programs, loading, configured, refresh: fetchPrograms } = useProgrammeCatalogue();
  const loadError = false;
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const categories = [...new Set(programs.map(p => p.category || 'Other Tracks'))];
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('program') || '');

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } = useSiteSettings();
  const formReady = !configured && isFormConfigured && !settingsLoading && !settingsError;
  const noteMessage = (configured || settingsLoading || settingsError)
    ? APPLICATION_NEUTRAL_MESSAGE
    : APPLICATION_UNAVAILABLE_MESSAGE;

  const visiblePrograms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter(p =>
      (selectedCategory === 'ALL' || (p.category || 'Other Tracks') === selectedCategory) &&
      (!q || `${p.title || ''} ${p.code || ''} ${p.category || ''} ${resolveProgramDescription(p) || ''}`.toLowerCase().includes(q))
    );
  }, [programs, query, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10 font-sans">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
          <span>Application status</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Find your next <span className="text-cyan-500">direction.</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Choose a NOXIRA programme and check the current application instructions.
        </p>
      </div>

      {configured && <p role="status" className="text-sm text-slate-500 text-center">Showing NOXIRA's configured catalogue. Live intake status is unavailable; listing a track does not confirm applications are open.</p>}
      {/* Search */}
      {!loading && !loadError && programs.length > 0 && (
        <div className="max-w-xl mx-auto w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search programs (e.g. AI, design, marketing)"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200 transition"
              aria-label="Search programs"
            />
          </div>
          <p className="text-center text-[11px] font-semibold text-slate-400 mt-2.5">
            Showing {visiblePrograms.length} of {programs.length} {programs.length === 1 ? 'program' : 'programs'}
          </p>
        </div>
      )}

      {!loading && programs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2" aria-label="Programme categories">
          {['ALL', ...categories].map(category => <button
            key={category}
            type="button"
            aria-pressed={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition ${selectedCategory === category ? 'bg-cyan-500 border-cyan-500 text-slate-950' : 'bg-white/5 border-slate-400/30 text-slate-500 hover:border-cyan-400'}`}
          >{category === 'ALL' ? 'All Programmes' : category} ({category === 'ALL' ? programs.length : programs.filter(p => (p.category || 'Other Tracks') === category).length})</button>)}
        </div>
      )}
      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {[1, 2, 3].map(m => (
            <div key={m} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded-md w-1/4"></div>
              <div className="h-6 bg-slate-200 rounded-md w-3/4"></div>
              <div className="h-14 bg-slate-100 rounded-md"></div>
            </div>
          ))}
        </div>
      )}

      {/* Load Error State */}
      {!loading && loadError && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mx-auto text-cyan-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm">Failed to Load Programs</h3>
            <p className="text-xs text-slate-500">
              The programs directory could not be reached. Please check your connection or retry.
            </p>
          </div>
          <button
            onClick={fetchPrograms}
            className="px-4 py-2 bg-ink-950 hover:bg-ink-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty / No-match States */}
      {!loading && !loadError && programs.length === 0 && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-12 text-center max-w-md mx-auto text-xs text-slate-500">
          No programs are currently open for applications. Please check back shortly.
        </div>
      )}
      {!loading && !loadError && programs.length > 0 && visiblePrograms.length === 0 && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-12 text-center max-w-md mx-auto text-xs text-slate-500">
          <p>No programmes match your search and category. Try a different search.</p>
          <button type="button" onClick={() => { setQuery(''); setSelectedCategory('ALL'); }} className="mt-4 text-cyan-500 font-semibold">Clear filters</button>
        </div>
      )}

      {/* Program Cards */}
      {!loading && !loadError && visiblePrograms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {visiblePrograms.map(prg => (
            <div
              key={prg.code}
              data-program-code={prg.code}
              className="programme-square-card bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl shadow-xs hover:border-cyan-300 hover:shadow-md transition"
            >
              {/* Real subject photography is illustrative, not a NOXIRA facility or student claim. */}
              <div className="programme-square-art relative border-b border-slate-200 overflow-hidden">
                {PROGRAMME_IMAGES[prg.code] && <img
                  src={PROGRAMME_IMAGES[prg.code].src}
                  srcSet={`${PROGRAMME_IMAGES[prg.code].small} 480w, ${PROGRAMME_IMAGES[prg.code].src} 960w`}
                  sizes="(min-width: 1280px) 604px, (min-width: 768px) 45vw, 100vw"
                  width="960"
                  height="640"
                  alt={PROGRAMME_IMAGES[prg.code].alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />}
                <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-white/95 border border-cyan-200 px-2 py-0.5 rounded-md">
                  {prg.category || 'Engineering'}
                </span>
                <span className="absolute bottom-3 right-3 font-mono text-xs font-bold text-white tracking-widest select-none bg-slate-950/65 px-2 py-1 rounded-md">
                  {prg.code}
                </span>
              </div>

              <div className="programme-square-body">
                <h3 className="programme-square-title font-bold text-slate-900">
                  {prg.title}
                </h3>
                <p className="programme-square-description text-slate-600 line-clamp-3">
                  {resolveProgramDescription(prg)}
                </p>
                <div className="programme-square-meta text-slate-600">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                    <span>Duration: 4 weeks</span>
                  </div>
                  {prg.seats != null && (
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span>{prg.seats} seats per cohort</span>
                    </div>
                  )}
                </div>

              {/* Apply CTA - opens the official Google Form */}
              <div className="programme-square-action">
                {formReady ? (
                  <a
                    href={googleForm1Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Apply via the official Google Form"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    Apply
                  </a>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      title={noteMessage}
                      className="nx-apply-off w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink-950/50 text-white/70 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      Apply
                    </button>
                    <p className="programme-square-status text-slate-500 text-center">{noteMessage}</p>
                  </>
                )}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-slate-500 mt-8">Questions about applying? Email <a className="eg-link" href={`mailto:${INTERNSHIP_EMAIL}`}>{INTERNSHIP_EMAIL}</a></p>
    </div>
  );
}
