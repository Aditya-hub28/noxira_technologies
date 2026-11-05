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
  Calendar,
  RotateCcw,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/30">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Curriculum & Cohort Directory</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Official Engineering & Technical Programmes
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Explore official engineering tracks across 6 professional domains. Browse curriculum requirements, track details, and apply for reviewed cohort intake.
        </p>
      </div>

      {/* Category Filter Chips */}
      {!loading && !loadError && programs.length > 0 && (
        <div className="flex items-center justify-center flex-wrap gap-2 pt-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
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
                    ? 'bg-amber-600 text-white shadow-xs'
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
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto text-amber-600">
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
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Directory
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !loadError && programs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto text-xs text-slate-500">
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
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
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
                      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-amber-300 hover:shadow-md transition flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
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

                        {/* Optional Meta Rows - Only rendered if set by owner */}
                        <div className="space-y-1.5 pt-2 text-[11px] text-slate-600">
                          {prg.durationWeeks != null && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span>{prg.durationWeeks} Weeks Structured Duration</span>
                            </div>
                          )}

                          {prg.feeInr != null && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <IndianRupee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Task Submission & Review Fee: ₹{Number(prg.feeInr).toLocaleString('en-IN')}</span>
                            </div>
                          )}

                          {prg.seats != null && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>Seats: {prg.seats} Available</span>
                            </div>
                          )}

                          {(prg.startDate || prg.endDate) && (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span>
                                {prg.startDate ? new Date(prg.startDate).toLocaleDateString() : 'TBD'} – {prg.endDate ? new Date(prg.endDate).toLocaleDateString() : 'TBD'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <Link
                          to={`/programs/${encodeURIComponent(prg.code)}`}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800 transition inline-flex items-center gap-1"
                        >
                          View Curriculum <ArrowRight className="w-3 h-3" />
                        </Link>
                        <Link
                          to={`/apply?program=${encodeURIComponent(prg.code)}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                        >
                          Apply Now
                        </Link>
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
