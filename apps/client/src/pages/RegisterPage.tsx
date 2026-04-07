import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayerClass } from '@riftborn/shared';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

const classCard = (selected: boolean): React.CSSProperties => ({
  background: selected ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${selected ? '#a78bfa' : 'rgba(167,139,250,0.2)'}`,
  borderRadius: '8px',
  padding: '10px 6px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #0d0821 0%, #1a0a3e 100%)',
    overflowY: 'auto',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '380px',
    backdropFilter: 'blur(12px)',
    margin: 'auto',
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
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '4px',
    display: 'block',
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
  },
  classGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
  },
  className: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#e8e0ff',
    marginBottom: '2px',
  },
  classRole: {
    fontSize: '10px',
    color: '#6b7280',
  },
  button: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '18px',
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

const CLASS_INFO: Record<PlayerClass, { label: string; role: string; emoji: string }> = {
  [PlayerClass.VOIDBLADE]: { label: 'Voidblade', role: 'Melee DPS', emoji: '⚔️' },
  [PlayerClass.AETHERMAGE]: { label: 'Aethermage', role: 'Ranged DPS', emoji: '🔮' },
  [PlayerClass.IRONVEIL]: { label: 'Ironveil', role: 'Tank', emoji: '🛡️' },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerClass, setPlayerClass] = useState<PlayerClass>(PlayerClass.VOIDBLADE);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (playerName.trim().length < 3) {
      setError('Player name must be at least 3 characters.');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.register({
        email,
        password,
        playerName: playerName.trim(),
        playerClass,
      });
      setAuth(response.accessToken, response.player);
      navigate('/game');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Registration failed. Email may already be in use.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>Riftborn Chronicles</h1>
        <p style={s.subtitle}>Create your Riftborn identity</p>

        <form onSubmit={handleSubmit} style={s.form}>
          {error && <div style={s.error}>{error}</div>}

          <div>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={s.label}>Riftborn Name</label>
            <input
              style={s.input}
              type="text"
              placeholder="Your hero's name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          <div>
            <label style={s.label}>Choose Class</label>
            <div style={s.classGrid}>
              {(Object.values(PlayerClass) as PlayerClass[]).map((cls) => (
                <div
                  key={cls}
                  style={classCard(playerClass === cls)}
                  onClick={() => setPlayerClass(cls)}
                  role="button"
                  aria-pressed={playerClass === cls}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    {CLASS_INFO[cls].emoji}
                  </div>
                  <div style={s.className}>{CLASS_INFO[cls].label}</div>
                  <div style={s.classRole}>{CLASS_INFO[cls].role}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            style={{ ...s.button, opacity: loading ? 0.7 : 1 }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Begin Your Journey'}
          </button>
        </form>

        <p style={s.footer}>
          Already a Riftborn?{' '}
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
