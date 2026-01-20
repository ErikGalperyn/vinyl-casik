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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: 40, borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: 400, width: '90%' }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24, fontSize: 32, fontWeight: 700, letterSpacing: '-1px', margin: '0 0 24px 0' }}>Medioteka</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Username<br />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Password<br />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, transition: 'border 0.2s' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </label>
          </div>
          {error && <div style={{ color: '#d32f2f', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 10, background: '#ff006e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', textDecoration: 'underline', fontSize: 14, fontWeight: 500 }}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
        <div style={{ marginTop: 24, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: 12, color: '#666' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#000' }}>Demo credentials:</p>
          <p style={{ margin: 0 }}>Username: <strong>admin</strong><br />Password: <strong>admin123</strong></p>
        </div>
      </div>
    </div>
  );
}
