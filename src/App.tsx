import { useState, useEffect } from 'react';
import './index.css';

// Declare global for TypeScript
declare global {
  interface Window {
    electronAPI: any;
  }
}

function App() {
  const [server, setServer] = useState('');
  const [token, setToken] = useState('');
  const [folder, setFolder] = useState('');
  const [peerStatus, setPeerStatus] = useState('offline');
  const [logs, setLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('peer');

  useEffect(() => {
    // Listen to Peer Daemon logs
    window.electronAPI.onPeerLog((msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
    });

    window.electronAPI.onPeerStatus((status: string) => {
      setPeerStatus(status);
    });

    // Try to load saved config from local storage
    const savedServer = localStorage.getItem('tc_server') || '';
    const savedToken = localStorage.getItem('tc_token') || '';
    setServer(savedServer);
    setToken(savedToken);
  }, []);

  const handleStartPeer = async () => {
    localStorage.setItem('tc_server', server);
    localStorage.setItem('tc_token', token);
    
    await window.electronAPI.startPeer({
      server,
      token,
      folders: folder.split(',').map(f => f.trim()),
      allowDownloads: true
    });
  };

  const handleStopPeer = async () => {
    await window.electronAPI.stopPeer();
  };

  const handleSearch = async () => {
    setLogs(prev => [...prev, `Ricerca Soulseek: ${searchQuery}...`]);
    const res = await window.electronAPI.slskSearch(searchQuery);
    setSearchResults(res);
  };

  const handleDownloadAndUpload = async (result: any) => {
    try {
      setLogs(prev => [...prev, `Avvio download di: ${result.file}`]);
      // Download da Soulseek
      const filePath = await window.electronAPI.slskDownload(result);
      setLogs(prev => [...prev, `Download completato! File: ${filePath}`]);
      
      // Upload su TuneCamp
      setLogs(prev => [...prev, `Upload in corso verso ${server}...`]);
      await window.electronAPI.setUploadConfig(server, token);
      await window.electronAPI.uploadTrack(filePath, {});
      setLogs(prev => [...prev, `Upload completato con successo!`]);

    } catch (err: any) {
      setLogs(prev => [...prev, `Errore: ${err.message}`]);
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo-container">
          <div className="logo-icon"></div>
          <h1>Sidecamp</h1>
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'peer' ? 'active' : ''}`} onClick={() => setActiveTab('peer')}>
            <span className="icon">📡</span> Peer Node
          </button>
          <button className={`nav-item ${activeTab === 'download' ? 'active' : ''}`} onClick={() => setActiveTab('download')}>
            <span className="icon">⬇️</span> Downloader
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="icon">⚙️</span> Configurazione
          </button>
        </nav>

        <div className="status-indicator">
          <div className={`status-dot ${peerStatus}`}></div>
          <span>{peerStatus.toUpperCase()}</span>
        </div>
      </div>

      <main className="main-content">
        <header className="topbar">
          <h2>{activeTab === 'peer' ? 'Condivisione Locale' : activeTab === 'download' ? 'Ricerca & Download' : 'Impostazioni'}</h2>
        </header>

        <div className="content-area">
          {activeTab === 'settings' && (
            <div className="glass-card settings-card">
              <h3>Connessione a TuneCamp</h3>
              <div className="form-group">
                <label>Server URL</label>
                <input 
                  type="text" 
                  value={server} 
                  onChange={e => setServer(e.target.value)} 
                  placeholder="https://my-tunecamp.com" 
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>API Token / JWT</label>
                <input 
                  type="password" 
                  value={token} 
                  onChange={e => setToken(e.target.value)} 
                  placeholder="Inserisci il token JWT" 
                  className="glass-input"
                />
              </div>
            </div>
          )}

          {activeTab === 'peer' && (
            <div className="glass-card peer-card">
              <div className="peer-controls">
                <div className="form-group">
                  <label>Cartelle Musicali (separate da virgola)</label>
                  <input 
                    type="text" 
                    value={folder} 
                    onChange={e => setFolder(e.target.value)} 
                    placeholder="D:\Musica, C:\Download" 
                    className="glass-input"
                  />
                </div>
                <div className="btn-group">
                  <button className="btn btn-primary" onClick={handleStartPeer} disabled={peerStatus === 'online'}>
                    Avvia Condivisione
                  </button>
                  <button className="btn btn-danger" onClick={handleStopPeer} disabled={peerStatus === 'offline'}>
                    Arresta
                  </button>
                </div>
              </div>
              
              <div className="terminal-log">
                <div className="terminal-header">Terminal Logs</div>
                <div className="terminal-body">
                  {logs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {logs.length === 0 && <div className="log-line dim">Nessun log disponibile...</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="glass-card download-card">
              <div className="search-bar">
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Cerca su Soulseek..." 
                  className="glass-input search-input"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch}>Cerca</button>
              </div>

              <div className="results-list">
                {searchResults.map((res, i) => (
                  <div key={i} className="result-item">
                    <div className="result-info">
                      <div className="result-filename">{res.file.split(/[/\\]/).pop()}</div>
                      <div className="result-meta">
                        {(res.size / 1024 / 1024).toFixed(2)} MB • {res.bitrate || '?'} kbps • Utente: {res.user}
                      </div>
                    </div>
                    <button className="btn btn-accent" onClick={() => handleDownloadAndUpload(res)}>
                      Scarica & Upload
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && <div className="no-results">Nessun risultato.</div>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
