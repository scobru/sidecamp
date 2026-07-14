import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, SkipForward, X } from 'lucide-react';

// Graph playlist: nodes are tracks, directed edges are transitions the user
// draws. Selecting a node suggests library tracks with compatible BPM, genre
// or Camelot key. Playing walks the out-edges from the selected node with a
// crossfade + tempo-match between tracks.

export type GraphMeta = { bpm: number | null; key: string; genre: string; artist?: string; title?: string };
export type GraphTrack = { path: string; name: string };
export type GraphEdge = [string, string]; // [fromPath, toPath]

// --- Camelot wheel ---------------------------------------------------------
// Accepts Camelot notation ("8A") or classic key names ("Am", "F#m", "Bb").
const CLASSIC_TO_CAMELOT: Record<string, string> = {
  'abm': '1A', 'b': '1B', 'ebm': '2A', 'f#': '2B', 'gb': '2B', 'bbm': '3A', 'db': '3B', 'c#': '3B',
  'fm': '4A', 'ab': '4B', 'cm': '5A', 'eb': '5B', 'gm': '6A', 'bb': '6B', 'dm': '7A', 'f': '7B',
  'am': '8A', 'c': '8B', 'em': '9A', 'g': '9B', 'bm': '10A', 'd': '10B', 'f#m': '11A', 'gbm': '11A',
  'a': '11B', 'c#m': '12A', 'dbm': '12A', 'e': '12B',
};
const toCamelot = (key: string): { num: number; letter: string } | null => {
  const k = key.trim();
  let m = k.match(/^(\d{1,2})\s*([ABab])$/);
  if (!m) {
    const c = CLASSIC_TO_CAMELOT[k.toLowerCase().replace(/\s*(maj|major)$/, '').replace(/\s*(min|minor)$/, 'm')];
    if (!c) return null;
    m = c.match(/^(\d{1,2})([AB])$/)!;
  }
  const num = parseInt(m[1], 10);
  return num >= 1 && num <= 12 ? { num, letter: m[2].toUpperCase() } : null;
};
const keysCompatible = (a: string, b: string) => {
  const ka = toCamelot(a), kb = toCamelot(b);
  if (!ka || !kb) return false;
  if (ka.num === kb.num) return true; // same or relative major/minor
  const d = Math.abs(ka.num - kb.num);
  return ka.letter === kb.letter && (d === 1 || d === 11); // adjacent on the wheel
};

const bpmRatio = (from: number, to: number) => {
  // Best playback-rate ratio considering half/double time.
  const cands = [to, to * 2, to / 2];
  const best = cands.reduce((a, b) => (Math.abs(from / b - 1) < Math.abs(from / a - 1) ? b : a));
  return from / best;
};
const bpmClose = (a: number | null, b: number | null, tol = 0.06) =>
  !!a && !!b && Math.abs(bpmRatio(a, b) - 1) <= tol;

// --- Crossfade player -------------------------------------------------------
const FADE_S = 8;
type NowPlaying = { index: number; path: string; name: string } | null;

class CrossfadePlayer {
  private els: [HTMLAudioElement, HTMLAudioElement];
  private cur = 0;
  private queue: { path: string; name: string; bpm: number | null }[] = [];
  private idx = -1;
  private fading = false;
  private raf = 0;
  onChange: (np: NowPlaying) => void = () => {};

  constructor() {
    this.els = [new Audio(), new Audio()];
    this.els.forEach(el => { el.preservesPitch = true; });
  }
  private src(path: string) { return `media://${encodeURIComponent(path)}`; }

  play(queue: { path: string; name: string; bpm: number | null }[]) {
    this.stop();
    this.queue = queue;
    this.idx = 0;
    const el = this.els[this.cur];
    el.src = this.src(queue[0].path);
    el.volume = 1;
    el.playbackRate = 1;
    el.play().catch(() => {});
    this.onChange({ index: 0, path: queue[0].path, name: queue[0].name });
    this.tick();
  }

  skip() { if (this.idx >= 0 && this.idx + 1 < this.queue.length && !this.fading) this.startFade(); }

  stop() {
    cancelAnimationFrame(this.raf);
    this.fading = false;
    this.idx = -1;
    this.els.forEach(el => { el.pause(); el.removeAttribute('src'); });
    this.onChange(null);
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const el = this.els[this.cur];
    if (this.idx < 0 || this.fading || !isFinite(el.duration)) return;
    const remaining = el.duration - el.currentTime;
    if (this.idx + 1 < this.queue.length) {
      if (remaining <= FADE_S) this.startFade();
    } else if (el.ended) {
      this.stop();
    }
  };

  private startFade() {
    const from = this.queue[this.idx];
    const to = this.queue[this.idx + 1];
    const a = this.els[this.cur];
    const b = this.els[1 - this.cur];
    b.src = this.src(to.path);
    b.volume = 0;
    // Tempo match: incoming track starts at the outgoing tempo (within ±8%),
    // then eases back to its own tempo after the fade.
    let rate = 1;
    if (from.bpm && to.bpm) {
      rate = Math.min(1.08, Math.max(0.92, bpmRatio(from.bpm, to.bpm)));
    }
    b.playbackRate = rate;
    b.play().catch(() => {});
    this.fading = true;
    const t0 = performance.now();
    const fade = (now: number) => {
      const k = Math.min(1, (now - t0) / (FADE_S * 1000));
      a.volume = 1 - k;
      b.volume = k;
      if (k < 1 && this.idx >= 0) { requestAnimationFrame(fade); return; }
      a.pause(); a.removeAttribute('src');
      this.cur = 1 - this.cur;
      this.idx += 1;
      this.fading = false;
      if (this.idx >= 0) this.onChange({ index: this.idx, path: to.path, name: to.name });
      // ease the rate back to 1 over 4s
      const r0 = b.playbackRate, rt0 = performance.now();
      const ease = (n: number) => {
        const kk = Math.min(1, (n - rt0) / 4000);
        b.playbackRate = r0 + (1 - r0) * kk;
        if (kk < 1 && this.idx >= 0) requestAnimationFrame(ease);
      };
      if (rate !== 1) requestAnimationFrame(ease);
    };
    requestAnimationFrame(fade);
  }
}

// --- Force layout ------------------------------------------------------------
type Node = { path: string; name: string; x: number; y: number; vx: number; vy: number };

export default function GraphView({ tracks, edges, meta, library, onAddTrack, onAddEdge, onRemoveEdge, onRemoveTrack }: {
  tracks: GraphTrack[];
  edges: GraphEdge[];
  meta: Record<string, GraphMeta | undefined>;
  library: GraphTrack[]; // suggestion candidates (whole library)
  onAddTrack: (t: GraphTrack, edgeFrom?: string) => void;
  onAddEdge: (from: string, to: string) => void;
  onRemoveEdge: (from: string, to: string) => void;
  onRemoveTrack: (path: string) => void;
}) {
  const W = 900, H = 480, R = 26;
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const [, force] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const playerRef = useRef<CrossfadePlayer | null>(null);
  const dragRef = useRef<{ path: string; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!playerRef.current) playerRef.current = new CrossfadePlayer();
  useEffect(() => {
    const p = playerRef.current!;
    p.onChange = setNowPlaying;
    return () => p.stop();
  }, []);

  // Sync nodes with tracks; keep positions of existing ones.
  const nodes = nodesRef.current;
  tracks.forEach((t, i) => {
    if (!nodes.has(t.path)) {
      const a = (i / Math.max(1, tracks.length)) * 2 * Math.PI;
      nodes.set(t.path, { path: t.path, name: t.name, x: W / 2 + Math.cos(a) * 150, y: H / 2 + Math.sin(a) * 120, vx: 0, vy: 0 });
    }
  });
  [...nodes.keys()].forEach(k => { if (!tracks.some(t => t.path === k)) nodes.delete(k); });

  // Force simulation: springs on edges, repulsion between nodes, mild centering.
  useEffect(() => {
    let raf = 0, cooling = 220;
    const step = () => {
      const ns = [...nodes.values()];
      for (const n of ns) {
        for (const m of ns) {
          if (n === m) continue;
          const dx = n.x - m.x, dy = n.y - m.y;
          const d2 = Math.max(400, dx * dx + dy * dy);
          const f = 22000 / d2;
          const d = Math.sqrt(d2);
          n.vx += (dx / d) * f; n.vy += (dy / d) * f;
        }
        n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002;
      }
      for (const [a, b] of edges) {
        const na = nodes.get(a), nb = nodes.get(b);
        if (!na || !nb) continue;
        const dx = nb.x - na.x, dy = nb.y - na.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = (d - 130) * 0.01;
        na.vx += (dx / d) * f; na.vy += (dy / d) * f;
        nb.vx -= (dx / d) * f; nb.vy -= (dy / d) * f;
      }
      for (const n of ns) {
        if (dragRef.current?.path === n.path) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.max(R, Math.min(W - R, n.x + n.vx));
        n.y = Math.max(R, Math.min(H - R, n.y + n.vy));
      }
      force(v => v + 1);
      if (--cooling > 0) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tracks.length, edges.length]); // re-heat when the graph changes

  const svgPoint = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };

  const compatible = (a: string, b: string) => {
    const ma = meta[a], mb = meta[b];
    if (!ma || !mb) return false;
    return bpmClose(ma.bpm, mb.bpm) || (!!ma.genre && ma.genre === mb.genre) || keysCompatible(ma.key, mb.key);
  };

  // Suggestions for the selected node: library tracks not yet in the graph,
  // scored by BPM distance, key compatibility and genre.
  const suggestions = useMemo(() => {
    if (!selected) return [];
    const ms = meta[selected];
    if (!ms) return [];
    const inGraph = new Set(tracks.map(t => t.path));
    return library
      .filter(t => !inGraph.has(t.path))
      .map(t => {
        const m = meta[t.path];
        if (!m) return null;
        let score = 0;
        if (bpmClose(ms.bpm, m.bpm)) score += 2 - Math.abs(bpmRatio(ms.bpm!, m.bpm!) - 1) * 10;
        if (keysCompatible(ms.key, m.key)) score += 1.5;
        if (ms.genre && ms.genre === m.genre) score += 1;
        return score > 0 ? { t, m, score } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [selected, tracks, library, meta]);

  // Walk out-edges from a node (first unvisited neighbour at branches).
  const pathFrom = (start: string) => {
    const out = new Map<string, string[]>();
    for (const [a, b] of edges) out.set(a, [...(out.get(a) || []), b]);
    const seen = new Set<string>();
    const walk: string[] = [];
    let cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); walk.push(cur);
      cur = (out.get(cur) || []).find(n => !seen.has(n));
    }
    return walk;
  };

  const playFrom = (start: string) => {
    const q = pathFrom(start).map(p => {
      const t = tracks.find(x => x.path === p)!;
      return { path: p, name: t.name, bpm: meta[p]?.bpm ?? null };
    });
    if (q.length) playerRef.current!.play(q);
  };

  const nodeClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && selected && selected !== path) {
      const exists = edges.some(([a, b]) => a === selected && b === path);
      exists ? onRemoveEdge(selected, path) : onAddEdge(selected, path);
      return;
    }
    setSelected(s => (s === path ? null : path));
  };

  const short = (n: string) => {
    const base = n.replace(/\.[^/.]+$/, '');
    return base.length > 18 ? base.slice(0, 17) + '…' : base;
  };

  const playingPath = nowPlaying ? pathFrom(selected || nowPlaying.path) : [];

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        {selected ? (
          <>
            <button className="btn btn-primary" onClick={() => playFrom(selected)}><Play size={13} /> Play path</button>
            <button className="btn btn-danger" onClick={() => { onRemoveTrack(selected); setSelected(null); }}><X size={13} /> Remove</button>
            <span className="graph-hint">
              {(() => { const m = meta[selected]; return m ? `${m.bpm ? Math.round(m.bpm) + ' BPM' : ''} ${m.key} ${m.genre}`.trim() : ''; })()}
              {' — Ctrl+click another node to link/unlink'}
            </span>
          </>
        ) : (
          <span className="graph-hint">Click a node to select it. Compatible nodes light up; suggestions appear below.</span>
        )}
        {nowPlaying && (
          <span className="graph-nowplaying">
            <Play size={12} /> {short(nowPlaying.name)}
            <button className="btn btn-secondary" onClick={() => playerRef.current!.skip()} title="Skip to next (crossfade now)"><SkipForward size={12} /></button>
            <button className="btn btn-secondary" onClick={() => playerRef.current!.stop()} title="Stop"><Square size={12} /></button>
          </span>
        )}
      </div>

      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="graph-canvas"
        onClick={() => setSelected(null)}
        onPointerMove={e => {
          const d = dragRef.current;
          if (!d) return;
          d.moved = true;
          const pt = svgPoint(e);
          const n = nodes.get(d.path);
          if (n) { n.x = pt.x; n.y = pt.y; force(v => v + 1); }
        }}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-subtle)" />
          </marker>
        </defs>
        {edges.map(([a, b]) => {
          const na = nodes.get(a), nb = nodes.get(b);
          if (!na || !nb) return null;
          const dx = nb.x - na.x, dy = nb.y - na.y, d = Math.max(1, Math.hypot(dx, dy));
          const x2 = nb.x - (dx / d) * (R + 4), y2 = nb.y - (dy / d) * (R + 4);
          return (
            <line
              key={a + '→' + b}
              x1={na.x + (dx / d) * R} y1={na.y + (dy / d) * R} x2={x2} y2={y2}
              className="graph-edge" markerEnd="url(#arrow)"
              onClick={e => { e.stopPropagation(); onRemoveEdge(a, b); }}
            >
              <title>Click to remove this transition</title>
            </line>
          );
        })}
        {tracks.map(t => {
          const n = nodes.get(t.path);
          if (!n) return null;
          const m = meta[t.path];
          const isSel = selected === t.path;
          const isCompat = !!selected && !isSel && compatible(selected, t.path);
          const isPlaying = nowPlaying?.path === t.path;
          const inPath = !!nowPlaying && playingPath.includes(t.path);
          return (
            <g
              key={t.path}
              transform={`translate(${n.x},${n.y})`}
              className={`graph-node ${isSel ? 'sel' : ''} ${isCompat ? 'compat' : ''} ${isPlaying ? 'playing' : ''} ${inPath ? 'inpath' : ''}`}
              onClick={e => nodeClick(e, t.path)}
              onDoubleClick={e => { e.stopPropagation(); playFrom(t.path); }}
              onPointerDown={e => { e.stopPropagation(); dragRef.current = { path: t.path, moved: false }; }}
            >
              <circle r={R} />
              <text y={-2} textAnchor="middle" className="graph-bpm">{m?.bpm ? Math.round(m.bpm) : '—'}</text>
              <text y={11} textAnchor="middle" className="graph-key">{m?.key || ''}</text>
              <text y={R + 14} textAnchor="middle" className="graph-label">{short(t.name)}</text>
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="graph-suggestions">
          <div className="graph-suggestions-title">Compatible with the selected track (BPM / key / genre)</div>
          {suggestions.length === 0 && <div className="graph-hint">No compatible tracks found in the library. Run Analyze to fill BPM/key data.</div>}
          <div className="graph-suggestions-list">
            {suggestions.map(({ t, m }) => (
              <button key={t.path} className="graph-suggestion" title="Add to graph, linked from the selected track"
                onClick={() => onAddTrack(t, selected)}>
                <span className="s-bpm">{m.bpm ? Math.round(m.bpm) : '—'}</span>
                <span className="s-key">{m.key}</span>
                <span className="s-name">{short(t.name.split(/[/\\]/).pop() || t.name)}</span>
                <span className="s-genre">{m.genre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
