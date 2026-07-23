import { useState, type FormEvent } from 'react';
import { Button } from 'tunecamp-design-system';
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
      // Goes through window.electronAPI (Electron IPC / CapacitorHttp native
      // request) rather than a plain fetch(), so it isn't blocked by the
      // Android webview's CORS restrictions.
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
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '420px', width: '100%', margin: 'auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <img src={logo} alt="Sidecamp" style={{ width: '48px', height: '48px', borderRadius: '10px' }} />
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-headings)' }}>Sidecamp</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Connect to a TuneCamp instance</p>
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

          <div className="btn-group" style={{ marginBottom: '1rem' }}>
            <Button type="button" variant={mode === 'register' ? 'primary' : 'secondary'} onClick={() => setMode('register')}>
              Register
            </Button>
            <Button type="button" variant={mode === 'login' ? 'primary' : 'secondary'} onClick={() => setMode('login')}>
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

          {error && <p style={{ color: 'var(--danger, #e5484d)', fontSize: '0.85rem' }}>{error}</p>}

          <div className="btn-group" style={{ marginTop: '1rem' }}>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Connecting…' : mode === 'register' ? 'Create Account' : 'Log In'}
            </Button>
          </div>
        </form>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowManual(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
          >
            {showManual ? '▾' : '▸'} Advanced: paste an existing JWT token
          </button>
          {showManual && (
            <div style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <input
                  type="password"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="Paste JWT token"
                  className="glass-input"
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleManualConnect}>
                Connect with Token
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
