import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { resolveProgramDescription } from '../utils/programUtils';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  IndianRupee,
  Users,
  Calendar,
  BookOpen,
  CheckCircle2,
  ListOrdered,
  RotateCcw,
  AlertTriangle,
  Send
} from 'lucide-react';

export default function ProgramDetailPage() {
  const { code } = useParams();
  const cleanCode = (code || '').toUpperCase().trim();

  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const fetchDetail = async () => {
    if (!cleanCode) return;
    setLoading(true);
    setError('');
    setNotFound(false);

    try {
      const data = await api.getProgramDetail(cleanCode);
      if (data && data.program) {
        setProgram(data.program);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message || 'Failed to load programme details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [cleanCode]);

  // Determine if any owner-configured content fields exist
  const hasContent = program && (
    program.durationWeeks != null ||
    program.feeInr != null ||
    program.seats != null ||
    program.startDate ||
    program.endDate ||
    (Array.isArray(program.syllabus) && program.syllabus.length > 0) ||
    (Array.isArray(program.tasks) && program.tasks.length > 0)
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xs animate-pulse">
          <div className="h-8 bg-slate-200 rounded-md w-1/3"></div>
          <div className="h-10 bg-slate-200 rounded-md w-3/4"></div>
          <div className="h-20 bg-slate-100 rounded-md"></div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Programme Not Found</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          The requested programme code <span className="font-mono font-bold text-slate-800">"{cleanCode}"</span> does not exist or is currently inactive.
        </p>
        <div className="pt-2">
          <Link
            to="/programs"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Programmes
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Failed to Load Programme</h2>
        <p className="text-xs text-slate-600">{error}</p>
        <button
          onClick={fetchDetail}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8 font-sans">
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          to="/programs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-700 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Programmes
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              {program.code}
            </span>
            {program.category && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                {program.category}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Programme
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            {program.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {resolveProgramDescription(program)}
          </p>
        </div>

        {/* Apply CTA Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            {program.feeInr !== undefined && program.feeInr !== null
              ? 'Submit candidate details for reviewed administrative intake.'
              : 'Intake for this programme is currently pending fee publication.'}
          </div>
          {program.feeInr !== undefined && program.feeInr !== null ? (
            <Link
              to={`/apply?program=${encodeURIComponent(program.code)}`}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center justify-center gap-2"
            >
              Apply for {program.code}
              <Send className="w-3.5 h-3.5 text-amber-400" />
            </Link>
          ) : (
            <span className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs font-medium text-center">
              Applications open once NOXIRA publishes the fee.
            </span>
          )}
        </div>
      </div>

      {/* Owner-Configured Content Details */}
      {hasContent ? (
        <div className="space-y-6">
          {/* Key Specifications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {program.durationWeeks != null && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Duration</span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {program.durationWeeks} Weeks
                </div>
              </div>
            )}

            {program.feeInr != null && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Review Fee</span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {program.feeInr === 0 ? '₹0 (free)' : `₹${Number(program.feeInr).toLocaleString('en-IN')}`}
                </div>
              </div>
            )}

            {program.seats != null && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Available Seats</span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  {program.seats}
                </div>
              </div>
            )}

            {(program.startDate || program.endDate) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cohort Schedule</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1">
                  {program.startDate ? new Date(program.startDate).toLocaleDateString() : 'TBD'} – {program.endDate ? new Date(program.endDate).toLocaleDateString() : 'TBD'}
                </div>
              </div>
            )}
          </div>

          {/* Syllabus Section */}
          {Array.isArray(program.syllabus) && program.syllabus.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Programme Syllabus</h2>
              </div>
              <ul className="space-y-2.5 pt-2">
                {program.syllabus.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5 flex-shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Practical Tasks Section */}
          {Array.isArray(program.tasks) && program.tasks.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Task Deliverables</h2>
              </div>
              <ul className="space-y-2.5 pt-2">
                {program.tasks.map((taskItem, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{taskItem}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* Neutral Notice when Owner Has Not Configured Curriculum Yet */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2 shadow-xs">
          <p className="text-sm font-medium text-slate-700">
            NOXIRA will publish the detailed curriculum for this programme.
          </p>
          <p className="text-xs text-slate-500">
            Cohort applications remain open for administrative intake.
          </p>
        </div>
      )}
    </div>
  );
}
