import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { User, Mail, CalendarDays, GraduationCap, FileText, Award, ClipboardList, LogOut, ArrowRight } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';

function EmptySection({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-bold text-ink-950">{title}</h2>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

export default function StudentDashboardPage() {
  const { student, loading, logout } = useStudentAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-400">
        Loading your dashboard...
      </div>
    );
  }

  if (!student) {
    return <Navigate to="/login" replace />;
  }

  const joined = student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      {/* Profile header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-ink-950 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {student.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink-950 tracking-tight truncate">{student.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{student.email}</span>
            {joined && <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Joined {joined}</span>}
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full px-4 py-2 transition self-start sm:self-center"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <EmptySection
          icon={GraduationCap}
          title="My Applications"
          description="Your internship application status will appear here. For now you can check any application with its application ID."
          action={
            <Link to="/status" className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800">
              Check application status <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <EmptySection
          icon={FileText}
          title="Offer Letters"
          description="When you are selected, your offer letter will be downloadable directly from here - no digging through email."
          action={
            <Link to="/status" className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800">
              Download offer letter <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <EmptySection
          icon={ClipboardList}
          title="Skill Tests"
          description="Skill tests and their results will live here - scores, pass status and attempt history, all tied to your account."
        />
        <EmptySection
          icon={Award}
          title="Certificates"
          description="Certificates you earn will be listed here with their verification links, so anyone can verify them publicly."
          action={
            <Link to="/verify" className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800">
              Verify a certificate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
      </div>
    </div>
  );
}
