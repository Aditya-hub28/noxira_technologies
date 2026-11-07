import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, HelpCircle, Target, Award, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const LEVEL_STYLES = {
  BEGINNER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INTERMEDIATE: 'bg-sky-50 text-sky-700 border-sky-200',
  ADVANCED: 'bg-violet-50 text-violet-700 border-violet-200'
};

export default function SkillCoursesPage() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSkillCourses()
      .then(data => setCourses(data.courses || []))
      .catch(err => setError(err.message || 'Could not load skill courses.'));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="text-center mb-12 space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">
          Validate your skills. <span className="text-cyan-600">Earn proof.</span>
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Timed skill assessments built from original NOXIRA question banks. Pass the bar and your result is recorded on your account.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-6 max-w-md mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {!courses && !error && <p className="text-center text-xs text-slate-400">Loading courses...</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {(courses || []).map(course => (
          <div key={course.code} className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col hover:shadow-lg hover:shadow-ink-950/5 hover:-translate-y-0.5 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{course.category}</span>
              <span className={`text-[10px] font-bold tracking-wide uppercase border rounded-full px-2.5 py-1 ${LEVEL_STYLES[course.level] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {course.level}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink-950 tracking-tight mb-2">{course.title}</h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5 flex-1">{course.description}</p>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 mb-5">
              <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{course.durationMinutes} minutes</span>
              <span className="inline-flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5 text-slate-400" />{course.questionCount} questions</span>
              <span className="inline-flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-slate-400" />Pass: &ge;{course.passPercent}%</span>
              <span className="inline-flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-slate-400" />Result recorded</span>
            </div>

            <Link
              to={`/skill-courses/${course.code}`}
              className="inline-flex items-center justify-center gap-1.5 w-full bg-ink-950 text-white text-xs font-bold rounded-full py-2.5 hover:bg-ink-900 transition"
            >
              View test details <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
