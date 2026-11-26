import React from 'react';
import {
  SUPPORT_EMAIL,
  CONTACT_EMAIL,
  INTERNSHIP_EMAIL,
  FOUNDER_EMAIL,
  NOREPLY_EMAIL,
} from '../config/supportContact';
import './email-guide.css';

const ROWS = [
  { email: SUPPORT_EMAIL, use: 'Students\u2019 questions and support', reply: true },
  { email: CONTACT_EMAIL, use: 'General enquiries, clients and services', reply: true },
  { email: INTERNSHIP_EMAIL, use: 'Application, offer letter, certificate and verification', reply: true },
  { email: FOUNDER_EMAIL, use: 'Founder and partnerships', reply: true },
  { email: NOREPLY_EMAIL, use: 'Automatic emails only. Replies are not monitored', reply: false },
];

export default function EmailGuide() {
  return (
    <section className="eg" data-testid="email-guide" aria-labelledby="eg-title">
      <h2 id="eg-title">Which email is for what</h2>
      <ul>
        {ROWS.map((r) => (
          <li key={r.email}>
            {r.reply ? <a href={`mailto:${r.email}`}>{r.email}</a> : <span className="eg-addr">{r.email}</span>}
            <span className="eg-use">{r.use}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
