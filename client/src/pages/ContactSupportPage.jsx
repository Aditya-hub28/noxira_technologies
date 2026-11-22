import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Mail, Phone } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, SUPPORT_LOCATION } from '../config/supportContact';
import '../doc.css';

/**
 * Contact Support. The form is frontend-only for now (no backend): it only
 * validates and shows a notice. Nothing is sent anywhere.
 */
export default function ContactSupportPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [notice, setNotice] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setNotice('Thanks! Messaging is not connected yet, so this was not sent. Please use the contact details above once they are published.');
  };

  return (
    <div className="nxdoc">
      <Link to="/" className="back"><ArrowLeft width={14} height={14} /> Back to Home</Link>
      <h1>Contact Support</h1>
      <p className="intro">Have a question about our internship program? Contact us here and we will get back to you.</p>

      <section className="sec">
        <h2>Ways to reach us</h2>
        <ul className="ways">
          <li><MapPin /><span><b>Visit Us:</b> {SUPPORT_LOCATION}</span></li>
          <li><Mail /><span><b>Email:</b> <span data-testid="support-email">{SUPPORT_EMAIL}</span></span></li>
          <li><Phone /><span><b>Call Us and WhatsApp:</b> <span data-testid="support-whatsapp">{SUPPORT_WHATSAPP}</span></span></li>
        </ul>
      </section>

      <section className="sec">
        <h2>Send us your message</h2>
        <p>Fill in this form and we will get back to you:</p>
        <form onSubmit={submit}>
          <label htmlFor="cs-name">Full Name</label>
          <input id="cs-name" required value={form.name} onChange={set('name')} autoComplete="name" />
          <label htmlFor="cs-email">Email Address</label>
          <input id="cs-email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
          <label htmlFor="cs-phone">Phone Number</label>
          <input id="cs-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          <label htmlFor="cs-msg">Your Message</label>
          <textarea id="cs-msg" required rows={5} value={form.message} onChange={set('message')} />
          <button type="submit" className="send">Send Message</button>
          {notice && <p role="status" className="notice">{notice}</p>}
        </form>
      </section>
    </div>
  );
}
