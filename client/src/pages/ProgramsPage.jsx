import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { resolveProgramDescription } from '../utils/programUtils';
import {
  BookOpen,
  ArrowRight,
  Clock,
  IndianRupee,
  Users,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

const CATEGORIES = [
  'Development',
  'Programming',
  'AI & Data Science',
  'Design',
  'Business',
  'Engineering'
];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } = useSiteSettings();
  const noteMessage = (settingsLoading || settingsError) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

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

  // Group programs by category
  const groupedPrograms = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = programs.filter(p => p.category === cat);
    return acc;
  }, {});

  // Catch any programs with missing or custom category
  const uncategorized = programs.filter(p => !p.category || !CATEGORIES.includes(p.category));
  if (uncategorized.length > 0) {
    groupedPrograms['Other Tracks'] = uncategorized;
  }

  const activeCategories = (selectedCategory === 'ALL'
    ? Object.keys(groupedPrograms)
    : [selectedCategory]
  ).filter(cat => (groupedPrograms[cat] || []).length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10 font-sans">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
          <span>Engineering Tracks</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Engineering &amp; Technical Programmes
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Explore structured 1-month technical tracks. Browse curriculum specifications and apply for cohort intake via Google Form.
        </p>
      </div>

      {/* Category Filter Chips */}
      {!loading && !loadError && programs.length > 0 && (
        <div className="flex items-center justify-center flex-wrap gap-2 pt-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              selectedCategory === 'ALL'
                ? 'bg-ink-950 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Tracks ({programs.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = (groupedPrograms[cat] || []).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-12">
          {[1, 2].map(n => (
            <div key={n} className="space-y-4">
              <div className="h-6 w-48 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(m => (
                  <div key={m} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs animate-pulse space-y-4">
                    <div className="h-5 bg-slate-200 rounded-md w-1/4"></div>
                    <div className="h-6 bg-slate-200 rounded-md w-3/4"></div>
                    <div className="h-14 bg-slate-100 rounded-md"></div>
                  </div>
                ))}
              </div>
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
            <h3 className="font-bold text-slate-900 text-sm">Failed to Load Programmes</h3>
            <p className="text-xs text-slate-500">
              The programmes directory could not be reached. Please check your connection or retry.
            </p>
          </div>
          <button
            onClick={fetchPrograms}
            className="px-4 py-2 bg-ink-950 hover:bg-ink-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Directory
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !loadError && programs.length === 0 && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-12 text-center max-w-md mx-auto text-xs text-slate-500">
          No programmes are currently published in the catalogue. Please check back shortly.
        </div>
      )}

      {/* Categorized Programmes Grid */}
      {!loading && !loadError && programs.length > 0 && (
        <div className="space-y-14">
          {activeCategories.map(categoryName => {
            const catPrograms = groupedPrograms[categoryName] || [];
            return (
              <section key={categoryName} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {categoryName}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {catPrograms.length} {catPrograms.length === 1 ? 'Track' : 'Tracks'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catPrograms.map(prg => (
                    <div
                      key={prg.code}
                      className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-6 shadow-xs hover:border-cyan-300 hover:shadow-md transition flex flex-col justify-between space-y-5"
                    >
                      {/* Card artwork area (structure placeholder - no fake imagery; program code monogram) */}
                      <div className="relative -mx-6 -mt-6 h-32 rounded-t-2xl bg-gradient-to-br from-slate-100 via-cyan-50 to-slate-100 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-white/85 border border-cyan-200 px-2 py-0.5 rounded-md">
                          {prg.category || 'Engineering'}
                        </span>
                        <span className="font-mono text-2xl font-black text-slate-300 tracking-widest select-none">
                          {prg.code}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200">
                            {prg.code}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {prg.category || 'Engineering'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {prg.title}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {resolveProgramDescription(prg)}
                        </p>

                        {/* Meta Rows (Duration guarded to 1-month, no batch dates) */}
                        <div className="space-y-1.5 pt-2 text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                            <span>Duration: 1 Month (4 Weeks)</span>
                          </div>

                          {prg.feeInr != null && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <IndianRupee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Task Submission &amp; Review Fee: {prg.feeInr === 0 ? '₹0 (Free)' : `₹${Number(prg.feeInr).toLocaleString('en-IN')}`}</span>
                            </div>
                          )}

                          {prg.seats != null && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>Seats: {prg.seats} Available</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/programs/${encodeURIComponent(prg.code)}`}
                            className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 transition inline-flex items-center gap-1"
                          >
                            View Curriculum <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>

                        {isFormConfigured ? (
                          <a
                            href={googleForm1Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center justify-center gap-1.5"
                            title="Apply via Google Form"
                          >
                            Apply Now
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={noteMessage}
                            className="w-full py-2.5 bg-ink-950/50 text-white/70 rounded-xl text-xs font-bold cursor-not-allowed"
                          >
                            Apply Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
