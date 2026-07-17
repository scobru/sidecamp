import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, SkipForward, X, Circle } from 'lucide-react';
import {
  CrossfadePlayer, bpmRatio, bpmClose,
  DEFAULT_FADE_S, FADE_OPTIONS, PREVIEW_LEAD_S, PREVIEW_TAIL_S,
  NEUTRAL_STRIP,
  type EqPreset, type BandPeaks, type QueueItem, type LiveConfig,
  type StripState, type NowPlaying, type EqBands,
} from './audio/CrossfadePlayer';
import TransitionWave from './components/TransitionWave';

// Re-export types that App.tsx imports from this module
export type { LiveConfig, EqPreset, EqBands, BandPeaks };

// Graph playlist: nodes are tracks, directed edges are transitions the user
// draws. Selecting a node suggests library tracks with compatible BPM, genre
// or Camelot key. Playing walks the out-edges from the selected node with a
// crossfade + tempo-match between tracks.

export type GraphMeta = { bpm: number | null; key: string; genre: string; artist?: string; title?: string; duration?: number; beatOffset?: number | null; cuePoint?: number | null; cueOutPoint?: number | null; };
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

const ZOOM_LEVELS = [1, 2, 4, 8] as const;

// --- Force layout ------------------------------------------------------------
type Node = { path: string; name: string; x: number; y: number; vx: number; vy: number };

export default function GraphView({ tracks, edges, meta, library, onAddTrack, onAddEdge, onRemoveEdge, onRemoveTrack, onSetCue, onSetCueOut, liveConfig, onLiveConfigChange }: {
  tracks: GraphTrack[];
  edges: GraphEdge[];
  meta: Record<string, GraphMeta | undefined>;
  library: GraphTrack[]; // suggestion candidates (whole library)
  onAddTrack: (t: GraphTrack, edgeFrom?: string) => void;
  onAddEdge: (from: string, to: string) => void;
  onRemoveEdge: (from: string, to: string) => void;
  onRemoveTrack: (path: string) => void;
  onSetCue: (path: string, cue: number) => void;
  onSetCueOut?: (path: string, cueOut: number) => void;
  liveConfig?: LiveConfig;
  onLiveConfigChange?: (cfg: LiveConfig) => void;
}) {
  const W = 900, H = 480, R = 26;
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const [, force] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [detailEdge, setDetailEdge] = useState<GraphEdge | null>(null);
  const [detailPeaks, setDetailPeaks] = useState<{ a: BandPeaks; b: BandPeaks } | null>(null);
  const [waveDetail, setWaveDetail] = useState<string | null>(null);
  const [waveDetailPeaks, setWaveDetailPeaks] = useState<BandPeaks | null>(null);
  const [waveZoomIdx, setWaveZoomIdx] = useState(0);
  const waveZoom = ZOOM_LEVELS[waveZoomIdx];
  const [wavePan, setWavePan] = useState(0); // seconds, start of the visible window
  const [beatOverride, setBeatOverride] = useState<Record<string, number>>(() => liveConfig?.beatOverride ?? {});
  const [fadeS, setFadeS] = useState(() => liveConfig?.fadeS ?? DEFAULT_FADE_S);
  const [edgePreset, setEdgePreset] = useState<Record<string, EqPreset>>(() => liveConfig?.edgePreset ?? {});
  const [loopBeats, setLoopBeats] = useState<number | null>(null);
  const [liveFilter, setLiveFilter] = useState(0); // -100..100
  const [masterOn, setMasterOn] = useState(() => liveConfig?.masterOn ?? false);
  const [masterBpm, setMasterBpm] = useState(() => liveConfig?.masterBpm ?? 125); // Ableton-style global tempo target
  // restore saved master tempo on mount (player starts fresh each mount)
  useEffect(() => { if (masterOn) playerRef.current?.setMasterTempo(masterBpm); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // persist the live-set config with the playlist whenever any piece changes
  useEffect(() => {
    onLiveConfigChange?.({ edgePreset, beatOverride, fadeS, masterOn, masterBpm });
  }, [edgePreset, beatOverride, fadeS, masterOn, masterBpm]); // eslint-disable-line react-hooks/exhaustive-deps
  const [deckRates, setDeckRates] = useState<{ a: number | null; cue: number | null }>({ a: null, cue: null });
  // mixer channels keyed by player channel id: 'a', 'b' (fallback incoming), or a cued track path
  const [strips, setStrips] = useState<Record<string, StripState | null>>({ a: NEUTRAL_STRIP });
  const mixTouch = useRef(0); // last time the user moved a mixer slider — pause sync so it doesn't fight the drag
  useEffect(() => {
    if (!nowPlaying) return;
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p || Date.now() - mixTouch.current < 1200) return;
      const chans = ['a', 'b', ...p.getCuePaths()];
      setStrips(Object.fromEntries(chans.map(ch => [ch, p.getMixerState(ch)])));
      setRouting(Object.fromEntries(chans.map(ch => [ch, p.getRouting(ch)])));
      if (masterOn) setDeckRates(p.getDeckRates());
    }, 600);
    return () => clearInterval(iv);
  }, [nowPlaying, masterOn]);
  // VU meters: style-only updates at display rate, no React re-render
  const vuRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  // Playback progress bar — DOM-only updates at ~30fps, no React re-render
  const pbBarRef = useRef<HTMLDivElement>(null);
  const pbTimeRef = useRef<HTMLSpanElement>(null);
  const pbRemRef = useRef<HTMLSpanElement>(null);
  const pbFadeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!nowPlaying) return;
    let raf = 0;
    let frame = 0;
    const fmtT2 = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const step = () => {
      // VU meters every frame
      for (const [ch, el] of Object.entries(vuRefs.current)) {
        if (el) el.style.transform = `scaleX(${playerRef.current?.getDeckLevel(ch) ?? 0})`;
      }
      // Progress bar every other frame (~30fps)
      if (++frame % 2 === 0) {
        const info = playerRef.current?.getPlaybackInfo();
        if (info && pbBarRef.current && pbTimeRef.current && pbRemRef.current && pbFadeRef.current) {
          const pct = Math.min(100, Math.max(0, (info.pos / info.dur) * 100));
          pbBarRef.current.style.width = `${pct}%`;
          pbTimeRef.current.textContent = `${fmtT2(info.pos)} / ${fmtT2(info.dur)}`;
          pbRemRef.current.textContent = `-${fmtT2(Math.max(0, info.dur - info.pos))}`;
          pbFadeRef.current.style.display = info.fading ? '' : 'none';
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nowPlaying]);
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIdx];
  const [panA, setPanA] = useState(0); // seconds, how far left of the anchored (right) edge the A window has slid
  const [panB, setPanB] = useState(0); // seconds, how far right of the anchored (left) edge the B window has slid
  const [recording, setRecording] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [pendingLive, setPendingLive] = useState<string | null>(null);
  const [cueingPaths, setCueingPaths] = useState<string[]>([]); // layered manual cues, 2-3 tracks mixable at once
  const [cuePitch, setCuePitchState] = useState<Record<string, number>>({});
  const [cueLoopBeats, setCueLoopBeats] = useState<Record<string, number>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [monitorDeviceId, setMonitorDeviceId] = useState<string | null>(null);
  const [routing, setRouting] = useState<Record<string, { pfl: boolean; master: boolean } | null>>({});
  const playerRef = useRef<CrossfadePlayer | null>(null);
  const dragRef = useRef<{ path: string; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);

  if (!playerRef.current) playerRef.current = new CrossfadePlayer();
  playerRef.current.fadeS = fadeS;
  (window as any).__cf = playerRef.current; // debug/inspection handle
  // enumerate audio output devices for the headphone monitor picker
  useEffect(() => {
    const enumerate = () => navigator.mediaDevices.enumerateDevices()
      .then(devs => setAudioOutputs(devs.filter(d => d.kind === 'audiooutput' && d.deviceId)));
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);
  // live-control state is per-track — reset when the playhead moves to a different track
  useEffect(() => {
    setLoopBeats(null);
    setLiveFilter(0);
    playerRef.current!.exitLoop();
    playerRef.current!.setLiveFilter(0);
  }, [nowPlaying?.path]);
  useEffect(() => {
    const p = playerRef.current!;
    p.onChange = setNowPlaying;
    p.onRecordingSaved = blob => {
      setSavingRec(true);
      blob.arrayBuffer()
        .then(buf => (window as any).electronAPI.saveRecording(`set-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, new Uint8Array(buf)))
        .catch(() => {})
        .finally(() => setSavingRec(false));
    };
    return () => p.stop();
  }, []);

  const toggleRecording = () => {
    if (recording) { playerRef.current!.stopRecording(); setRecording(false); }
    else { playerRef.current!.startRecording(); setRecording(true); }
  };

  // Fetch tail-of-A / head-of-B peaks for the open transition panel, matching
  // the windows preview() actually plays so the shaded fade zone lines up.
  useEffect(() => {
    if (!detailEdge) { setDetailPeaks(null); return; }
    let stale = false;
    const [a, b] = detailEdge;
    setDetailPeaks(null);
    // Zoom shrinks the visible window; pan slides it within the original
    // (zoom=1) span while keeping the fade edge reachable — A's window can
    // slide left of the track's end, B's can slide right of its start.
    const aFullLen = fadeS + PREVIEW_LEAD_S, bFullLen = fadeS + PREVIEW_TAIL_S;
    const viewLenA = aFullLen / zoom, viewLenB = bFullLen / zoom;
    const aDur = meta[a]?.duration ?? aFullLen;
    const bDur = meta[b]?.duration ?? bFullLen;
    const maxPanA = Math.max(0, aDur - viewLenA), maxPanB = Math.max(0, bDur - viewLenB);
    const pA = Math.min(panA, maxPanA), pB = Math.min(panB, maxPanB);
    const startA = aDur - viewLenA - pA;
    const startB = pB;
    Promise.all([
      playerRef.current!.getBandPeaksWindow(a, startA, startA + viewLenA),
      playerRef.current!.getBandPeaksWindow(b, startB, startB + viewLenB),
    ]).then(([pa, pb]) => { if (!stale) setDetailPeaks({ a: pa, b: pb }); }).catch(() => { if (!stale) setDetailPeaks(null); });
    return () => { stale = true; };
  }, [detailEdge, fadeS, zoom, panA, panB, meta]);

  // reset zoom/pan when a different transition opens
  useEffect(() => { setZoomIdx(0); setPanA(0); setPanB(detailEdge ? (meta[detailEdge[1]]?.cuePoint ?? 0) : 0); }, [detailEdge]);

  // Windowed waveform for the click cue/grid preview panel — zoom
  // shrinks the visible span, pan slides it, so cues can be placed precisely.
  useEffect(() => {
    if (!waveDetail) { setWaveDetailPeaks(null); return; }
    let stale = false;
    setWaveDetailPeaks(null);
    const dur = meta[waveDetail]?.duration ?? 0;
    const winLen = dur > 0 ? dur / waveZoom : undefined;
    const maxPan = winLen != null ? Math.max(0, dur - winLen) : 0;
    const start = winLen != null ? Math.min(wavePan, maxPan) : 0;
    playerRef.current!.getBandPeaksWindow(waveDetail, start, winLen != null ? start + winLen : dur)
      .then(p => { if (!stale) setWaveDetailPeaks(p); }).catch(() => { if (!stale) setWaveDetailPeaks(null); });
    return () => { stale = true; };
  }, [waveDetail, meta, waveZoom, wavePan]);

  // reset zoom/pan when a different track's preview opens
  useEffect(() => { setWaveZoomIdx(0); setWavePan(0); }, [waveDetail]);

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

  const edgeKey = (from: string, to: string) => `${from}>${to}`;

  const queueItem = (p: string): QueueItem => {
    const t = tracks.find(x => x.path === p);
    if (!t) return { path: p, name: p.split(/[\\/]/).pop() || p, bpm: null };
    return { path: p, name: t.name, bpm: meta[p]?.bpm ?? null, beatOffset: beatOverride[p] ?? meta[p]?.beatOffset, cue: meta[p]?.cuePoint ?? undefined, cueOut: meta[p]?.cueOutPoint ?? undefined };
  };

  const playFrom = (start: string) => {
    const path = pathFrom(start);
    const q = path.map((p, i) => {
      const item = queueItem(p);
      if (i > 0) item.eqPreset = edgePreset[edgeKey(path[i - 1], p)] ?? 'off';
      return item;
    });
    if (q.length) playerRef.current!.play(q, q[0].cue ?? 0);
  };

  const previewEdge = (from: string, to: string) => {
    const toItem = queueItem(to);
    toItem.eqPreset = edgePreset[edgeKey(from, to)] ?? 'off';
    playerRef.current!.preview(queueItem(from), toItem);
  };

  const goLive = (from: string, to: string) => {
    if (nowPlaying?.path !== from) return;
    const toItem = queueItem(to);
    toItem.eqPreset = edgePreset[edgeKey(from, to)] ?? 'off';
    playerRef.current!.liveTransitionTo(toItem);
    setPendingLive(to);
    clearCueState(to); // the fade takes over this deck; other cued tracks keep playing
  };

  /** Loop overlay feeder for a waveform window: maps the deck's active loop + playhead to window fractions. */
  const loopOverlay = (ch: string, winStart: number, winLen: number) => () => {
    const ls = playerRef.current?.getLoopState(ch);
    if (!ls || winLen <= 0) return null;
    return { startFrac: (ls.start - winStart) / winLen, endFrac: (ls.end - winStart) / winLen, posFrac: (ls.pos - winStart) / winLen };
  };

  const clearCueState = (path: string) => {
    setCueingPaths(cs => cs.filter(x => x !== path));
    setCuePitchState(({ [path]: _, ...rest }) => rest);
    setCueLoopBeats(({ [path]: _, ...rest }) => rest);
  };

  const toggleCue = (path: string, offset: number) => {
    clearCueState(path);
    if (cueingPaths.includes(path)) {
      playerRef.current!.stopCue(path);
    } else {
      playerRef.current!.cueLive(path, offset, meta[path]?.bpm, beatOverride[path] ?? meta[path]?.beatOffset);
      setCueingPaths(cs => [...cs, path]);
    }
  };

  // shared by the grid nudge buttons and the keyboard shortcut below
  const nudgeGrid = (path: string, bpm: number | null | undefined, curOffset: number | null | undefined, deltaS: number) => {
    if (!bpm || curOffset == null) return;
    const period = 60 / bpm;
    setBeatOverride(o => {
      const base = o[path] ?? curOffset;
      return { ...o, [path]: (((base + deltaS) % period) + period) % period };
    });
    // if this track is currently sounding (manual cue or live crossfade), bend its
    // pitch live too, instead of only updating the override for the next fire
    playerRef.current!.nudgeLive(path, deltaS);
  };

  useEffect(() => {
    if (pendingLive && nowPlaying?.path === pendingLive) setPendingLive(null);
  }, [nowPlaying?.path, pendingLive]);

  // Live keyboard mapping: Z X C V / 1-5 / 0 drive deck A (beat jump / loop / exit loop);
  // Q, A S D F, Shift+1-5 / Shift+0 drive the cue deck of the selected node — click a node
  // to retarget them — falling back to the B track of the open transition panel.
  useEffect(() => {
    if (!liveMode) return;
    const loopSteps = [1, 2, 4, 8, 16];
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const p = playerRef.current;
      if (!p) return;
      const key = e.key.toLowerCase();
      // e.key for a shifted digit varies by keyboard layout (e.g. Shift+1 → "!" on US,
      // "!" or others elsewhere) — e.code stays "Digit0".."Digit5" regardless of Shift/layout.
      const digitMatch = /^Digit([0-5])$/.exec(e.code);

      const aJump: Record<string, number> = { z: -4, x: -1, c: 1, v: 4 };
      if (key in aJump) { p.beatJump(aJump[key]); return; }
      if (!e.shiftKey && digitMatch) {
        const n = Number(digitMatch[1]);
        if (n === 0) { p.exitLoop(); setLoopBeats(null); return; }
        const beats = loopSteps[n - 1];
        if (loopBeats === beats) { p.exitLoop(); setLoopBeats(null); }
        else { p.setLoop(beats); setLoopBeats(beats); }
        return;
      }

      const b = selected && selected !== nowPlaying?.path ? selected : detailEdge?.[1];
      if (!b) return;
      const mb = meta[b];
      if (key === 'q') { toggleCue(b, mb?.cuePoint ?? 0); return; }
      if (e.shiftKey) {
        const bNudge: Record<string, number> = { a: -0.05, s: -0.01, d: 0.01, f: 0.05 };
        if (key in bNudge) { nudgeGrid(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, bNudge[key]); return; }
      } else {
        const bJump: Record<string, number> = { a: -4, s: -1, d: 1, f: 4 };
        if (key in bJump) { if (mb?.bpm) p.cueBeatJump(b, bJump[key], mb.bpm); return; }
      }
      if (e.shiftKey && digitMatch) {
        const n = Number(digitMatch[1]);
        if (n === 0) { p.exitCueLoop(b); setCueLoopBeats(({ [b]: _, ...rest }) => rest); return; }
        if (!mb?.bpm) return;
        const beats = loopSteps[n - 1];
        if (cueLoopBeats[b] === beats) { p.exitCueLoop(b); setCueLoopBeats(({ [b]: _, ...rest }) => rest); }
        else { p.setCueLoop(b, beats, mb.bpm); setCueLoopBeats(lb => ({ ...lb, [b]: beats })); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveMode, detailEdge, selected, nowPlaying, meta, loopBeats, cueLoopBeats, toggleCue, beatOverride, nudgeGrid]);

  const toggleDetail = (from: string, to: string) => {
    setDetailEdge(d => (d && d[0] === from && d[1] === to ? null : [from, to]));
    if (liveMode) {
      if (nowPlaying?.path !== from) playFrom(from);
    } else {
      previewEdge(from, to);
    }
  };

  const nodeClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    // Alt+click in live mode: quick-fire layer a connected track
    if (e.altKey && liveMode && nowPlaying && path !== nowPlaying.path) {
      const connected = edges.some(([a, b]) => a === nowPlaying.path && b === path);
      if (connected) { toggleCue(path, meta[path]?.cuePoint ?? 0); return; }
    }
    if (e.shiftKey && selected && selected !== path) {
      const exists = edges.some(([a, b]) => a === selected && b === path);
      exists ? onRemoveEdge(selected, path) : onAddEdge(selected, path);
      return;
    }
    setSelected(s => (s === path ? null : path));
    setWaveDetail(w => (w === path ? null : path));
  };

  const short = (n: string) => {
    const base = n.replace(/\.[^/.]+$/, '');
    return base.length > 18 ? base.slice(0, 17) + '…' : base;
  };

  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const playingPath = nowPlaying ? pathFrom(selected || nowPlaying.path) : [];

  const getNodeMixerLabel = (path: string): string | null => {
    if (!nowPlaying) return null;
    if (nowPlaying.path === path) return 'A';

    // Check if it's the target of a fade (Deck B)
    const fadingPair = playerRef.current?.getFadingPair();
    if (fadingPair && fadingPair.to === path) return 'B';

    // Check if it's in cued paths
    const cueIdx = cueingPaths.indexOf(path);
    if (cueIdx !== -1) {
      return String.fromCharCode(66 + cueIdx); // B, C, D...
    }

    return null;
  };

  // Spectrogram-style animated background: draws the live playback spectrum
  // as translucent bars behind the graph, so the canvas breathes with the music.
  useEffect(() => {
    const cv = bgRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
      ctx.clearRect(0, 0, w, h);
      const spectrum = nowPlaying ? playerRef.current?.getSpectrum() : null;
      if (spectrum) {
        const n = spectrum.length;
        const barW = w / n;
        const isLight = document.documentElement.dataset.theme === 'light';
        for (let i = 0; i < n; i++) {
          const v = spectrum[i] / 255;
          const barH = v * h;
          ctx.fillStyle = isLight
            ? `rgba(29, 78, 216, ${0.03 + v * 0.12})`
            : `rgba(251, 191, 36, ${0.06 + v * 0.24})`;
          ctx.fillRect(i * barW, h - barH, barW + 0.5, barH);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [nowPlaying]);

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <button className={`btn ${recording ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleRecording}
          title={recording ? 'Stop recording and save the set' : 'Record this set to a file as you play it'}>
          <Circle size={12} fill={recording ? 'currentColor' : 'none'} /> {recording ? 'Stop rec' : 'Rec'}
        </button>
        {savingRec && <span className="graph-hint">Saving recording…</span>}
        <button className={`btn ${liveMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLiveMode(v => !v)}
          title={liveMode ? 'Live: click an arrow to crossfade to that track now' : 'Enable live-arrow transitions while a track is playing'}>
          Live
        </button>
        {liveMode && (
          <button className={`btn ${showShortcuts ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowShortcuts(v => !v)}
            title="Show/hide keyboard shortcuts">
            ⌨
          </button>
        )}
        {selected ? (
          <>
            <button className="btn btn-primary" onClick={() => playFrom(selected)}><Play size={13} /> Play path</button>
            <button className="btn btn-danger" onClick={() => { onRemoveTrack(selected); setSelected(null); }}><X size={13} /> Remove</button>
            <span className="graph-hint">
              {(() => { const m = meta[selected]; return m ? `${m.bpm ? Math.round(m.bpm) + ' BPM' : ''} ${m.key} ${m.genre}`.trim() : ''; })()}
              {' — Shift+click another node to link/unlink'}
            </span>
          </>
        ) : (
          <span className="graph-hint">Click a node to select it (compatible nodes light up, suggestions appear below, and waveform opens to set cues/grid). Click an arrow to preview that transition.</span>
        )}
        {nowPlaying && (
          <span className="graph-nowplaying">
            <Play size={12} /> {short(nowPlaying.name)}
            <button className="btn btn-secondary" onClick={() => playerRef.current!.skip()} title="Skip to next (crossfade now)"><SkipForward size={12} /></button>
            <button className="btn btn-secondary" onClick={() => playerRef.current!.stop()} title="Stop"><Square size={12} /></button>
          </span>
        )}
      </div>

      {nowPlaying && (() => {
        const m = meta[nowPlaying.path];
        return (
          <div className="graph-playback-bar">
            <span className="gpb-track">
              <Play size={11} /> {short(nowPlaying.name)}
              {m?.bpm ? <span className="gpb-meta"> — {Math.round(m.bpm)} BPM {m.key}</span> : null}
            </span>
            <span className="gpb-progress">
              <span className="gpb-fill" ref={pbBarRef} />
            </span>
            <span className="gpb-time" ref={pbTimeRef}>0:00 / 0:00</span>
            <span className="gpb-remaining" ref={pbRemRef}>-0:00</span>
            <span className="gpb-fading" ref={pbFadeRef} style={{ display: 'none' }}>FADING</span>
          </div>
        );
      })()}

      {liveMode && showShortcuts && (
        <div className="graph-hint">
          Deck A — <b>Z X C V</b> beat jump ±4/±1 · <b>1-5</b> loop 1/2/4/8/16 · <b>0</b> exit loop.{' '}
          Deck B cue (open a transition panel) — <b>Q</b> cue play/stop · <b>A S D F</b> beat jump ±4/±1 ·{' '}
          <b>Shift+A/S/D/F</b> grid nudge ±50/±10ms · <b>Shift+1-5</b> loop · <b>Shift+0</b> exit loop.
          {' '}Live — <b>Alt+click</b> a connected node to quick-fire it as a beat-synced layer.
        </div>
      )}

      {nowPlaying && (() => {
        return (
          <div className="graph-live-controls">
            <span className="glc-group">
              <button className={`btn wc-btn ${masterOn ? 'btn-primary' : 'btn-secondary'}`}
                title="Master tempo: warp every deck to this BPM (Ableton-style). Enabling snaps to the current track's BPM."
                onClick={() => {
                  const on = !masterOn;
                  let bpm = masterBpm;
                  if (on) { const cur = meta[nowPlaying.path]?.bpm; if (cur) { bpm = Math.round(cur); setMasterBpm(bpm); } }
                  setMasterOn(on);
                  playerRef.current!.setMasterTempo(on ? bpm : null);
                }}>Master</button>
              <input type="number" min={60} max={200} step={1} value={masterBpm} style={{ width: 52 }}
                onChange={e => {
                  const v = Number(e.target.value) || 0;
                  setMasterBpm(v);
                  if (masterOn && v >= 60 && v <= 200) playerRef.current!.setMasterTempo(v);
                }} />
              {masterOn && deckRates.a != null && (
                <span className="wc-label" title="Actual warp rate of each deck — ×1.000 means the track's BPM is unknown or already equals the master">
                  A×{deckRates.a.toFixed(3)}{deckRates.cue != null ? ` · B×${deckRates.cue.toFixed(3)}` : ''}
                </span>
              )}
            </span>
            {[
              { ch: 'a', label: 'A' },
              // one strip per manually cued track (named); plain B strip only as fallback for the auto-fade deck
              ...(cueingPaths.length
                ? cueingPaths.map((p, idx) => ({ ch: p, label: String.fromCharCode(66 + idx) })) // B, C, D...
                : [{ ch: 'b', label: 'B' }]),
            ].map(({ ch, label }) => {
              const dis = ch !== 'a' && !strips[ch];
              const v = strips[ch] ?? NEUTRAL_STRIP;
              const set = (patch: Partial<StripState>) => {
                mixTouch.current = Date.now();
                setStrips(prev => ({ ...prev, [ch]: { ...(prev[ch] ?? NEUTRAL_STRIP), ...patch } }));
              };
              const isCue = ch !== 'a' && ch !== 'b';
              const bpm = isCue ? meta[ch]?.bpm : null;
              const jump = (n: number) => (isCue ? bpm && playerRef.current!.cueBeatJump(ch, n, bpm) : playerRef.current!.beatJump(n));
              const activeLoop = isCue ? cueLoopBeats[ch] : ch === 'a' ? loopBeats ?? undefined : undefined;
              const setChanLoop = (n: number | null) => {
                const p = playerRef.current!;
                if (isCue) {
                  if (n == null) { p.exitCueLoop(ch); setCueLoopBeats(({ [ch]: _, ...rest }) => rest); }
                  else if (bpm) { p.setCueLoop(ch, n, bpm); setCueLoopBeats(lb => ({ ...lb, [ch]: n })); }
                } else {
                  if (n == null) { p.exitLoop(); setLoopBeats(null); }
                  else { p.setLoop(n); setLoopBeats(n); }
                }
              };
              return (
                <span className={`glc-group glc-strip${dis ? ' glc-strip-off' : ''}`} key={ch}>
                  <span className="glc-strip-row">
                  <b className="wc-label" title={ch !== 'a' && ch !== 'b' ? tracks.find(t => t.path === ch)?.name : undefined}>{label}</b>
                  <span className="vu"><span className="vu-fill" ref={el => { vuRefs.current[ch] = el; }} /></span>
                  <label className="glc-ctl">
                    <span className="glc-tag">VOL</span>
                    <input type="range" className="glc-vol" min={0} max={100} value={Math.round(v.vol * 100)} disabled={dis}
                      title={`Volume ${label} (double-click: 100%)`}
                      onDoubleClick={() => { set({ vol: 1 }); playerRef.current!.setDeckVolume(ch, 1); }}
                      onChange={e => { const x = Number(e.target.value) / 100; set({ vol: x }); playerRef.current!.setDeckVolume(ch, x); }} />
                  </label>
                  <label className="glc-ctl">
                    <span className="glc-tag">FLT</span>
                    <input type="range" className="glc-fil" min={-100} max={100} step={5} value={Math.round(v.filter * 100)} disabled={dis}
                      title={`Filter ${label} — left: lowpass, right: highpass, center/double-click: off`}
                      onDoubleClick={() => { set({ filter: 0 }); playerRef.current!.setDeckFilter(ch, 0); }}
                      onChange={e => { const x = Number(e.target.value) / 100; set({ filter: x }); playerRef.current!.setDeckFilter(ch, x); }} />
                  </label>
                  {(['low', 'mid', 'high'] as const).map(band => (
                    <label className="glc-ctl" key={band}>
                      <span className="glc-tag">{band === 'low' ? 'LO' : band === 'mid' ? 'MD' : 'HI'}</span>
                      <input type="range" className="glc-eq" min={-24} max={6} value={Math.round(v[band])} disabled={dis}
                        title={`EQ ${band} ${label} (double-click: 0, -24 dB = kill)`}
                        onDoubleClick={() => { set({ [band]: 0 }); playerRef.current!.setDeckEq(ch, band, 0); }}
                        onChange={e => { const x = Number(e.target.value); set({ [band]: x }); playerRef.current!.setDeckEq(ch, band, x); }} />
                    </label>
                  ))}
                  {monitorDeviceId && (
                    <>
                      <button className={`btn wc-btn ${routing[ch]?.pfl ? 'btn-accent' : 'btn-secondary'}`} disabled={dis}
                        title={`Pre-fade listen ${label} in headphones`}
                        onClick={() => { const on = !routing[ch]?.pfl; playerRef.current!.setPfl(ch, on); setRouting(r => ({ ...r, [ch]: { ...r[ch]!, pfl: on } })); }}>
                        🎧
                      </button>
                      {ch !== 'a' && (
                        <button className={`btn wc-btn ${routing[ch]?.master ? 'btn-primary' : 'btn-secondary'}`} disabled={dis}
                          title={`Push ${label} to master output (unmute from headphone-only)`}
                          onClick={() => { const on = !routing[ch]?.master; playerRef.current!.setDeckMaster(ch, on); setRouting(r => ({ ...r, [ch]: r[ch] ? { ...r[ch]!, master: on } : null })); }}>
                          🔊
                        </button>
                      )}
                    </>
                  )}
                  {isCue && (
                    <button className="btn btn-secondary wc-btn" title={`Stop cued track ${label}`}
                      onClick={() => { playerRef.current!.stopCue(ch); clearCueState(ch); }}>
                      <Square size={12} />
                    </button>
                  )}
                  </span>
                  {ch !== 'b' && (
                    <span className="glc-strip-row glc-strip-perf">
                      <span className="glc-tag">JMP</span>
                      {[-4, -1, 1, 4].map(n => (
                        <button key={n} className="btn btn-secondary wc-btn" disabled={dis || (isCue && !bpm)}
                          title={`Jump ${n > 0 ? '+' : ''}${n} beats`} onClick={() => jump(n)}>{n > 0 ? `+${n}` : n}</button>
                      ))}
                      <span className="wc-sep" />
                      <span className="glc-tag">LOOP</span>
                      {[1, 2, 4, 8, 16].map(n => (
                        <button key={n} className={`btn wc-btn ${activeLoop === n ? 'btn-primary' : 'btn-secondary'}`}
                          disabled={dis || (isCue && !bpm)} title={`Loop ${n} beat${n > 1 ? 's' : ''} from here`}
                          onClick={() => setChanLoop(activeLoop === n ? null : n)}>{n}</button>
                      ))}
                      {activeLoop != null && (
                        <button className="btn btn-secondary wc-btn" onClick={() => setChanLoop(null)}>Exit</button>
                      )}
                      {isCue && (
                        <>
                          <span className="wc-sep" />
                          <span className="glc-tag">PITCH</span>
                          <input type="range" className="glc-pitch" min={-8} max={8} step={0.1} disabled={dis}
                            value={((cuePitch[ch] ?? 1) - 1) * 100} title="Manual pitch % (double-click: 0)"
                            onDoubleClick={() => { setCuePitchState(ps => ({ ...ps, [ch]: 1 })); playerRef.current!.setCuePitch(ch, 1); }}
                            onChange={e => { const r = 1 + Number(e.target.value) / 100; setCuePitchState(ps => ({ ...ps, [ch]: r })); playerRef.current!.setCuePitch(ch, r); }} />
                          <span className="wc-label">{(((cuePitch[ch] ?? 1) - 1) * 100).toFixed(1)}%</span>
                        </>
                      )}
                    </span>
                  )}
                </span>
              );
            })}

            {audioOutputs.length > 1 && (
              <span className="glc-group">
                <span className="wc-label">🎧 Monitor</span>
                <select className="transition-fade-select" value={monitorDeviceId ?? ''}
                  title="Headphone output device for pre-fade listen (PFL)"
                  onChange={e => {
                    const id = e.target.value || null;
                    setMonitorDeviceId(id);
                    playerRef.current!.setMonitorDevice(id);
                  }}>
                  <option value="">Off</option>
                  {audioOutputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                  ))}
                </select>
              </span>
            )}
          </div>
        );
      })()}

      {nowPlaying && (
        <div className="graph-live-fx">
          <span className="glc-tag graph-live-fx-label">⚡ Live Sweep</span>
          <span className="graph-live-fx-val">{liveFilter > 0 ? '+' : ''}{liveFilter}</span>
          <input type="range" className="graph-live-fx-knob" min={-100} max={100} step={5} value={liveFilter}
            title="Live filter sweep — all decks: left = lowpass (underwater), right = highpass (distant), center = off. Double-click to reset."
            onDoubleClick={() => { setLiveFilter(0); playerRef.current!.setLiveFilter(0); }}
            onChange={e => { const v = Number(e.target.value); setLiveFilter(v); playerRef.current!.setLiveFilter(v / 100); }} />
          {liveFilter !== 0 && (
            <button className="btn btn-secondary wc-btn" title="Reset sweep to off" onClick={() => { setLiveFilter(0); playerRef.current!.setLiveFilter(0); }}>✕</button>
          )}
          <span className="wc-sep" style={{ alignSelf: 'center', height: '1.4em' }} />
          <span className="glc-tag graph-live-fx-label">🥁 Deck A</span>
          <span className="glc-group">
            <span className="wc-label">Jump</span>
            <button className="btn btn-secondary wc-btn" onClick={() => playerRef.current!.beatJump(-4)}>-4</button>
            <button className="btn btn-secondary wc-btn" onClick={() => playerRef.current!.beatJump(-1)}>-1</button>
            <button className="btn btn-secondary wc-btn" onClick={() => playerRef.current!.beatJump(1)}>+1</button>
            <button className="btn btn-secondary wc-btn" onClick={() => playerRef.current!.beatJump(4)}>+4</button>
          </span>
          <span className="glc-group">
            <span className="wc-label">Loop</span>
            {[1, 2, 4, 8, 16].map(n => (
              <button key={n} className={`btn wc-btn ${loopBeats === n ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (loopBeats === n) { playerRef.current!.exitLoop(); setLoopBeats(null); }
                  else { playerRef.current!.setLoop(n); setLoopBeats(n); }
                }}>{n}</button>
            ))}
            {loopBeats != null && (
              <button className="btn btn-secondary wc-btn" onClick={() => { playerRef.current!.exitLoop(); setLoopBeats(null); }}>Exit</button>
            )}
          </span>
        </div>
      )}

      <div className="graph-canvas-wrap">
      <canvas ref={bgRef} className="graph-spectrum-bg" />
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="graph-canvas"
        onClick={() => { setSelected(null); setDetailEdge(null); }}
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
          const x1 = na.x + (dx / d) * R, y1 = na.y + (dy / d) * R;
          const pi = playingPath.indexOf(a);
          const flowing = pi >= 0 && playingPath[pi + 1] === b;
          const armed = liveMode && nowPlaying?.path === a;
          return (
            <g
              key={a + '→' + b}
              className={`graph-edge-hit ${detailEdge && detailEdge[0] === a && detailEdge[1] === b ? 'active' : ''} ${flowing ? 'flowing' : ''}`}
              onClick={e => { e.stopPropagation(); (e.ctrlKey || e.metaKey) ? onRemoveEdge(a, b) : toggleDetail(a, b); }}
            >
              <title>{armed ? 'Armed for live — click to open the transition panel, then hit the lock to fire it' : 'Click: preview this transition — Ctrl+click: remove it'}</title>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="graph-edge" markerEnd="url(#arrow)" />
              {armed && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} className="graph-edge-armed">🔒</text>}
            </g>
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
          const isLayerable = liveMode && !!nowPlaying && !isPlaying && edges.some(([a, b]) => a === nowPlaying.path && b === t.path);
          const isCued = cueingPaths.includes(t.path);
          const mixerLabel = getNodeMixerLabel(t.path);
          return (
            <g
              key={t.path}
              transform={`translate(${n.x},${n.y})`}
              className={`graph-node ${isSel ? 'sel' : ''} ${isCompat ? 'compat' : ''} ${isPlaying ? 'playing' : ''} ${inPath ? 'inpath' : ''} ${isLayerable ? 'layerable' : ''} ${isCued ? 'cued' : ''}`}
              onClick={e => nodeClick(e, t.path)}
              onDoubleClick={e => { e.stopPropagation(); playFrom(t.path); }}
              onPointerDown={e => { e.stopPropagation(); dragRef.current = { path: t.path, moved: false }; }}
            >
              <circle r={R} style={isPlaying && m?.bpm ? { animationDuration: `${60 / m.bpm}s` } : undefined} />
              <text y={-2} textAnchor="middle" className="graph-bpm">{m?.bpm ? Math.round(m.bpm) : '—'}</text>
              <text y={11} textAnchor="middle" className="graph-key">{m?.key || ''}</text>
              <text y={R + 14} textAnchor="middle" className="graph-label">{short(t.name)}</text>
              {mixerLabel && (
                <g className={`graph-node-badge ${mixerLabel !== 'A' ? 'cued-badge' : ''}`}>
                  <circle cx={R - 2} cy={-R + 2} r={9} className="badge-bg" />
                  <text x={R - 2} y={-R + 2} textAnchor="middle" className="badge-text">{mixerLabel}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      </div>

      {detailEdge && (() => {
        const [a, b] = detailEdge;
        const ta = tracks.find(t => t.path === a), tb = tracks.find(t => t.path === b);
        const ma = meta[a], mb = meta[b];
        const aFullLen = fadeS + PREVIEW_LEAD_S, bFullLen = fadeS + PREVIEW_TAIL_S;
        const aLen = aFullLen / zoom, bLen = bFullLen / zoom;
        const aDur = ma?.duration ?? aFullLen;
        const bDur = mb?.duration ?? bFullLen;
        const maxPanA = Math.max(0, aDur - aLen), maxPanB = Math.max(0, bDur - bLen);
        const pA = Math.min(panA, maxPanA), pB = Math.min(panB, maxPanB);
        const aWinStart = aDur - aLen - pA;
        const bWinStart = pB;
        // Keep the point you're looking at under the cursor when zooming,
        // instead of snapping the view back — otherwise every zoom click
        // throws away where you were in the waveform.
        const changeZoom = (newIdx: number) => {
          const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, newIdx));
          if (clamped === zoomIdx) return;
          const newZoom = ZOOM_LEVELS[clamped];
          const newALen = aFullLen / newZoom, newBLen = bFullLen / newZoom;
          const centerA = aWinStart + aLen / 2, centerB = bWinStart + bLen / 2;
          const newPanA = aDur - newALen - (centerA - newALen / 2);
          const newPanB = centerB - newBLen / 2;
          setZoomIdx(clamped);
          setPanA(Math.max(0, Math.min(Math.max(0, aDur - newALen), newPanA)));
          setPanB(Math.max(0, Math.min(Math.max(0, bDur - newBLen), newPanB)));
        };
        const beatFracs = (bpm: number | null | undefined, offset: number | null | undefined, winStart: number, winLen: number) => {
          if (!bpm || offset == null) return [];
          const period = 60 / bpm;
          let t = winStart + (((offset - winStart) % period) + period) % period;
          const out: number[] = [];
          for (; t < winStart + winLen; t += period) out.push((t - winStart) / winLen);
          return out;
        };
        const pickBeat = (path: string, bpm: number | null | undefined, winStart: number, winLen: number) => (frac: number) => {
          if (!bpm) return;
          const period = 60 / bpm;
          const abs = winStart + frac * winLen;
          setBeatOverride(o => ({ ...o, [path]: ((abs % period) + period) % period }));
        };
        const nudgeBeat = (path: string, bpm: number | null | undefined, curOffset: number | null | undefined, deltaS: number) => () => nudgeGrid(path, bpm, curOffset, deltaS);
        return (
          <div className="transition-panel">
            <div className="transition-panel-head">
              <span className="transition-panel-title">Transition detail</span>
              <select className="transition-fade-select" value={fadeS} onChange={e => setFadeS(Number(e.target.value))} title="Crossfade length">
                {FADE_OPTIONS.map(s => <option key={s} value={s}>{s}s fade</option>)}
              </select>
              <select className="transition-fade-select" value={edgePreset[edgeKey(a, b)] ?? 'off'}
                onChange={e => setEdgePreset(p => ({ ...p, [edgeKey(a, b)]: e.target.value as EqPreset }))}
                title="EQ style for this transition">
                <option value="off">Fade</option>
                <option value="bass-swap">Bass Swap</option>
                <option value="rise">Rise</option>
                <option value="blend">Blend</option>
                <option value="wave">Wave</option>
                <option value="melt">Melt</option>
                <option value="slam">Slam</option>
              </select>
              <span className="transition-zoom">
                <button className="btn btn-secondary" disabled={zoomIdx === 0} onClick={() => changeZoom(zoomIdx - 1)} title="Zoom out">−</button>
                <span className="transition-zoom-label">{zoom}x</span>
                <button className="btn btn-secondary" disabled={zoomIdx === ZOOM_LEVELS.length - 1} onClick={() => changeZoom(zoomIdx + 1)} title="Zoom in">+</button>
              </span>
              <button className="btn btn-secondary" onClick={() => previewEdge(a, b)} title="Replay this transition"><Play size={12} /> Preview</button>
              {liveMode && nowPlaying?.path === a && (
                <>
                  <button className={`btn ${cueingPaths.includes(b) ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggleCue(b, mb?.cuePoint ?? 0)}
                    title={cueingPaths.includes(b)
                      ? 'Stop the synced track'
                      : 'Start the incoming track now, beat-synced, without crossfading — you decide when to go live'}>
                    {cueingPaths.includes(b) ? <><Square size={12} /> Stop</> : <><Play size={12} /> Play sync</>}
                  </button>
                  <button className={`btn btn-accent ${pendingLive === b ? 'blink' : ''}`} disabled={pendingLive === b}
                    onClick={() => goLive(a, b)} title="Fire this transition now, quantized to the next bar">
                    🔒 {pendingLive === b ? 'Going live…' : 'Go live'}
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setDetailEdge(null)} title="Close"><X size={12} /></button>
            </div>

            <div className="transition-track-label">
              <span>{short(ta?.name || a)}{ma?.bpm ? ` — ${Math.round(ma.bpm)} BPM ${ma.key}` : ''}</span>
              <span className="transition-tail-tag">out</span>
            </div>
            {maxPanA > 0 && (
              <div className="wave-scrub">
                <input type="range" min={0} max={maxPanA} step={1} value={maxPanA - pA}
                  onChange={e => setPanA(maxPanA - Number(e.target.value))} title="Scrub anywhere in the track to find a closing point" />
                <span className="wc-label">{fmtT(aWinStart)} / {fmtT(aDur)}</span>
              </div>
            )}
            <TransitionWave peaks={detailPeaks?.a ?? null} fadeFrom={(aLen - fadeS) / aLen} fadeTo={1} tone="out"
              beats={beatFracs(ma?.bpm, beatOverride[a] ?? ma?.beatOffset, aWinStart, aLen)} onPick={pickBeat(a, ma?.bpm, aWinStart, aLen)}
              cueFrac={ma?.cueOutPoint != null ? (ma.cueOutPoint - aWinStart) / aLen : null}
              onSetCue={frac => onSetCueOut?.(a, Math.max(0, aWinStart + frac * aLen))}
              getLoop={loopOverlay('a', aWinStart, aLen)} />
            <div className="wave-controls">
              <button className="btn btn-secondary wc-btn" disabled={pA >= maxPanA} onClick={() => setPanA(p => Math.min(maxPanA, p + aLen * 0.4))} title="Pan earlier">◀ pan</button>
              <button className="btn btn-secondary wc-btn" disabled={pA <= 0} onClick={() => setPanA(p => Math.max(0, p - aLen * 0.4))} title="Pan back toward the fade">pan ▶</button>
              <span className="wc-sep" />
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(a, ma?.bpm, beatOverride[a] ?? ma?.beatOffset, -0.05)} title="Grid −50ms">«</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(a, ma?.bpm, beatOverride[a] ?? ma?.beatOffset, -0.01)} title="Grid −10ms">‹</button>
              <span className="wc-label">beat grid</span>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(a, ma?.bpm, beatOverride[a] ?? ma?.beatOffset, 0.01)} title="Grid +10ms">›</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(a, ma?.bpm, beatOverride[a] ?? ma?.beatOffset, 0.05)} title="Grid +50ms">»</button>
            </div>
            {maxPanB > 0 && (
              <div className="wave-scrub">
                <input type="range" min={0} max={maxPanB} step={1} value={pB}
                  onChange={e => setPanB(Number(e.target.value))} title="Scrub anywhere in the track to find a start point" />
                <span className="wc-label">{fmtT(bWinStart)} / {fmtT(bDur)}</span>
              </div>
            )}
            <TransitionWave peaks={detailPeaks?.b ?? null} fadeFrom={0} fadeTo={fadeS / bLen} tone="in"
              beats={beatFracs(mb?.bpm, beatOverride[b] ?? mb?.beatOffset, bWinStart, bLen)} onPick={pickBeat(b, mb?.bpm, bWinStart, bLen)}
              cueFrac={mb?.cuePoint != null ? (mb.cuePoint - bWinStart) / bLen : null}
              onSetCue={frac => onSetCue(b, Math.max(0, bWinStart + frac * bLen))}
              getLoop={loopOverlay(b, bWinStart, bLen)} />
            <div className="wave-controls">
              <button className="btn btn-secondary wc-btn" disabled={pB <= 0} onClick={() => setPanB(p => Math.max(0, p - bLen * 0.4))} title="Pan back toward the fade">◀ pan</button>
              <button className="btn btn-secondary wc-btn" disabled={pB >= maxPanB} onClick={() => setPanB(p => Math.min(maxPanB, p + bLen * 0.4))} title="Pan later">pan ▶</button>
              <span className="wc-sep" />
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, -0.05)} title="Grid −50ms">«</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, -0.01)} title="Grid −10ms">‹</button>
              <span className="wc-label">beat grid</span>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, 0.01)} title="Grid +10ms">›</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, 0.05)} title="Grid +50ms">»</button>
              {liveMode && nowPlaying?.path === a && (
                <>
                  <span className="wc-sep" />
                  <button className="btn btn-secondary wc-btn" onClick={() => toggleCue(b, mb?.cuePoint ?? 0)}
                    title={cueingPaths.includes(b) ? 'Stop cueing this track' : 'Cue this track in now, at full volume, to beatmatch by ear — layers on top of any other cued track'}>
                    {cueingPaths.includes(b) ? <Square size={12} /> : <Play size={12} />} Cue
                  </button>
                </>
              )}
            </div>
            <div className="transition-track-label">
              <span>{short(tb?.name || b)}{mb?.bpm ? ` — ${Math.round(mb.bpm)} BPM ${mb.key}` : ''}</span>
              <span className="transition-tail-tag">in</span>
            </div>
            <div className="graph-hint">Shaded zone = the {fadeS}s crossfade window. Click a waveform on a beat, or use the grid ‹›/«» buttons to nudge it. Shift+click the wave to set that track's start/end point. Pan activates once you zoom in.</div>
          </div>
        );
      })()}

      {waveDetail && (() => {
        const t = tracks.find(x => x.path === waveDetail);
        const m = meta[waveDetail];
        const dur = m?.duration ?? 0;
        const winLen = dur > 0 ? dur / waveZoom : 0;
        const maxPan = Math.max(0, dur - winLen);
        const wp = Math.min(wavePan, maxPan);
        const winStart = wp;
        const offset = beatOverride[waveDetail] ?? m?.beatOffset;
        const beatFracs = () => {
          if (!m?.bpm || offset == null || winLen <= 0) return [];
          const period = 60 / m.bpm;
          let t2 = winStart + (((offset - winStart) % period) + period) % period;
          const out: number[] = [];
          for (; t2 < winStart + winLen; t2 += period) out.push((t2 - winStart) / winLen);
          return out;
        };
        const pickBeat = (frac: number) => {
          if (!m?.bpm || winLen <= 0) return;
          const period = 60 / m.bpm;
          const abs = winStart + frac * winLen;
          setBeatOverride(o => ({ ...o, [waveDetail]: ((abs % period) + period) % period }));
        };
        const nudgeBeat = (deltaS: number) => () => {
          if (!m?.bpm || offset == null) return;
          const period = 60 / m.bpm;
          setBeatOverride(o => ({ ...o, [waveDetail]: (((offset + deltaS) % period) + period) % period }));
        };
        const changeWaveZoom = (newIdx: number) => {
          const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, newIdx));
          if (clamped === waveZoomIdx) return;
          const newZoom = ZOOM_LEVELS[clamped];
          const newWinLen = dur > 0 ? dur / newZoom : 0;
          const center = winStart + winLen / 2;
          const newPan = center - newWinLen / 2;
          setWaveZoomIdx(clamped);
          setWavePan(Math.max(0, Math.min(Math.max(0, dur - newWinLen), newPan)));
        };
        return (
          <div className="transition-panel">
            <div className="transition-panel-head">
              <span className="transition-panel-title">Waveform: {short(t?.name || waveDetail)}{m?.bpm ? ` — ${Math.round(m.bpm)} BPM ${m.key}` : ''}</span>
              <span className="transition-zoom">
                <button className="btn btn-secondary" disabled={waveZoomIdx === 0} onClick={() => changeWaveZoom(waveZoomIdx - 1)} title="Zoom out">−</button>
                <span className="transition-zoom-label">{waveZoom}x</span>
                <button className="btn btn-secondary" disabled={waveZoomIdx === ZOOM_LEVELS.length - 1} onClick={() => changeWaveZoom(waveZoomIdx + 1)} title="Zoom in">+</button>
              </span>
              <button className="btn btn-secondary" onClick={() => setWaveDetail(null)} title="Close"><X size={12} /></button>
            </div>
            {maxPan > 0 && (
              <div className="wave-scrub">
                <input type="range" min={0} max={maxPan} step={0.01} value={wp}
                  onChange={e => setWavePan(Number(e.target.value))} title="Scrub anywhere in the track" />
                <span className="wc-label">{fmtT(winStart)} / {fmtT(dur)}</span>
              </div>
            )}
            <TransitionWave peaks={waveDetailPeaks} fadeFrom={0} fadeTo={0} tone="in"
              beats={beatFracs()} onPick={pickBeat}
              cueFrac={m?.cuePoint != null && winLen > 0 ? (m.cuePoint - winStart) / winLen : null}
              onSetCue={frac => onSetCue(waveDetail, Math.max(0, winStart + frac * winLen))}
              getLoop={loopOverlay(nowPlaying?.path === waveDetail ? 'a' : waveDetail, winStart, winLen)} />
            <div className="wave-controls">
              <button className="btn btn-secondary wc-btn" disabled={wp <= 0} onClick={() => setWavePan(p => Math.max(0, p - winLen * 0.4))} title="Pan earlier">◀ pan</button>
              <button className="btn btn-secondary wc-btn" disabled={wp >= maxPan} onClick={() => setWavePan(p => Math.min(maxPan, p + winLen * 0.4))} title="Pan later">pan ▶</button>
              <span className="wc-sep" />
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(-0.05)} title="Grid −50ms">«</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(-0.01)} title="Grid −10ms">‹</button>
              <span className="wc-label">beat grid</span>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(0.01)} title="Grid +10ms">›</button>
              <button className="btn btn-secondary wc-btn" onClick={nudgeBeat(0.05)} title="Grid +50ms">»</button>
            </div>
            <div className="graph-hint">Click a waveform on a beat to set the grid, or use «›»‹ to nudge it. Shift+click to set the cue/start point (green line). Zoom in and pan to place it precisely.</div>
          </div>
        );
      })()}

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
