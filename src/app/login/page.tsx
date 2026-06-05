'use client';

import { useState } from 'react';

/**
 * Login page for the optional UI auth gate. Only reachable/relevant when
 * RCM_UI_PASSWORD is configured; otherwise the app is open and middleware never
 * redirects here.
 */
export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError('Invalid username or password.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('from') || '/';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <form onSubmit={submit} style={{ width: 360, background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1d6fb8', letterSpacing: 2 }}>VEEBASE</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>RCM Intelligence Platform</div>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0b1f3a', margin: '18px 0 14px' }}>Sign in</h1>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', margin: '6px 0 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', margin: '6px 0 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: 'none', background: '#1d6fb8', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
