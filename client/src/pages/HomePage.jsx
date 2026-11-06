import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  ShieldCheck,
  ArrowRight,
  Code2,
  Globe,
  Smartphone,
  RotateCcw,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  Users
} from 'lucide-react';

import { resolveProgramDescription } from '../utils/programUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

export default function HomePage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } = useSiteSettings();
  const noteMessage = (settingsLoading || settingsError) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

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
      {/* 1. Hero Section: Company Intro + Services + Internships */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/30">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Software Engineering &amp; Industry Internships</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Modern Software Development &amp; <span className="text-amber-600">Practical Engineering Internships</span>
        </h1>

        <p className="text-sm sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          NOXIRA Technologies builds custom web applications and mobile software solutions for digital platforms, while offering structured internship programmes to train aspiring developers on real-world engineering workflows.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isFormConfigured ? (
            <a
              href={googleForm1Url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
              title="Apply via Google Form"
            >
              Apply for Internship
              <ExternalLink className="w-4 h-4 text-amber-400" />
            </a>
          ) : (
            <div className="w-full sm:w-auto flex flex-col items-center">
              <button
                type="button"
                disabled
                title={noteMessage}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900/60 text-white/70 rounded-xl text-sm font-bold cursor-not-allowed flex items-center justify-center gap-2"
              >
                Apply for Internship
                <ExternalLink className="w-4 h-4 text-amber-400/50" />
              </button>
              <span className="text-[11px] text-slate-500 mt-1">
                {noteMessage}
              </span>
            </div>
          )}

          <a
            href="#services"
            className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2"
          >
            <Code2 className="w-4 h-4 text-amber-600" />
            Our Services
          </a>

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
            <span>Published programmes: <strong>{programs.length} active engineering tracks</strong></span>
          </div>
        )}
      </section>

      {/* 2. Services Section: Web & App Development */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-600 font-bold">
            Software Development Services
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            What We Build at NOXIRA Technologies
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            We partner with businesses and founders to design, develop, and deploy production-ready digital software solutions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Service 1: Web Application Development */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xs hover:border-amber-300 hover:shadow-md transition space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Web Application Development
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Full-stack web applications tailored to business operations. We build responsive frontends with React and modern UI frameworks, backed by secure, scalable Node.js and Python APIs and robust database architectures.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-900 block">Core Capabilities:</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Full-Stack Web Architectures
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  RESTful APIs &amp; Integrations
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Database Modeling &amp; Auth
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Admin Portals &amp; Dashboards
                </li>
              </ul>
            </div>
          </div>

          {/* Service 2: Mobile Application Development */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xs hover:border-amber-300 hover:shadow-md transition space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Mobile Application Development
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Native and cross-platform mobile applications engineered for performance and fluid user experience. From concept and UI design to cloud backend integration, we build reliable Android and iOS software.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-900 block">Core Capabilities:</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Cross-Platform Apps
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Native Android Solutions
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Mobile API Integration
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Clean UI/UX Implementation
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Internship Programmes Section */}
      <section id="programs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-600 font-bold">
            Industry Internship Tracks
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Engineering Internship Programmes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Practical 1-month engineering tracks designed to build industry-ready technical skills.
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

        {/* Error State (Neutral English fallback) */}
        {!loading && loadError && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Unable to Load Programmes</h3>
              <p className="text-xs text-slate-500">
                Please check your network connection or try again shortly.
              </p>
            </div>
            <button
              onClick={fetchPrograms}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Programmes
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && programs.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto text-xs text-slate-500">
            No active programmes are currently published. Please check back shortly.
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

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium pt-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Duration: 1 Month (4 Weeks)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/programs/${encodeURIComponent(prg.code)}`}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 transition inline-flex items-center gap-1"
                  >
                    View Details <ArrowRight className="w-3 h-3" />
                  </Link>

                  {isFormConfigured ? (
                    <a
                      href={googleForm1Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5"
                      title="Apply via Google Form 1"
                    >
                      Apply Now
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={noteMessage}
                      className="px-4 py-2 bg-slate-900/60 text-white/70 rounded-lg text-xs font-semibold cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      Apply Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {programs.length > 0 && (
          <div className="text-center pt-2">
            <Link
              to="/programs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-amber-700 transition"
            >
              Browse all {programs.length} technical programmes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* 4. 6-Step Journey Section (Agreed Workflow) */}
      <section id="journey" className="bg-slate-900 text-white py-16 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              Transparent &amp; Structured Flow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              The 6-Step Internship Journey
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Every candidate progresses through our defined, merit-oriented lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Apply via Google Form 1',
                desc: 'Select your preferred engineering track and submit your candidate application through official Google Form 1. Applying is completely free.'
              },
              {
                step: '02',
                title: 'Administrative Review',
                desc: 'NOXIRA administration reviews applicant background, track selection, and eligibility for cohort intake.'
              },
              {
                step: '03',
                title: 'Official Offer Letter',
                desc: 'Approved candidates receive a personalized, administrative offer letter delivered directly to their registered email address.'
              },
              {
                step: '04',
                title: 'Tasks & Cohort Guidance',
                desc: 'Interns receive practical technical task deliverables, project requirements, and guidance through the dedicated WhatsApp cohort group.'
              },
              {
                step: '05',
                title: 'Final Project Submission (Form 2)',
                desc: 'Submit your completed project repository link, Task Submission & Review Fee, and payment transaction ID through Google Form 2.'
              },
              {
                step: '06',
                title: 'Verified Certificate Issuance',
                desc: 'Once payment is manually verified and technical review is approved, your official Certificate of Achievement is explicitly released and publicly verifiable on the registry.'
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
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                    Step {item.step}
                  </span>
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

      {/* 5. Trust & Verification Teaser */}
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
