import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger, ScrollSmoother } from 'gsap/all';
import { useProgrammeCatalogue } from '../utils/useProgrammeCatalogue';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';
import Hero from '../components/Heroes';
import JourneyBoard from '../components/JourneyBoard';
import ReviewMarquee from '../components/ReviewMarquee';
import CertificateShowcase from '../components/CertificateShowcase';
import ProgramShowcase from '../components/ProgramShowcase';
import { soon } from '../utils/toast';
import {
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const JOURNEY_STEPS = [
  {
    word: 'APPLY',
    step: '01',
    title: 'Apply via Google Form 1',
    desc: 'Select your preferred engineering track and submit your candidate application through official Google Form 1. Applying is completely free.',
  },
  {
    word: 'REVIEW',
    step: '02',
    title: 'Administrative Review',
    desc: 'NOXIRA administration reviews applicant background, track selection, and eligibility for cohort intake.',
  },
  {
    word: 'OFFER',
    step: '03',
    title: 'Official Offer Letter',
    desc: 'Approved candidates receive a personalized, administrative offer letter delivered directly to their registered email address.',
  },
  {
    word: 'TASKS',
    step: '04',
    title: 'Tasks & Cohort Guidance',
    desc: 'Interns receive practical technical task deliverables, project requirements, and guidance through the dedicated WhatsApp cohort group.',
  },
  {
    word: 'CODE',
    step: '05',
    title: 'Build the Project',
    desc: 'Work through your assigned tasks and build your project, keeping your code in a project repository you can share.',
  },
  {
    word: 'SUBMIT',
    step: '06',
    title: 'Final Project Submission (Form 2)',
    desc: 'Submit your completed project repository link, Task Submission & Review Fee, and payment transaction ID through Google Form 2.',
  },
  {
    word: 'EVALUATE',
    step: '07',
    title: 'Technical Review',
    desc: 'Your submission goes through technical review. Technical review approval and manual payment verification are both required before a certificate can be released.',
  },
  {
    word: 'CERTIFY',
    step: '08',
    title: 'Verified Certificate Issuance',
    desc: 'Once payment is verified and technical review is approved, your official Certificate of Achievement is explicitly released and publicly verifiable on the registry.',
  },
];


export default function HomePage() {
  const { programs, loading, configured } = useProgrammeCatalogue();

  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } =
    useSiteSettings();
  const noteMessage =
    settingsLoading || settingsError ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

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
      <section id="internship-start">
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
                <Link
                  to="/apply"
                  className="gb pri inline-flex items-center gap-1.5 text-xs font-bold"
                  title="Browse programs and apply"
                >
                  Apply Now
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Download Offer Letter card */}
            <div className="card rv">
              <small>02</small>
              <b>Download Offer Letter</b>
              <span>Shortlisted interns access and download official letters.</span>
              <div className="mt-auto pt-3">
                <Link to="/offer-letter" className="gb inline-flex items-center gap-1.5 text-xs font-bold">
                  Download Offer Letter
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

        </div>
      </section>

      {/* 02 - JOURNEY (The 8-Step Internship Journey) */}
      <section id="journey">
        <div className="wrap">
          <p className="kick rv">02 - JOURNEY</p>
          <h2 className="rv">The 8-Step Internship Journey</h2>
          <JourneyBoard steps={JOURNEY_STEPS} />
        </div>
      </section>

      {/* 03 - SERVICES */}
      <section id="services">
        <div className="wrap">
          <p className="kick rv">03 - SERVICES</p>
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

      {/* 04 - CONTACT PLACEHOLDER */}
      <section id="contact">
        <div className="wrap">
          <p className="kick rv">04 - CONTACT</p>
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

      <ProgramShowcase programs={programs} loading={loading} configured={configured} />

      <CertificateShowcase />

      {/* 05 - STUDENT REVIEWS: continuous right-to-left marquee (hidden until approved reviews exist; samples only in demo preview) */}
      <ReviewMarquee />

      {/* Copyright footer, directly after feedback. */}
      <div className="home-copyright">
        <div className="wrap">
          <p className="foot rv">&copy; {new Date().getFullYear()} NOXIRA TECHNOLOGIES</p>
        </div>
      </div>
    </main>
  );
}
