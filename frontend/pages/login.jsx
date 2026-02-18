import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { login, register, getToken } from '../utils/api';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (router.isReady && getToken()) {
      router.push('/');
    }
  }, [router.isReady]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      router.push('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
      <div style={{ background: 'var(--g-surface)', padding: 40, borderRadius: 12, border: '1px solid var(--c-border)', boxShadow: '0 20px 60px rgb(0 0 0 / 0.35)', maxWidth: 420, width: '90%' }}>
        <h1
          style={{
            textAlign: 'center',
            margin: '0 0 24px 0',
            fontSize: 88,
            fontWeight: 400,
            letterSpacing: '0.02em',
            color: 'var(--c-ink)',
            WebkitTextStroke: '1.75px var(--c-accent)',
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.25))',
            fontFamily: "'Plaster', 'Poppins', system-ui, -apple-system, sans-serif",
            lineHeight: 0.9,
          }}
        >
          MT
        </h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Username<br />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, transition: 'border 0.2s', background: 'rgba(0,0,0,0.25)', color: 'var(--c-text)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Password<br />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, transition: 'border 0.2s', background: 'rgba(0,0,0,0.25)', color: 'var(--c-text)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
              />
            </label>
          </div>
          {error && <div style={{ color: 'var(--c-danger)', marginBottom: 16, fontSize: 14, fontWeight: 700 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 12, background: 'var(--c-accent2)', color: 'var(--c-ink)', border: '1px solid var(--c-accent2)', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 800, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.06em', boxShadow: '0 10px 24px rgb(var(--rgb-accent2) / 0.25)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: 'var(--c-text)', cursor: 'pointer', textDecoration: 'underline', fontSize: 14, fontWeight: 600 }}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
        <div style={{ marginTop: 24, padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 10, fontSize: 12, color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--c-text)' }}>Demo credentials:</p>
          <p style={{ margin: 0 }}>Username: <strong>admin</strong><br />Password: <strong>admin123</strong></p>
        </div>
      </div>
    </div>
  );
}
