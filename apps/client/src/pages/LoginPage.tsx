import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #0d0821 0%, #1a0a3e 100%)',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '360px',
    backdropFilter: 'blur(12px)',
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#a78bfa',
    textAlign: 'center',
    marginBottom: '4px',
    letterSpacing: '0.02em',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '32px',
    fontStyle: 'italic',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  input: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: '8px',
    padding: '11px 14px',
    color: '#e8e0ff',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
  },
  button: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    marginTop: '6px',
    transition: 'opacity 0.15s',
  },
  footer: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '13px',
    color: '#6b7280',
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#f87171',
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      setAuth(response.accessToken, response.player);
      navigate('/game');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>Riftborn Chronicles</h1>
        <p style={s.subtitle}>Shatter the Void. Claim Eternity.</p>

        <form onSubmit={handleSubmit} style={s.form}>
          {error && <div style={s.error}>{error}</div>}

          <input
            style={s.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            style={{ ...s.button, opacity: loading ? 0.7 : 1 }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Entering...' : 'Enter the Void'}
          </button>
        </form>

        <p style={s.footer}>
          New to Eryndal?{' '}
          <Link to="/register">Create Account</Link>
        </p>
      </div>
    </div>
  );
}
