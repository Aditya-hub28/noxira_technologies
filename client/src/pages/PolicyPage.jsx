import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SUPPORT_EMAIL } from '../config/supportContact';
import '../doc.css';

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
    official: true,
    intro: 'This page provides a clear overview of your rights, payment terms, and responsibilities, ensuring transparency at every step. We are committed to maintaining fair policies, responsible practices, and a trustworthy experience for everyone.',
    sections: [
      { heading: 'Introduction', body: 'By using NOXIRA TECHNOLOGIES website, participating in its internship programs, or accessing its services, you agree to comply with these Terms and Conditions.' },
      { heading: 'Services Offered', body: 'NOXIRA TECHNOLOGIES provides digital internships:', list: ['Internship programs with practical tasks and projects'] },
      { heading: 'Eligibility', body: 'Users must meet the eligibility requirements of the internship program. All information provided during application must be accurate, complete and up to date. Applicants must not use false identities or submit misleading qualifications or documents.' },
      { heading: 'User Responsibilities', body: 'To maintain a fair and safe environment, users must:', list: ['Avoid plagiarism or cheating in any submitted tasks', 'Use all services legally and ethically', 'Not misuse or redistribute platform content', 'Not attempt hacking, copying, or reverse-engineering'], after: 'Violation of these responsibilities may lead to immediate suspension or termination of services.' },
      { heading: 'Internship Fees & Payments', body: 'Internship participation requires a small task submission fee to cover administrative costs:', fee: { label: 'Internship Task Submission Fee', plan: '1 MONTH INTERNSHIP', price: '\u20B9149' }, quote: '"These are task review charges, not hidden fees, and help maintain platform operations, servers, and mentorship support."', after: 'These charges help support servers, mentors, and platform operations. They are charged only for managing and reviewing tasks. No personal profit or unnecessary fees are collected.' },
      { heading: 'Refund Policy', body: 'All payments are non-refundable unless NOXIRA TECHNOLOGIES cancels the program itself.', after: 'Please ensure you are committed to the program before making any payment. Refunds are issued only in the rare event that NOXIRA TECHNOLOGIES cancels the specific program you enrolled in, or when a duplicate or accidental double payment is made for the same program.' },
      { heading: 'Certificates & Deliverables', body: 'Certificates are issued only after successful completion of tasks and a positive performance evaluation by our mentors.' },
      { heading: 'Intellectual Property', body: 'All content, code, branding, and materials belong to NOXIRA TECHNOLOGIES and cannot be copied, resold, or redistributed without explicit written permission.' },
      { heading: 'Confidentiality', body: 'Any project data shared with NOXIRA TECHNOLOGIES is treated with strict confidentiality and is protected by our internal security protocols.' },
      { heading: 'Limitation of Liability', body: 'NOXIRA TECHNOLOGIES is not responsible for:', list: ['Internet or technical issues on the user\'s end', 'Data loss due to user mistakes or negligence', 'Third-party payment failures or delays', 'External tool downtime or API failures'] },
      { heading: 'Third-Party Tools', body: 'Some services may use payment gateways, APIs, or hosting providers beyond NOXIRA TECHNOLOGIES\' control. Usage of these tools is subject to their respective terms.' },
      { heading: 'Updates to Terms', body: 'Terms may change anytime to reflect changes in our services or legal requirements. Continued use of the platform means acceptance of the updated terms.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    official: true,
    intro: 'This page explains your rights, payments, and responsibilities clearly to ensure transparency and trust. We believe in transparent policies and fair usage.',
    sections: [
      { heading: 'Information Collected', body: 'We collect the following information to provide and improve our services:', list: ['Name, email, and phone number for account creation and communication', 'Payment details processed securely through our payment partners', 'Internship activity including task submissions and performance data', 'Website usage analytics to understand how users interact with our platform'] },
      { heading: 'How Data Is Used', body: 'Your data is used for the following purposes:', list: ['Service delivery including internship', 'Communication and support to assist you with any queries', 'Certificates and invoices generation upon completion'] },
      { heading: 'Data Protection', body: 'NOXIRA TECHNOLOGIES uses industry-standard security practices and restricted access protocols to protect your personal data from unauthorized access, alteration, or disclosure.' },
      { heading: 'Data Sharing', body: 'Your data is never sold to third parties. It may be shared only with trusted service providers like payment gateways or hosting partners strictly for the purpose of service delivery.' },
      { heading: 'User Rights', body: 'You have the right to request correction, deletion, or access to your personal data.' },
      { heading: 'Data Retention', body: 'Data is stored only as long as needed for the fulfillment of our services and to comply with legal and regulatory requirements.' },
      { heading: "Children's Privacy", body: 'Our services are intended for users above 15 years of age. We do not knowingly collect data from children under this age.' },
      { heading: 'Updates', body: 'This policy may change anytime to reflect changes in our data practices. Any updates will be posted on this page with a revised "Last Updated" date.' },
      { heading: 'Contact', body: 'If you have any questions regarding your privacy, please contact us at:', contact: true },
    ],
  },
  cookies: {
    title: 'Cookies Policy',
    official: true,
    intro: 'This page explains your rights, payments, and responsibilities clearly to ensure transparency and trust. We believe in transparent policies and fair usage.',
    sections: [
      { heading: 'What Cookies Are', body: 'Cookies are small text files that are stored on your device when you visit a website. They help improve your browsing experience by remembering your preferences and analyzing how you use the site.' },
      { heading: 'How NOXIRA TECHNOLOGIES Uses Cookies', body: 'We use cookies for the following purposes:', list: ['Remember user preferences such as language and login status', 'Analyze traffic to understand which parts of our site are most popular', 'Improve performance by identifying and fixing technical issues'] },
      { heading: 'Third-Party Cookies', body: 'In addition to our own cookies, we may also use third-party cookies from trusted partners like Google Analytics and payment providers to help us analyze usage and process transactions.' },
      { heading: 'Managing Cookies', body: 'You have full control over your cookie settings. Most browsers allow you to disable or delete cookies through their settings menu. Please note that disabling cookies may affect the functionality of some parts of our website.' },
      { heading: 'Consent', body: 'By continuing to use our website, you consent to our use of cookies as described in this policy. We will always notify you of any major changes to our cookie practices.' },
      { heading: 'Updates', body: 'This policy may be updated from time to time to reflect changes in technology or legal requirements. We encourage you to review this page periodically for the latest information.' },
      { heading: 'Contact', body: 'If you have any questions about our use of cookies, please reach out to us:', contact: true },
    ],
  },
  refund: {
    title: 'Payment & Refund Policy',
    intro: 'This policy covers the one-time programme fee, how it is confirmed, and when refunds apply.',
    sections: [
      {
        heading: 'Fee and payment method',
        body: 'The fee is a one-time \u20B9149, paid at final project submission through the UPI QR shown in the submission form. You then enter your UTR/transaction ID in the form.',
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
  { slug: 'cookies', path: '/cookies', label: 'Cookies Policy' },
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
    <div className="nxdoc">
      <Link to="/" className="back"><ArrowLeft width={14} height={14} /> Back to Home</Link>
      {policy.official && <p className="eyebrow">OFFICIAL POLICY</p>}
      <h1>{policy.title}</h1>
      <p className="intro">{policy.intro}</p>
      {!policy.official && (
        <p className="draft">Last updated: 6 November 2026. Draft - pending final owner confirmation and legal review before launch. This page is not legal advice.</p>
      )}

      {policy.sections.map((s) => (
        <section key={s.heading} className="sec">
          <h2>{s.heading}</h2>
          <p>{s.body}</p>
          {s.list && <ul>{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
          {s.fee && (
            <div className="fee">
              <div><small>{s.fee.label}</small><b>{s.fee.plan}</b></div>
              <span className="price">{s.fee.price}</span>
            </div>
          )}
          {s.quote && <p className="quote">{s.quote}</p>}
          {s.after && <p>{s.after}</p>}
          {s.contact && <p className="mail" data-testid="support-email">{SUPPORT_EMAIL}</p>}
        </section>
      ))}

      {!policy.official && (
        <div className="pending">
          <h3>Being finalized before launch</h3>
          <ul>{PENDING_LAUNCH_ITEMS.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <div className="more">
        {POLICY_LINKS.filter((l) => l.slug !== slug).map((l) => (
          <Link key={l.slug} to={l.path}>{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
