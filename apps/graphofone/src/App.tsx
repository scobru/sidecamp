import { useState, useEffect, useRef } from 'react';
import { GraphView, type LiveConfig, type GraphTrack, type GraphEdge, type GraphMeta } from 'graph-ui';
import { Sun, Moon, HelpCircle } from 'lucide-react';
import LibraryPanel, { type LibTrack } from './components/LibraryPanel';
import QuickTour from './components/QuickTour';
import { computePeaks } from './audio-utils';
import { guess } from 'web-audio-beat-detector';
import './index.css';

function App() {
  const [liveConfig, setLiveConfig] = useState<LiveConfig>({});
  
  // Graph State
  const [tracks, setTracks] = useState<GraphTrack[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [meta, setMeta] = useState<Record<string, GraphMeta>>({});
  
  // Library State
  const [library, setLibrary] = useState<LibTrack[]>([]);
  const [analyzing, setAnalyzing] = useState<{ done: number; total: number } | null>(null);
  const analyzeCancelRef = useRef(false);
  const isInitialLoad = useRef(true);

  // Load initial graph and library
  useEffect(() => {
    window.electronAPI.loadLibrary().then(setLibrary);
    window.electronAPI.loadGraph().then(data => {
      if (data) {
        setTracks(data.tracks || []);
        setEdges(data.edges || []);
        setMeta(data.meta || {});
        setLiveConfig(data.liveConfig || {});
      }
      isInitialLoad.current = false;
    });
  }, []);

  // Save graph on change (debounced)
  useEffect(() => {
    if (isInitialLoad.current) return;
    const t = setTimeout(() => {
      window.electronAPI.saveGraph({ tracks, edges, meta, liveConfig });
    }, 500);
    return () => clearTimeout(t);
  }, [tracks, edges, meta, liveConfig]);

  const handleImport = async () => {
    const newLib = await window.electronAPI.importFolder();
    setLibrary(newLib);
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear the library?')) {
      const empty = await window.electronAPI.clearLibrary();
      setLibrary(empty);
    }
  };

  const handleAnalyze = async () => {
    const targets = library.filter(t => !t.bpm || !t.peaks || t.beatOffset == null);
    if (targets.length === 0) {
      alert('Nothing to analyze — all tracks have BPM and waveform.');
      return;
    }
    
    analyzeCancelRef.current = false;
    setAnalyzing({ done: 0, total: targets.length });
    
    for (const f of targets) {
      if (analyzeCancelRef.current) break;
      try {
        const u8 = await window.electronAPI.readAudioFile(f.path);
        const raw = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
        const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw);
        
        const data: Partial<LibTrack> = {};
        if (!f.peaks) data.peaks = computePeaks(decoded);
        
        if (!f.bpm || f.beatOffset == null) {
          const windowStart = Math.max(0, (decoded.duration - 60) / 2);
          try {
            const { bpm, offset } = await guess(decoded, windowStart, Math.min(60, decoded.duration));
            data.bpm = bpm;
            data.beatOffset = (windowStart + offset) % (60 / bpm);
          } catch { /* no clear tempo */ }
        }
        
        if (data.bpm || data.peaks) {
          await window.electronAPI.updateTrackMeta(f.path, data);
          setLibrary(prev => prev.map(t => t.path === f.path ? { ...t, ...data } : t));
          // Update graph meta too if it's already in the set
          if (tracks.some(t => t.path === f.path)) {
            setMeta(prev => ({
              ...prev,
              [f.path]: {
                ...prev[f.path],
                ...(data.bpm ? { bpm: data.bpm, beatOffset: data.beatOffset } : {}),
                ...(data.peaks ? { peaks: data.peaks } : {})
              } as GraphMeta
            }));
          }
        }
      } catch (e) {
        console.warn('Analysis failed for', f.path, e);
      }
      setAnalyzing(s => (s ? { done: s.done + 1, total: s.total } : s));
    }
    setAnalyzing(null);
  };

  const handleAddTrack = (libTrack: LibTrack) => {
    if (!tracks.find(t => t.path === libTrack.path)) {
      setTracks(prev => [...prev, { path: libTrack.path, name: libTrack.name }]);
      setMeta(prev => ({
        ...prev,
        [libTrack.path]: {
          bpm: libTrack.bpm,
          key: libTrack.key,
          genre: libTrack.genre,
          artist: libTrack.artist,
          title: libTrack.title,
          duration: libTrack.duration,
          beatOffset: libTrack.beatOffset
        }
      }));
    }
  };

  const [showTour, setShowTour] = useState(() => !localStorage.getItem('graphofone-tour-done'));
  const closeTour = () => {
    localStorage.setItem('graphofone-tour-done', '1');
    setShowTour(false);
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const libraryForGraph: GraphTrack[] = library.map(t => ({ path: t.path, name: t.name }));

  return (
    <div className="app-container" style={{ flexDirection: 'column', background: 'var(--terminal-bg)' }}>
      <header className="titlebar-drag" style={{ height: '48px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', padding: '0 1rem', background: 'var(--terminal-header-bg)', zIndex: 10 }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.1em', background: 'linear-gradient(to right, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
          GRAPHOFONE
        </h1>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowTour(true)} className="btn" style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }} title="Quick tour">
          <HelpCircle size={18} />
        </button>
        <button onClick={toggleTheme} className="btn" style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }} title="Toggle light/dark mode">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LibraryPanel 
          library={library} 
          onImport={handleImport}
          onClear={handleClear}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          onAddTrack={handleAddTrack}
        />
        
        <main style={{ flex: 1, position: 'relative', background: 'var(--terminal-bg)', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <GraphView
            tracks={tracks}
            edges={edges}
            meta={meta}
            library={libraryForGraph}
            onAddTrack={(t, edgeFrom) => {
              const lib = library.find(l => l.path === t.path);
              if (lib) handleAddTrack(lib);
              if (edgeFrom) setEdges(prev => prev.some(e => e[0] === edgeFrom && e[1] === t.path) ? prev : [...prev, [edgeFrom, t.path]]);
            }}
            onAddEdge={(from, to) => setEdges(prev => [...prev, [from, to]])}
            onRemoveEdge={(from, to) => setEdges(prev => prev.filter(e => !(e[0] === from && e[1] === to)))}
            onRemoveTrack={(path) => {
              setTracks(prev => prev.filter(t => t.path !== path));
              setEdges(prev => prev.filter(e => e[0] !== path && e[1] !== path));
            }}
            onSetCue={(path, val) => setMeta(prev => ({...prev, [path]: {...prev[path], cuePoint: val}} as any))}
            onSetCueOut={(path, val) => setMeta(prev => ({...prev, [path]: {...prev[path], cueOutPoint: val}} as any))}
            liveConfig={liveConfig}
            onLiveConfigChange={setLiveConfig}
          />
        </main>
      </div>
      {showTour && <QuickTour onClose={closeTour} />}
    </div>
  );
}

export default App;
