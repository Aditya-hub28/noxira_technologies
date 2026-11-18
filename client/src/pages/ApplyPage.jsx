import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { resolveProgramDescription } from '../utils/programUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';
import {
  ExternalLink,
  Clock,
  IndianRupee,
  Users,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Search
} from 'lucide-react';

export default function ApplyPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } = useSiteSettings();
  const formReady = isFormConfigured && !settingsLoading && !settingsError;
  const noteMessage = (settingsLoading || settingsError)
    ? APPLICATION_NEUTRAL_MESSAGE
    : APPLICATION_UNAVAILABLE_MESSAGE;

  const fetchPrograms = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.getPrograms();
      setPrograms(data.programs || []);
    } catch (err) {
      console.warn('Failed to load programs catalogue:', err.message);
      setLoadError(true);
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const visiblePrograms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (resolveProgramDescription(p) || '').toLowerCase().includes(q)
    );
  }, [programs, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10 font-sans">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
          <span>Admissions Open</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Programs
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Pick your 1-month track and apply in under a minute. Applying is free; the Task Submission &amp; Review Fee is payable only at final submission.
        </p>
      </div>

      {/* Search */}
      {!loading && !loadError && programs.length > 0 && (
        <div className="max-w-xl mx-auto w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
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

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          No programs match &ldquo;{query}&rdquo;. Try a different search.
        </div>
      )}

      {/* Program Cards */}
      {!loading && !loadError && visiblePrograms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePrograms.map(prg => (
            <div
              key={prg.code}
              className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-6 shadow-xs hover:border-cyan-300 hover:shadow-md transition flex flex-col justify-between space-y-5"
            >
              {/* Card artwork area (program code monogram) */}
              <div className="relative -mx-6 -mt-6 h-32 rounded-t-2xl bg-gradient-to-br from-slate-100 via-cyan-50 to-slate-100 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-white/85 border border-cyan-200 px-2 py-0.5 rounded-md">
                  {prg.category || 'Engineering'}
                </span>
                <span className="font-mono text-2xl font-black text-slate-300 tracking-widest select-none">
                  {prg.code}
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {prg.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {resolveProgramDescription(prg)}
                </p>
                <div className="space-y-1.5 pt-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                    <span>Duration: 1 Month (4 Weeks)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Applying is free · ₹{Number(prg.feeInr ?? 99).toLocaleString('en-IN')} only at final submission</span>
                  </div>
                  {prg.seats != null && (
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span>{prg.seats} seats per cohort</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Apply CTA - opens the official Google Form */}
              <div className="pt-1">
                {formReady ? (
                  <a
                    href={googleForm1Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Apply via the official Google Form"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    Apply
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  </a>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      title={noteMessage}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-950/50 text-white/70 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      Apply
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400/50" />
                    </button>
                    <p className="text-[11px] text-slate-500 mt-1.5 text-center">{noteMessage}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
