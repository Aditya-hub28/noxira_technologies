import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { Award, ShieldCheck, FileSpreadsheet, Users, Sliders, Send, History, LogIn, LogOut, CheckCircle, ExternalLink } from 'lucide-react';

import ApplyPage from './pages/ApplyPage';
import VerifyPage from './pages/VerifyPage';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardOverview from './pages/DashboardOverview';
import ParticipantsPage from './pages/ParticipantsPage';
import CsvImportPage from './pages/CsvImportPage';
import TemplatePreviewPage from './pages/TemplatePreviewPage';
import IssuanceBatchPage from './pages/IssuanceBatchPage';
import CertificatesPage from './pages/CertificatesPage';
import DistributionPage from './pages/DistributionPage';
import AuditLogsPage from './pages/AuditLogsPage';

export default function App() {
  const [currentView, setCurrentView] = useState('apply');
  const [admin, setAdmin] = useState(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  // Check initial path (e.g. /verify/TOKEN)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/verify/')) {
      const token = path.replace('/verify/', '');
      setVerifyToken(token);
      setCurrentView('verify');
    }
  }, []);

  // Check logged-in admin session
  useEffect(() => {
    api.getMe()
      .then(res => {
        if (res && res.admin) setAdmin(res.admin);
      })
      .catch(() => setAdmin(null))
      .finally(() => setLoadingUser(false));
  }, []);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setAdmin(null);
    setCurrentView('apply');
  };

  const navigateToVerifyWithToken = (token) => {
    setVerifyToken(token);
    setCurrentView('verify');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            onClick={() => setCurrentView(admin ? 'dashboard' : 'apply')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-900 text-sm shadow-md">
              N
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-base">NOXIRA</span>
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block -mt-1">
                Credential System
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Public links */}
            <button
              onClick={() => setCurrentView('apply')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentView === 'apply' ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Application Form
            </button>
            <button
              onClick={() => setCurrentView('verify')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentView === 'verify' ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Verify Credential
            </button>

            {/* Admin section or Login button */}
            {admin ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700 ml-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    currentView === 'dashboard' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Admin Console
                </button>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentView('login')}
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                Admin Login
              </button>
            )}
          </nav>
        </div>

        {/* Secondary Admin Sub-Navigation (Visible when logged in) */}
        {admin && (
          <div className="bg-slate-950/80 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 overflow-x-auto">
            <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5 text-xs">
              {[
                { id: 'dashboard', label: 'Overview', icon: ShieldCheck },
                { id: 'participants', label: 'Participants & Review', icon: Users },
                { id: 'import', label: 'CSV Import', icon: FileSpreadsheet },
                { id: 'templates', label: 'Template Studio', icon: Sliders },
                { id: 'issuance', label: 'Batch Issuance', icon: Award },
                { id: 'certificates', label: 'Certificates Registry', icon: ShieldCheck },
                { id: 'distribution', label: 'Email Distribution', icon: Send },
                { id: 'audit', label: 'Audit Trail', icon: History }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = currentView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentView(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentView === 'apply' && (
          <ApplyPage onNavigateToVerify={() => setCurrentView('verify')} />
        )}

        {currentView === 'verify' && (
          <VerifyPage initialToken={verifyToken} />
        )}

        {currentView === 'login' && (
          <AdminLoginPage onLoginSuccess={(adminUser) => {
            setAdmin(adminUser);
            setCurrentView('dashboard');
          }} />
        )}

        {currentView === 'dashboard' && admin && (
          <DashboardOverview onNavigate={(view) => setCurrentView(view)} />
        )}

        {currentView === 'participants' && admin && (
          <ParticipantsPage onNavigateToIssuance={() => setCurrentView('issuance')} />
        )}

        {currentView === 'import' && admin && (
          <CsvImportPage onImportSuccess={() => setCurrentView('participants')} />
        )}

        {currentView === 'templates' && admin && (
          <TemplatePreviewPage />
        )}

        {currentView === 'issuance' && admin && (
          <IssuanceBatchPage onBatchSuccess={() => setCurrentView('certificates')} />
        )}

        {currentView === 'certificates' && admin && (
          <CertificatesPage onNavigateToVerify={navigateToVerifyWithToken} />
        )}

        {currentView === 'distribution' && admin && (
          <DistributionPage />
        )}

        {currentView === 'audit' && admin && (
          <AuditLogsPage />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>NOXIRA Technologies Private Limited · Digital Credential Issuance & Verification Infrastructure</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Cryptographically authenticated with 128-bit verification entropy and immutable audit logging.
        </p>
      </footer>
    </div>
  );
}
