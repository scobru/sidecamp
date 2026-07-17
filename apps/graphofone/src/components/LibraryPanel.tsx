import { useState } from 'react';
import { FolderOpen, Plus, Trash2, Headphones, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export type LibTrack = {
  path: string;
  name: string;
  bpm: number | null;
  key: string;
  genre: string;
  artist?: string;
  title?: string;
  duration?: number;
  beatOffset?: number | null;
  peaks?: number[];
};

interface LibraryPanelProps {
  library: LibTrack[];
  onImport: () => void;
  onClear: () => void;
  onAnalyze: () => void;
  analyzing: { done: number; total: number } | null;
  onAddTrack: (track: LibTrack) => void;
}

export default function LibraryPanel({ library, onImport, onClear, onAnalyze, analyzing, onAddTrack }: LibraryPanelProps) {
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = library.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase()) || 
    (t.artist && t.artist.toLowerCase().includes(filter.toLowerCase())) ||
    (t.title && t.title.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ transition: 'width 0.2s', width: collapsed ? '60px' : '300px', display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--glass-border)', background: 'var(--sidebar-bg)' }}>
      <div style={{ padding: collapsed ? '1rem 0.5rem' : '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minHeight: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', marginBottom: '-0.5rem' }}>
          <button onClick={() => setCollapsed(!collapsed)} className="btn" style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {!collapsed && (
          <input 
            type="text" 
            placeholder="Search tracks..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--terminal-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', borderRadius: '4px' }}
          />
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center' }}>
          <button data-tour="import" onClick={onImport} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem 0.5rem', display: 'flex', justifyContent: 'center' }}>
            <FolderOpen size={14} /> {!collapsed && "Import"}
          </button>
          
          {analyzing ? (
            <button disabled className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem 0.5rem', opacity: 0.7, display: 'flex', justifyContent: 'center' }}>
              <Headphones size={14} /> {!collapsed && `${analyzing.done}/${analyzing.total}`}
            </button>
          ) : (
            <button data-tour="analyze" onClick={onAnalyze} className="btn btn-accent" style={{ flex: 1, padding: '0.4rem 0.5rem', display: 'flex', justifyContent: 'center' }}>
              <Headphones size={14} /> {!collapsed && "Analyze"}
            </button>
          )}

          <button onClick={onClear} className="btn btn-danger" style={{ padding: '0.4rem 0.5rem', display: 'flex', justifyContent: 'center' }}>
            <Trash2 size={14} />
          </button>
        </div>

        <div className="track-table-wrap" data-tour="library" style={{ flex: 1, minHeight: 0, opacity: collapsed ? 0 : 1, pointerEvents: collapsed ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <table className="track-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>BPM</th>
                <th style={{ width: '50px' }}>KEY</th>
                <th>TITLE</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.path}>
                  <td style={{ fontFamily: 'monospace' }}>{t.bpm ? Math.round(t.bpm) : '-'}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--secondary)' }}>{t.key || '-'}</td>
                  <td title={t.title || t.name}>
                    <div style={{ fontWeight: 600 }}>{t.title || t.name}</div>
                    {t.artist && <div style={{ opacity: 0.6 }}>{t.artist}</div>}
                  </td>
                  <td>
                    <button className="btn btn-primary" style={{ padding: '0.2rem', borderRadius: '50%' }} onClick={() => onAddTrack(t)}>
                      <Plus size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-subtle)', textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem' }}>No tracks found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
