import React, { useState } from 'react';
import './services-packages.css';
import { Check, Minus, ArrowRight, MessageCircle, Phone, Lightbulb, FileText } from 'lucide-react';

/* Placeholder: put the NOXIRA business WhatsApp number here (digits only, with country code).
   While empty, the button opens WhatsApp with the message pre-filled and lets the visitor pick a chat. */
const WHATSAPP_NUMBER = '';
const wa = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
const rupee = (n) => '₹' + n.toLocaleString('en-IN');

const WEB = [
  {
    cap: 'A first website, online fast',
    name: 'Starter',
    price: 12000,
    tag: 'Intro offer, first 3 clients',
    best: 'Shops, clinics, coaching classes and local service businesses getting online for the first time.',
    inc: [
      '3-5 pages (for example Home, About, Services, Contact)',
      'Mobile friendly layout that works on every phone',
      'Contact form, WhatsApp button and Google Maps location',
      'Basic SEO setup so Google can understand your pages',
      'SSL certificate (secure https)',
      'First-year domain and hosting included, up to ₹1,000 each',
      '2 rounds of revisions',
      'Delivered in 7-12 working days',
      '15 days of bug support after launch',
    ],
    not: [
      'Admin panel or database',
      'E-commerce and online payments',
      'Domain or hosting cost above ₹1,000 each in year one',
      'Copywriting and paid stock photos',
    ],
  },
  {
    cap: 'Edit it yourself, get found',
    name: 'Business',
    price: 25000,
    best: 'Growing businesses that publish updates often and want to rank on Google.',
    featured: 'Most chosen',
    inc: [
      '5-8 pages with a consistent design',
      'Mobile friendly layout',
      'Blog section so you can post news and offers',
      'Basic CMS: change text and posts yourself, no developer needed',
      'Advanced SEO setup',
      'Analytics setup to see your visitors',
      'Contact form and WhatsApp button',
      '3 rounds of revisions',
    ],
    not: [
      'E-commerce, payment gateway or complex CRM (quoted separately)',
      'Domain and hosting charges',
      'Copywriting and paid stock photos',
      'Ongoing SEO campaigns',
    ],
  },
  {
    cap: 'Brand-level site with enquiries',
    name: 'Premium',
    price: 40000,
    best: 'Established businesses and brands that want a standout site and organised enquiries.',
    inc: [
      '8-12 pages with a custom section design',
      'Smooth animations and motion effects',
      'Advanced CMS for pages, blog and content',
      'Enquiry management: see and track incoming enquiries',
      'One basic third-party API integration',
      'Mobile friendly, with SEO and analytics setup',
      '4 rounds of revisions',
      '30 days of bug support after launch',
    ],
    not: [
      'E-commerce, payment gateway or complex CRM (quoted separately)',
      'Domain and hosting charges',
      'Copywriting and paid stock photos',
      'Ongoing SEO campaigns',
    ],
  },
];

const APPS = [
  {
    cap: 'Your business on their phone',
    name: 'Basic',
    price: 25000,
    best: 'Businesses that want an app to show services, menu, catalogue or contact details.',
    inc: [
      'Android app (APK delivered)',
      '4-6 informational screens',
      'Clean mobile UI designed for your business',
      'Screens for services, about, gallery and contact',
      'Call, WhatsApp and Maps buttons',
      'Works as a standalone app, installable from the APK',
    ],
    not: [
      'Login and backend or database',
      'Play Store account (charged separately)',
      'iOS app (charged separately)',
      'Server hosting and paid APIs',
    ],
  },
  {
    cap: 'Stay connected with customers',
    name: 'Business',
    price: 45000,
    best: 'Businesses that want customer logins, offers and notifications in one app.',
    featured: 'Most chosen',
    inc: [
      '6-10 screens',
      'OTP login for your customers',
      'Backend and database to store users and data',
      'Push notifications for offers and updates',
      'Basic admin panel to manage content',
      'Play Store publishing help',
      'Android app',
    ],
    not: [
      'Play Store account fee (charged separately)',
      'DLT and SMS charges for OTP (charged separately)',
      'Server hosting and paid APIs (charged separately)',
      'iOS app (charged separately)',
    ],
  },
  {
    cap: 'A full business process in an app',
    name: 'Premium',
    price: 75000,
    best: 'Businesses that want to run bookings, orders or internal workflows through an app.',
    inc: [
      '10-15 screens',
      'Advanced backend with a full admin panel',
      'Multiple API integrations',
      'Advanced workflows built around your process',
      'Android app',
    ],
    not: [
      'Play Store account, DLT and SMS (charged separately)',
      'Server hosting and paid APIs (charged separately)',
      'iOS app (charged separately)',
      'E-commerce, payment gateway or complex CRM (quoted separately)',
    ],
  },
];

function Card({ p, kind }) {
  return (
    <article className={'pk' + (p.featured ? ' pk-feat' : '')}>
      {p.featured ? <span className="pk-flag">{p.featured}</span> : null}
      <div className="pk-cap">{p.cap}</div>
      <h4>{p.name} {kind === 'app' ? 'App' : 'Website'}</h4>
      <div className="pk-from">Starting from</div>
      <div className="pk-price">{rupee(p.price)}</div>
      {p.tag ? <div className="pk-tag">{p.tag}</div> : null}
      <p className="pk-best"><b>Best for:</b> {p.best}</p>
      <ul className="pk-inc">
        {p.inc.map((t) => (<li key={t}><Check aria-hidden="true" strokeWidth={2.4} /><span>{t}</span></li>))}
      </ul>
      <div className="pk-nic">Not included</div>
      <ul className="pk-not">
        {p.not.map((t) => (<li key={t}><Minus aria-hidden="true" strokeWidth={2.4} /><span>{t}</span></li>))}
      </ul>
      <a className={'pk-btn' + (p.featured ? ' pk-btn-solid' : '')} href={wa(`Hi NOXIRA, I want a quote for the ${p.name} ${kind === 'app' ? 'Android app' : 'website'} package (${rupee(p.price)}).`)} target="_blank" rel="noopener noreferrer">
        Get a quote for this <ArrowRight aria-hidden="true" />
      </a>
    </article>
  );
}

export default function PackagesPage() {
  const [need, setNeed] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const goForm = (e) => {
    e.preventDefault();
    const f = document.getElementById('pk-need');
    const card = document.getElementById('pk-form');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 450);
  };
  const sendNeed = (e) => {
    e.preventDefault();
    const text = need.trim();
    if (!text) return;
    const lines = ['Hi NOXIRA, I have a custom requirement:', text];
    if (name.trim()) lines.push('Name: ' + name.trim());
    if (email.trim()) lines.push('Email: ' + email.trim());
    if (phone.trim()) lines.push('Phone: ' + phone.trim());
    window.open(wa(lines.join('\n')), '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="pkg">
      <div className="glow" />

      <section className="pkg-hero">
        <div className="wrap">
          <p className="kick">SERVICES AND PACKAGES</p>
          <h1>Websites and apps for your business,<br />at a price you can plan around.</h1>
          <p className="pkg-lede">Three website packages and three Android app packages. Every package lists what you get and what is not included, so nothing is a surprise later.</p>
          <div className="pkg-jump">
            <a href="#website-packages">Website packages</a>
            <a href="#app-packages">Android app packages</a>
            <a href="#terms">Payment terms</a>
          </div>
        </div>
      </section>

      <section id="website-packages">
        <div className="wrap">
          <p className="kick">01 - WEBSITES</p>
          <h2>Website packages</h2>
          <div className="pk-grid">{WEB.map((p) => <Card key={p.name} p={p} kind="web" />)}</div>
        </div>
      </section>

      <section id="app-packages">
        <div className="wrap">
          <p className="kick">02 - ANDROID APPS</p>
          <h2>Android app packages</h2>
          <div className="pk-grid">{APPS.map((p) => <Card key={p.name} p={p} kind="app" />)}</div>
        </div>
      </section>

      <section id="terms">
        <div className="wrap">
          <p className="kick">03 - TERMS</p>
          <div className="pk-terms">
            <div><h5>Payment</h5><p>50% advance to start. 50% before launch.</p></div>
            <div><h5>Charged separately</h5><p>Play Store account, DLT and SMS, server hosting, paid APIs and iOS.</p></div>
            <div><h5>Quoted separately</h5><p>E-commerce, payment gateway and complex CRM.</p></div>
          </div>
          <p className="pk-note">Prices are one-time project prices in Indian rupees. Tap "Get a quote for this" to message us on WhatsApp.</p>
        </div>
      </section>

      <section id="custom">
        <div className="wrap">
          <div className="pk-custom">
            <div className="pk-custom-left">
              <span className="pk-pill"><i /> Custom requirements</span>
              <h2>Contact NOXIRA.<br /><em>Let's talk ideas.</em></h2>
              <p className="pk-custom-text">NOXIRA builds websites and Android apps for small businesses. If your idea does not fit the six packages above, tell us what you want to build or change, and let's work out the right scope and a custom quote together.</p>
              <div className="pk-custom-btns">
                <a className="pk-wa-btn pk-wa-fill" href={wa('Hi NOXIRA, I have a custom requirement.')} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Chat on WhatsApp</a>
                <a className="pk-wa-btn" href="#pk-form" onClick={goForm}><Phone aria-hidden="true" /> Let's talk</a>
              </div>
              <ul className="pk-points">
                <li><Lightbulb aria-hidden="true" /><div><b>Share your idea</b><span>Type it in your own words, rough is fine.</span></div></li>
                <li><MessageCircle aria-hidden="true" /><div><b>Talk it through</b><span>We discuss features and timeline on WhatsApp.</span></div></li>
                <li><FileText aria-hidden="true" /><div><b>Get a custom quote</b><span>Priced for your requirement, not a fixed package.</span></div></li>
              </ul>
            </div>
            <form className="pk-glass" id="pk-form" onSubmit={sendNeed}>
              <h3>Tell us about your project</h3>
              <p className="pk-glass-sub">Describe your idea or the change you need in a package. Share as much or as little as you like.</p>
              <div className="pk-row">
                <div className="pk-field">
                  <label htmlFor="pk-name">Your Name</label>
                  <input id="pk-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
                </div>
                <div className="pk-field">
                  <label htmlFor="pk-email">Your Email</label>
                  <input id="pk-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </div>
              </div>
              <div className="pk-field">
                <label htmlFor="pk-phone">Phone with country code</label>
                <input id="pk-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" />
              </div>
              <div className="pk-field">
                <label htmlFor="pk-need">Your requirement <b>*</b></label>
                <textarea id="pk-need" rows={5} value={need} onChange={(e) => setNeed(e.target.value)} placeholder="What should it do? Who is it for? Any deadline in mind?" required />
              </div>
              <button type="submit" className="pk-submit">Send on WhatsApp <ArrowRight aria-hidden="true" /></button>
              <span className="pk-form-note">Opens WhatsApp with your message ready to send. Name, email and phone are optional.</span>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
