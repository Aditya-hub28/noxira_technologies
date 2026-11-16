import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';

function getSafeRedirect(next) {
  if (!next || typeof next !== 'string') return '/account';
  const trimmed = next.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('://')) {
    return trimmed;
  }
  return '/account';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextTarget = getSafeRedirect(searchParams.get('next'));
  const { student, login } = useStudentAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect immediately
  if (student) {
    navigate(nextTarget, { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(nextTarget, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nx-auth-container">
      <div className="nx-auth-card">
        <h1 className="nx-auth-title">Welcome back</h1>
        <p className="nx-auth-subtitle">Sign in to your NOXIRA student account</p>

        {error && (
          <div className="nx-auth-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="nx-auth-group">
            <label className="nx-auth-label" htmlFor="login-email">
              Email Address
            </label>
            <div className="nx-auth-input-wrap">
              <input
                id="login-email"
                type="email"
                className="nx-auth-input"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="nx-auth-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <label className="nx-auth-label" htmlFor="login-password" style={{ margin: 0 }}>
                Password
              </label>
              <Link to="/forgot-password" className="nx-auth-link" style={{ fontSize: '12px' }}>
                Forgot password?
              </Link>
            </div>
            <div className="nx-auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="nx-auth-input"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
              />
              <button
                type="button"
                className="nx-auth-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="nx-auth-btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="nx-auth-links" style={{ justifyContent: 'center' }}>
          <span style={{ opacity: 0.75 }}>Don't have an account?</span>
          <Link to="/signup" className="nx-auth-link">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
