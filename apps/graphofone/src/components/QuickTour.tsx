import { useEffect, useState } from 'react';

type Step = { selector: string; title: string; body: string };

const STEPS: Step[] = [
  {
    selector: '[data-tour="import"]',
    title: 'Import your music',
    body: 'Pick a folder of audio files to build your library. Tags (BPM, key, artist) are read automatically.'
  },
  {
    selector: '[data-tour="analyze"]',
    title: 'Analyze tracks',
    body: 'Detects BPM, beat grid and waveform for tracks missing them — required for beat-matched transitions.'
  },
  {
    selector: '[data-tour="library"]',
    title: 'Add tracks to the graph',
    body: 'Click the + on a track to drop it onto the graph as a node.'
  },
  {
    selector: '.graph-canvas-wrap',
    title: 'Build your set',
    body: 'Drag nodes to arrange them. Click a node to select it (compatible tracks light up), then Shift+click another to link them with a transition arrow. Double-click a node to play from it. Click an arrow to open the transition detail panel and set cues, fade length and EQ.'
  },
  {
    selector: '.graph-toolbar',
    title: 'Perform',
    body: '"Play path" follows the arrows with automatic beat-matched crossfades. "Live" arms arrows so you fire transitions manually, and "Rec" records your whole set to a file.'
  },
  {
    selector: '[data-tour="live-mode"]',
    title: 'Play it like an instrument',
    body: 'Enable "Live" while a track is playing to drive decks from the keyboard — beat jump, loop and cue nudge without touching the mouse. Click the ⌨ button that appears next to Live for the full key list any time.'
  },
  {
    selector: '.graph-live-controls',
    title: 'Mixer & Cueing',
    body: 'Control volume, filter and EQ for active channels. Manually cued tracks start silent (VOL 0) with headphone pre-listen (🎧) active. Press Tab to cycle through channel strips, or toggle "All" to show them all at once.'
  }
];

export default function QuickTour({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(STEPS[idx].selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [idx]);

  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;
  // Place the card below the target unless that would run off-screen.
  const below = rect ? rect.bottom + 12 : window.innerHeight / 2 - 90;
  const cardTop = rect && below + 180 > window.innerHeight ? Math.max(12, rect.top - 192) : below;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 332) : window.innerWidth / 2 - 160;

  return (
    <div className="tour-overlay" onClick={onClose}>
      {rect && (
        <div
          className="tour-spotlight"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div className="tour-card" style={{ top: cardTop, left: cardLeft }} onClick={e => e.stopPropagation()}>
        <div className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>
        <div className="tour-nav">
          <span className="tour-progress">{idx + 1}/{STEPS.length}</span>
          <button className="btn btn-secondary" onClick={onClose}>Skip</button>
          {idx > 0 && <button className="btn btn-secondary" onClick={() => setIdx(idx - 1)}>Back</button>}
          <button className="btn btn-primary" onClick={() => (last ? onClose() : setIdx(idx + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
