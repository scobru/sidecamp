import { useState } from 'react';
import { FolderOpen, Plus, Trash2, Headphones, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from 'tunecamp-design-system';

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
          <Button onClick={() => setCollapsed(!collapsed)} variant="ghost" size="sm" style={{ padding: '0.4rem' }}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
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
          <Button data-tour="import" onClick={onImport} variant="secondary" size="sm" style={{ flex: 1 }}>
            <FolderOpen size={14} /> {!collapsed && "Import"}
          </Button>

          {analyzing ? (
            <Button disabled variant="secondary" size="sm" style={{ flex: 1, opacity: 0.7 }}>
              <Headphones size={14} /> {!collapsed && `${analyzing.done}/${analyzing.total}`}
            </Button>
          ) : (
            <Button data-tour="analyze" onClick={onAnalyze} variant="accent" size="sm" style={{ flex: 1 }}>
              <Headphones size={14} /> {!collapsed && "Analyze"}
            </Button>
          )}

          <Button onClick={onClear} variant="danger" size="sm">
            <Trash2 size={14} />
          </Button>
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
                    <Button variant="primary" size="sm" style={{ padding: '0.2rem', borderRadius: '50%' }} onClick={() => onAddTrack(t)}>
                      <Plus size={14} />
                    </Button>
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
