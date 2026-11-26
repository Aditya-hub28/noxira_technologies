import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { ScrollSmoother } from 'gsap/all';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';
import { initTheme } from '../theme';
import SiteShell from './SiteShell';
import MobileMenu from './MobileMenu';
import '../theme.css';
import '../base.css';
import '../nx.css';

export default function PublicLayout({ admin, onLogout, onOpenAdminLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    initTheme();
    return () => {
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    if (!location.hash) {
      const sm = ScrollSmoother.get();
      if (sm) {
        sm.scrollTo(0, false);
      } else {
        window.scrollTo(0, 0);
      }
    }
  }, [location.pathname]);

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const { googleForm1Url, isFormConfigured, loading, error } = useSiteSettings();
  const noteMessage = (loading || error) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg, #0b0c0f)' }}>
      {/* SiteShell: Liquid-glass navbar, SVG loader & desktop dropdowns */}
      <SiteShell onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)} />

      {/* Mobile Drawer Navigation */}
      <MobileMenu open={mobileMenuOpen} onClose={closeMobileMenu} />

      {/* GSAP ScrollSmoother wrapper and content around public page outlet and footer */}
      <div id="smooth-wrapper">
        <div id="smooth-content">
          {/* Main Content Viewport */}
          <main className={`flex-1 ${location.pathname !== '/' ? 'pt-24 sm:pt-28' : ''}`}>
            <Outlet />
          </main>

          {/* Public Footer */}
          <footer className="bg-ink-950 border-t border-ink-800 text-slate-400 text-xs mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                {/* Col 1: Organization Branding */}
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <img src="/noxira-wordmark-white.png" alt="NOXIRA Technologies" className="h-7 w-auto nx-logo-dark" />
                    <img src="/noxira-wordmark.png" alt="NOXIRA Technologies" className="h-7 w-auto nx-logo-light" />
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                    NOXIRA Technologies designs and develops modern web and mobile software solutions, alongside practical engineering internship tracks with transparent credential verification.
                  </p>
                </div>

                {/* Col 2: Navigation Links */}
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Quick Navigation</h4>
                  <ul className="space-y-2">
                    <li><Link to="/" className="hover:text-cyan-400 transition">Home Overview</Link></li>
                    <li><a href="/#services" className="hover:text-cyan-400 transition">Software Services</a></li>
                    <li><Link to="/apply" className="hover:text-cyan-400 transition">All Programmes</Link></li>
                    <li><a href="/#journey" className="hover:text-cyan-400 transition">8-Step Journey</a></li>
                    <li><Link to="/apply" className="hover:text-cyan-400 transition">Candidate Application</Link></li>
                    <li><Link to="/offer-letter" className="hover:text-cyan-400 transition">Download Offer Letter</Link></li>
                    <li><Link to="/verify" className="hover:text-cyan-400 transition">Public Verification Portal</Link></li>
                    <li><Link to="/reviews" className="hover:text-cyan-400 transition">Student Reviews</Link></li>
                  </ul>
                </div>

                {/* Col 3: Authenticity & Verification */}
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Verification</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Verify certificate authenticity and current record status directly against the official registry.
                  </p>
                  <Link to="/verify" className="text-cyan-400 hover:text-cyan-300 font-semibold transition inline-flex items-center gap-1">
                    Registry Verification Portal <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* Col 4: Policies */}
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Policies</h4>
                  <ul className="space-y-2">
                    <li><Link to="/terms" className="hover:text-cyan-400 transition">Terms &amp; Conditions</Link></li>
                    <li><Link to="/privacy" className="hover:text-cyan-400 transition">Privacy Policy</Link></li>
                    <li><Link to="/services-terms" className="hover:text-cyan-400 transition">Services Terms</Link></li>
                    <li><Link to="/services-privacy" className="hover:text-cyan-400 transition">Services Privacy</Link></li>
                    <li><Link to="/cookies" className="hover:text-cyan-400 transition">Cookies Policy</Link></li>
                    <li><Link to="/payment-refund" className="hover:text-cyan-400 transition">Payment &amp; Refund</Link></li>
                    <li><Link to="/review-rules" className="hover:text-cyan-400 transition">Review Rules</Link></li>
                  </ul>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
                <div>
                  &copy; {new Date().getFullYear()} NOXIRA Technologies. All rights reserved.
                </div>
                <div className="flex items-center gap-4">
                  <span>Software Engineering &amp; Verification Registry</span>
                  <span>·</span>
                  <Link to="/verify" className="text-cyan-400/80 hover:text-cyan-400">Public Verification</Link>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
