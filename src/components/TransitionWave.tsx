import { useEffect, useRef } from 'react';
import type { BandPeaks } from '../audio/CrossfadePlayer';

// Dual waveform strip for the transition detail panel: layered blue bars
// (bass envelope, mids, treble core), rekordbox-style, with the crossfade
// span at full opacity and the rest dimmed.
const WAVE_TONES = { out: { zone: 'rgba(251,191,36,0.10)' }, in: { zone: 'rgba(168,85,247,0.10)' } };

export type LoopOverlay = { startFrac: number; endFrac: number; posFrac: number };

export default function TransitionWave({ peaks, fadeFrom, fadeTo, tone, beats, cueFrac, onPick, onSetCue, getLoop }: { peaks: BandPeaks | null; fadeFrom: number; fadeTo: number; tone: 'out' | 'in'; beats?: number[]; cueFrac?: number | null; onPick?: (frac: number) => void; onSetCue?: (frac: number) => void; getLoop?: () => LoopOverlay | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { zone } = WAVE_TONES[tone];

    const isLight = document.documentElement.dataset.theme === 'light';

    ctx.fillStyle = zone;
    ctx.fillRect(fadeFrom * W, 0, (fadeTo - fadeFrom) * W, H);

    ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.15)' : 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();

    if (!peaks || peaks.low.length === 0) return;
    const { low, mid, high } = peaks;
    const n = low.length;
    const barW = W / n;
    // Rekordbox-style layered bars: bass is the outer envelope (deep blue),
    // mids sit inside it (lighter blue), treble is the bright core — one
    // consistent blue ramp instead of a per-sample RGB mix, so the shape
    // reads as amplitude+brightness rather than a confusing color jumble.
    for (let i = 0; i < n; i++) {
      const x = i * barW;
      const hLow = Math.max(2, (low[i] / 100) * (H - 4));
      const hMid = Math.max(1, (mid[i] / 100) * (H - 4) * 0.72);
      const hHigh = Math.max(1, (high[i] / 100) * (H - 4) * 0.42);
      const inFade = i / n >= fadeFrom && i / n < fadeTo;
      ctx.globalAlpha = inFade ? 1 : 0.45;
      ctx.fillStyle = isLight ? '#2563eb' : '#1d4ed8';
      ctx.fillRect(x, (H - hLow) / 2, barW + 0.5, hLow);
      ctx.fillStyle = isLight ? '#60a5fa' : '#7dd3fc';
      ctx.fillRect(x, (H - hMid) / 2, barW + 0.5, hMid);
      ctx.fillStyle = isLight ? '#93c5fd' : '#f0f9ff';
      ctx.fillRect(x, (H - hHigh) / 2, barW + 0.5, hHigh);
    }
    ctx.globalAlpha = 1;
    if (beats) {
      ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 1;
      for (const f of beats) {
        ctx.beginPath();
        ctx.moveTo(f * W, 0);
        ctx.lineTo(f * W, H);
        ctx.globalAlpha = isLight ? 0.25 : 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (cueFrac != null && cueFrac >= 0 && cueFrac <= 1) {
      const cx = cueFrac * W;
      const color = tone === 'out' ? '#ef4444' : '#4ade80'; // red for out point, green for in point
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      ctx.restore();
      // flag at top so cue reads at a glance even when the line gets lost in busy bars
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + 7, 0);
      ctx.lineTo(cx, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [peaks, fadeFrom, fadeTo, tone, beats, cueFrac, onSetCue]);

  // Animated loop overlay on a second stacked canvas: breathing green region with
  // a sweeping playhead, redrawn per frame so it appears/disappears with the loop
  // and lets loops on multiple decks be eyeballed for sync.
  const loopRef = useRef<HTMLCanvasElement>(null);
  const getLoopRef = useRef(getLoop);
  getLoopRef.current = getLoop;
  const hasLoop = !!getLoop;
  useEffect(() => {
    if (!hasLoop) return;
    let raf = 0;
    const step = () => {
      const cv = loopRef.current;
      const ctx = cv?.getContext('2d');
      if (cv && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const W = cv.clientWidth, H = cv.clientHeight;
        if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const lp = getLoopRef.current?.();
        if (lp && lp.endFrac > lp.startFrac && lp.endFrac > 0 && lp.startFrac < 1) {
          const x0 = Math.max(0, lp.startFrac) * W, x1 = Math.min(1, lp.endFrac) * W;
          const pulse = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(performance.now() / 300));
          ctx.fillStyle = `rgba(74,222,128,${pulse.toFixed(3)})`;
          ctx.fillRect(x0, 0, x1 - x0, H);
          ctx.strokeStyle = 'rgba(74,222,128,0.9)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x0 + 0.75, 0.75, x1 - x0 - 1.5, H - 1.5);
          if (lp.posFrac >= 0 && lp.posFrac <= 1) {
            const px = lp.posFrac * W;
            const isLight = document.documentElement.dataset.theme === 'light';
            ctx.save();
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = isLight ? '#16a34a' : '#bbf7d0';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
            ctx.restore();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hasLoop]);

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    if (e.shiftKey && onSetCue) { onSetCue(frac); return; }
    if (onPick) onPick(frac);
  };
  const title = onSetCue ? `Click: mark the beat — Shift+click: set ${tone === 'out' ? 'closing/end' : 'cue/start'} point` : onPick ? 'Click to mark the beat' : undefined;
  return (
    <div className="transition-wave-wrap">
      <canvas ref={ref} className="transition-wave-canvas" onClick={pick} title={title} />
      {hasLoop && <canvas ref={loopRef} className="transition-wave-loop" />}
    </div>
  );
}
