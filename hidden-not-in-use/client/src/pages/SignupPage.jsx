import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, Circle } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { student, signup } = useStudentAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to /account
  if (student) {
    navigate('/account', { replace: true });
    return null;
  }

  // Password rules validation
  const hasMinLength = password.length >= 8 && password.length <= 72;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumber;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must meet all complexity requirements.');
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password
      });
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not complete registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nx-auth-container">
      <div className="nx-auth-card">
        <h1 className="nx-auth-title">Create Account</h1>
        <p className="nx-auth-subtitle">Register your NOXIRA student profile to get started</p>

        {error && (
          <div className="nx-auth-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="nx-auth-group">
            <label className="nx-auth-label" htmlFor="signup-name">
              Full Name
            </label>
            <div className="nx-auth-input-wrap">
              <input
                id="signup-name"
                type="text"
                className="nx-auth-input"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aditya Jha"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="nx-auth-group">
            <label className="nx-auth-label" htmlFor="signup-email">
              Email Address
            </label>
            <div className="nx-auth-input-wrap">
              <input
                id="signup-email"
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
            <label className="nx-auth-label" htmlFor="signup-password">
              Password
            </label>
            <div className="nx-auth-input-wrap">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="nx-auth-input"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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

            {/* Live rule hints */}
            <div className="nx-auth-hint" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hasMinLength ? '#38c8ff' : 'inherit' }}>
                {hasMinLength ? <Check size={13} /> : <Circle size={10} style={{ opacity: 0.5 }} />}
                <span>At least 8 characters (max 72)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hasLetter ? '#38c8ff' : 'inherit' }}>
                {hasLetter ? <Check size={13} /> : <Circle size={10} style={{ opacity: 0.5 }} />}
                <span>Contains at least one letter</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hasNumber ? '#38c8ff' : 'inherit' }}>
                {hasNumber ? <Check size={13} /> : <Circle size={10} style={{ opacity: 0.5 }} />}
                <span>Contains at least one number</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="nx-auth-btn-primary"
            disabled={submitting}
            style={{ marginTop: '12px' }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="nx-auth-terms">
          By signing up you agree to the{' '}
          <Link to="/terms" className="nx-auth-link" target="_blank" rel="noopener noreferrer">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="nx-auth-link" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="nx-auth-links" style={{ justifyContent: 'center', marginTop: '16px' }}>
          <span style={{ opacity: 0.75 }}>Already have an account?</span>
          <Link to="/login" className="nx-auth-link">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
