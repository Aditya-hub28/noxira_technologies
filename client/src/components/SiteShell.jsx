import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/all';
import markup from '../shell/markup.html?raw';
import { mountShell, makeSmoother, killSmoother } from '../shell/shell.js';
import config from '../nx.config.js';
import { currentTheme, toggleTheme } from '../theme.js';
import { soon } from '../utils/toast.js';
import { useSiteSettings } from '../context/SiteSettingsContext.jsx';

export default function SiteShell({ onToggleMobileMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { googleForm1Url, isFormConfigured } = useSiteSettings();

  const [theme, setTheme] = useState(currentTheme());
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ left: '0px', top: '0px' });

  const stageHostRef = useRef(null);
  const dropdownRef = useRef(null);
  const shellInstanceRef = useRef(null);
  const navRef = useRef(null);

  // Sync theme icon with state
  useEffect(() => {
    const handleThemeChange = () => setTheme(currentTheme());
    window.addEventListener('nx:theme', handleThemeChange);
    return () => window.removeEventListener('nx:theme', handleThemeChange);
  }, []);

  // Mount loader & liquid-glass shell once
  useEffect(() => {
    if (!document.getElementById('scene')) {
      const container = document.createElement('div');
      container.id = 'nx-shell-stage-container';
      container.innerHTML = markup;
      document.body.appendChild(container);
      stageHostRef.current = container;
    }

    makeSmoother();
    const inst = mountShell();
    shellInstanceRef.current = inst;
    window.noxiraLoader = inst;

    const q = new URLSearchParams(window.location.search);
    const hasSeen = sessionStorage.getItem('nx-loader-seen') === '1';
    const isSnap = q.has('snap') || q.get('replay') === '0';
    const forceReplay = q.get('replay') === '1';

    if ((hasSeen && !forceReplay) || isSnap) {
      inst.snapToEnd();
    } else {
      inst.play();
      const onReady = () => {
        sessionStorage.setItem('nx-loader-seen', '1');
      };
      window.addEventListener('noxira:ready', onReady, { once: true });
    }

    return () => {
      inst.destroy();
      killSmoother();
      if (stageHostRef.current) {
        stageHostRef.current.remove();
        stageHostRef.current = null;
      }
    };
  }, []);

  const closeDropdown = useCallback((instant = false) => {
    if (!dropdownRef.current) {
      setOpenDropdown(null);
      return;
    }
    const el = dropdownRef.current;
    if (instant) {
      gsap.set(el, { display: 'none' });
      setOpenDropdown(null);
    } else {
      gsap.to(el, {
        opacity: 0,
        y: -6,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(el, { display: 'none' });
          setOpenDropdown(null);
        },
      });
    }
  }, []);

  // Close dropdown on click outside or escape
  useEffect(() => {
    if (!openDropdown) return;

    const handlePointerDown = (e) => {
      if (e.target.closest('.nxdd') || e.target.closest('#nav .l.dd')) return;
      closeDropdown();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeDropdown();
    };

    const handleResize = () => closeDropdown(true);

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [openDropdown, closeDropdown]);

  const toggleDropdown = useCallback(
    (key, targetEl) => {
      if (openDropdown === key) {
        closeDropdown();
        return;
      }

      const navEl = navRef.current || document.getElementById('nav');
      if (!targetEl || !navEl) return;

      const lr = targetEl.getBoundingClientRect();
      const nr = navEl.getBoundingClientRect();
      const estWidth = 240;
      const calculatedLeft = Math.max(
        12,
        Math.min(Math.round(lr.left + lr.width / 2 - estWidth / 2), window.innerWidth - estWidth - 12)
      );
      const calculatedTop = Math.round(nr.bottom + 10);

      setDropdownPos({ left: `${calculatedLeft}px`, top: `${calculatedTop}px` });
      setOpenDropdown(key);

      requestAnimationFrame(() => {
        if (!dropdownRef.current) return;
        const panel = dropdownRef.current;
        gsap.set(panel, { display: 'flex', opacity: 0, y: -8 });
        gsap.to(panel, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' });
        if (panel.children.length) {
          gsap.fromTo(
            panel.children,
            { opacity: 0, y: -6 },
            { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', stagger: 0.045 }
          );
        }
      });
    },
    [openDropdown, closeDropdown]
  );

  // Module 4: Route navigation mapping
  const handleItemNavigation = (name) => {
    closeDropdown(true);

    switch (name) {
      case 'Home':
        if (location.pathname !== '/') {
          navigate('/');
        } else {
          const sm = ScrollSmoother.get();
          if (sm) sm.scrollTo(0, true);
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;

      case 'Services':
        navigate('/services');
        break;

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
        soon(name);
        break;
    }
  };

  const handleLinkClick = (linkName, e) => {
    const subs = config?.subs || {};
    if (subs[linkName]) {
      e.preventDefault();
      toggleDropdown(linkName, e.currentTarget);
      return;
    }
    handleItemNavigation(linkName);
  };

  const links = config?.links || ['Home', 'Internships', 'Services', 'More'];
  const subs = config?.subs || {};

  return (
    <>
      {/* Liquid-glass floating pill navbar */}
      <header id="nav" ref={navRef}>
        {/* Clickable Wordmark Logo Hotspot */}
        <span
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-10 w-36 z-20 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label="NOXIRA Technologies - Home"
          onClick={() => {
            if (location.pathname === '/') {
              const sm = ScrollSmoother.get();
              if (sm) sm.scrollTo(0, true);
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
        />
        <div className="nlinks">
          {links.map((linkName) => {
            const hasSub = Boolean(subs[linkName]);
            const isOpen = openDropdown === linkName;
            return (
              <span
                key={linkName}
                className={`l${hasSub ? ' dd' : ''}${isOpen ? ' open' : ''}`}
                role={hasSub ? 'button' : undefined}
                tabIndex={hasSub ? 0 : undefined}
                data-k={linkName}
                onClick={(e) => handleLinkClick(linkName, e)}
                onKeyDown={(e) => {
                  if (hasSub && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggleDropdown(linkName, e.currentTarget);
                  }
                }}
              >
                {linkName}
                {hasSub && (
                  <svg
                    className="chev"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </span>
            );
          })}
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="nxtheme"
          role="switch"
          aria-checked={theme !== 'light'}
          aria-label={theme === 'light' ? 'Light theme on - tap for dark' : 'Dark theme on - tap for light'}
          title={theme === 'light' ? 'Light theme on - tap for dark' : 'Dark theme on - tap for light'}
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

        {/* Mobile Burger Menu Icon */}
        <span
          className="burger"
          role="button"
          aria-label="Open mobile menu"
          tabIndex={0}
          onClick={onToggleMobileMenu}
        />
      </header>

      {/* Desktop Dropdown Panel */}
      {openDropdown && subs[openDropdown] && (
        <div
          ref={dropdownRef}
          className="nxdd"
          id={`nxdd-${openDropdown}`}
          role="menu"
          style={{
            display: 'flex',
            left: dropdownPos.left,
            top: dropdownPos.top,
          }}
        >
          {subs[openDropdown].map((it) => (
            <button
              key={it}
              type="button"
              className="nxddi"
              onClick={() => handleItemNavigation(it)}
            >
              {it}
            </button>
          ))}
        </div>
      )}

      {/* Shared Toast */}
      <div id="nxtoast" className="nxtoast" aria-live="polite" />
    </>
  );
}
