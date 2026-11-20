// Extracted from client/src/pages/HomePage.jsx
// Career Tools & Courses section (deferred for current internship launch)
import React from 'react';
import { soon } from '../utils/toast.js';

export default function CareerToolsSection() {
  return (
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
  );
}
