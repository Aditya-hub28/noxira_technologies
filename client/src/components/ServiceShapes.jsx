import React from 'react';
import {
  Globe, Smartphone, GraduationCap, ChevronLeft, ChevronRight, RotateCw, Lock,
  MoreVertical, Home, Search, Bell, User, Signal, Wifi, BatteryFull,
} from 'lucide-react';
import './service-shapes.css';

/* Home "What we build" cards. Each card is shaped like what it represents:
   a browser window (web), a phone (mobile app) and a certificate (training).
   Text and chips come from the SERVICES list in HomePage, unchanged. */

const ICON = { browser: Globe, phone: Smartphone, cert: GraduationCap };

function Head({ shape, tag }) {
  const Icon = ICON[shape];
  return (
    <div className="sx-top">
      <span className="sx-ico" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
      <small>{tag}</small>
    </div>
  );
}

function Chips({ title, chips }) {
  return (
    <ul className="sx-chips" aria-label={`${title} focus areas`}>
      {chips.map((chip) => <li key={chip}>{chip}</li>)}
    </ul>
  );
}

function BrowserCard({ item }) {
  return (
    <article className="sx-card sx-web rv">
      <div className="sx-tabs" aria-hidden="true">
        <div className="sx-dots"><i /><i /><i /></div>
        <div className="sx-tab"><b />yourbusiness.com</div>
        <div className="sx-tab sx-tab2">+ New tab</div>
      </div>
      <div className="sx-nav" aria-hidden="true">
        <ChevronLeft /><ChevronRight /><RotateCw />
        <div className="sx-addr"><Lock />https://yourbusiness.com</div>
        <MoreVertical />
      </div>
      <div className="sx-web-in">
        <div className="sx-body">
          <Head shape="browser" tag={item.tag} />
          <h3>{item.title}</h3>
          <p>{item.text}</p>
          <Chips title={item.title} chips={item.chips} />
        </div>
        <div className="sx-mock" aria-hidden="true">
          <div className="sx-hd"><b /><b style={{ width: 28 }} /><b style={{ width: 34 }} /></div>
          <div className="sx-stat">
            <div><span /><strong /></div>
            <div><span /><strong style={{ width: '48%' }} /></div>
          </div>
          <div className="sx-bars">
            {[38, 62, 48, 84, 58, 96, 72].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
          </div>
          <div className="sx-row"><i /><b /><em /></div>
          <div className="sx-row"><i /><b style={{ flex: 0.7 }} /><em /></div>
        </div>
      </div>
    </article>
  );
}

function PhoneCard({ item }) {
  return (
    <article className="sx-card sx-phone rv">
      <div className="sx-screen">
        <span className="sx-island" aria-hidden="true" />
        <div className="sx-status" aria-hidden="true">
          <span>9:41</span>
          <span><Signal /><Wifi /><BatteryFull /></span>
        </div>
        <div className="sx-appbar" aria-hidden="true">
          <div><div className="hi">NOXIRA Apps</div><div className="nm">Your idea, in hand</div></div>
          <span className="sx-avatar" />
        </div>
        <div className="sx-body">
          <div className="sx-panel">
            <Head shape="phone" tag={item.tag} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <Chips title={item.title} chips={item.chips} />
          </div>
        </div>
        <div className="sx-tabbar" aria-hidden="true">
          <Home className="on" /><Search /><Bell /><User />
        </div>
        <span className="sx-homebar" aria-hidden="true" />
      </div>
    </article>
  );
}

function CertCard({ item }) {
  return (
    <article className="sx-card sx-cert rv">
      <i className="sx-corner sx-c1" /><i className="sx-corner sx-c2" /><i className="sx-corner sx-c3" /><i className="sx-corner sx-c4" />
      <div className="sx-seal" aria-hidden="true">
        <span className="sx-disc"><GraduationCap strokeWidth={1.8} /></span>
        <span className="sx-tails"><i /><i /></span>
      </div>
      <div className="sx-body">
        <Head shape="cert" tag={item.tag} />
        <span className="sx-eyebrow">CERTIFICATE OF ACHIEVEMENT</span>
        <h3>{item.title}</h3>
        <div className="sx-rule"><i /><span /></div>
        <p>{item.text}</p>
        <Chips title={item.title} chips={item.chips} />
        <div className="sx-sigs" aria-hidden="true">
          <div className="sx-sig"><b>&nbsp;</b><i /><small>MENTOR REVIEW</small></div>
          <div className="sx-sig"><b>&nbsp;</b><i /><small>NOXIRA</small></div>
          <span className="sx-idline">VERIFIABLE ON THE PUBLIC REGISTRY</span>
        </div>
      </div>
    </article>
  );
}

export default function ServiceShapes({ items }) {
  const by = (shape) => items.find((i) => i.shape === shape);
  const web = by('browser');
  const app = by('phone');
  const cert = by('cert');
  return (
    <div className="sx-grid">
      {web && <BrowserCard item={web} />}
      {app && <PhoneCard item={app} />}
      {cert && <CertCard item={cert} />}
    </div>
  );
}
