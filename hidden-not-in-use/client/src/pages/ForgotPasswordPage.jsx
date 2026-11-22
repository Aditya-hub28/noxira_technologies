import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { studentForgotPassword, studentVerifyOtp, studentResetPassword } from '../services/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Screen steps: 1 = Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState(1);

  // Sensitive credentials kept strictly in component state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 60-second resend countdown timer
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await studentForgotPassword({ email: email.trim() });
      setMessage(res?.message || 'If an account exists for this email, an OTP has been sent.');
      setCountdown(60);
      setCanResend(false);
      setStep(2);
    } catch (err) {
      // Always treat forgot password response neutrally
      setMessage('If an account exists for this email, an OTP has been sent.');
      setCountdown(60);
      setCanResend(false);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await studentForgotPassword({ email: email.trim() });
      setMessage(res?.message || 'If an account exists for this email, an OTP has been sent.');
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.message || 'Unable to resend OTP right now.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    setLoading(true);
    try {
      await studentVerifyOtp({ email: email.trim(), otp: cleanOtp });
      setError('');
      setStep(3);
    } catch (err) {
      const errMsg = err.message || 'Invalid or expired OTP.';
      setError(errMsg);
      if (errMsg.includes('Too many wrong attempts') || errMsg.includes('Please request a new OTP')) {
        // Return to step 1 after attempt exhaustion
        setTimeout(() => {
          setOtp('');
          setStep(1);
        }, 2200);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 8 || newPassword.length > 72 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }

    setLoading(true);
    try {
      await studentResetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password: newPassword
      });
      setError('');
      setStep(4);
    } catch (err) {
      const errMsg = err.message || 'Invalid or expired OTP.';
      setError(errMsg);
      if (errMsg.includes('Too many wrong attempts') || errMsg.includes('Invalid or expired OTP')) {
        // If OTP expired during typing
        setTimeout(() => {
          setOtp('');
          setStep(1);
        }, 2200);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-auth-container">
      <div className="nx-auth-card">
        {step === 1 && (
          <>
            <h1 className="nx-auth-title">Reset Password</h1>
            <p className="nx-auth-subtitle">Enter your registered email and we will send a 6-digit OTP code.</p>

            {error && (
              <div className="nx-auth-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <form onSubmit={handleSendOtp} noValidate>
              <div className="nx-auth-group">
                <label className="nx-auth-label" htmlFor="reset-email">
                  Email Address
                </label>
                <div className="nx-auth-input-wrap">
                  <input
                    id="reset-email"
                    type="email"
                    className="nx-auth-input"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="nx-auth-btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  'Send Reset OTP'
                )}
              </button>
            </form>

            <div className="nx-auth-links" style={{ justifyContent: 'center' }}>
              <Link to="/login" className="nx-auth-link inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Back to Log in
              </Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="nx-auth-title">Verify OTP Code</h1>
            <p className="nx-auth-subtitle">
              Enter the 6-digit code sent to <strong style={{ color: '#38c8ff' }}>{email}</strong>
            </p>

            {message && (
              <div className="nx-auth-neutral" role="status">
                {message}
              </div>
            )}

            {error && (
              <div className="nx-auth-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} noValidate>
              <div className="nx-auth-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <label className="nx-auth-label" htmlFor="otp-input" style={{ margin: 0 }}>
                    6-Digit OTP
                  </label>
                  <button
                    type="button"
                    className="nx-auth-link"
                    style={{ fontSize: '12px', background: 'none', border: 'none', padding: 0 }}
                    onClick={() => {
                      setError('');
                      setStep(1);
                    }}
                  >
                    Change email
                  </button>
                </div>
                <div className="nx-auth-input-wrap">
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="nx-auth-input"
                    style={{ letterSpacing: '0.25em', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="nx-auth-btn-primary" disabled={loading || otp.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Verify OTP'
                )}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                className="nx-auth-link"
                disabled={!canResend || loading}
                onClick={handleResendOtp}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  opacity: canResend ? 1 : 0.6,
                  cursor: canResend ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                {canResend ? 'Resend OTP' : `Resend OTP in ${countdown}s`}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="nx-auth-title">Set New Password</h1>
            <p className="nx-auth-subtitle">Choose a secure new password for your account</p>

            {error && (
              <div className="nx-auth-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} noValidate>
              <div className="nx-auth-group">
                <label className="nx-auth-label" htmlFor="new-password">
                  New Password
                </label>
                <div className="nx-auth-input-wrap">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    className="nx-auth-input"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={loading}
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
                <div className="nx-auth-hint">
                  Min 8 characters with at least one letter and one number.
                </div>
              </div>

              <button type="submit" className="nx-auth-btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save New Password'
                )}
              </button>
            </form>
          </>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={48} style={{ color: '#38c8ff', margin: '0 auto 16px' }} />
            <h1 className="nx-auth-title">Password Reset Complete</h1>
            <p className="nx-auth-subtitle" style={{ marginBottom: '28px' }}>
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>
            <button
              type="button"
              className="nx-auth-btn-primary"
              onClick={() => navigate('/login')}
            >
              Proceed to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
