import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { api } from './services/api';
import {
  ShieldCheck,
  FileSpreadsheet,
  Users,
  Sliders,
  Award,
  Send,
  History,
  LogOut,
  ArrowLeft,
  Shield,
  BookOpen,
  UserCheck,
  FileText,
  Settings as SettingsIcon
} from 'lucide-react';

import PublicLayout from './components/PublicLayout';
import PolicyPage from './pages/PolicyPage';
import HomePage from './pages/HomePage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import StatusPage from './pages/StatusPage';
import VerifyPage from './pages/VerifyPage';
import ServicesPage from './pages/ServicesPage';
import StudentLoginPage from './pages/StudentLoginPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import SkillCoursesPage from './pages/SkillCoursesPage';
import SkillCourseDetailPage from './pages/SkillCourseDetailPage';
import SkillQuizPage from './pages/SkillQuizPage';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { StudentAuthProvider } from './context/StudentAuthContext';

// Admin console pages are code-split: the public site bundle does not ship admin code.
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DashboardOverview = lazy(() => import('./pages/DashboardOverview'));
const AdminProgramsPage = lazy(() => import('./pages/AdminProgramsPage'));
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'));
const AdminOfferTemplatesPage = lazy(() => import('./pages/AdminOfferTemplatesPage'));
const ParticipantsPage = lazy(() => import('./pages/ParticipantsPage'));
const CsvImportPage = lazy(() => import('./pages/CsvImportPage'));
const Form1ImportPage = lazy(() => import('./pages/Form1ImportPage'));
const Form2ImportPage = lazy(() => import('./pages/Form2ImportPage'));
const TemplatePreviewPage = lazy(() => import('./pages/TemplatePreviewPage'));
const IssuanceBatchPage = lazy(() => import('./pages/IssuanceBatchPage'));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'));
const DistributionPage = lazy(() => import('./pages/DistributionPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));

function AdminFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-xs text-slate-400">
      Loading administration module...
    </div>
  );
}

function AdminConsole({ admin, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminTab, setAdminTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: ShieldCheck },
    { id: 'applications', label: 'Applications & Selection', icon: UserCheck },
    { id: 'offer-templates', label: 'Offer Letter Studio', icon: FileText },
    { id: 'programs', label: 'Programmes', icon: BookOpen },
    { id: 'participants', label: 'Participants & Review', icon: Users },
    { id: 'import', label: 'CSV Import', icon: FileSpreadsheet },
    { id: 'form1-import', label: 'Form 1 Import', icon: FileSpreadsheet },
    { id: 'form2-import', label: 'Form 2 Import', icon: FileSpreadsheet },
    { id: 'templates', label: 'Certificate Studio', icon: Sliders },
    { id: 'issuance', label: 'Batch Issuance', icon: Award },
    { id: 'certificates', label: 'Certificates Registry', icon: ShieldCheck },
    { id: 'distribution', label: 'Email Distribution', icon: Send },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Admin Top Navigation */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
              title="Return to Public Website"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Public Site
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xs shadow-xs">
                N
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold tracking-tight text-white text-sm">NOXIRA</span>
                <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block -mt-1">
                  Admin Authority Console
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden md:inline font-mono">
              {admin.email} ({admin.role})
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-slate-300 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Secondary Sub-Navigation Tabs */}
        <div className="bg-slate-950/90 border-t border-slate-800 px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5 text-xs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = adminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id)}
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
      </header>

      {/* Main Admin Tab Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<AdminFallback />}>
        {adminTab === 'dashboard' && (
          <DashboardOverview onNavigate={(view) => setAdminTab(view)} />
        )}
        {adminTab === 'applications' && (
          <AdminApplicationsPage />
        )}
        {adminTab === 'offer-templates' && (
          <AdminOfferTemplatesPage />
        )}
        {adminTab === 'programs' && (
          <AdminProgramsPage />
        )}
        {adminTab === 'participants' && (
          <ParticipantsPage onNavigateToIssuance={() => setAdminTab('issuance')} />
        )}
        {adminTab === 'import' && (
          <CsvImportPage onImportSuccess={() => setAdminTab('participants')} />
        )}
        {adminTab === 'form1-import' && (
          <Form1ImportPage onNavigateToApplications={() => setAdminTab('applications')} />
        )}
        {adminTab === 'form2-import' && (
          <Form2ImportPage />
        )}
        {adminTab === 'templates' && (
          <TemplatePreviewPage />
        )}
        {adminTab === 'issuance' && (
          <IssuanceBatchPage onBatchSuccess={() => setAdminTab('certificates')} />
        )}
        {adminTab === 'certificates' && (
          <CertificatesPage onNavigateToVerify={(token) => navigate(`/verify/${token}`)} />
        )}
        {adminTab === 'distribution' && (
          <DistributionPage />
        )}
        {adminTab === 'audit' && (
          <AuditLogsPage />
        )}
        {adminTab === 'settings' && (
          <AdminSettingsPage />
        )}
        </Suspense>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>NOXIRA Technologies · Administrative Console</p>
      </footer>
    </div>
  );
}

// Handles in-app hash navigation (e.g. /#journey) and scroll restoration on route change.
function ScrollManager() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return null;
}

function AppContent() {
  const [admin, setAdmin] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const navigate = useNavigate();

  // Bootstrap logged-in admin session
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
    navigate('/');
  };

  const handleLoginSuccess = (adminUser) => {
    setAdmin(adminUser);
    navigate('/admin');
  };

  return (
    <Routes>
      {/* Public Pages wrapped in PublicLayout */}
      <Route
        element={
          <PublicLayout
            admin={admin}
            onLogout={handleLogout}
            onOpenAdminLogin={() => navigate('/admin/login')}
          />
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/programs/:code" element={<ProgramDetailPage />} />
        <Route path="/apply" element={<Navigate to="/" replace />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/verify/:token" element={<VerifyPage />} />
        <Route path="/login" element={<StudentLoginPage />} />
        <Route path="/register" element={<StudentRegisterPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/skill-courses" element={<SkillCoursesPage />} />
        <Route path="/skill-courses/:code" element={<SkillCourseDetailPage />} />
        <Route path="/skill-courses/:code/test" element={<SkillQuizPage />} />
        <Route path="/terms" element={<PolicyPage slug="terms" />} />
        <Route path="/privacy" element={<PolicyPage slug="privacy" />} />
        <Route path="/cookies" element={<PolicyPage slug="cookies" />} />
        <Route path="/payment-refund" element={<PolicyPage slug="refund" />} />
        <Route path="/review-rules" element={<PolicyPage slug="review" />} />
      </Route>

      {/* Admin Login Route */}
      <Route
        path="/admin/login"
        element={
          admin ? (
            <Navigate to="/admin" replace />
          ) : (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center">
              <div className="p-4 text-center">
                <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-4">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to NOXIRA Public Site
                </Link>
              </div>
              <Suspense fallback={<AdminFallback />}>
                <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
              </Suspense>
            </div>
          )
        }
      />

      {/* Admin Console Route */}
      <Route
        path="/admin"
        element={
          loadingUser ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">
              Loading administration portal...
            </div>
          ) : admin ? (
            <AdminConsole admin={admin} onLogout={handleLogout} />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />

      {/* Catch-all fallback: redirect to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteSettingsProvider>
      <StudentAuthProvider>
        <ScrollManager />
        <AppContent />
            </StudentAuthProvider>
    </SiteSettingsProvider>
    </BrowserRouter>
  );
}
