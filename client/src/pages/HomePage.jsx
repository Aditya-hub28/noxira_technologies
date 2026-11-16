import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger, ScrollSmoother } from 'gsap/all';
import { api } from '../services/api';
import { resolveProgramDescription } from '../utils/programUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';
import Hero from '../components/Heroes';
import { soon } from '../utils/toast';
import {
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export default function HomePage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } =
    useSiteSettings();
  const noteMessage =
    settingsLoading || settingsError ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

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

  // Handle hash scrolling (e.g. #services) with ScrollSmoother
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const target = document.getElementById(id);
        const sm = ScrollSmoother.get();
        if (sm && target) sm.scrollTo(target, true, 'top 90px');
        else if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // GSAP scroll reveals matching the source design
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.rv').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
          },
        });
      });
      gsap.to('.glow', {
        y: -120,
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          start: 0,
          end: 'max',
          scrub: 1,
        },
      });
    });

    return () => ctx.revert();
  }, [loading, programs]);

  return (
    <main>
      <div className="glow" />

      {/* Hero section with GSAP animated conveyor and Build. Learn. Ship. */}
      <Hero
        googleForm1Url={googleForm1Url}
        isFormConfigured={isFormConfigured}
        noteMessage={noteMessage}
      />

      {/* 01 - INTERNSHIPS & PROGRAMMES */}
      <section id="programs">
        <div className="wrap">
          <p className="kick rv">01 - INTERNSHIPS</p>
          <h2 className="rv">
            Apply. Get your letter.
            <br />
            Finish. Get verified.
          </h2>

          {/* Quick intake action cards */}
          <div className="grid g3">
            {/* Apply Now card */}
            <div className="card rv">
              <small>01</small>
              <b>Apply Now</b>
              <span>One short form to start your candidate evaluation.</span>
              <div className="mt-auto pt-3">
                {isFormConfigured ? (
                  <a
                    href={googleForm1Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gb pri inline-flex items-center gap-1.5 text-xs font-bold"
                    title="Apply via official Google Form"
                  >
                    Apply Now
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={noteMessage}
                    className="gb pri opacity-50 cursor-not-allowed text-xs font-bold"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>

            {/* Download Offer Letter card */}
            <div className="card rv">
              <small>02</small>
              <b>Download Offer Letter</b>
              <span>Shortlisted interns access and download official letters.</span>
              <div className="mt-auto pt-3">
                <Link to="/status" className="gb inline-flex items-center gap-1.5 text-xs font-bold">
                  Check Status &amp; Letter
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Internship verification card */}
            <div className="card rv">
              <small>03</small>
              <b>Internship certificate verification</b>
              <span>Anyone can verify credentials against the official registry.</span>
              <div className="mt-auto pt-3">
                <Link to="/verify" className="gb inline-flex items-center gap-1.5 text-xs font-bold">
                  Verify Registry
                  <ShieldCheck className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Published Technical Programmes */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                  Active Engineering Tracks
                </span>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Available Internship Programmes
                </h3>
              </div>
              {programs.length > 0 && (
                <Link
                  to="/programs"
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  Browse all {programs.length} technical tracks <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="grid g2">
                {[1, 2].map((n) => (
                  <div key={n} className="card rv animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-1/4 mb-2"></div>
                    <div className="h-6 bg-white/10 rounded w-3/4 mb-2"></div>
                    <div className="h-12 bg-white/5 rounded mb-4"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {!loading && loadError && (
              <div className="card rv text-center p-8 max-w-md mx-auto space-y-3">
                <AlertTriangle className="w-6 h-6 text-cyan-400 mx-auto" />
                <b>Unable to Load Programmes</b>
                <span>Please check your connection and try again shortly.</span>
                <div>
                  <button
                    onClick={fetchPrograms}
                    className="gb pri text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !loadError && programs.length === 0 && (
              <div className="card rv text-center p-6 text-xs text-slate-400">
                No active programmes are currently published. Please check back shortly.
              </div>
            )}

            {/* Dynamic Programs Grid */}
            {!loading && !loadError && programs.length > 0 && (
              <div className="grid g2">
                {programs.map((prg) => (
                  <div key={prg.code} className="card big rv flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <small>{prg.code}</small>
                        <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Active Track
                        </span>
                      </div>
                      <b className="block mb-2">{prg.title}</b>
                      <span>{resolveProgramDescription(prg)}</span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-3">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Duration: 1 Month (4 Weeks)</span>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                      <Link
                        to={`/programs/${encodeURIComponent(prg.code)}`}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                      >
                        View Details <ArrowRight className="w-3 h-3" />
                      </Link>
                      {isFormConfigured ? (
                        <a
                          href={googleForm1Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gb pri text-xs font-bold inline-flex items-center gap-1.5"
                          title="Apply via Google Form 1"
                        >
                          Apply Now <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={noteMessage}
                          className="gb pri opacity-50 cursor-not-allowed text-xs font-bold"
                        >
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 02 - SKILL COURSE AND CAREER TOOLS */}
      <section id="career-tools">
        <div className="wrap">
          <p className="kick rv">02 - SKILL COURSE AND CAREER TOOLS</p>
          <h2 className="rv">
            Learn it. Prove it.
            <br />
            Get hired.
          </h2>
          <div className="grid g3">
            {[
              ['Browse Courses', 'skill courses to pick from'],
              ['My Certificates', 'all your certificates in one place'],
              ['Skill Certificate verification', 'verify a skill certificate'],
              ['Check ATS Score', 'see how your resume reads'],
              ['Job Email Builder', 'write the application email'],
              ['Interview Preparation', 'get ready before the call'],
            ].map(([a, b], i) => (
              <div
                className="card rv cursor-pointer transition hover:border-cyan-400/50"
                key={a}
                role="button"
                tabIndex={0}
                onClick={() => soon(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    soon(a);
                  }
                }}
              >
                <small>0{i + 1}</small>
                <b>{a}</b>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 - JOURNEY (The 6-Step Internship Journey) */}
      <section id="journey">
        <div className="wrap">
          <p className="kick rv">03 - JOURNEY</p>
          <h2 className="rv">The 6-Step Internship Journey</h2>
          <div className="grid g3">
            {[
              {
                step: '01',
                title: 'Apply via Google Form 1',
                desc: 'Select your preferred engineering track and submit your candidate application through official Google Form 1. Applying is completely free.',
              },
              {
                step: '02',
                title: 'Administrative Review',
                desc: 'NOXIRA administration reviews applicant background, track selection, and eligibility for cohort intake.',
              },
              {
                step: '03',
                title: 'Official Offer Letter',
                desc: 'Approved candidates receive a personalized, administrative offer letter delivered directly to their registered email address.',
              },
              {
                step: '04',
                title: 'Tasks & Cohort Guidance',
                desc: 'Interns receive practical technical task deliverables, project requirements, and guidance through the dedicated WhatsApp cohort group.',
              },
              {
                step: '05',
                title: 'Final Project Submission (Form 2)',
                desc: 'Submit your completed project repository link, Task Submission & Review Fee, and payment transaction ID through Google Form 2.',
              },
              {
                step: '06',
                title: 'Verified Certificate Issuance',
                desc: 'Once payment is manually verified and technical review is approved, your official Certificate of Achievement is explicitly released and publicly verifiable on the registry.',
              },
            ].map((item) => (
              <div className="card rv" key={item.step}>
                <small>Step {item.step}</small>
                <b>{item.title}</b>
                <span>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 - SERVICES */}
      <section id="services">
        <div className="wrap">
          <p className="kick rv">04 - SERVICES</p>
          <h2 className="rv">What we build.</h2>
          <div className="grid g2">
            <div className="card big rv">
              <small>ENGINEERING</small>
              <b>Web Application Development</b>
              <span>
                Full-stack web applications tailored to business operations. Responsive frontends with React and
                modern UI frameworks, backed by secure, scalable Node.js and Python APIs and robust database architectures.
              </span>
            </div>
            <div className="card big rv">
              <small>MOBILE</small>
              <b>Mobile Application Development</b>
              <span>
                Native and cross-platform mobile applications engineered for performance and fluid user experience. Reliable Android and iOS software with clean UI/UX implementation.
              </span>
            </div>
            <div className="card big rv">
              <small>INTELLIGENCE</small>
              <b>AI Automation</b>
              <span>
                Repeat work handed to intelligent automations, custom workflow pipelines, and data-driven systems.
              </span>
            </div>
            <div className="card big rv">
              <small>ACADEMY</small>
              <b>Training &amp; Internships</b>
              <span>
                Learn by building production-ready projects, receive structured milestone reviews, and leave with verifiable proof.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Verification Section */}
      <section id="verification-teaser">
        <div className="wrap">
          <div className="card big rv flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <small>AUTHENTICITY GUARANTEED</small>
              <b>Registry-Verified Credentials</b>
              <span>
                Every certificate issued by NOXIRA includes a unique verification token. Employers and institutions can verify authentic issuance and record status directly against the official registry.
              </span>
            </div>
            <div className="flex-shrink-0">
              <Link to="/verify" className="gb pri inline-flex items-center gap-2 text-sm font-bold">
                Verify Credential
                <ShieldCheck className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 05 - CONTACT PLACEHOLDER */}
      <section id="contact">
        <div className="wrap">
          <p className="kick rv">05 - CONTACT</p>
          <h2 className="rv">Get in Touch</h2>
          <div className="card rv text-center p-8 space-y-3">
            <b>Inquiries &amp; Partnerships</b>
            <span className="max-w-md mx-auto block">
              Contact channels and support desk are being finalized for launch.
            </span>
            <div>
              <button
                type="button"
                className="gb text-xs font-semibold"
                onClick={() => soon('Contact Support')}
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* End section */}
      <section className="end">
        <div className="wrap">
          <h2 className="rv">Apply.</h2>
          <p className="lede rv">
            Start your practical engineering journey with NOXIRA.
          </p>
          <div className="mt-6 rv">
            {isFormConfigured ? (
              <a
                href={googleForm1Url}
                target="_blank"
                rel="noopener noreferrer"
                className="gb pri inline-flex items-center gap-2 text-sm font-bold"
                title="Apply via official Google Form"
              >
                Apply via Google Form 1
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={noteMessage}
                className="gb pri opacity-50 cursor-not-allowed text-sm font-bold"
              >
                Apply via Google Form 1
              </button>
            )}
          </div>
          <p className="foot rv">&copy; {new Date().getFullYear()} NOXIRA TECHNOLOGIES</p>
        </div>
      </section>
    </main>
  );
}
