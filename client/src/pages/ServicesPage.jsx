import React from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import {
  Globe,
  Smartphone,
  Bot,
  ArrowRight,
  Code2,
  Database,
  ShieldCheck,
  LayoutDashboard,
  Plug,
  GaugeCircle,
  Workflow,
  LineChart,
  MessagesSquare,
  FileSearch,
  PenTool,
  Rocket,
  LifeBuoy,
  ClipboardList
} from 'lucide-react';

const SERVICES = [
  {
    id: 'web-development',
    icon: Globe,
    name: 'Web Application Development',
    tagline: 'Production-ready web platforms tailored to how your business actually runs.',
    description:
      'We design and build full-stack web applications - responsive React frontends backed by secure Node.js and Python APIs, with database architectures that fit the scale of the problem. Every engagement is scoped individually with the client before work begins.',
    capabilities: [
      { icon: Code2, label: 'Full-stack web architectures (React, Node.js, Python)' },
      { icon: Plug, label: 'RESTful APIs and third-party integrations' },
      { icon: Database, label: 'Database modeling, authentication and access control' },
      { icon: LayoutDashboard, label: 'Admin portals, dashboards and internal tools' }
    ]
  },
  {
    id: 'mobile-development',
    icon: Smartphone,
    name: 'Mobile Application Development',
    tagline: 'Reliable Android and cross-platform apps, from concept to release.',
    description:
      'We build native Android and cross-platform mobile applications engineered for performance and a fluid user experience - from concept and UI design through cloud backend integration and release preparation.',
    capabilities: [
      { icon: Smartphone, label: 'Native Android and cross-platform apps' },
      { icon: Plug, label: 'Mobile API and cloud backend integration' },
      { icon: PenTool, label: 'Clean UI/UX implementation' },
      { icon: GaugeCircle, label: 'Performance-focused engineering' }
    ]
  },
  {
    id: 'ai-automation',
    icon: Bot,
    name: 'AI Automation & Integrations',
    tagline: 'Practical automation that removes repetitive manual work.',
    description:
      'We design workflow automations and AI-assisted tooling for everyday business operations - connecting the tools a business already uses, automating repetitive steps, and surfacing the data owners need to make decisions.',
    capabilities: [
      { icon: Workflow, label: 'Workflow and process automation' },
      { icon: Bot, label: 'AI-assisted business tooling' },
      { icon: LineChart, label: 'Data pipelines, reports and dashboards' },
      { icon: Plug, label: 'Integration with existing business tools' }
    ]
  }
];

const PROCESS = [
  {
    step: '01',
    icon: MessagesSquare,
    title: 'Discovery Call',
    desc: 'We understand your business, the problem, and what success looks like - before quoting anything.'
  },
  {
    step: '02',
    icon: ClipboardList,
    title: 'Scope & Proposal',
    desc: 'You receive a written scope: what will be built, the timeline, and the cost. No surprises later.'
  },
  {
    step: '03',
    icon: PenTool,
    title: 'Design & Build',
    desc: 'We design, develop and share progress in stages, so you can review and steer as it takes shape.'
  },
  {
    step: '04',
    icon: Rocket,
    title: 'Launch & Handover',
    desc: 'We deploy, test with you, and hand over with documentation - the work is yours.'
  },
  {
    step: '05',
    icon: LifeBuoy,
    title: 'Support',
    desc: 'Post-launch support and iteration as your business grows.'
  }
];

export default function ServicesPage() {
  return (
    <div className="space-y-16 sm:space-y-24 py-8 sm:py-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="hero-badge inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Code2 className="w-3.5 h-3.5 text-cyan-600" />
          <span>Software Development Services</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
          <span className="hero-title-line block">Software That Works</span>
          <span className="hero-title-line block text-cyan-600">For Your Business</span>
        </h1>
        <p className="hero-subtitle text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          NOXIRA Technologies builds custom web applications, mobile apps and AI-powered automation for businesses and founders - scoped honestly, built properly.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/#contact"
            className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            Discuss Your Project
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </Link>
          <Link
            to="/programs"
            className="hero-cta w-full sm:w-auto px-6 py-3.5 bg-white/70 backdrop-blur-md hover:bg-white/90 text-slate-800 border border-white/60 shadow-glass rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            Looking for internships instead?
          </Link>
        </div>
      </section>

      {/* Detailed services */}
      {SERVICES.map((service, index) => {
        const Icon = service.icon;
        return (
          <section key={service.id} id={service.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
            <Reveal>
              <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-3xl p-8 sm:p-12 shadow-xs space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 font-bold">
                      Service {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{service.name}</h2>
                    <p className="text-xs sm:text-sm text-cyan-700 font-semibold">{service.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">{service.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {service.capabilities.map(cap => {
                    const CapIcon = cap.icon;
                    return (
                      <div key={cap.label} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3">
                        <CapIcon className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-700">{cap.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </section>
        );
      })}

      {/* Process */}
      <section className="bg-ink-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <Reveal className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              How We Work
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              A Clear Process, Start to Finish
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Every engagement follows the same transparent sequence - you always know what happens next.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {PROCESS.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.step} delay={Math.min(index, 4) * 0.07}>
                  <div className="bg-slate-800/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-cyan-500/40 transition h-full">
                    <div className="flex items-center justify-between">
                      <Icon className="w-5 h-5 text-cyan-400" />
                      <span className="font-mono text-xs font-black text-cyan-500">{item.step}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm">{item.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="bg-gradient-to-br from-cyan-500/10 via-white to-cyan-500/5 border border-cyan-200/70 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xs">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-700" />
                Scoped Before We Start
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Tell Us What You Need Built
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Share your requirements and we will come back with an honest assessment - what it takes, what it costs, and how long it needs.
              </p>
            </div>
            <div className="flex-shrink-0 w-full sm:w-auto">
              <Link
                to="/#contact"
                className="w-full sm:w-auto px-6 py-3.5 bg-ink-950 hover:bg-ink-800 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center justify-center gap-2"
              >
                Get in Touch
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
