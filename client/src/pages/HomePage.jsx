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
import {
  ShieldCheck,
  ArrowRight,
  Globe,
  Smartphone,
  Bot,
  GraduationCap,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const JOURNEY_STEPS = [
  {
    word: 'APPLY',
    step: '01',
    title: 'Apply via Google Form 1',
    desc: 'Select your preferred engineering track and submit your candidate application through official Google Form 1. Applying is completely free.',
    happens: [
      'Choose the engineering track you want to join.',
      'Fill in the official Google Form 1 with your details and submit it.',
      'Applying is completely free.'
    ],
    action: 'Complete and submit Google Form 1.'
  },
  {
    word: 'REVIEW',
    step: '02',
    title: 'Administrative Review',
    desc: 'NOXIRA administration reviews applicant background, track selection, and eligibility for cohort intake.',
    happens: [
      'NOXIRA administration looks at your background and the track you picked.',
      'Eligibility for the cohort intake is checked.',
      'Only approved candidates move on to the offer letter.'
    ],
    action: 'Nothing to do. Wait for the decision.'
  },
  {
    word: 'OFFER',
    step: '03',
    title: 'Official Offer Letter',
    desc: 'Approved candidates receive a personalized, administrative offer letter delivered directly to their registered email address.',
    happens: [
      'After approval, a personalized offer letter is sent to the email address you registered with.',
      'You can also find it on the Download Offer Letter page with your application details.'
    ],
    action: 'Check your registered email, or open Download Offer Letter.',
    link: {
      to: '/offer-letter',
      label: 'Download Offer Letter'
    }
  },
  {
    word: 'TASKS',
    step: '04',
    title: 'Tasks & Cohort Guidance',
    desc: 'Interns receive practical technical task deliverables, project requirements, and guidance through the dedicated WhatsApp cohort group.',
    happens: [
      'You receive practical technical tasks and the project requirements.',
      'Guidance and updates for your cohort come through the dedicated WhatsApp group.'
    ],
    action: 'Join the cohort WhatsApp group and read the task requirements.'
  },
  {
    word: 'CODE',
    step: '05',
    title: 'Build the Project',
    desc: 'Work through your assigned tasks and build your project, keeping your code in a project repository you can share.',
    happens: [
      'You work through your assigned tasks and build your project.',
      'Your code lives in a project repository that you can share.'
    ],
    action: 'Build the project and keep the code in your repository.'
  },
  {
    word: 'SUBMIT',
    step: '06',
    title: 'Final Project Submission (Form 2)',
    desc: 'Submit your completed project repository link, Task Submission & Review Fee, and payment transaction ID through Google Form 2.',
    happens: [
      'You send the link to your completed project repository.',
      'You pay the Task Submission & Review Fee and enter the payment transaction ID.',
      'All of this goes through Google Form 2.'
    ],
    action: 'Submit Google Form 2 with your repository link and transaction ID.'
  },
  {
    word: 'EVALUATE',
    step: '07',
    title: 'Technical Review',
    desc: 'Your submission goes through technical review. Technical review approval and manual payment verification are both required before a certificate can be released.',
    happens: [
      'Every final submission gets an initial review plus up to 3 free re-reviews.',
      'Each review is completed within 2-3 working days (Monday to Friday, excluding public holidays).',
      'If changes are requested, you get 3 calendar days after each feedback to fix and resubmit.',
      'A submission passes only when the task requirements are complete and the project works properly.',
      'Your payment is verified manually. Both the passed review and the verified payment are needed.'
    ],
    action: 'Fix anything the reviewers ask for and resubmit within 3 calendar days.',
    link: {
      to: '/review-rules',
      label: 'Read the Review Rules'
    }
  },
  {
    word: 'CERTIFY',
    step: '08',
    title: 'Verified Certificate Issuance',
    desc: 'Once payment is verified and technical review is approved, your official Certificate of Achievement is explicitly released and publicly verifiable on the registry.',
    happens: [
      'Once payment is verified and the review has passed, our team explicitly releases your Certificate of Achievement.',
      'The target is 2-3 working days after you pass.',
      'Every certificate can be checked on the public verification registry.'
    ],
    action: 'Download your certificate. Anyone can verify it on the registry.',
    link: {
      to: '/verify',
      label: 'Open the verification registry'
    }
  }
];


const SERVICES = [
  {
    Icon: Globe,
    tag: 'ENGINEERING',
    title: 'Web Application Development',
    text: 'Full-stack web applications tailored to business operations. Responsive React frontends, backed by secure, scalable Node.js and Python APIs and robust database architectures.',
    chips: [
      'React',
      'Node.js',
      'Python',
      'Databases'
    ]
  },
  {
    Icon: Smartphone,
    tag: 'MOBILE',
    title: 'Mobile Application Development',
    text: 'Native and cross-platform mobile applications engineered for performance and fluid user experience. Reliable Android and iOS software with clean UI/UX implementation.',
    chips: [
      'Android',
      'iOS',
      'Cross-platform',
      'UI/UX'
    ]
  },
  {
    Icon: Bot,
    tag: 'INTELLIGENCE',
    title: 'AI Automation',
    text: 'Repeat work handed to intelligent automations, custom workflow pipelines, and data-driven systems.',
    chips: [
      'Automations',
      'Workflow pipelines',
      'Data-driven systems'
    ]
  },
  {
    Icon: GraduationCap,
    tag: 'ACADEMY',
    title: 'Training & Internships',
    text: 'Learn by building production-ready projects, receive structured milestone reviews, and leave with verifiable proof.',
    chips: [
      'Real projects',
      'Milestone reviews',
      'Verifiable proof'
    ]
  }
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
          <div className="svc-grid">
            {SERVICES.map(({ Icon, tag, title, text, chips }) => (
              <article className="svc-card rv" key={tag}>
                <div className="svc-top">
                  <span className="svc-ico" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
                  <small>{tag}</small>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ul className="svc-chips" aria-label={`${title} focus areas`}>
                  {chips.map((chip) => (
                    <li key={chip}>{chip}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProgramShowcase programs={programs} loading={loading} configured={configured} />

      <CertificateShowcase />

      {/* 04 - STUDENT REVIEWS: continuous right-to-left marquee (live approved reviews win; the approved sample set shows until launch) */}
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
