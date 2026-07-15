import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, SkipForward, X, Circle } from 'lucide-react';

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

const bpmRatio = (from: number, to: number) => {
  // Best playback-rate ratio considering half/double time.
  const cands = [to, to * 2, to / 2];
  const best = cands.reduce((a, b) => (Math.abs(from / b - 1) < Math.abs(from / a - 1) ? b : a));
  return from / best;
};
const bpmClose = (a: number | null, b: number | null, tol = 0.06) =>
  !!a && !!b && Math.abs(bpmRatio(a, b) - 1) <= tol;

// --- Crossfade player -------------------------------------------------------
// Web Audio, not <audio>: tracks are decoded to AudioBuffers over IPC (same
// proven path as the Analyze pass), which gives seek-anywhere previews and
// sample-accurate beat alignment. The media:// protocol aborts ranged
// requests, so HTMLAudioElement cannot seek outside its buffer at all.
const DEFAULT_FADE_S = 8;
const FADE_OPTIONS = [8, 16, 24];
const ZOOM_LEVELS = [1, 2, 4, 8] as const;
const PREVIEW_LEAD_S = 5;  // seconds of A heard before the fade starts
const PREVIEW_TAIL_S = 6;  // seconds of B heard after the fade completes
export type EqPreset = 'off' | 'bass-swap' | 'rise' | 'blend' | 'wave' | 'melt' | 'slam';
type BandPeaks = { low: number[]; mid: number[]; high: number[] };
const BASS_SWAP_CUT = -15; // dB the outgoing/incoming low shelf dips to during a bass-swap fade
const BLEND_CUT = -10;     // dB, gentler 3-band cut used by the Blend/Wave presets
const SWEEP_LP_START_HZ = 300;   // Rise/Wave: incoming lowpass opens from here up to fully open
const SWEEP_HP_END_HZ = 800;     // Rise/Wave: outgoing highpass climbs from open up to here
const MELT_HP_HZ = 1500;         // Melt: both sides sweep highpass through this frequency
const LIVE_FILTER_LP_FLOOR_HZ = 200;  // live knob fully negative: lowpass cutoff floor ("underwater")
const LIVE_FILTER_HP_CEIL_HZ = 2000;  // live knob fully positive: highpass cutoff ceiling ("distant")
type QueueItem = { path: string; name: string; bpm: number | null; beatOffset?: number | null; eqPreset?: EqPreset; cue?: number; cueOut?: number };
type NowPlaying = { index: number; path: string; name: string } | null;
type Deck = {
  src: AudioBufferSourceNode; gain: GainNode; buf: AudioBuffer; startCtx: number; startOffset: number; rate: number;
  low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode;
  lp: BiquadFilterNode; // preset sweep filter, neutral (fully open) unless a transition drives it
  hp: BiquadFilterNode; // preset sweep filter, neutral (fully open) unless a transition drives it
};
export type EqBands = { low: number; mid: number; high: number }; // dB, range -15..15
const DEFAULT_EQ: EqBands = { low: 0, mid: 0, high: 0 };

class CrossfadePlayer {
  private ctx: AudioContext | null = null;
  private deck: Deck | null = null;
  private fadingDeck: Deck | null = null; // incoming deck mid-crossfade; stop() must kill this too
  private cueDeck: Deck | null = null; // manually cued incoming deck, played solo before the real fade fires
  private cuePath: string | null = null;
  private cueToken = 0;
  fadeS = DEFAULT_FADE_S;
  private eq: EqBands = { ...DEFAULT_EQ };
  private queue: QueueItem[] = [];
  private idx = -1;
  private fading = false;
  private previewing = false;
  private raf = 0;
  private session = 0; // bumped on stop/play; async loads from older sessions are discarded
  private bufCache = new Map<string, AudioBuffer>();
  private bufLoading = new Map<string, Promise<AudioBuffer>>();
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private recordChunks: Blob[] = [];
  onChange: (np: NowPlaying) => void = () => {};
  onRecordingSaved: (blob: Blob) => void = () => {};

  private analyser: AnalyserNode | null = null;

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Live frequency spectrum (0-255 per bin) of whatever's currently sounding, for the graph's animated background. */
  getSpectrum(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  private async load(path: string): Promise<AudioBuffer> {
    const hit = this.bufCache.get(path);
    if (hit) return hit;
    const inFlight = this.bufLoading.get(path);
    if (inFlight) return inFlight;
    const p = (async () => {
      const u8: Uint8Array = await (window as any).electronAPI.readAudioFile(path);
      const raw = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
      const buf = await this.getCtx().decodeAudioData(raw);
      this.bufCache.set(path, buf);
      // decoded PCM is big — keep only the last few tracks (A, B being previewed/cued, headroom for one more)
      while (this.bufCache.size > 5) this.bufCache.delete(this.bufCache.keys().next().value!);
      this.bufLoading.delete(path);
      return buf;
    })();
    this.bufLoading.set(path, p);
    return p;
  }

  /** media position (seconds into the buffer) of a playing deck; loop-aware so tick()
   *  doesn't mistake a looping deck for one that's run off the end of the buffer. */
  private pos(d: Deck) {
    const raw = d.startOffset + (this.getCtx().currentTime - d.startCtx) * d.rate;
    if (d.src.loop && d.src.loopEnd > d.src.loopStart && raw >= d.src.loopEnd) {
      const span = d.src.loopEnd - d.src.loopStart;
      return d.src.loopStart + ((raw - d.src.loopStart) % span);
    }
    return raw;
  }

  private startDeck(buf: AudioBuffer, offset: number, rate: number, gain0: number, when = 0): Deck {
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf'; low.frequency.value = 200; low.gain.value = this.eq.low;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.9; mid.gain.value = this.eq.mid;
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf'; high.frequency.value = 4000; high.gain.value = this.eq.high;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 20; // neutral: passes everything
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 20000; // neutral: passes everything
    const gain = ctx.createGain();
    gain.gain.value = gain0;
    src.connect(low).connect(mid).connect(high).connect(hp).connect(lp).connect(gain).connect(ctx.destination);
    if (this.recordDest) gain.connect(this.recordDest);
    if (this.analyser) gain.connect(this.analyser);
    const at = when || ctx.currentTime;
    src.start(at, offset);
    return { src, gain, buf, startCtx: at, startOffset: offset, rate, low, mid, high, lp, hp };
  }

  /** Current media-time playhead (seconds) of the live deck, for hot-cue "set". */
  getPos(): number | null { return this.deck ? this.pos(this.deck) : null; }

  /** Paths of the pair currently mid-crossfade, or null. */
  getFadingPair(): { from: string; to: string } | null {
    return this.fading && this.idx >= 0 && this.idx + 1 < this.queue.length
      ? { from: this.queue[this.idx].path, to: this.queue[this.idx + 1].path }
      : null;
  }

  /** Live phase nudge on the incoming deck for `path` — a brief pitch bend, same move a DJ
   *  makes to bring a synced deck back into phase, without touching the gain/EQ automation.
   *  Targets whichever deck is actually sounding for that path: a manual cue, or a live fade. */
  nudgeLive(path: string, deltaS: number) {
    const d = this.cuePath === path ? this.cueDeck : (this.getFadingPair()?.to === path ? this.fadingDeck : null);
    if (!d || !deltaS) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const k = 0.08; // 8% pitch bend, typical CDJ nudge strength
    const bump = d.rate * (1 + Math.sign(deltaS) * k);
    const dur = Math.abs(deltaS) / (d.rate * k);
    d.src.playbackRate.cancelScheduledValues(now);
    d.src.playbackRate.setValueAtTime(bump, now);
    d.src.playbackRate.setValueAtTime(d.rate, now + dur);
  }

  /** Manually cue the incoming track in now, at full volume alongside whatever's playing —
   *  independent of the automated crossfade engine, so it can be beatmatched by ear first. */
  cueLive(path: string, offset: number) {
    const token = ++this.cueToken;
    if (this.cueDeck) { try { this.cueDeck.src.stop(); } catch { /* already stopped */ } this.cueDeck = null; this.cuePath = null; }
    this.load(path).then(buf => {
      if (token !== this.cueToken) return; // superseded by a newer cue/stop before load finished
      this.cueDeck = this.startDeck(buf, Math.max(0, Math.min(offset, buf.duration - 1)), 1, 1);
      this.cuePath = path;
    });
  }

  stopCue() {
    this.cueToken++;
    if (this.cueDeck) { try { this.cueDeck.src.stop(); } catch { /* already stopped */ } this.cueDeck = null; }
    this.cuePath = null;
  }

  getCuePath(): string | null { return this.cuePath; }

  /** Jump forward/back by whole beats on the manually cued deck. */
  cueBeatJump(beats: number, bpm: number) {
    const d = this.cueDeck;
    if (!d || !bpm) return;
    const delta = beats * (60 / bpm);
    const clamped = Math.max(0, Math.min(this.pos(d) + delta, d.buf.duration - 0.05));
    const gain0 = d.gain.gain.value;
    try { d.src.stop(); } catch { /* already stopped */ }
    d.gain.disconnect();
    this.cueDeck = this.startDeck(d.buf, clamped, d.rate, gain0);
  }

  /** Loop the next N beats of the manually cued deck, from its current playhead. */
  setCueLoop(beats: number, bpm: number) {
    if (!this.cueDeck || !bpm) return;
    const start = this.pos(this.cueDeck);
    this.cueDeck.src.loopStart = start;
    this.cueDeck.src.loopEnd = start + beats * (60 / bpm);
    this.cueDeck.src.loop = true;
  }

  exitCueLoop() {
    if (this.cueDeck) this.cueDeck.src.loop = false;
  }

  /** Persistent manual pitch on the cued deck (1 = original speed) — unlike nudgeLive's
   *  temporary bend, this stays until changed again. */
  setCuePitch(rate: number) {
    if (!this.cueDeck) return;
    this.cueDeck.src.playbackRate.cancelScheduledValues(this.getCtx().currentTime);
    this.cueDeck.src.playbackRate.value = rate;
    this.cueDeck.rate = rate;
  }

  /** Live filter knob (-1..1): negative sweeps a lowpass down ("underwater"), positive sweeps a highpass up ("distant"). */
  setLiveFilter(knob: number) {
    const k = Math.max(-1, Math.min(1, knob));
    const ctx = this.getCtx();
    for (const d of [this.deck, this.fadingDeck, this.cueDeck]) {
      if (!d) continue;
      if (k < 0) {
        d.lp.frequency.setTargetAtTime(20000 + (LIVE_FILTER_LP_FLOOR_HZ - 20000) * -k, ctx.currentTime, 0.03);
        d.hp.frequency.setTargetAtTime(20, ctx.currentTime, 0.03);
      } else {
        d.hp.frequency.setTargetAtTime(20 + (LIVE_FILTER_HP_CEIL_HZ - 20) * k, ctx.currentTime, 0.03);
        d.lp.frequency.setTargetAtTime(20000, ctx.currentTime, 0.03);
      }
    }
  }

  /** Stop-and-restart the live deck's source at a new media position (AudioBufferSourceNode can't seek in place). */
  private reseat(offset: number) {
    if (!this.deck || this.fading) return;
    const d = this.deck;
    const clamped = Math.max(0, Math.min(offset, d.buf.duration - 0.05));
    const gain0 = d.gain.gain.value;
    try { d.src.stop(); } catch { /* already stopped */ }
    d.gain.disconnect();
    this.deck = this.startDeck(d.buf, clamped, d.rate, gain0);
  }

  /** Jump forward/back by whole beats using the current track's BPM. */
  beatJump(beats: number) {
    if (!this.deck) return;
    const bpm = this.queue[this.idx]?.bpm;
    if (!bpm) return;
    const delta = beats * (60 / bpm);
    this.reseat(this.pos(this.deck) + delta);
  }

  /** Loop the next N beats from the current playhead, using the native loop range. */
  setLoop(beats: number) {
    if (!this.deck) return;
    const bpm = this.queue[this.idx]?.bpm;
    if (!bpm) return;
    const start = this.pos(this.deck);
    this.deck.src.loopStart = start;
    this.deck.src.loopEnd = start + beats * (60 / bpm);
    this.deck.src.loop = true;
  }

  exitLoop() {
    if (this.deck) this.deck.src.loop = false;
  }

  /** firstOffset < 0 means "seconds from the end of the first track" */
  play(queue: QueueItem[], firstOffset = 0) {
    this.stop();
    const sess = ++this.session;
    this.queue = queue;
    this.idx = 0;
    this.onChange({ index: 0, path: queue[0].path, name: queue[0].name });
    this.load(queue[0].path).then(buf => {
      if (sess !== this.session) return;
      const end = queue[0].cueOut ?? buf.duration;
      const off = firstOffset < 0 ? end + firstOffset : firstOffset;
      this.deck = this.startDeck(buf, Math.max(0, Math.min(off, buf.duration - 1)), 1, 1);
      this.tick();
    }).catch(() => { if (sess === this.session) this.stop(); });
  }

  /** Play just the A→B transition: the tail of A, the fade, a few seconds of B. */
  preview(from: QueueItem, to: QueueItem) {
    this.play([from, to], -(this.fadeS + PREVIEW_LEAD_S));
    this.previewing = true;
  }

  /** Per-band peaks for [startSec, endSec), split into low/mid/high (~<250Hz, 250Hz-2kHz, >2kHz)
   *  via two cascaded one-pole lowpass filters, each band peak normalized 0-100 against its own max.
   *  Negative bounds count from the end (like play()'s firstOffset); omitted endSec = duration. */
  async getBandPeaksWindow(path: string, startSec: number, endSec?: number, N = 400): Promise<BandPeaks> {
    const buf = await this.load(path);
    const s = Math.max(0, startSec < 0 ? buf.duration + startSec : startSec);
    const e = Math.min(buf.duration, endSec == null ? buf.duration : endSec < 0 ? buf.duration + endSec : endSec);
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const s0 = Math.floor(s * sr), e0 = Math.max(s0 + 1, Math.floor(e * sr));
    const bucket = Math.max(1, Math.floor((e0 - s0) / N));
    const aLow = 1 - Math.exp((-2 * Math.PI * 250) / sr);
    const aMid = 1 - Math.exp((-2 * Math.PI * 2000) / sr);
    let lpLow = 0, lpMid = 0;
    const low: number[] = [], mid: number[] = [], high: number[] = [];
    let topLow = 0, topMid = 0, topHigh = 0;
    for (let i = 0; i < N; i++) {
      const bs = s0 + i * bucket, be = Math.min(e0, bs + bucket);
      let maxLow = 0, maxMid = 0, maxHigh = 0;
      for (let j = bs; j < be; j++) {
        const x = ch[j];
        lpLow += aLow * (x - lpLow);
        lpMid += aMid * (x - lpMid);
        const aL = Math.abs(lpLow), aM = Math.abs(lpMid - lpLow), aH = Math.abs(x - lpMid);
        if (aL > maxLow) maxLow = aL;
        if (aM > maxMid) maxMid = aM;
        if (aH > maxHigh) maxHigh = aH;
      }
      low.push(maxLow); mid.push(maxMid); high.push(maxHigh);
      if (maxLow > topLow) topLow = maxLow;
      if (maxMid > topMid) topMid = maxMid;
      if (maxHigh > topHigh) topHigh = maxHigh;
    }
    return {
      low: low.map(v => (topLow > 0 ? Math.round((v / topLow) * 100) : 0)),
      mid: mid.map(v => (topMid > 0 ? Math.round((v / topMid) * 100) : 0)),
      high: high.map(v => (topHigh > 0 ? Math.round((v / topHigh) * 100) : 0)),
    };
  }

  skip() { if (this.idx >= 0 && this.idx + 1 < this.queue.length && !this.fading && this.deck) this.startFade(); }

  /** Live mode: crossfade the currently playing deck straight into `to`, starting right
   *  now from the live playhead — instead of the isolated preview() replay. */
  liveTransitionTo(to: QueueItem) {
    if (this.idx < 0 || this.fading) return;
    this.queue = [...this.queue.slice(0, this.idx + 1), to];
    // click-triggered: quantize to the next bar (not just the next beat) so the
    // transition kicks in on a musically obvious boundary instead of mid-phrase.
    if (this.deck) { this.startFade(4); return; }
    // onChange fires before the first track's buffer finishes decoding — if the
    // user fires a live transition in that window, wait for the deck instead of
    // silently dropping the transition.
    const sess = this.session;
    const wait = () => {
      if (sess !== this.session) return;
      if (this.deck) this.startFade(4); else requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  }

  /** Capture the graph's audio output (this deck and every future one) to a WebM blob. */
  startRecording() {
    if (this.recorder) return;
    const ctx = this.getCtx();
    this.recordDest = ctx.createMediaStreamDestination();
    for (const d of [this.deck, this.fadingDeck, this.cueDeck]) d?.gain.connect(this.recordDest);
    this.recordChunks = [];
    const rec = new MediaRecorder(this.recordDest.stream);
    rec.ondataavailable = e => { if (e.data.size) this.recordChunks.push(e.data); };
    rec.onstop = () => { this.onRecordingSaved(new Blob(this.recordChunks, { type: 'audio/webm' })); this.recordDest = null; };
    rec.start();
    this.recorder = rec;
  }

  stopRecording() {
    this.recorder?.stop();
    this.recorder = null;
  }

  stop() {
    this.session++;
    cancelAnimationFrame(this.raf);
    this.fading = false;
    this.previewing = false;
    this.idx = -1;
    if (this.deck) { try { this.deck.src.stop(); } catch { /* already stopped */ } this.deck = null; }
    if (this.fadingDeck) { try { this.fadingDeck.src.stop(); } catch { /* already stopped */ } this.fadingDeck = null; }
    this.stopCue();
    this.onChange(null);
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    if (this.idx < 0 || this.fading || !this.deck) return;
    const dur = this.queue[this.idx].cueOut ?? this.deck.buf.duration;
    const remaining = dur - this.pos(this.deck);
    if (this.idx + 1 < this.queue.length) {
      // decode of the next track takes a moment — lead with extra slack
      if (remaining <= this.fadeS + 1.5) this.startFade();
    } else if (remaining <= 0.05) {
      this.stop();
    }
  };

  /** quantizeBeats: snap the fade start to the next multiple of this many beats of A
   *  (1 = next beat, used for the normal queued handoff; 4 = next bar, used for live clicks). */
  private async startFade(quantizeBeats = 1) {
    const sess = this.session;
    const from = this.queue[this.idx];
    const to = this.queue[this.idx + 1];
    const a = this.deck!;
    this.fading = true;
    // if the incoming track is already manually cued in and beatmatched, take that deck
    // over as-is instead of restarting it fresh — only A's gain/EQ fade out around it.
    const bAlreadyCued = this.cuePath === to.path && !!this.cueDeck;

    let buf: AudioBuffer;
    try { buf = await this.load(to.path); } catch { if (sess === this.session) this.stop(); return; }
    if (sess !== this.session) return;

    const ctx = this.getCtx();
    // Tempo match: incoming track starts at the outgoing tempo (within ±8%),
    // then eases back to its own tempo after the fade.
    const rawRatio = from.bpm && to.bpm ? bpmRatio(from.bpm, to.bpm) : 1;
    const rate = Math.min(1.08, Math.max(0.92, rawRatio));
    const canSync = rate === rawRatio && from.beatOffset != null && to.beatOffset != null && !!from.bpm && !!to.bpm;

    // Fade start: next beat of A (sample-accurate), or "shortly after now".
    let t0 = ctx.currentTime + 0.15;
    let bOffset = to.cue ?? 0; // incoming track starts from its cue point unless beat-synced below

    if (quantizeBeats === 1) {
      const dur = from.cueOut ?? a.buf.duration;
      const remaining = dur - this.pos(a);
      t0 = Math.max(ctx.currentTime + 0.05, ctx.currentTime + remaining / a.rate - this.fadeS);
    } else if (canSync) {
      const pMedia = (60 / from.bpm!) * quantizeBeats; // quantize period in A's media time
      const posMedia = (((this.pos(a) - from.beatOffset!) % pMedia) + pMedia) % pMedia;
      t0 = ctx.currentTime + (pMedia - posMedia) / a.rate; // next quantize boundary, wall clock
      while (t0 < ctx.currentTime + 0.1) t0 += pMedia / a.rate;
    }

    if (canSync) {
      const posAtT0 = this.pos(a) + (t0 - ctx.currentTime) * a.rate;
      const pB = 60 / to.bpm!;
      const phaseA = (((posAtT0 - from.beatOffset!) % pB) + pB) % pB;
      const targetB = to.beatOffset! + phaseA;
      const minB = to.cue ?? 0;
      let adjustedB = targetB;
      // Allow snapping slightly backwards (e.g. -0.05s) if they placed cue right on a beat
      while (adjustedB < minB - 0.05) adjustedB += pB;
      bOffset = Math.max(0, Math.min(adjustedB, buf.duration - 1));
    }

    const b = bAlreadyCued ? this.cueDeck! : this.startDeck(buf, bOffset, rate, 0, t0);
    if (bAlreadyCued) { this.cueDeck = null; this.cuePath = null; b.src.loop = false; }
    this.fadingDeck = b;
    const tEnd = t0 + this.fadeS;
    a.gain.gain.setValueAtTime(1, t0);
    a.gain.gain.linearRampToValueAtTime(0, tEnd);
    if (!bAlreadyCued) {
      b.gain.gain.setValueAtTime(0, t0);
      b.gain.gain.linearRampToValueAtTime(1, tEnd);
    } // else: already audible at full gain from the manual cue — only A fades out
    // Transition presets: each drives the EQ bands and/or sweep filters (lp/hp)
    // of the two decks over the fade window on top of the volume crossfade above.
    const dur = tEnd - t0;
    const baseLow = this.eq.low, baseMid = this.eq.mid, baseHigh = this.eq.high;
    const swapBand = (band: 'low' | 'mid' | 'high', base: number, cut: number, from0: number, to0: number) => {
      a[band].gain.setValueAtTime(base, from0);
      a[band].gain.linearRampToValueAtTime(cut, to0);
      b[band].gain.setValueAtTime(cut, from0);
      b[band].gain.linearRampToValueAtTime(base, to0);
    };
    const sweep = (filter: BiquadFilterNode, type: 'lowpass' | 'highpass', startHz: number, endHz: number, from0: number, to0: number) => {
      filter.type = type;
      filter.frequency.setValueAtTime(startHz, from0);
      filter.frequency.exponentialRampToValueAtTime(endHz, to0);
    };
    switch (to.eqPreset) {
      case 'bass-swap':
        // dip A's low end out while B's climbs in, so the two basslines never overlap
        swapBand('low', baseLow, Math.min(baseLow, BASS_SWAP_CUT), t0, tEnd);
        break;
      case 'rise': {
        // B enters muffled (lowpass) and opens up; A thins into a highpass; bass handoff near the end
        sweep(b.lp, 'lowpass', SWEEP_LP_START_HZ, 20000, t0, tEnd);
        sweep(a.hp, 'highpass', 20, SWEEP_HP_END_HZ, t0, tEnd);
        swapBand('low', baseLow, Math.min(baseLow, BASS_SWAP_CUT), t0 + dur * 0.7, tEnd);
        break;
      }
      case 'blend':
        // gentle 3-band crossfade across the whole transition, no single sharp swap point
        swapBand('low', baseLow, Math.min(baseLow, BLEND_CUT), t0, tEnd);
        swapBand('mid', baseMid, Math.min(baseMid, BLEND_CUT), t0, tEnd);
        swapBand('high', baseHigh, Math.min(baseHigh, BLEND_CUT), t0, tEnd);
        break;
      case 'wave': {
        // like Blend, plus a centered bass handoff and lowpass/highpass sweeps in and out
        const c0 = t0 + dur * 0.35, c1 = t0 + dur * 0.65;
        swapBand('low', baseLow, Math.min(baseLow, BASS_SWAP_CUT), c0, c1);
        sweep(b.lp, 'lowpass', SWEEP_LP_START_HZ, 20000, t0, tEnd);
        sweep(a.hp, 'highpass', 20, SWEEP_HP_END_HZ, t0, tEnd);
        break;
      }
      case 'melt': {
        // both tracks thin through a highpass sweep, bass handed off right at the center
        const c0 = t0 + dur * 0.35, c1 = t0 + dur * 0.65;
        swapBand('low', baseLow, Math.min(baseLow, BASS_SWAP_CUT), c0, c1);
        sweep(a.hp, 'highpass', 20, MELT_HP_HZ, t0, tEnd);
        sweep(b.hp, 'highpass', MELT_HP_HZ, 20, t0, tEnd);
        break;
      }
      case 'slam': {
        // hard cut at the center: A's volume and EQ finish there, B's only start after
        const center = t0 + dur / 2;
        a.gain.gain.cancelScheduledValues(t0);
        a.gain.gain.setValueAtTime(1, t0);
        a.gain.gain.linearRampToValueAtTime(0, center);
        if (!bAlreadyCued) {
          b.gain.gain.cancelScheduledValues(t0);
          b.gain.gain.setValueAtTime(0, t0);
          b.gain.gain.setValueAtTime(0, center);
          b.gain.gain.linearRampToValueAtTime(1, tEnd);
        }
        a.low.gain.setValueAtTime(baseLow, t0);
        a.low.gain.linearRampToValueAtTime(Math.min(baseLow, BASS_SWAP_CUT), center);
        b.low.gain.setValueAtTime(Math.min(baseLow, BASS_SWAP_CUT), center);
        b.low.gain.linearRampToValueAtTime(baseLow, tEnd);
        break;
      }
    }
    // ease the incoming track back to its own tempo after the fade
    // (skip when it's a manually cued deck — its pitch is the DJ's own choice)
    if (!bAlreadyCued && rate !== 1) {
      b.src.playbackRate.setValueAtTime(rate, tEnd);
      b.src.playbackRate.linearRampToValueAtTime(1, tEnd + 4);
      // pos() assumes a constant rate; after the ramp settles it is 1 for good.
      // The small drift during the 4s ramp only affects the fade trigger point.
      b.rate = 1;
      b.startOffset = bOffset + (tEnd + 2 - t0) * ((rate + 1) / 2); // midpoint approximation
      b.startCtx = tEnd + 2;
    }
    a.src.stop(tEnd + 0.05);

    const finish = () => {
      if (sess !== this.session) return;
      if (ctx.currentTime < tEnd) { requestAnimationFrame(finish); return; }
      this.deck = b;
      this.fadingDeck = null;
      this.idx += 1;
      this.fading = false;
      this.onChange({ index: this.idx, path: to.path, name: to.name });
      if (this.previewing) setTimeout(() => { if (this.previewing && sess === this.session) this.stop(); }, PREVIEW_TAIL_S * 1000);
    };
    requestAnimationFrame(finish);
  }
}

// Dual waveform strip for the transition detail panel: layered blue bars
// (bass envelope, mids, treble core), rekordbox-style, with the crossfade
// span at full opacity and the rest dimmed.
const WAVE_TONES = { out: { zone: 'rgba(251,191,36,0.10)' }, in: { zone: 'rgba(168,85,247,0.10)' } };

function TransitionWave({ peaks, fadeFrom, fadeTo, tone, beats, cueFrac, onPick, onSetCue }: { peaks: BandPeaks | null; fadeFrom: number; fadeTo: number; tone: 'out' | 'in'; beats?: number[]; cueFrac?: number | null; onPick?: (frac: number) => void; onSetCue?: (frac: number) => void }) {
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

    ctx.fillStyle = zone;
    ctx.fillRect(fadeFrom * W, 0, (fadeTo - fadeFrom) * W, H);

    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
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
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x, (H - hLow) / 2, barW + 0.5, hLow);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(x, (H - hMid) / 2, barW + 0.5, hMid);
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(x, (H - hHigh) / 2, barW + 0.5, hHigh);
    }
    ctx.globalAlpha = 1;
    if (beats) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const f of beats) { ctx.beginPath(); ctx.moveTo(f * W, 0); ctx.lineTo(f * W, H); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
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
  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    if (e.shiftKey && onSetCue) { onSetCue(frac); return; }
    if (onPick) onPick(frac);
  };
  const title = onSetCue ? `Click: mark the beat — Shift+click: set ${tone === 'out' ? 'closing/end' : 'cue/start'} point` : onPick ? 'Click to mark the beat' : undefined;
  return <canvas ref={ref} className="transition-wave-canvas" onClick={pick} title={title} />;
}

// --- Force layout ------------------------------------------------------------
type Node = { path: string; name: string; x: number; y: number; vx: number; vy: number };

export default function GraphView({ tracks, edges, meta, library, onAddTrack, onAddEdge, onRemoveEdge, onRemoveTrack, onSetCue, onSetCueOut }: {
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
  const [beatOverride, setBeatOverride] = useState<Record<string, number>>({});
  const [fadeS, setFadeS] = useState(DEFAULT_FADE_S);
  const [edgePreset, setEdgePreset] = useState<Record<string, EqPreset>>({});
  const [loopBeats, setLoopBeats] = useState<number | null>(null);
  const [liveFilter, setLiveFilter] = useState(0); // -100..100
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIdx];
  const [panA, setPanA] = useState(0); // seconds, how far left of the anchored (right) edge the A window has slid
  const [panB, setPanB] = useState(0); // seconds, how far right of the anchored (left) edge the B window has slid
  const [recording, setRecording] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [pendingLive, setPendingLive] = useState<string | null>(null);
  const [cueingPath, setCueingPath] = useState<string | null>(null);
  const [cuePitch, setCuePitchState] = useState(1);
  const [cueLoopBeats, setCueLoopBeats] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const playerRef = useRef<CrossfadePlayer | null>(null);
  const dragRef = useRef<{ path: string; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);

  if (!playerRef.current) playerRef.current = new CrossfadePlayer();
  playerRef.current.fadeS = fadeS;
  (window as any).__cf = playerRef.current; // debug/inspection handle
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

  // Windowed waveform for the Ctrl+click cue/grid preview panel — zoom
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
    if (cueingPath === to) { setCueingPath(null); setCuePitchState(1); setCueLoopBeats(null); }
  };

  const toggleCue = (path: string, offset: number) => {
    if (playerRef.current?.getCuePath() === path) {
      playerRef.current!.stopCue();
      setCueingPath(null);
    } else {
      playerRef.current!.cueLive(path, offset);
      setCueingPath(path);
    }
    setCuePitchState(1);
    setCueLoopBeats(null);
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
  // Q, A S D F, Shift+1-5 / Shift+0 drive the manually cued deck B in the open transition panel.
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

      if (!detailEdge) return;
      const [, b] = detailEdge;
      const mb = meta[b];
      if (key === 'q') { toggleCue(b, mb?.cuePoint ?? 0); return; }
      if (e.shiftKey) {
        const bNudge: Record<string, number> = { a: -0.05, s: -0.01, d: 0.01, f: 0.05 };
        if (key in bNudge) { nudgeGrid(b, mb?.bpm, beatOverride[b] ?? mb?.beatOffset, bNudge[key]); return; }
      } else {
        const bJump: Record<string, number> = { a: -4, s: -1, d: 1, f: 4 };
        if (key in bJump) { if (mb?.bpm) p.cueBeatJump(bJump[key], mb.bpm); return; }
      }
      if (e.shiftKey && digitMatch) {
        const n = Number(digitMatch[1]);
        if (n === 0) { p.exitCueLoop(); setCueLoopBeats(null); return; }
        if (!mb?.bpm) return;
        const beats = loopSteps[n - 1];
        if (cueLoopBeats === beats) { p.exitCueLoop(); setCueLoopBeats(null); }
        else { p.setCueLoop(beats, mb.bpm); setCueLoopBeats(beats); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveMode, detailEdge, meta, loopBeats, cueLoopBeats, toggleCue, beatOverride, nudgeGrid]);

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
    if (e.ctrlKey || e.metaKey) { setWaveDetail(path); return; }
    if (e.shiftKey && selected && selected !== path) {
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

  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const playingPath = nowPlaying ? pathFrom(selected || nowPlaying.path) : [];

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
        for (let i = 0; i < n; i++) {
          const v = spectrum[i] / 255;
          const barH = v * h;
          ctx.fillStyle = `rgba(29, 78, 216, ${0.05 + v * 0.22})`;
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
              {' — Shift+click another node to link/unlink, Ctrl+click to preview its waveform'}
            </span>
          </>
        ) : (
          <span className="graph-hint">Click a node to select it — compatible nodes light up, suggestions appear below. Click an arrow to preview that transition. Ctrl+click a node to preview its waveform and set cues/grid.</span>
        )}
        {nowPlaying && (
          <span className="graph-nowplaying">
            <Play size={12} /> {short(nowPlaying.name)}
            <button className="btn btn-secondary" onClick={() => playerRef.current!.skip()} title="Skip to next (crossfade now)"><SkipForward size={12} /></button>
            <button className="btn btn-secondary" onClick={() => playerRef.current!.stop()} title="Stop"><Square size={12} /></button>
          </span>
        )}
      </div>

      {liveMode && showShortcuts && (
        <div className="graph-hint">
          Deck A — <b>Z X C V</b> beat jump ±4/±1 · <b>1-5</b> loop 1/2/4/8/16 · <b>0</b> exit loop.{' '}
          Deck B cue (open a transition panel) — <b>Q</b> cue play/stop · <b>A S D F</b> beat jump ±4/±1 ·{' '}
          <b>Shift+A/S/D/F</b> grid nudge ±50/±10ms · <b>Shift+1-5</b> loop · <b>Shift+0</b> exit loop.
        </div>
      )}

      {nowPlaying && (() => {
        return (
          <div className="graph-live-controls">
            <span className="glc-group">
              <span className="wc-label">Filter {liveFilter > 0 ? '+' : ''}{liveFilter}</span>
              <input type="range" min={-100} max={100} step={5} value={liveFilter}
                onChange={e => { const v = Number(e.target.value); setLiveFilter(v); playerRef.current!.setLiveFilter(v / 100); }} />
            </span>
            <span className="glc-group">
              <span className="wc-label">Beat jump</span>
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
        );
      })()}

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
          return (
            <g
              key={t.path}
              transform={`translate(${n.x},${n.y})`}
              className={`graph-node ${isSel ? 'sel' : ''} ${isCompat ? 'compat' : ''} ${isPlaying ? 'playing' : ''} ${inPath ? 'inpath' : ''}`}
              onClick={e => nodeClick(e, t.path)}
              onDoubleClick={e => { e.stopPropagation(); playFrom(t.path); }}
              onPointerDown={e => { e.stopPropagation(); dragRef.current = { path: t.path, moved: false }; }}
            >
              <circle r={R} style={isPlaying && m?.bpm ? { animationDuration: `${60 / m.bpm}s` } : undefined} />
              <text y={-2} textAnchor="middle" className="graph-bpm">{m?.bpm ? Math.round(m.bpm) : '—'}</text>
              <text y={11} textAnchor="middle" className="graph-key">{m?.key || ''}</text>
              <text y={R + 14} textAnchor="middle" className="graph-label">{short(t.name)}</text>
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
                <button className={`btn btn-accent ${pendingLive === b ? 'blink' : ''}`} disabled={pendingLive === b}
                  onClick={() => goLive(a, b)} title="Fire this transition now, quantized to the next bar">
                  🔒 {pendingLive === b ? 'Going live…' : 'Go live'}
                </button>
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
              onSetCue={frac => onSetCueOut?.(a, Math.max(0, aWinStart + frac * aLen))} />
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
              onSetCue={frac => onSetCue(b, Math.max(0, bWinStart + frac * bLen))} />
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
                    title={cueingPath === b ? 'Stop cueing this track' : 'Cue this track in now, at full volume, to beatmatch by ear'}>
                    {cueingPath === b ? <Square size={12} /> : <Play size={12} />} Cue
                  </button>
                  {cueingPath === b && (
                    <>
                      <input type="range" min={-8} max={8} step={0.1} value={(cuePitch - 1) * 100}
                        onChange={e => { const r = 1 + Number(e.target.value) / 100; setCuePitchState(r); playerRef.current!.setCuePitch(r); }}
                        title="Manual pitch (%)" />
                      <span className="wc-label">{((cuePitch - 1) * 100).toFixed(1)}%</span>
                      <span className="wc-sep" />
                      {[1, 2, 4, 8, 16].map(n => (
                        <button key={n} className={`btn wc-btn ${cueLoopBeats === n ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => {
                            if (cueLoopBeats === n) { playerRef.current!.exitCueLoop(); setCueLoopBeats(null); }
                            else if (mb?.bpm) { playerRef.current!.setCueLoop(n, mb.bpm); setCueLoopBeats(n); }
                          }}>{n}</button>
                      ))}
                      {cueLoopBeats != null && (
                        <button className="btn btn-secondary wc-btn" onClick={() => { playerRef.current!.exitCueLoop(); setCueLoopBeats(null); }}>Exit</button>
                      )}
                    </>
                  )}
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
              onSetCue={frac => onSetCue(waveDetail, Math.max(0, winStart + frac * winLen))} />
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
