import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import logo from '../assets/logo.png';

type Mode = 'register' | 'login';

interface ConnectScreenProps {
  onConnected: (server: string, token: string) => void;
}

function normalizeServer(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export default function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [mode, setMode] = useState<Mode>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const server = normalizeServer(serverUrl);
    if (!server) {
      setError('Enter your TuneCamp instance URL.');
      return;
    }
    if (!username || !password) {
      setError('Username and password required.');
      return;
    }

    setLoading(true);
    try {
      // Goes through Electron IPC rather than renderer fetch() to avoid
      // cross-origin restrictions when talking to remote TuneCamp instances.
      const data = await window.electronAPI.authConnect(server, mode, username, password);
      onConnected(server, data.token);
    } catch (err: any) {
      setError(err?.message || 'Could not reach that server.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = () => {
    const server = normalizeServer(serverUrl);
    if (!server || !manualToken.trim()) {
      setError('Server URL and JWT token both required.');
      return;
    }
    onConnected(server, manualToken.trim());
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass-card" style={{ maxWidth: '380px', width: '100%', margin: 'auto', padding: '1.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.1rem' }}>
          <img src={logo} alt="Sidecamp" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-headings)', fontSize: '1.15rem' }}>Sidecamp</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }}>Connect to a TuneCamp instance</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>TuneCamp Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="https://my-tunecamp.com"
              className="glass-input"
            />
          </div>

          <div className="btn-group" style={{ marginBottom: '0.7rem' }}>
            <Button type="button" size="sm" variant={mode === 'register' ? 'primary' : 'secondary'} onClick={() => setMode('register')}>
              Register
            </Button>
            <Button type="button" size="sm" variant={mode === 'login' ? 'primary' : 'secondary'} onClick={() => setMode('login')}>
              Log In
            </Button>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Your username"
              className="glass-input"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              className="glass-input"
            />
          </div>

          {error && <p style={{ color: 'var(--danger, #e5484d)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{error}</p>}

          <div className="btn-group" style={{ marginTop: '0.85rem' }}>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Connecting…' : mode === 'register' ? 'Create Account' : 'Log In'}
            </Button>
          </div>
        </form>

        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowManual(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}
          >
            {showManual ? '▾' : '▸'} Advanced: paste an existing JWT token
          </button>
          {showManual && (
            <div style={{ marginTop: '0.6rem' }}>
              <div className="form-group">
                <input
                  type="password"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="Paste JWT token"
                  className="glass-input"
                />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={handleManualConnect}>
                Connect with Token
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
