import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, Award, CheckCircle2, Menu, X, ArrowRight, ExternalLink, Lock, ChevronDown } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

export default function PublicLayout({ admin, onLogout, onOpenAdminLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internOpen, setInternOpen] = useState(false);
  const [mobileInternOpen, setMobileInternOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const { googleForm1Url, isFormConfigured, loading, error } = useSiteSettings();
  const noteMessage = (loading || error) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-3 z-40 px-3 sm:px-5">
        {/* Floating pill navbar (visual reference: tsec-assignment-hub.me translucent pill) */}
        <div className="max-w-6xl mx-auto bg-white/85 backdrop-blur-md border border-slate-200/80 shadow-lg shadow-slate-900/5 rounded-full pl-4 pr-2.5 sm:pl-5 sm:pr-3 h-14 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-105 transition">
              <Shield className="h-4.5 w-4.5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="font-black tracking-wider text-sm flex items-center gap-1 text-slate-900">
                NOXIRA <span className="text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 font-bold">TECH</span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono tracking-tight uppercase hidden sm:block">Software Services &amp; Internships</div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-full transition ${location.pathname === '/' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
            >
              Home
            </Link>
            <a
              href="/#services"
              className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
            >
              Services
            </a>
            <a
              href="/#portfolio"
              className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
            >
              Portfolio
            </a>
            {/* Internships dropdown (structure reference: grouped internship menu) */}
            <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInternOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setInternOpen(false); }}>
              <button
                type="button"
                aria-expanded={internOpen}
                aria-controls="internships-desktop-menu"
                onClick={() => setInternOpen(!internOpen)}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1 ${['/programs', '/status', '/verify'].some(p => location.pathname.startsWith(p)) || internOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              >
                Internships
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${internOpen ? 'rotate-180' : ''}`} />
              </button>
              {internOpen && (
                <div id="internships-desktop-menu" className="absolute left-0 top-full mt-2 w-60 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-600">
                  {isFormConfigured ? (
                    <a
                      href={googleForm1Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                      title="Apply via official Google Form"
                    >
                      Apply Now <ExternalLink className="w-3 h-3 text-amber-600" />
                    </a>
                  ) : (
                    <span
                      className="flex items-center justify-between mx-2 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed"
                      title={noteMessage}
                    >
                      Apply Now <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                  <Link
                    to="/programs"
                    onClick={() => setInternOpen(false)}
                    className="block mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                  >
                    All Programmes
                  </Link>
                  <a
                    href="/#journey"
                    onClick={() => setInternOpen(false)}
                    className="block mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                  >
                    6-Step Journey
                  </a>
                  <Link
                    to="/verify"
                    onClick={() => setInternOpen(false)}
                    className="flex items-center gap-1.5 mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                    Certificate Verification
                  </Link>
                  <Link
                    to="/status"
                    onClick={() => setInternOpen(false)}
                    className="block mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                  >
                    Download Offer Letter
                  </Link>
                  <Link
                    to="/status"
                    onClick={() => setInternOpen(false)}
                    className="block mx-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 hover:text-amber-700 transition"
                  >
                    Check Application Status
                  </Link>
                </div>
              )}
            </div>
            <a
              href="/#contact"
              className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
            >
              Contact
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2.5">
            {admin ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/admin"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-full text-xs font-semibold transition"
                >
                  Admin Console
                </Link>
                <button
                  onClick={onLogout}
                  className="px-2 py-1.5 text-slate-400 hover:text-slate-800 text-xs font-semibold"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold transition flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                Admin
              </button>
            )}

            {isFormConfigured ? (
              <a
                href={googleForm1Url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-full text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                title="Apply via official Google Form"
              >
                Apply Now
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={noteMessage}
                className="px-4 py-2 bg-amber-500/60 text-slate-950/70 rounded-full text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
              >
                Apply Now
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            {isFormConfigured ? (
              <a
                href={googleForm1Url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-full sm:hidden flex items-center gap-1"
              >
                Apply <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={noteMessage}
                className="px-3 py-1.5 bg-amber-500/60 text-slate-950/70 font-bold text-xs rounded-full sm:hidden cursor-not-allowed"
              >
                Apply
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 focus:outline-none transition"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto lg:hidden max-w-6xl mx-auto mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl px-4 pt-3 pb-5 space-y-1">
            <Link
              to="/"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-amber-700"
            >
              Home
            </Link>
            <a
              href="/#services"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-amber-700"
            >
              Services
            </a>
            <a
              href="/#portfolio"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-amber-700"
            >
              Portfolio
            </a>
            {/* Internships expandable submenu (mobile) */}
            <div>
              <button
                type="button"
                aria-expanded={mobileInternOpen}
                onClick={() => setMobileInternOpen(!mobileInternOpen)}
                className="w-full flex items-center justify-between py-2 text-sm font-semibold text-slate-700 hover:text-amber-700"
              >
                Internships
                <ChevronDown className={`w-4 h-4 transition-transform ${mobileInternOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileInternOpen && (
                <div className="pl-4 border-l border-slate-200 ml-1 space-y-1">
                  {isFormConfigured ? (
                    <a
                      href={googleForm1Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-1.5 py-2 text-sm font-semibold text-slate-600 hover:text-amber-700"
                    >
                      Apply Now <ExternalLink className="w-3 h-3 text-amber-600" />
                    </a>
                  ) : (
                    <span
                      className="flex items-center gap-1.5 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
                      title={noteMessage}
                    >
                      Apply Now <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                  <Link
                    to="/programs"
                    onClick={closeMobileMenu}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-amber-700"
                  >
                    All Programmes
                  </Link>
                  <a
                    href="/#journey"
                    onClick={closeMobileMenu}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-amber-700"
                  >
                    6-Step Journey
                  </a>
                  <Link
                    to="/verify"
                    onClick={closeMobileMenu}
                    className="block py-2 text-sm font-semibold text-amber-700"
                  >
                    Certificate Verification
                  </Link>
                  <Link
                    to="/status"
                    onClick={closeMobileMenu}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-amber-700"
                  >
                    Download Offer Letter
                  </Link>
                  <Link
                    to="/status"
                    onClick={closeMobileMenu}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-amber-700"
                  >
                    Check Application Status
                  </Link>
                </div>
              )}
            </div>
            <a
              href="/#contact"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-amber-700"
            >
              Contact
            </a>
            <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
              {isFormConfigured ? (
                <a
                  href={googleForm1Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="w-full text-center py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-full flex items-center justify-center gap-1.5"
                >
                  Apply for Cohort
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={noteMessage}
                  className="w-full text-center py-2.5 bg-amber-500/60 text-slate-950/70 font-bold text-xs rounded-full cursor-not-allowed"
                >
                  Apply for Cohort (Unavailable)
                </button>
              )}
              {admin ? (
                <Link
                  to="/admin"
                  onClick={closeMobileMenu}
                  className="w-full text-center py-2 bg-slate-900 text-slate-200 font-semibold text-xs rounded-full"
                >
                  Admin Console
                </Link>
              ) : (
                <button
                  onClick={() => { closeMobileMenu(); onOpenAdminLogin(); }}
                  className="w-full text-center py-2 text-slate-400 hover:text-slate-700 text-xs font-semibold"
                >
                  Admin Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Col 1: Organization Branding */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-slate-950">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-sm tracking-wider">NOXIRA TECHNOLOGIES</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                NOXIRA Technologies designs and develops modern web and mobile software solutions, alongside practical engineering internship tracks with transparent credential verification.
              </p>
            </div>

            {/* Col 2: Navigation Links */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Quick Navigation</h4>
              <ul className="space-y-2">
                <li><Link to="/" className="hover:text-amber-400 transition">Home Overview</Link></li>
                <li><a href="/#services" className="hover:text-amber-400 transition">Software Services</a></li>
                <li><Link to="/programs" className="hover:text-amber-400 transition">All Programmes</Link></li>
                <li><a href="/#journey" className="hover:text-amber-400 transition">6-Step Journey</a></li>
                <li>
                  {isFormConfigured ? (
                    <a
                      href={googleForm1Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-amber-400 transition inline-flex items-center gap-1"
                    >
                      Candidate Application <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span
                      className="text-slate-500 cursor-not-allowed inline-flex items-center gap-1"
                      title={noteMessage}
                    >
                      Candidate Application
                    </span>
                  )}
                </li>
                <li><Link to="/status" className="hover:text-amber-400 transition">Check Application Status</Link></li>
                <li><Link to="/verify" className="hover:text-amber-400 transition">Public Verification Portal</Link></li>
              </ul>
            </div>

            {/* Col 3: Authenticity & Verification */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Verification</h4>
              <p className="text-slate-400 text-xs leading-relaxed mb-3">
                Verify certificate authenticity and current record status directly against the official registry.
              </p>
              <Link to="/verify" className="text-amber-400 hover:text-amber-300 font-semibold transition inline-flex items-center gap-1">
                Registry Verification Portal <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Col 4: Policies */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Policies</h4>
              <ul className="space-y-2">
                <li><Link to="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link></li>
                <li><Link to="/payment-refund" className="hover:text-amber-400 transition">Payment &amp; Refund</Link></li>
                <li><Link to="/review-rules" className="hover:text-amber-400 transition">Review Rules</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} NOXIRA Technologies. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Software Engineering &amp; Verification Registry</span>
              <span>·</span>
              <Link to="/verify" className="text-amber-500/80 hover:text-amber-400">Public Verification</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
