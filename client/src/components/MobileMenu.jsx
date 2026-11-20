import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/all';
import { currentTheme, toggleTheme } from '../theme.js';
import config from '../nx.config.js';
import { soon } from '../utils/toast.js';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useStudentAuth } from '../context/StudentAuthContext';
import '../menu.css';

export function ThemeToggle() {
  const [t, setT] = useState(currentTheme());

  useEffect(() => {
    const f = () => setT(currentTheme());
    window.addEventListener('nx:theme', f);
    return () => window.removeEventListener('nx:theme', f);
  }, []);

  return (
    <button
      type="button"
      className="nxtheme"
      role="switch"
      aria-checked={t !== 'light'}
      aria-label={t === 'light' ? 'Light theme on - tap for dark' : 'Dark theme on - tap for light'}
      title={t === 'light' ? 'Light theme on - tap for dark' : 'Dark theme on - tap for light'}
      onClick={() => toggleTheme()}
    >
      <span className="nxthumb" aria-hidden="true" />
      <span className="nxsun" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span className="nxmoon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.2 14.2A8.5 8.5 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4Z" />
        </svg>
      </span>
    </button>
  );
}

const Chev = () => (
  <svg
    className="chev"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default function MobileMenu({ open, onClose }) {
  const [exp, setExp] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { googleForm1Url, isFormConfigured } = useSiteSettings();
  const { student, logout } = useStudentAuth();

  const ref = useRef(null);
  const scrim = useRef(null);
  const hostRef = useRef(null);

  if (!hostRef.current && typeof document !== 'undefined') {
    const h = document.createElement('div');
    h.id = 'nxmenu-host';
    hostRef.current = h;
  }

  // Elastic pull physics for drawer buttons
  useEffect(() => {
    if (!hostRef.current) return;
    document.body.appendChild(hostRef.current);
    const host = hostRef.current;
    let cur = null;

    const pull = (b, dx, dy) => {
      const r = b.getBoundingClientRect();
      const mx = Math.max(-16, Math.min(16, dx));
      const my = Math.max(-14, Math.min(14, dy));
      gsap.to(b, {
        x: mx * 0.55,
        y: my * 0.55,
        scaleX: 1 + (Math.abs(mx) / r.width) * 0.5 + 0.01,
        scaleY: 1 - (Math.abs(mx) / r.width) * 0.35 - 0.04 + (Math.abs(my) / r.height) * 0.2,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    const rel = (b) =>
      gsap.to(b, {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 1.1,
        ease: 'elastic.out(1.1, 0.35)',
        overwrite: 'auto',
      });

    let sx = 0;
    let sy = 0;

    const dn = (e) => {
      const b = e.target.closest('.mfoot button');
      if (!b) return;
      cur = b;
      sx = e.clientX;
      sy = e.clientY;
      pull(b, 0, 0);
    };

    const mv = (e) => {
      if (cur) pull(cur, e.clientX - sx, e.clientY - sy);
    };

    const up = () => {
      if (cur) {
        rel(cur);
        cur = null;
      }
    };

    host.addEventListener('pointerdown', dn);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    window.__nxPull = (sel, dx, dy) => {
      cur = host.querySelector(sel);
      if (cur) pull(cur, dx, dy);
    };
    window.__nxRel = () => up();

    return () => {
      host.remove();
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Sync open/close animations
  useEffect(() => {
    document.getElementById('nav')?.classList.toggle('menu-open', open);
    const el = ref.current;
    if (!el || !scrim.current) return;

    if (open) {
      gsap.set(el, { display: 'flex' });
      gsap.set(scrim.current, { display: 'block' });
      gsap.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.4 });
      gsap.fromTo(
        el.querySelectorAll('.mi, .mfoot > *'),
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: 0.055, delay: 0.08 }
      );
    } else {
      gsap.to(el, {
        xPercent: 100,
        duration: 0.4,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(el, { display: 'none' });
          setExp(null);
        },
      });
      gsap.to(scrim.current, {
        opacity: 0,
        duration: 0.35,
        onComplete: () => gsap.set(scrim.current, { display: 'none' }),
      });
    }
  }, [open]);

  // Submenu accordion expansion
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('.msub').forEach((s) => {
      const on = s.dataset.k === exp;
      gsap.to(s, { height: on ? s.scrollHeight : 0, duration: 0.4, ease: 'power3.inOut' });
      s.parentElement.classList.toggle('x', on);
    });
  }, [exp]);

  const handleSubItemNavigation = (subName) => {
    onClose();
    switch (subName) {
      case 'Apply Now':
        navigate('/apply');
        break;
      case 'Internship certificate verification':
        navigate('/verify');
        break;
      case 'Download Offer Letter':
        navigate('/offer-letter');
        break;
      case 'Terms & Conditions':
        navigate('/terms');
        break;
      case 'Privacy Policy':
        navigate('/privacy');
        break;
      case 'Cookies Policy':
        soon('Cookies Policy');
        break;
      case 'Student Reviews':
        soon('Student Reviews');
        break;
      case 'Contact Support':
        soon('Contact Support');
        break;
      default:
        soon(subName);
        break;
    }
  };

  const handleTopNavigation = (k) => {
    if (k === 'svc') {
      onClose();
      if (location.pathname === '/') {
        setTimeout(() => {
          const t = document.getElementById('services');
          const sm = ScrollSmoother.get();
          if (sm && t) sm.scrollTo(t, true, 'top 90px');
          else if (t) t.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } else {
        navigate('/#services');
      }
      return;
    }

    if (k === 'home') {
      onClose();
      if (location.pathname === '/') {
        setTimeout(() => {
          const sm = ScrollSmoother.get();
          if (sm) sm.scrollTo(0, true);
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
      } else {
        navigate('/');
      }
      return;
    }

    setExp((prev) => (prev === k ? null : k));
  };

  const items = [
    { k: 'home', t: 'Home' },
    { k: 'int', t: 'Internships', sub: config?.subs?.Internships || ['Apply Now', 'Internship certificate verification', 'Download Offer Letter'] },
    { k: 'skill', t: 'Skill Course', sub: ['Dashboard', 'Browse Courses', 'My Certificates', 'Skill Certificate verification'] },
    { k: 'career', t: 'Career Tools', sub: ['Check ATS Score', 'Job Email Builder', 'Interview Preparation'] },
    { k: 'svc', t: 'Services' },
    { k: 'more', t: 'More', sub: config?.subs?.More || ['Terms & Conditions', 'Privacy Policy', 'Cookies Policy', 'Student Reviews', 'Contact Support'] },
  ];

  if (!hostRef.current) return null;

  return createPortal(
    <>
      <div className="nxscrim" ref={scrim} style={{ display: 'none' }} onClick={onClose} />
      <div className="nxmenu" ref={ref} style={{ display: 'none' }}>
        <ThemeToggle />
        <button className="mclose" aria-label="Close menu" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <nav className="mlist">
          {items.map((i) => (
            <div className="mi" key={i.k} data-k={i.k}>
              <button type="button" className="mrow" onClick={() => handleTopNavigation(i.k)}>
                <span>{i.t}</span>
                {i.sub && <Chev />}
              </button>
              {i.sub && (
                <div className="msub" data-k={i.k} style={{ height: 0 }}>
                  <div className="mlinks">
                    {i.sub.map((s) => (
                      <button
                        type="button"
                        className="mlk"
                        key={s}
                        onClick={() => handleSubItemNavigation(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Real student auth state in drawer */}
        {student ? (
          <div className="mfoot in">
            <div className="prof">
              <span className="av">{(student.name || 'S').trim().charAt(0).toUpperCase()}</span>
              <span className="pn">{student.name}</span>
              <button
                type="button"
                className="lo"
                onClick={async () => {
                  onClose();
                  await logout();
                  navigate('/');
                }}
              >
                Logout
              </button>
            </div>
            <button
              type="button"
              className="dash"
              onClick={() => {
                onClose();
                navigate('/account');
              }}
            >
              My account
            </button>
          </div>
        ) : (
          <div className="mfoot">
            <button
              type="button"
              className="dash"
              onClick={() => {
                onClose();
                navigate('/signup');
              }}
            >
              Sign up
            </button>
            <button
              type="button"
              className="ghostb"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
            >
              Login
            </button>
          </div>
        )}
      </div>
    </>,
    hostRef.current
  );
}
