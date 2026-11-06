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
  'Detailed data retention schedule - pending final legal review',
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
        body: 'Participants must be at least 15 years old. Programmes are open to everyone - college students, beginners, and working professionals.',
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
        body: 'Application details you submit in the application form, final submission details (project link and payment transaction/UTR reference), and the review, payment, and certificate records created from them.',
      },
      {
        heading: 'Who can access your data',
        body: 'Only the founder and the authorised NOXIRA team. Your data is not sold or shared with outside parties.',
      },
      {
        heading: 'What is public',
        body: 'Only the public certificate verification page is visible to anyone: it shows the recipient name, programme, batch, and certificate status for a valid certificate ID. Your email address and phone number are never shown publicly.',
      },
      {
        heading: 'Payment references',
        body: 'The UTR or transaction ID you submit is stored so our team can manually verify your payment against actual bank/UPI records. Until verified, it is treated as an unconfirmed claim.',
      },
      {
        heading: 'Communications',
        body: 'We contact you on the channels you provide (including WhatsApp and email) for programme updates, and occasionally for promotional messages about future NOXIRA programmes.',
      },
      {
        heading: 'Corrections and retention',
        body: 'Student records are retained for verification and record-keeping. There is no self-service deletion option; you can request correction of inaccurate details through our support contact once published.',
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
  { slug: 'refund', path: '/payment-refund', label: 'Payment & Refund' },
  { slug: 'review', path: '/review-rules', label: 'Review Rules' },
];

export default function PolicyPage({ slug }) {
  const policy = POLICIES[slug];
  if (!policy) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Unknown policy page. <Link to="/" className="text-amber-600 font-semibold">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-amber-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">{policy.title}</h1>
      </div>
      <p className="text-xs text-slate-500 mb-2">{policy.intro}</p>
      <p className="text-[11px] text-slate-400 mb-8">Last updated: 6 November 2026</p>

      <div className="space-y-6">
        {policy.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-sm font-bold text-slate-900 mb-1.5">{s.heading}</h2>
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
          <Link key={l.slug} to={l.path} className="text-amber-600 hover:text-amber-700 font-semibold">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
