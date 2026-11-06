import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, Award, CheckCircle2, Menu, X, ArrowRight, ExternalLink, Lock } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

export default function PublicLayout({ admin, onLogout, onOpenAdminLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const { googleForm1Url, isFormConfigured, loading, error } = useSiteSettings();
  const noteMessage = (loading || error) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-3 group">
            <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition">
              <Shield className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="font-black tracking-wider text-base flex items-center gap-1 text-white">
                NOXIRA <span className="text-amber-500 text-xs px-1.5 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/20 font-bold">TECH</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">Software Services &amp; Internships</div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <Link
              to="/"
              className={`hover:text-amber-400 transition ${location.pathname === '/' ? 'text-amber-400' : ''}`}
            >
              Home
            </Link>
            <a
              href="/#services"
              className="hover:text-amber-400 transition"
            >
              Services
            </a>
            <Link
              to="/programs"
              className={`hover:text-amber-400 transition ${location.pathname.startsWith('/programs') ? 'text-amber-400 font-bold' : ''}`}
            >
              Programmes
            </Link>
            <Link
              to="/status"
              className={`hover:text-amber-400 transition ${location.pathname.startsWith('/status') ? 'text-amber-400 font-bold' : ''}`}
            >
              Check Status
            </Link>
            <a
              href="/#journey"
              className="hover:text-amber-400 transition"
            >
              6-Step Journey
            </a>
            <Link
              to="/verify"
              className={`hover:text-amber-400 transition flex items-center gap-1 ${location.pathname.startsWith('/verify') ? 'text-amber-400 font-bold' : ''}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
              Verify Certificate
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {admin ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/admin"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  Admin Console
                </Link>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-semibold transition flex items-center gap-1"
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
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
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
                className="px-4 py-2 bg-amber-500/60 text-slate-950/70 rounded-lg text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
              >
                Apply Now
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {isFormConfigured ? (
              <a
                href={googleForm1Url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg sm:hidden flex items-center gap-1"
              >
                Apply <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={noteMessage}
                className="px-3 py-1.5 bg-amber-500/60 text-slate-950/70 font-bold text-xs rounded-lg sm:hidden cursor-not-allowed"
              >
                Apply
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-5 space-y-3">
            <Link
              to="/"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-200 hover:text-amber-400"
            >
              Home
            </Link>
            <a
              href="/#services"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-200 hover:text-amber-400"
            >
              Services
            </a>
            <Link
              to="/programs"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-200 hover:text-amber-400"
            >
              Programmes
            </Link>
            <Link
              to="/status"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-200 hover:text-amber-400"
            >
              Check Status
            </Link>
            <a
              href="/#journey"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-slate-200 hover:text-amber-400"
            >
              6-Step Journey
            </a>
            <Link
              to="/verify"
              onClick={closeMobileMenu}
              className="block py-2 text-sm font-semibold text-amber-400"
            >
              Verify Certificate
            </Link>
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              {isFormConfigured ? (
                <a
                  href={googleForm1Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="w-full text-center py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                >
                  Apply for Cohort
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={noteMessage}
                  className="w-full text-center py-2.5 bg-amber-500/60 text-slate-950/70 font-bold text-xs rounded-lg cursor-not-allowed"
                >
                  Apply for Cohort (Unavailable)
                </button>
              )}
              {admin ? (
                <Link
                  to="/admin"
                  onClick={closeMobileMenu}
                  className="w-full text-center py-2 bg-slate-800 text-slate-200 font-semibold text-xs rounded-lg"
                >
                  Admin Console
                </Link>
              ) : (
                <button
                  onClick={() => { closeMobileMenu(); onOpenAdminLogin(); }}
                  className="w-full text-center py-2 text-slate-400 hover:text-white text-xs font-semibold"
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
