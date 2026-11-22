import { Link } from 'react-router-dom';
import { ArrowRight, FileDown, ShieldCheck } from 'lucide-react';
import './certificate-showcase.css';

export default function CertificateShowcase() {
  return (
    <section id="verification-teaser" className="cert-showcase" aria-labelledby="cert-showcase-title">
      <div className="wrap cert-layout">
        <div className="cert-copy">
          <p className="kick">YOUR WORK. YOUR CREDENTIAL.</p>
          <h2 id="cert-showcase-title">Build something real.<br /><span>Have something to show.</span></h2>
          <p className="cert-intro">Turn completed work into a NOXIRA Certificate of Achievement, with a unique credential ID that can be checked through our verification portal.</p>
          <div className="cert-detail"><ShieldCheck size={20} aria-hidden="true" /><p><strong>A record people can check</strong><span>Share your issued credential ID so others can look up its authenticity and current registry status.</span></p></div>
          <div className="cert-detail"><ArrowRight size={20} aria-hidden="true" /><p><strong>Earned through the process</strong><span>Certificates are released after technical approval and manual payment verification, as explained in the internship journey.</span></p></div>
          <div className="cert-actions">
            <Link to="/apply" className="gb pri">Explore Internships <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link to="/verify" className="gb">Verify Certificate <ShieldCheck size={16} aria-hidden="true" /></Link>
            <Link to="/offer-letter" className="gb">Download Offer Letter <FileDown size={16} aria-hidden="true" /></Link>
          </div>
          <p className="cert-action-note">Already shortlisted? Use your application details to find your offer letter.</p>
        </div>
        <figure className="cert-figure">
          <div className="cert-paper" aria-label="Demo NOXIRA certificate layout. Sample only, not an issued credential.">
            <header className="cert-paper-top"><img src="/noxira-wordmark.png" alt="NOXIRA Technologies" /><span>DEMO<br />NOT ISSUED</span></header>
            <div className="cert-paper-body">
              <p className="cert-paper-eyebrow">A PREVIEW OF YOUR NEXT MILESTONE</p>
              <h3>CERTIFICATE <span>OF ACHIEVEMENT</span></h3>
              <p className="cert-paper-label">Presented to</p>
              <p className="cert-paper-name">Your name here</p>
              <div className="cert-paper-rule" />
              <p className="cert-paper-label">For completing the requirements of</p>
              <p className="cert-paper-track">Your internship programme</p>
            </div>
            <div className="cert-paper-bottom"><span>SAMPLE PREVIEW ONLY</span><span>No credential ID assigned</span></div>
          </div>
          <figcaption><span className="cert-demo-dot" /> Illustrative demo, not a valid certificate. Final issued design may differ.</figcaption>
        </figure>
      </div>
    </section>
  );
}
