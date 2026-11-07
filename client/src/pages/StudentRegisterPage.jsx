import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';

export default function StudentRegisterPage() {
  const { register } = useStudentAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password kam se kam 8 characters ka hona chahiye.');
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink-950 tracking-tight">Create your account</h1>
          <p className="text-sm text-slate-500 mt-2">Track your applications, skill tests and certificates in one place</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-600 mb-1.5">Full name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="reg-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Minimum 8 characters. </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-ink-950 text-white text-sm font-semibold rounded-full py-3 hover:bg-ink-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" />
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-cyan-700 hover:text-cyan-800">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
