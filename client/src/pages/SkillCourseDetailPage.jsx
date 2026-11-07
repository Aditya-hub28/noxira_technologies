import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, HelpCircle, Target, ShieldAlert, PlayCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useStudentAuth } from '../context/StudentAuthContext';

export default function SkillCourseDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { student } = useStudentAuth();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    api.getSkillCourse(code)
      .then(data => setCourse(data.course))
      .catch(err => setError(err.message || 'Course not found.'));
  }, [code]);

  const handleStart = async () => {
    if (!student) {
      navigate('/login', { state: { next: `/skill-courses/${code}` } });
      return;
    }
    setStarting(true);
    setStartError('');
    try {
      const data = await api.startSkillAttempt(code);
      const attempt = {
        ...data.attempt,
        courseTitle: course.title,
        questions: (data.questions || []).map(q => ({
          id: q.id,
          prompt: q.question,
          options: q.options,
          chosen: data.attempt.answers && data.attempt.answers[q.id] != null ? data.attempt.answers[q.id] : null
        }))
      };
      navigate(`/skill-courses/${code}/test`, { state: { attempt } });
    } catch (err) {
      setStartError(err.message || 'Could not start the test.');
      setStarting(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">{error}</p>
        <Link to="/skill-courses" className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 mt-4 hover:text-cyan-700">
          <ArrowLeft className="w-3.5 h-3.5" /> All skill courses
        </Link>
      </div>
    );
  }
  if (!course) return <p className="text-center text-xs text-slate-400 py-24">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <Link to="/skill-courses" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-ink-950 transition mb-8">
        <ArrowLeft className="w-3.5 h-3.5" /> All skill courses
      </Link>

      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-9 shadow-sm">
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">{course.category}</p>
        <h1 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight mb-6">{course.title}</h1>

        <div className="grid grid-cols-3 gap-3 mb-7">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <Clock className="w-5 h-5 text-cyan-600 mx-auto mb-1.5" />
            <p className="text-lg font-black text-ink-950">{course.durationMinutes}</p>
            <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">minutes</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <HelpCircle className="w-5 h-5 text-cyan-600 mx-auto mb-1.5" />
            <p className="text-lg font-black text-ink-950">{course.questionCount}</p>
            <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">questions</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <Target className="w-5 h-5 text-cyan-600 mx-auto mb-1.5" />
            <p className="text-lg font-black text-ink-950">{course.passPercent}%</p>
            <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">to pass</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-6">{course.description}</p>

        <div className="flex items-start gap-2.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 mb-7">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            One attempt runs at a time and is server-timed. You can leave and resume an in-progress attempt; answers save automatically as you go and count up to the deadline. If your final submit arrives late, only your saved answers are scored.
          </p>
        </div>

        {startError && (
          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{startError}</span>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="inline-flex items-center justify-center gap-2 w-full bg-cyan-600 text-white font-bold text-sm rounded-full py-3.5 hover:bg-cyan-700 transition disabled:opacity-50"
        >
          <PlayCircle className="w-4.5 h-4.5 w-5 h-5" />
          {starting ? 'Preparing your test...' : student ? 'Start Test' : 'Sign in to start'}
        </button>
        {!student && <p className="text-center text-[11px] text-slate-400 mt-3">A NOXIRA account is required so your result is recorded against it.</p>}
      </div>
    </div>
  );
}
