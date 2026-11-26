import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CONTACT_EMAIL } from '../config/supportContact';
import EmailGuide from '../components/EmailGuide';
import './services-packages.css';

/* Legal pages for NOXIRA's website and Android app services (separate from the
   internship policies in PolicyPage.jsx). Draft wording for the owner to review.
   Items in [SQUARE BRACKETS] are placeholders the owner must fill in before launch. */

const ADDRESS = 'Maharashtra, India';
const UPDATED = '27 November 2026';

const PAGES = {
  terms: {
    eyebrow: 'WEBSITE AND ANDROID APP SERVICES',
    title: 'Services Terms',
    intro: 'These terms apply when you hire NOXIRA to build a website or an Android app. They sit alongside the package details on the Services page. The internship programme has its own Terms & Conditions.',
    sections: [
      { h: 'Who we are', p: ['NOXIRA TECHNOLOGIES is a growing software and internship team based in Maharashtra, India. "We" and "us" mean NOXIRA. "You" and "the client" mean the person or business that orders a package or custom work.'] },
      { h: 'Accepting these terms', p: ['By paying the advance, accepting a quote, or confirming a project with us on WhatsApp or email, you agree to these terms. If you do not agree, please do not place an order. Package details on the Services page are part of these terms.'] },
      { h: 'How a project starts', p: ['A project moves through these steps:'], list: ['You pick a package or send your custom requirement.', 'We confirm the scope, price and expected delivery time in writing (WhatsApp or email counts).', 'You pay the 50% advance.', 'You send the content and access we need and we start work.', 'We share progress for your review, make the included revisions, and you pay the remaining 50%.', 'We launch or hand over the finished work.'] },
      { h: 'Scope of work', p: ['The work we do is what the chosen package lists as included, plus anything we agree in writing on WhatsApp or email before work starts. Anything listed as "not included" is outside the price.', 'A request that goes beyond the agreed scope is quoted separately. We start it only after you accept the quote.'] },
      { h: 'Prices and payment', p: ['Prices on the Services page are one-time project prices in Indian rupees.'], list: ['50% advance to start the project.', '50% before launch. We hand over the final files or publish the live site or app after this payment.', 'Work starts when the advance is received and we have the material we need from you.'] },
      { h: 'Charged separately', p: ['These costs are not part of the package price. You pay them directly or we pass them on at actual cost, agreed with you first:'], list: ['Google Play Store developer account', 'DLT registration and SMS charges', 'Server hosting (beyond any hosting included in your package)', 'Paid third-party APIs and services', 'iOS app development and the Apple developer account'] },
      { h: 'Quoted separately', p: ['These need their own scope and price, so they are not covered by the standard packages:'], list: ['E-commerce', 'Payment gateway integration', 'Complex CRM'] },
      { h: 'Taxes and invoices', p: ['We share a payment receipt or invoice for every payment on request. If GST or any other tax applies to your order, it is shown in the quote and is paid by you on top of the price. Quotes that do not mention tax are for the amount stated.'] },
      { h: 'Late payment', p: ['If a payment is more than 7 days late, we may pause work until it is received. Paused time does not count towards the delivery timeline. We do not publish or hand over the final work while any part of the agreed price is unpaid.'] },
      { h: 'Delivery timelines', p: ['Each package shows an expected delivery time in working days. The clock starts when the advance and the material we need (text, images, logo, access) are received. Delays in feedback, content or payment move the delivery date by the same amount.'] },
      { h: 'Review and approval', p: ['We share work for your review at sensible points. Please reply with your feedback in one list where possible. If we do not hear from you for 14 days after sharing finished work, we may treat it as approved and ask for the final payment.'] },
      { h: 'Revisions', p: ['Each package includes the number of revision rounds it lists. A revision round means changes to work already delivered within the agreed scope. New features, new pages or a change of direction count as new work and are quoted separately.'] },
      { h: 'What we need from you', p: ['You agree to:'], list: ['Give accurate information and send content, images and access on time.', 'Own or have the right to use everything you send us, including logos, text, photos and fonts.', 'Review work and reply with feedback promptly.', 'Pay on the schedule above.'] },
      { h: 'Your content and materials', p: ['You are responsible for the text, images, logos, product details, prices and legal information (for example business registration or licence numbers) that appear on your site or app. We do not check them for accuracy or for rights. If a claim is made that something you supplied infringes someone else\'s rights, you are responsible for it.', 'We can suggest layouts and wording, but copywriting and paid stock photos are not included unless the package says so.'] },
      { h: 'Domain, hosting and accounts', p: ['Domain names, hosting, app store accounts and similar accounts should be registered in your name or your business name wherever possible, so you stay in control. If we buy something for you under a package, we tell you what it is and give you the login details on request after full payment. Renewals after the included period (for example the first year of a domain) are paid by you.'] },
      { h: 'Ownership and intellectual property', p: ['After the full payment is received, the finished work made for you becomes yours to use. Until then, ownership stays with NOXIRA.', 'We may reuse our own general tools, code libraries and methods across projects. We may show the finished project in our portfolio unless you ask us in writing not to.'] },
      { h: 'Support after launch', p: ['Each package lists a bug-support period after launch. Support means fixing errors in what we built. It does not cover new features, content updates, or problems caused by changes made by someone else.'] },
      { h: 'Android app publishing', p: ['Google decides whether an app is approved on the Play Store, and can change its rules or review times. We prepare the app to follow Google\'s published requirements at the time and help with the submission. We cannot promise approval or a particular approval date. A Play Store developer account is charged separately, as listed above.'] },
      { h: 'Website performance, SEO and results', p: ['Basic SEO setup helps search engines understand your pages. It does not guarantee any ranking, traffic or number of enquiries. Results depend on your content, competition, search engine changes and time.'] },
      { h: 'Warranty disclaimer', p: ['Apart from what these terms and your package state, we provide the work "as is". We do not give any other promise that it will suit a particular purpose or work without interruption on every device, browser or operating system version.'] },
      { h: 'Third-party services', p: ['Your project may depend on hosting providers, app stores, payment providers and APIs. We do not control them and are not responsible for their downtime, policy changes, approvals or fees.'] },
      { h: 'Cancellation and refunds', p: ['Payments for services are not refundable. A refund is given in only two cases: (1) NOXIRA cancels the project or cannot deliver the agreed work, or (2) you are charged twice for the same payment. Both sides should raise cancellation or a double payment in writing, which includes WhatsApp or email.'] },
      { h: 'Acceptable use', p: ['We will not build, and you agree not to use our work for, anything illegal, misleading, abusive or that infringes others\' rights. We may refuse or stop a project that falls into these groups, and the advance is handled as described under cancellation.'] },
      { h: 'Limitation of liability', p: ['We build in good faith and test our work, but we cannot promise that a website or app will be free of every error or that it will bring a particular amount of traffic, sales or ranking. To the extent the law allows, our liability for any claim is limited to the amount you paid us for the work in question. We are not liable for indirect losses such as lost profit or lost data.'] },
      { h: 'Confidentiality', p: ['We keep your business information, credentials and project material private and use them only to deliver your project.'] },
      { h: 'Delays outside our control', p: ['We are not responsible for a delay or failure caused by things outside our reasonable control, such as illness, power or internet failure, natural events, government action, or a third-party provider being unavailable. We will tell you as soon as we can and agree a new timeline.'] },
      { h: 'Communication', p: ['We mainly work over WhatsApp, phone and email. Messages sent there count as written communication for scope changes, approvals and cancellation. Please keep your contact details up to date. We usually reply on working days.'] },
      { h: 'Complete agreement', p: ['These terms, your package details and the written scope we agree make up the whole agreement for the project. If a part of these terms is found to be unenforceable, the rest stays in force. You may not transfer your order to someone else without our written agreement.'] },
      { h: 'Changes to these terms', p: ['We may update these terms. The version on this page when you place your order applies to that order.'] },
      { h: 'Contact', p: ['Questions about these terms:'], contact: true },
    ],
  },
  privacy: {
    eyebrow: 'WEBSITE AND ANDROID APP SERVICES',
    title: 'Services Privacy',
    intro: 'This explains what we collect when you contact NOXIRA about a website or app, and what we do with it. The internship programme has its own Privacy Policy.',
    sections: [
      { h: 'Who is responsible', p: ['NOXIRA TECHNOLOGIES, a growing software and internship team based in Maharashtra, India, decides how the information described here is used.'] },
      { h: 'About this policy', p: ['This policy covers the website and Android app services pages of NOXIRA: the Services page, its enquiry form and WhatsApp buttons, and the conversations that follow. It is written with India\'s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 in mind.'] },
      { h: 'What we collect', p: ['When you use the custom requirement form or WhatsApp buttons on our Services page, we receive what you choose to send:'], list: ['Your name, email address and phone number (these fields are optional)', 'The description of your project requirement', 'Anything else you tell us in the WhatsApp or email conversation, such as business details, files or deadlines'] },
      { h: 'Information collected automatically', p: ['Like most websites, the site and its hosting provider may record basic technical data when you visit, such as browser type, device type, pages viewed, approximate location from your IP address, and the date and time. We use this to keep the site working, find faults and understand how pages are used.'] },
      { h: 'How the form works', p: ['The form on the Services page does not store your details on our server. When you press "Send on WhatsApp", your browser opens WhatsApp with your message ready, and you choose to send it. The message then reaches us through WhatsApp and is handled under WhatsApp\'s own terms and privacy policy.'] },
      { h: 'Why we may use your information', p: ['We use your information because you asked us to (for example for a quote), because it is needed to deliver and support a project you hired us for, to meet legal and tax duties, or with your consent. Where we rely on consent, you can withdraw it at any time by telling us.'] },
      { h: 'How we use it', p: ['We use your details only to:'], list: ['Reply to your enquiry and discuss your requirement', 'Prepare a quote and scope for your project', 'Deliver the work if you hire us, including invoices and support'] },
      { h: 'Project information from clients', p: ['If you hire us, we may also receive business content, logins, files, customer lists or other material for your site or app. We use it only for your project, keep it confidential, and ask you to share logins only through a channel you are comfortable with and to change passwords after the work is done. If your site or app collects data from your own visitors, you are responsible for your own privacy policy and for following the law for that data.'] },
      { h: 'Sharing', p: ['We do not sell your personal data. We share it only with services we need to deliver your project, such as hosting, domain, app store or payment providers, and only to the extent needed. We may disclose information if the law requires it.'] },
      { h: 'Payments', p: ['We do not collect or store your card, UPI PIN or net-banking details through this website. If a payment is made by UPI, bank transfer or a payment provider, that provider or your bank processes it, and we see only what is needed to confirm and record the payment, such as the amount, date and reference number.'] },
      { h: 'Cookies and analytics', p: ['This website may use cookies and similar storage for basic operation, such as remembering your theme choice, and may use analytics to see how pages are used. You can block or delete cookies in your browser settings. Some parts of the site may not work as expected if you do.'] },
      { h: 'How long we keep it', p: ['We keep enquiry and project information for as long as needed to respond, deliver and support the work, and to meet legal and accounting needs. After that we delete it or remove identifying details.'] },
      { h: 'Where information is stored', p: ['Information may be stored on our devices, in WhatsApp, in email and messaging accounts, and with cloud tools or hosting providers we use. Some of these providers keep data on servers outside India. We choose reputable providers and share only what is needed.'] },
      { h: 'Security', p: ['We take reasonable steps to protect the information we hold. No method of sending or storing data is fully secure, so we cannot guarantee absolute security.'] },
      { h: 'Your rights', p: ['You can ask us to:'], list: ['Tell you what personal information we hold about you', 'Correct information that is wrong or out of date', 'Delete your information, unless we must keep it by law', 'Stop contacting you or withdraw a consent you gave', 'Nominate someone to exercise these rights for you if you cannot'] , p2: 'Write to the contact below from the email or phone number you used with us so we can confirm it is you. We aim to reply within 30 days.' },
      { h: 'Complaints', p: ['If you are unhappy with how we handled your information, contact us first and we will try to fix it. If it is not resolved, you can complain to the Data Protection Board of India once it is operational, or to any other authority the law provides.'] },
      { h: 'Links to other sites', p: ['Our pages may link to other websites or apps, such as WhatsApp. We do not control them and are not responsible for how they handle information. Please read their policies.'] },
      { h: 'Children', p: ['Our services are meant for businesses and adults. We do not knowingly collect information from children.'] },
      { h: 'Changes', p: ['We may update this page. The date below shows the latest update.'] },
      { h: 'Contact', p: ['For privacy questions or requests:'], contact: true },
    ],
  },
};

export default function ServicesLegalPage({ slug }) {
  const page = PAGES[slug];
  const other = slug === 'terms' ? { to: '/services-privacy', label: 'Services Privacy' } : { to: '/services-terms', label: 'Services Terms' };
  return (
    <div className="pkg">
      <div className="glow" />
      <section className="pkg-hero">
        <div className="wrap pk-legal">
          <Link to="/services" className="pk-back"><ArrowLeft aria-hidden="true" /> Back to Services</Link>
          <p className="kick">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="pkg-lede">{page.intro}</p>
          <p className="pk-updated">Last updated: {UPDATED}</p>
          <div className="pk-doc">
            {page.sections.map((s, i) => (
              <section key={s.h} className="pk-doc-sec">
                <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.h}</h2>
                {s.p.map((t) => <p key={t}>{t}</p>)}
                {s.list && <ul>{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
                {s.p2 && <p>{s.p2}</p>}
                {s.contact && (
                  <p className="pk-doc-contact">
                    Email: {CONTACT_EMAIL}<br />
                    Address: {ADDRESS}
                  </p>
                )}
              </section>
            ))}
          </div>
          <EmailGuide />
          <p className="pk-doc-more">See also: <Link to={other.to}>{other.label}</Link> · <Link to="/terms">Internship Terms</Link> · <Link to="/privacy">Internship Privacy</Link></p>
        </div>
      </section>
    </div>
  );
}
