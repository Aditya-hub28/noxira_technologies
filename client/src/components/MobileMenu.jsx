import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/all';
import { currentTheme, toggleTheme } from '../theme.js';
import config from '../nx.config.js';
import { soon } from '../utils/toast.js';
import { useSiteSettings } from '../context/SiteSettingsContext';
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

  const ref = useRef(null);
  const scrim = useRef(null);
  const hostRef = useRef(null);

  if (!hostRef.current && typeof document !== 'undefined') {
    const h = document.createElement('div');
    h.id = 'nxmenu-host';
    hostRef.current = h;
  }

  // Host container for drawer portal
  useEffect(() => {
    if (!hostRef.current) return;
    document.body.appendChild(hostRef.current);
    const host = hostRef.current;
    return () => {
      host.remove();
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
        el.querySelectorAll('.mi'),
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
      case 'All Programmes':
        navigate('/apply');
        break;
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
      case 'Services Terms':
        navigate('/services-terms');
        break;

      case 'Services Privacy':
        navigate('/services-privacy');
        break;

      case 'Cookies Policy':
        navigate('/cookies');
        break;
      case 'Student Reviews':
        navigate('/reviews');
        break;
      case 'Contact Support':
        navigate('/contact');
        break;
      default:
        soon(subName);
        break;
    }
  };

  const handleTopNavigation = (k) => {
    if (k === 'svc') {
      onClose();
      navigate('/services');
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
    { k: 'svc', t: 'Services' },
    { k: 'more', t: 'More', sub: config?.subs?.More || ['Terms & Conditions', 'Privacy Policy', 'Services Terms', 'Services Privacy', 'Cookies Policy', 'Student Reviews', 'Contact Support'] },
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
      </div>
    </>,
    hostRef.current
  );
}
