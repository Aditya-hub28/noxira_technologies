import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, ArrowLeft } from 'lucide-react';

/**
 * Module 10: Public policy pages (Terms, Privacy, Payment & Refund, Review Rules).
 *
 * CONTENT RULE: every statement below maps to a decision the owner made on
 * record (6 Nov 2026). Items still pending owner decision are NOT guessed -
 * they appear in the PENDING_LAUNCH_ITEMS list and are visibly flagged on the
 * page. Do not fill these in without the owner's explicit decision.
 */

const PENDING_LAUNCH_ITEMS = [
  'Public support contact email - to be published before launch',
  'Deadline extension rule - deadline is communicated as strict; extension policy to be finalized before launch',
  'Data retention, deletion and consent handling - pending legal review before launch; nothing on this page is legal advice',
];

const POLICIES = {
  terms: {
    title: 'Terms & Conditions',
    intro: 'These terms govern participation in NOXIRA Technologies internship programmes. By applying, you accept these terms.',
    sections: [
      {
        heading: 'Who we are',
        body: 'NOXIRA Technologies is an independent software services and training brand operated by its founding team. Programme operations, reviews, and certificate decisions are handled by the founder and the authorised team.',
      },
      {
        heading: 'Eligibility',
        body: 'Programmes are open to college students, beginners, and working professionals. If you are below 18, please apply with a parent or guardian\u2019s awareness; specific eligibility requirements, if any, will be confirmed before launch.',
      },
      {
        heading: 'What a programme includes',
        body: 'Each programme provides practice projects, learning material, and review feedback on your submissions. Projects are practice work assigned by NOXIRA; they are not work for real clients.',
      },
      {
        heading: 'Duration and batches',
        body: 'Programmes run for one month, counted from the fixed batch start date. New batches start every month. Published batch deadlines are strict and must be followed.',
      },
      {
        heading: 'Programme fee',
        body: 'The programme fee is a one-time Rs. 99, payable only at final project submission. There is no separate charge for application, review, re-reviews, or the certificate. See the Payment & Refund Policy for details.',
      },
      {
        heading: 'Reviews and certificate',
        body: 'Every final submission receives an initial review plus up to 3 free re-reviews, as described in the Review Rules. A certificate is released only after your payment is verified and your review is passed, through an explicit release by our team - never automatically.',
      },
      {
        heading: 'Skill assessments',
        body: 'Skill tests are timed and server-clocked. Answers save automatically as you go and count up to the deadline; a submission that arrives late is scored only from answers saved in time. One attempt may be in progress at a time per course, and you can resume it. Results are recorded on your account. Certificates for passed assessments are released under the certificate policy in force at the time; until a pricing or release decision is published, passing does not by itself guarantee certificate delivery.',
      },
      {
        heading: 'Your project',
        body: 'Your project lives on your own GitHub account and remains yours. Submitted work must be your own. Suspected copied or misrepresented work is handled through the same review and re-review process as any other correction.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what data NOXIRA Technologies collects, who can see it, and how it is used.',
    sections: [
      {
        heading: 'What we collect',
        body: 'Application details you submit in the application form, final submission details (project link and payment transaction/UTR reference), and the review, payment, and certificate records created from them. If you create a student account, we also store your name, email address (verified by a one-time code), a secure hash of your password (never the password itself), your skill-test attempts, answers and scores, and any certificates earned.',
      },
      {
        heading: 'Who can access your data',
        body: 'Only the founder and the authorised NOXIRA team. Your data is not sold or shared with outside parties.',
      },
      {
        heading: 'What is public',
        body: 'Only the public certificate verification pages are visible to anyone holding a certificate ID or verification link: they show the recipient name, programme or assessment, and certificate status or score. Your email address, phone number, application details, quiz answers and account data are never shown publicly. Skill-test certificate links are long random tokens that are not listed or guessable in practice.',
      },
      {
        heading: 'Payment references',
        body: 'The UTR or transaction ID you submit is stored so our team can manually verify your payment against actual bank/UPI records. Until verified, it is treated as an unconfirmed claim.',
      },
      {
        heading: 'Account security',
        body: 'Sign-in uses a secure session cookie. Email verification codes are stored only as hashes and expire after 10 minutes. Pages that show your private records require either a verified email address or your unique application ID, and repeated failed lookups are rate-limited.',
      },
      {
        heading: 'Cookies',
        body: 'We use a small number of strictly necessary cookies for sign-in sessions and security. We do not use advertising or cross-site tracking cookies. See the Cookie Policy for the full list.',
      },
      {
        heading: 'Communications',
        body: 'We contact you on the channels you provide (including WhatsApp and email) for programme updates, and occasionally for promotional messages about future NOXIRA programmes.',
      },
      {
        heading: 'Corrections and retention',
        body: 'Student records are retained for verification and record-keeping. The portal currently has no self-service deletion option; requests about your data (including correction) can be made through our support contact once published. Final retention and data-rights handling is under legal review before launch.',
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: 'This policy lists the cookies this portal uses and why. The list reflects the actual implementation.',
    sections: [
      {
        heading: 'Strictly necessary cookies',
        body: 'The student sign-in session cookie keeps you logged in between pages. It is a first-party, HttpOnly cookie (not readable by scripts) with a limited lifetime, and it is removed when you log out. The admin portal uses an equivalent admin session cookie.',
      },
      {
        heading: 'What we do not use',
        body: 'No advertising cookies, no cross-site tracking cookies, and no analytics cookies are set by this portal at the time of writing. If analytics are added later, this page will be updated before they go live.',
      },
      {
        heading: 'Managing cookies',
        body: 'You can block or delete cookies in your browser settings. Blocking the session cookie will prevent sign-in from working; the public pages of the site do not require any cookies.',
      },
    ],
  },
  refund: {
    title: 'Payment & Refund Policy',
    intro: 'This policy covers the one-time programme fee, how it is confirmed, and when refunds apply.',
    sections: [
      {
        heading: 'Fee and payment method',
        body: 'The fee is a one-time Rs. 99, paid at final project submission through the UPI QR shown in the submission form. You then enter your UTR/transaction ID in the form.',
      },
      {
        heading: 'Manual verification',
        body: 'A submitted UTR/transaction ID is a claim, not proof. Our team verifies each payment against actual bank/UPI receipts before marking it confirmed. Your certificate process continues only after this verification.',
      },
      {
        heading: 'Refund rule',
        body: 'The programme fee is non-refundable.',
      },
      {
        heading: 'Exceptions',
        body: 'A refund is issued in two cases: (1) NOXIRA cancels the programme, or (2) a duplicate/accidental double payment for the same programme.',
      },
    ],
  },
  review: {
    title: 'Review Rules',
    intro: 'How project reviews, corrections, and passing work in every NOXIRA programme.',
    sections: [
      {
        heading: 'Review rounds',
        body: 'Every final submission gets an initial review plus up to 3 free re-reviews. Each review is completed within 2-3 working days (Monday to Friday, excluding public holidays).',
      },
      {
        heading: 'Corrections',
        body: 'If changes are requested, you get 3 calendar days - weekends included - after each feedback to correct and resubmit your project.',
      },
      {
        heading: 'Pass criteria',
        body: 'A submission passes only when the task requirements are complete and the project is properly working. Both conditions must hold.',
      },
      {
        heading: 'After re-reviews are exhausted',
        body: 'If a submission has not passed after the initial review and all 3 re-reviews, the attempt ends and a certificate cannot be issued for that submission.',
      },
      {
        heading: 'Certificate release',
        body: 'Certificates are released only after payment is verified and the review is passed, through an explicit release by our team. The target is 2-3 working days after passing. Every certificate is verifiable on the public registry.',
      },
    ],
  },
};

export const POLICY_LINKS = [
  { slug: 'terms', path: '/terms', label: 'Terms & Conditions' },
  { slug: 'privacy', path: '/privacy', label: 'Privacy Policy' },
  { slug: 'cookies', path: '/cookies', label: 'Cookie Policy' },
  { slug: 'refund', path: '/payment-refund', label: 'Payment & Refund' },
  { slug: 'review', path: '/review-rules', label: 'Review Rules' },
];

export default function PolicyPage({ slug }) {
  const policy = POLICIES[slug];
  if (!policy) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Unknown policy page. <Link to="/" className="text-cyan-600 font-semibold">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-cyan-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">{policy.title}</h1>
      </div>
      <p className="text-xs text-slate-500 mb-2">{policy.intro}</p>
      <p className="text-[11px] text-slate-400 mb-2">Last updated: 8 November 2026</p>
      <p className="text-[11px] font-semibold text-cyan-700 bg-amber-50 border border-amber-200 rounded-md inline-block px-2 py-1 mb-8">Draft - pending final owner confirmation and legal review before launch. This page is not legal advice.</p>

      <div className="space-y-6">
        {policy.sections.map((s) => (
          <section key={s.heading} className="glass-card p-6 sm:p-7">
            <h2 className="text-sm font-bold text-ink-950 mb-1.5">{s.heading}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Being finalized before launch</h3>
        </div>
        <ul className="list-disc list-inside text-xs text-amber-900/80 space-y-1">
          {PENDING_LAUNCH_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap gap-4 text-xs">
        {POLICY_LINKS.filter((l) => l.slug !== slug).map((l) => (
          <Link key={l.slug} to={l.path} className="text-cyan-600 hover:text-cyan-700 font-semibold">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
