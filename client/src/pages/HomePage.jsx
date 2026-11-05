import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  ShieldCheck,
  Award,
  ArrowRight,
  Code2,
  FileCheck,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ClipboardList,
  GitBranch,
  Terminal,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

import { resolveProgramDescription } from '../utils/programUtils';

export default function HomePage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchPrograms = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.getPrograms();
      setPrograms(data.programs || []);
    } catch (err) {
      console.warn('Failed to load active programs:', err.message);
      setLoadError(true);
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 py-8 sm:py-12">
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/30">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Engineering Internship & Certification Model</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Accelerate Your Career with <span className="text-amber-600">Structured Engineering Tracks</span>
        </h1>

        <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Bridge the gap between academic theory and practical engineering. Explore structured engineering tracks, apply for upcoming cohorts, and verify authentic credentials through our official registry.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/apply"
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            Apply for Cohort
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </Link>
          <Link
            to="/verify"
            className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Verify Credential
          </Link>
        </div>

        {/* Real Dynamic Program Count Banner */}
        {!loading && !loadError && programs.length > 0 && (
          <div className="pt-2 text-xs text-slate-500 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
            <span>Published tracks: <strong>{programs.length} active engineering programs</strong></span>
          </div>
        )}
      </section>

      {/* 2. Featured Programs Section */}
      <section id="programs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Official Engineering Cohorts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Practical, curriculum-backed engineering tracks designed for modern software teams.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(n => (
              <div key={n} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs animate-pulse space-y-4">
                <div className="h-6 bg-slate-200 rounded-md w-1/4"></div>
                <div className="h-5 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-16 bg-slate-100 rounded-md"></div>
                <div className="h-10 bg-slate-200 rounded-lg w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* STRICT FALLBACK: Neutral Error Message with Retry (No fake/invented cards) */}
        {!loading && loadError && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Programs abhi load nahi ho paye</h3>
              <p className="text-xs text-slate-500">
                Network connection check karein ya thodi der baad dobara koshish karein.
              </p>
            </div>
            <button
              onClick={fetchPrograms}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Programs
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && programs.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto text-xs text-slate-500">
            No active programs are currently published. Check back shortly.
          </div>
        )}

        {/* Dynamic Programs Grid */}
        {!loading && !loadError && programs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.map(prg => (
              <div
                key={prg.code}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:border-amber-300 hover:shadow-md transition flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                      {prg.code}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Track
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {prg.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {resolveProgramDescription(prg)}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Curriculum Review Model
                  </span>
                  <Link
                    to={`/apply?program=${encodeURIComponent(prg.code)}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5"
                  >
                    Apply Now
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. 6-Step Journey Strip (Strictly Informational Process) */}
      <section id="journey" className="bg-slate-900 text-white py-16 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              Transparent & Merit-Driven
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              The 6-Step Certification Journey
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Clear expectations from initial application to credential issuance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Explore & Apply',
                badge: 'Live',
                desc: 'Review available tracks and requirements. Submit your official candidate profile online.'
              },
              {
                step: '02',
                title: 'Application Review',
                badge: 'Live',
                desc: 'Administration screens applicant submissions and establishes cohort eligibility.'
              },
              {
                step: '03',
                title: 'Official Offer Letter (Planned)',
                badge: 'Planned',
                desc: 'Planned future module: Approved candidates will receive an official enrollment confirmation letter.'
              },
              {
                step: '04',
                title: 'Industry Tasks (Planned)',
                badge: 'Planned',
                desc: 'Planned future module: Task assignment and submission portal for project deliverables.'
              },
              {
                step: '05',
                title: 'Evaluation & Rework (Planned)',
                badge: 'Planned',
                desc: 'Planned future module: Staff reviewer rubric evaluation and structured rework guidance.'
              },
              {
                step: '06',
                title: 'Registry-Verified Certificate',
                badge: 'Live',
                desc: 'Upon approved completion, an official Certificate of Achievement is issued, recorded in the registry, and publicly verifiable.'
              }
            ].map(item => (
              <div
                key={item.step}
                className="bg-slate-800/60 border border-slate-800 p-6 rounded-2xl space-y-3 relative hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xl font-black text-amber-500">
                    {item.step}
                  </div>
                  {item.badge === 'Planned' ? (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                      Planned
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">
                      Live Flow
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-white text-sm">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Trust & Verification Teaser */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 border border-amber-200/80 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xs">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Public Verification Portal
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Registry-Verified Credentials
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every certificate issued by NOXIRA includes a unique verification token and secure QR code. Employers and institutions can verify authentic issuance and record status directly against the official registry without logging in.
            </p>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto">
            <Link
              to="/verify"
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center justify-center gap-2"
            >
              Verify a Certificate
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
