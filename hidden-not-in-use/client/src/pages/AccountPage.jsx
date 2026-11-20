import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, ShieldCheck } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';

export default function AccountPage() {
  const navigate = useNavigate();
  const { student, loading, logout } = useStudentAuth();

  useEffect(() => {
    if (!loading && !student) {
      navigate('/login?next=/account', { replace: true });
    }
  }, [loading, student, navigate]);

  if (loading || !student) {
    return (
      <div className="nx-auth-container">
        <div className="nx-auth-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ opacity: 0.7, fontSize: '14px' }}>Loading your student profile...</div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initial = (student.name || 'S').trim().charAt(0).toUpperCase();

  return (
    <div className="nx-auth-container">
      <div className="nx-auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38c8ff, #2a7fff)',
              color: '#06121a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '22px',
              boxShadow: '0 8px 20px rgba(56, 200, 255, 0.25)'
            }}
          >
            {initial}
          </div>
          <div>
            <h1 className="nx-auth-title" style={{ margin: 0, fontSize: '22px' }}>
              {student.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', opacity: 0.75, marginTop: '3px' }}>
              <ShieldCheck size={14} style={{ color: '#38c8ff' }} />
              <span>Verified Student Account</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <User size={16} style={{ opacity: 0.6 }} />
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.55 }}>Full Name</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{student.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={16} style={{ opacity: 0.6 }} />
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.55 }}>Email Address</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{student.email}</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="nx-auth-btn-primary"
          style={{
            background: 'rgba(255, 75, 75, 0.12)',
            border: '1px solid rgba(255, 75, 75, 0.35)',
            color: '#ff7878',
            marginBottom: '18px'
          }}
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>

        <p style={{ margin: 0, textAlign: 'center', fontSize: '12px', opacity: 0.55 }}>
          More account features coming soon.
        </p>
      </div>
    </div>
  );
}
