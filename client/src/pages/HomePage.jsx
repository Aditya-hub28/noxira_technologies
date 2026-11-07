import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Reveal from '../components/Reveal';
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
  Users,
  Bot,
  BookOpen,
  Award,
  MessageSquareCheck,
  BadgeCheck,
  Cpu,
  GraduationCap,
  Building2,
  Workflow,
  Terminal,
  Brain,
  Palette,
  Briefcase
} from 'lucide-react';

import { resolveProgramDescription } from '../utils/programUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

const FEATURED_PROGRAM_COUNT = 6;

const PROGRAMME_CATEGORIES = [
  { name: 'Development', count: 5, icon: Code2, blurb: 'Frontend, backend, full stack, app development and DevOps tracks.' },
  { name: 'Programming', count: 4, icon: Layers, blurb: 'Python, Java, C++ and C programming foundations and practice.' },
  { name: 'AI & Data Science', count: 6, icon: Bot, blurb: 'Data science, machine learning, analytics and cloud computing.' },
  { name: 'Design', count: 3, icon: Sparkles, blurb: 'UI/UX design, graphic design and CMS-based site building.' },
  { name: 'Business', count: 5, icon: Building2, blurb: 'Analytics, marketing, finance, HR and market fundamentals.' },
  { name: 'Engineering', count: 8, icon: Cpu, blurb: 'Mechanical, civil, IoT, robotics and research-oriented tracks.' }
];

const SKILLS = [
  'React', 'Node.js', 'Express', 'MongoDB', 'JavaScript', 'Python', 'Java', 'C++', 'C',
  'Machine Learning', 'Data Science', 'Power BI', 'Cloud Computing', 'DevOps',
  'UI/UX Design', 'WordPress', 'IoT & Robotics', 'AutoCAD', 'Cybersecurity', 'Digital Marketing'
];

const OUTCOMES = [
  {
    icon: FileText,
    title: 'Personalized Offer Letter',
    desc: 'Approved candidates receive an official, individually issued offer letter they can download and verify.'
  },
  {
    icon: BookOpen,
    title: 'Learning Material & Guided Tasks',
    desc: 'Every track carries curated learning material and practical task deliverables published by the administration.'
  },
  {
    icon: MessageSquareCheck,
    title: 'Real Project Review & Feedback',
    desc: 'Final submissions go through a structured technical review with explicit pass criteria and up to 3 free re-reviews.'
  },
  {
    icon: BadgeCheck,
    title: 'Registry-Verified Certificate',
    desc: 'Certificates are released only after payment verification and review pass, and are publicly verifiable with a unique token and QR code.'
  }
];

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

  // Hero entrance animation is pure CSS (see .hero-* classes in index.css).

  // Intentional cross-discipline representatives (not alphabetical first-N)
  const FEATURED_CODES = ['FS-DEV', 'PY-PROG', 'ML', 'UIUX', 'DIGI-MKT', 'IOT-ROBO'];

  // Per-category visual identity for programme cards
  const CATEGORY_ICON = {
    'Development': Code2,
    'Programming': Terminal,
    'AI & Data Science': Brain,
    'Design': Palette,
    'Business': Briefcase,
    'Engineering': Cpu
  };
  const CATEGORY_GRADIENT = {
    'Development': 'from-cyan-500 to-sky-600',
    'Programming': 'from-emerald-500 to-teal-600',
    'AI & Data Science': 'from-violet-500 to-purple-600',
    'Design': 'from-rose-500 to-pink-600',
    'Business': 'from-amber-500 to-orange-600',
    'Engineering': 'from-blue-500 to-indigo-600'
  };
  const categoryIcon = (category) => CATEGORY_ICON[category] || GraduationCap;
  const categoryGradient = (category) => CATEGORY_GRADIENT[category] || 'from-cyan-500 to-sky-600';
  const byCode = new Map(programs.map(p => [p.code, p]));
  const featuredPrograms = FEATURED_CODES.map(c => byCode.get(c)).filter(Boolean)
    .concat(programs.filter(p => !FEATURED_CODES.includes(p.code)))
    .slice(0, FEATURED_PROGRAM_COUNT);

  return (
    <div className="space-y-16 sm:space-y-24 py-8 sm:py-12">
      {/* 1. Hero Section: Company Intro + Services + Internships */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="hero-badge inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
          <span>Software Engineering &amp; Industry Internships</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          <span className="hero-title-line block">Modern Software Development &amp;</span>
          <span className="hero-title-line block text-cyan-600">Practical Engineering Internships</span>
        </h1>

        <p className="hero-subtitle text-sm sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          NOXIRA Technologies builds custom web applications and mobile software solutions for digital platforms, while offering structured internship programmes to train aspiring developers on real-world engineering workflows.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isFormConfigured ? (
            <a
              href={googleForm1Url}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
              title="Apply via Google Form"
            >
              Apply for Internship
              <ExternalLink className="w-4 h-4 text-cyan-400" />
            </a>
          ) : (
            <div className="hero-cta w-full sm:w-auto flex flex-col items-center">
              <button
                type="button"
                disabled
                title={noteMessage}
                className="w-full sm:w-auto px-6 py-3.5 bg-ink-950/50 text-white/70 rounded-xl text-sm font-bold cursor-not-allowed flex items-center justify-center gap-2"
              >
                Apply for Internship
                <ExternalLink className="w-4 h-4 text-cyan-400/50" />
              </button>
              <span className="text-[11px] text-slate-500 mt-1">
                {noteMessage}
              </span>
            </div>
          )}

          <a
            href="#services"
            className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-white/70 backdrop-blur-md hover:bg-white/90 text-slate-800 border border-white/60 shadow-glass rounded-xl text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2"
          >
            <Code2 className="w-4 h-4 text-cyan-600" />
            Our Services
          </a>

          <Link
            to="/verify"
            className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-white/70 backdrop-blur-md hover:bg-white/90 text-slate-800 border border-white/60 shadow-glass rounded-xl text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-600" />
            Verify Credential
          </Link>

          <Link
            to="/status"
            className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-white/70 backdrop-blur-md hover:bg-white/90 text-slate-800 border border-white/60 shadow-glass rounded-xl text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4 text-cyan-600" />
            Download Offer Letter
          </Link>
        </div>

        {/* Real Dynamic Program Count Banner */}
        {!loading && !loadError && programs.length > 0 && (
          <div className="hero-meta pt-2 text-xs text-slate-500 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
            <span>Published programmes: <strong>{programs.length} active engineering tracks</strong></span>
          </div>
        )}
      </section>

      {/* 2. Services Section: Web & App Development */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Software Development Services
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            What We Build at NOXIRA Technologies
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            We partner with businesses and founders to design, develop, and deploy production-ready digital software solutions.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Service 1: Web Application Development */}
          <Reveal>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-3xl p-8 sm:p-10 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-5 h-full">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Full-Stack Web Architectures
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    RESTful APIs &amp; Integrations
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Database Modeling &amp; Auth
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Admin Portals &amp; Dashboards
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Service 2: Mobile Application Development */}
          <Reveal delay={0.1}>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-3xl p-8 sm:p-10 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-5 h-full">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Cross-Platform Apps
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Native Android Solutions
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Mobile API Integration
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Clean UI/UX Implementation
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Service 3: AI Automation */}
          <Reveal delay={0.15}>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-3xl p-8 sm:p-10 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-5 h-full md:col-span-2 lg:col-span-1 lg:col-start-1 lg:col-end-3 lg:max-w-2xl lg:mx-auto w-full">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  AI Automation &amp; Integrations
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Practical automation for everyday business operations. We design workflow automations and AI-assisted tooling that reduce repetitive manual work and connect the tools a business already uses.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-900 block">Core Capabilities:</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Workflow Automation
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    AI-Assisted Business Tooling
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Data Pipelines &amp; Reports
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Third-Party Integrations
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2b. About NOXIRA */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            About NOXIRA
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Who We Are
          </h2>
        </Reveal>
        <Reveal>
          <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-3xl p-8 sm:p-12 shadow-xs space-y-8">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl mx-auto text-center">
              NOXIRA Technologies is a software development studio and engineering training provider. We design and build custom web and mobile software for businesses, and we run structured 4-week internship programmes that train aspiring engineers on real-world development workflows.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-200/70 flex items-center justify-center mx-auto">
                  <Code2 className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Software Services</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Custom web apps, mobile apps and AI automation built for real business operations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-200/70 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Engineering Internships</h3>
                <p className="text-xs text-slate-500 leading-relaxed">31 internship tracks across development, programming, AI, design, business and engineering - 4 weeks each, with track-wise curriculum published progressively.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-200/70 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Verified Credentials</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Every issued certificate is publicly verifiable against our registry with a unique token.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 2c. Why NOXIRA */}
      <section id="why-noxira" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Why NOXIRA
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Built on Structure, Not Promises
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Reveal>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-7 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-3 h-full">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">A Transparent 6-Step Lifecycle</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Application, review, offer letter, guided tasks, final submission and certification - every stage is defined publicly, with published review rules and fees disclosed before anyone applies.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-7 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-3 h-full">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Certificates Anyone Can Verify</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Each certificate carries a unique verification token and QR code. Employers can confirm authenticity on the public registry in seconds, without any login.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-7 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-3 h-full">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <MessageSquareCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Real Work, Real Feedback</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Interns submit actual project work that goes through structured technical review with explicit criteria - and up to three free re-reviews to get it right.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3. Featured Internship Programmes Section */}
      <section id="programs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Industry Internship Tracks
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Featured Internship Programmes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Practical 4-week engineering tracks designed to build industry-ready technical skills.
          </p>
        </Reveal>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
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
          <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mx-auto text-cyan-600">
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
              className="px-4 py-2 bg-ink-950 hover:bg-ink-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Programmes
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && programs.length === 0 && (
          <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-8 text-center max-w-md mx-auto text-xs text-slate-500">
            No active programmes are currently published. Please check back shortly.
          </div>
        )}

        {/* Featured Programs Grid (home shows a selection; the full catalogue lives on /programs) */}
        {!loading && !loadError && featuredPrograms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPrograms.map((prg, index) => (
              <Reveal key={prg.code} delay={Math.min(index, 5) * 0.06}>
                <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-6 shadow-xs hover:border-cyan-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-5 h-full">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${categoryGradient(prg.category)} flex items-center justify-center shadow-sm shrink-0`}>
                        {(() => { const CatIcon = categoryIcon(prg.category); return <CatIcon className="w-5 h-5 text-white" />; })()}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200">
                          {prg.code}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-cyan-700 bg-white/85 border border-cyan-200 px-2 py-0.5 rounded-md">{prg.category || 'Engineering'}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {prg.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {resolveProgramDescription(prg)}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium pt-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Duration: 4 Weeks</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col items-stretch gap-3">
                    <Link
                      to={`/programs/${encodeURIComponent(prg.code)}`}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 transition inline-flex items-center gap-1"
                    >
                      View Details <ArrowRight className="w-3 h-3" />
                    </Link>

                    {isFormConfigured ? (
                      <a
                        href={googleForm1Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition inline-flex justify-center items-center gap-1.5"
                        title="Apply via Google Form 1"
                      >
                        Apply Now
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title={noteMessage}
                        className="w-full px-4 py-2.5 bg-ink-950/50 text-white/70 rounded-xl text-xs font-semibold cursor-not-allowed inline-flex justify-center items-center gap-1.5"
                      >
                        Apply Now
                      </button>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {programs.length > FEATURED_PROGRAM_COUNT && (
          <Reveal className="text-center pt-2">
            <Link
              to="/programs"
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold transition"
            >
              Browse all {programs.length} programmes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Reveal>
        )}
      </section>

      {/* 3b. Programme Category Overview */}
      <section id="programme-overview" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Programme Overview
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Six Disciplines, One Standard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Every track follows the same structured lifecycle - guided tasks, transparent review and verified certification.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROGRAMME_CATEGORIES.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <Reveal key={cat.name} delay={Math.min(index, 5) * 0.06}>
                <Link
                  to="/programs"
                  className="block bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-6 shadow-xs hover:border-cyan-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300 space-y-3 h-full"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{cat.count} tracks</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{cat.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{cat.blurb}</p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 4. 6-Step Journey Section (Agreed Workflow) */}
      <section id="journey" className="bg-ink-950 text-white py-16 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <Reveal className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              Transparent &amp; Structured Flow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              The 6-Step Internship Journey
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Every candidate progresses through our defined, merit-oriented lifecycle.
            </p>
          </Reveal>

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
            ].map((item, index) => (
              <Reveal key={item.step} delay={Math.min(index, 5) * 0.06}>
                <div className="bg-slate-800/60 border border-slate-800 p-6 rounded-2xl space-y-3 relative hover:border-cyan-500/40 transition h-full">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xl font-black text-cyan-500">
                      {item.step}
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4c. Skills & Technologies */}
      <section id="technologies" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Skills &amp; Technologies
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            What Our Tracks Cover
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Technologies and domains taught across the NOXIRA internship catalogue.
          </p>
        </Reveal>
        <Reveal>
          <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
            {SKILLS.map(skill => (
              <span
                key={skill}
                className="px-4 py-2 rounded-full bg-white/70 backdrop-blur-md border border-white/60 shadow-glass text-xs font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-700 transition"
              >
                {skill}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 4d. Learner Outcomes */}
      <section id="learner-outcomes" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Learner Outcomes
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            What You Walk Away With
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Concrete deliverables every successful intern receives - no vague promises.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {OUTCOMES.map((outcome, index) => {
            const Icon = outcome.icon;
            return (
              <Reveal key={outcome.title} delay={Math.min(index, 3) * 0.07}>
                <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl p-6 shadow-xs hover:border-cyan-300 hover:shadow-md transition space-y-3 h-full">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{outcome.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{outcome.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 5. Trust & Verification Teaser */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="bg-gradient-to-br from-cyan-500/10 via-white to-cyan-500/5 border border-cyan-200/70 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xs">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-700" />
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
                className="w-full sm:w-auto px-6 py-3.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center justify-center gap-2"
              >
                Verify a Certificate
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 6. Contact (structure placeholder - contact details pending owner decision) */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-20">
        <Reveal className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
            Contact
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Get in Touch
          </h2>
        </Reveal>
        <Reveal>
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center bg-white/60">
            <p className="text-sm text-slate-400 font-medium">
              Contact details jald add hongi - section structure ready hai.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
