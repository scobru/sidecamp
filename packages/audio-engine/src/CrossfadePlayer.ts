import { WarpSource, ensureWarpWorklet } from './warpSource';

// --- Crossfade player -------------------------------------------------------
// Web Audio, not <audio>: tracks are decoded to AudioBuffers over IPC (same
// proven path as the Analyze pass), which gives seek-anywhere previews and
// sample-accurate beat alignment. The media:// protocol aborts ranged
// requests, so HTMLAudioElement cannot seek outside its buffer at all.
export const DEFAULT_FADE_S = 8;
export const FADE_OPTIONS = [8, 16, 24];
export const PREVIEW_LEAD_S = 5;  // seconds of A heard before the fade starts
export const PREVIEW_TAIL_S = 6;  // seconds of B heard after the fade completes
export type EqPreset = 'off' | 'bass-swap' | 'rise' | 'blend' | 'wave' | 'melt' | 'slam';
export type BandPeaks = { low: number[]; mid: number[]; high: number[] };
const BASS_SWAP_CUT = -15; // dB the outgoing/incoming low shelf dips to during a bass-swap fade
const BLEND_CUT = -10;     // dB, gentler 3-band cut used by the Blend/Wave presets
const SWEEP_LP_START_HZ = 300;   // Rise/Wave: incoming lowpass opens from here up to fully open
const SWEEP_HP_END_HZ = 800;     // Rise/Wave: outgoing highpass climbs from open up to here
const MELT_HP_HZ = 1500;         // Melt: both sides sweep highpass through this frequency
const LIVE_FILTER_LP_FLOOR_HZ = 200;  // live knob fully negative: lowpass cutoff floor ("underwater")
const LIVE_FILTER_HP_CEIL_HZ = 2000;  // live knob fully positive: highpass cutoff ceiling ("distant")
export type QueueItem = { path: string; name: string; bpm: number | null; beatOffset?: number | null; eqPreset?: EqPreset; cue?: number; cueOut?: number };

/** Per-playlist live-set settings, persisted by the parent alongside tracks/edges. */
export type LiveConfig = {
  edgePreset?: Record<string, EqPreset>;    // EQ preset per transition (edge key "from→to")
  beatOverride?: Record<string, number>;    // manual beat-grid corrections per track path
  fadeS?: number;
  masterOn?: boolean;
  masterBpm?: number;
};

export type StripState = { vol: number; filter: number; low: number; mid: number; high: number };
export const NEUTRAL_STRIP: StripState = { vol: 1, filter: 0, low: 0, mid: 0, high: 0 };
export type NowPlaying = { index: number; path: string; name: string } | null;
type Deck = {
  src: WarpSource; gain: GainNode; vol: GainNode; master: GainNode; pfl: GainNode; meter: AnalyserNode; buf: AudioBuffer; startCtx: number; startOffset: number; rate: number; filterKnob: number;
  low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode;
  lp: BiquadFilterNode; // preset sweep filter, neutral (fully open) unless a transition drives it
  hp: BiquadFilterNode; // preset sweep filter, neutral (fully open) unless a transition drives it
};
export type EqBands = { low: number; mid: number; high: number }; // dB, range -15..15
const DEFAULT_EQ: EqBands = { low: 0, mid: 0, high: 0 };

export const bpmRatio = (from: number, to: number) => {
  // Best playback-rate ratio considering half/double time.
  const cands = [to, to * 2, to / 2];
  const best = cands.reduce((a, b) => (Math.abs(from / b - 1) < Math.abs(from / a - 1) ? b : a));
  return from / best;
};
export const bpmClose = (a: number | null, b: number | null, tol = 0.06) =>
  !!a && !!b && Math.abs(bpmRatio(a, b) - 1) <= tol;

export class CrossfadePlayer {
  private ctx: AudioContext | null = null;
  private deck: Deck | null = null;
  private fadingDeck: Deck | null = null; // incoming deck mid-crossfade; stop() must kill this too
  // manually cued decks by track path, played alongside the live deck before a fade fires;
  // multiple entries let 2-3 tracks be layered/beatmatched at once. deck is null while loading.
  private cues = new Map<string, { deck: Deck | null; bpm: number | null }>();
  private masterBpm: number | null = null; // Ableton-style global tempo; null = tracks play native
  fadeS = DEFAULT_FADE_S;
  private eq: EqBands = { ...DEFAULT_EQ };
  private queue: QueueItem[] = [];
  private idx = -1;
  private fading = false;
  private fadeStart = 0;
  private fadeDuration = 0;
  private previewing = false;
  private raf = 0;
  private session = 0; // bumped on stop/play; async loads from older sessions are discarded
  private bufCache = new Map<string, AudioBuffer>();
  private bufLoading = new Map<string, Promise<AudioBuffer>>();
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private monitorDest: MediaStreamAudioDestinationNode | null = null; // headphone bus, rendered on a second output device
  private monitorEl: HTMLAudioElement | null = null;
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
    await ensureWarpWorklet(this.getCtx()); // decks need the warp processor registered before startDeck
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
    const src = new WarpSource(ctx, buf); // pitch-preserving time-stretch instead of varispeed
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
    const vol = ctx.createGain(); // user channel fader — separate from `gain`, which crossfade automation owns
    const master = ctx.createGain(); // send to the main output (0 while a deck is headphone-only pre-listen)
    const pfl = ctx.createGain();    // pre-fade listen send to the headphone monitor bus
    pfl.gain.value = 0;
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    src.connect(low).connect(mid).connect(high).connect(hp).connect(lp).connect(gain).connect(vol).connect(master).connect(ctx.destination);
    vol.connect(meter);
    vol.connect(pfl);
    if (this.monitorDest) pfl.connect(this.monitorDest);
    if (this.recordDest) master.connect(this.recordDest);
    if (this.analyser) master.connect(this.analyser);
    const at = when || ctx.currentTime;
    src.start(at, offset);
    return { src, gain, vol, master, pfl, meter, buf, startCtx: at, startOffset: offset, rate, low, mid, high, lp, hp, filterKnob: 0 };
  }

  /** Current media-time playhead (seconds) of the live deck, for hot-cue "set". */
  getPos(): number | null { return this.deck ? this.pos(this.deck) : null; }

  /** Playback state snapshot for the UI progress bar: position, effective duration, and whether a crossfade is in progress. */
  getPlaybackInfo(): { pos: number; dur: number; fading: boolean } | null {
    if (!this.deck || this.idx < 0) return null;
    return {
      pos: this.pos(this.deck),
      dur: this.queue[this.idx].cueOut ?? this.deck.buf.duration,
      fading: this.fading,
    };
  }

  /** Most recently cued deck that has finished loading (the one the B strip controls). */
  private lastCueDeck(): Deck | null {
    let last: Deck | null = null;
    for (const e of this.cues.values()) if (e.deck) last = e.deck;
    return last;
  }

  /** Every playing cue deck (loaded entries only). */
  private cueDecks(): Deck[] {
    return [...this.cues.values()].map(e => e.deck).filter((d): d is Deck => !!d);
  }

  /** Actual playback rates of the live and cue decks (UI feedback for master-tempo warp). */
  getDeckRates(): { a: number | null; cue: number | null } {
    return { a: this.deck?.rate ?? null, cue: this.lastCueDeck()?.rate ?? null };
  }

  /** Paths of the pair currently mid-crossfade, or null. */
  getFadingPair(): { from: string; to: string } | null {
    return this.fading && this.idx >= 0 && this.idx + 1 < this.queue.length
      ? { from: this.queue[this.idx].path, to: this.queue[this.idx + 1].path }
      : null;
  }

  getCrossfadeProgress(): { from: string; to: string; progress: number } | null {
    if (!this.fading || !this.deck || !this.fadingDeck || this.idx < 0 || this.idx + 1 >= this.queue.length) return null;
    const now = this.getCtx().currentTime;
    const dur = this.fadeDuration || 1;
    const pct = (now - this.fadeStart) / dur;
    return {
      from: this.queue[this.idx].path,
      to: this.queue[this.idx + 1].path,
      progress: Math.max(0, Math.min(1, pct)),
    };
  }

  /** Live phase nudge on the incoming deck for `path` — a brief pitch bend, same move a DJ
   *  makes to bring a synced deck back into phase, without touching the gain/EQ automation.
   *  Targets whichever deck is actually sounding for that path: a manual cue, or a live fade. */
  nudgeLive(path: string, deltaS: number) {
    const d = this.cues.get(path)?.deck ?? (this.getFadingPair()?.to === path ? this.fadingDeck : null);
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

  /** Manually cue a track in now, at full volume alongside whatever's playing — independent of
   *  the automated crossfade engine, so it can be beatmatched by ear first. Each cued path gets
   *  its own deck; cueing another track layers it instead of replacing the previous cue. */
  cueLive(path: string, offset: number, bpm?: number | null, _beatOffset?: number | null) {
    const old = this.cues.get(path);
    if (old?.deck) { try { old.deck.src.stop(); } catch { /* already stopped */ } }
    const entry = { deck: null as Deck | null, bpm: bpm ?? null };
    this.cues.set(path, entry);
    this.load(path).then(buf => {
      if (this.cues.get(path) !== entry) return; // superseded by a newer cue/stop before load finished
      const off = Math.max(0, Math.min(offset, buf.duration - 1));
      entry.deck = this.startDeck(buf, off, this.warpRate(bpm), 1, 0);
    });
  }

  /** Stop one cued track, or every cued track when no path is given. */
  stopCue(path?: string) {
    for (const [p, e] of [...this.cues]) {
      if (path && p !== path) continue;
      if (e.deck) { try { e.deck.src.stop(); } catch { /* already stopped */ } }
      this.cues.delete(p);
    }
  }

  getCuePaths(): string[] { return [...this.cues.keys()]; }

  /** Jump forward/back by whole beats on a manually cued deck. */
  cueBeatJump(path: string, beats: number, bpm: number) {
    const entry = this.cues.get(path);
    const d = entry?.deck;
    if (!entry || !d || !bpm) return;
    const delta = beats * (60 / bpm);
    const clamped = Math.max(0, Math.min(this.pos(d) + delta, d.buf.duration - 0.05));
    const gain0 = d.gain.gain.value;
    try { d.src.stop(); } catch { /* already stopped */ }
    d.gain.disconnect(); d.vol.disconnect();
    entry.deck = this.startDeck(d.buf, clamped, d.rate, gain0);
    this.carryMixer(d, entry.deck);
  }

  /** Loop the next N beats of a manually cued deck, from its current playhead. */
  setCueLoop(path: string, beats: number, bpm: number) {
    const d = this.cues.get(path)?.deck;
    if (!d || !bpm) return;
    const start = this.pos(d);
    d.src.loopStart = start;
    d.src.loopEnd = start + beats * (60 / bpm);
    d.src.loop = true;
  }

  exitCueLoop(path: string) {
    const d = this.cues.get(path)?.deck;
    if (d) d.src.loop = false;
  }

  /** Persistent manual pitch on a cued deck (1 = original speed) — unlike nudgeLive's
   *  temporary bend, this stays until changed again. */
  setCuePitch(path: string, rate: number) {
    const d = this.cues.get(path)?.deck;
    if (!d) return;
    d.src.playbackRate.cancelScheduledValues(this.getCtx().currentTime);
    d.src.playbackRate.value = rate;
    d.rate = rate;
  }

  /** Playback rate that makes a track of `trackBpm` sound at the master tempo (1 when master off or BPM unknown). */
  private warpRate(trackBpm: number | null | undefined): number {
    return this.masterBpm && trackBpm ? bpmRatio(this.masterBpm, trackBpm) : 1;
  }

  /** Ableton-style master tempo: warp every deck (live, fading, cue) to this BPM, now and
   *  for every deck started later. null = off — tracks play native, syncing only during fades. */
  setMasterTempo(bpm: number | null) {
    this.masterBpm = bpm && bpm > 0 ? bpm : null;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const retempo = (d: Deck | null, trackBpm: number | null | undefined) => {
      if (!d) return;
      const rate = this.warpRate(trackBpm);
      console.log(`[master] deck retempo: trackBpm=${trackBpm ?? 'unknown'} master=${this.masterBpm ?? 'off'} rate=${rate.toFixed(4)}`);
      d.startOffset = this.pos(d); // snapshot so pos() stays correct across the rate change
      d.startCtx = now;
      d.rate = rate;
      d.src.playbackRate.cancelScheduledValues(now);
      d.src.playbackRate.value = rate;
    };
    retempo(this.deck, this.queue[this.idx]?.bpm);
    retempo(this.fadingDeck, this.queue[this.idx + 1]?.bpm);
    for (const e of this.cues.values()) retempo(e.deck, e.bpm);
  }

  getMasterTempo(): number | null { return this.masterBpm; }

  /** Live filter knob (-1..1): negative sweeps a lowpass down ("underwater"), positive sweeps a highpass up ("distant"). */
  setLiveFilter(knob: number) {
    const k = Math.max(-1, Math.min(1, knob));
    const ctx = this.getCtx();
    for (const d of [this.deck, this.fadingDeck, ...this.cueDecks()]) {
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

  // ---- headphone monitor (pre-listen on a second audio output) ----

  monitorActive(): boolean { return this.monitorEl != null; }

  /** Route the PFL bus to an output device (e.g. headphones on a 2-out card). null = off. */
  async setMonitorDevice(deviceId: string | null) {
    if (!deviceId) {
      this.monitorEl?.pause();
      this.monitorEl = null;
      for (const d of [this.deck, this.fadingDeck, ...this.cueDecks()]) if (d) d.pfl.gain.value = 0;
      return;
    }
    const ctx = this.getCtx();
    if (!this.monitorDest) {
      this.monitorDest = ctx.createMediaStreamDestination();
      for (const d of [this.deck, this.fadingDeck, ...this.cueDecks()]) d?.pfl.connect(this.monitorDest);
    }
    if (!this.monitorEl) {
      this.monitorEl = new Audio();
      this.monitorEl.srcObject = this.monitorDest.stream;
    }
    await (this.monitorEl as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId);
    this.monitorEl.play().catch(() => { /* resumes on next user gesture */ });
  }

  /** Toggle a deck's send to the headphone bus. */
  setPfl(which: string, on: boolean) {
    const d = this.deckByLabel(which);
    if (d) d.pfl.gain.setTargetAtTime(on ? 1 : 0, this.getCtx().currentTime, 0.02);
  }

  /** Manually push/pull the B deck in or out of the master output (pre-listen escape hatch). */
  setDeckMaster(which: string, on: boolean) {
    const d = this.deckByLabel(which);
    if (d) d.master.gain.setTargetAtTime(on ? 1 : 0, this.getCtx().currentTime, 0.05);
  }

  getRouting(which: string): { pfl: boolean; master: boolean } | null {
    const d = this.deckByLabel(which);
    return d && { pfl: d.pfl.gain.value > 0.5, master: d.master.gain.value > 0.5 };
  }

  // ---- per-deck live mixer ----
  // Channel ids: 'a' = live deck, 'b' = most recently cued/incoming deck,
  // any other string = the cued deck for that track path.

  private deckByLabel(which: string): Deck | null {
    if (which === 'a') return this.deck;
    if (which === 'b') return this.lastCueDeck() ?? this.fadingDeck;
    return this.cues.get(which)?.deck ?? null;
  }

  setDeckVolume(which: string, v: number) {
    const d = this.deckByLabel(which);
    if (d) d.vol.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.getCtx().currentTime, 0.01);
  }

  /** Per-deck filter knob (-1..1): negative sweeps a lowpass down, positive a highpass up, 0 = off. */
  setDeckFilter(which: string, knob: number) {
    const d = this.deckByLabel(which);
    if (!d) return;
    const k = Math.max(-1, Math.min(1, knob));
    d.filterKnob = k;
    const now = this.getCtx().currentTime;
    if (k < 0) {
      d.lp.frequency.setTargetAtTime(20000 + (LIVE_FILTER_LP_FLOOR_HZ - 20000) * -k, now, 0.03);
      d.hp.frequency.setTargetAtTime(20, now, 0.03);
    } else {
      d.hp.frequency.setTargetAtTime(20 + (LIVE_FILTER_HP_CEIL_HZ - 20) * k, now, 0.03);
      d.lp.frequency.setTargetAtTime(20000, now, 0.03);
    }
  }

  setDeckEq(which: string, band: 'low' | 'mid' | 'high', dB: number) {
    const d = this.deckByLabel(which);
    if (d) d[band].gain.setTargetAtTime(dB, this.getCtx().currentTime, 0.02);
  }

  private meterScratch = new Float32Array(1024);
  private levelOf(d: Deck | null): number {
    if (!d) return 0;
    d.meter.getFloatTimeDomainData(this.meterScratch);
    let p = 0;
    for (let i = 0; i < this.meterScratch.length; i++) { const a = Math.abs(this.meterScratch[i]); if (a > p) p = a; }
    return Math.min(1, p);
  }

  /** Real-time peak level (0..1) of a channel strip, for VU meters. */
  getDeckLevel(which: string): number {
    return this.levelOf(this.deckByLabel(which));
  }

  /** Active native-loop bounds + playhead (media seconds) of a channel's deck, for waveform overlays. */
  getLoopState(which: string): { start: number; end: number; pos: number } | null {
    const d = this.deckByLabel(which);
    if (!d || !d.src.loop) return null;
    return { start: d.src.loopStart, end: d.src.loopEnd, pos: this.pos(d) };
  }

  /** Current mixer settings of a strip, so the UI can stay in sync when decks swap after a fade. */
  getMixerState(which: string) {
    const d = this.deckByLabel(which);
    return d && {
      vol: d.vol.gain.value, filter: d.filterKnob,
      low: d.low.gain.value, mid: d.mid.gain.value, high: d.high.gain.value,
    };
  }

  /** Carry user mixer settings across a stop-and-restart of the same track (reseat/beat jump). */
  private carryMixer(from: Deck, to: Deck) {
    to.vol.gain.value = from.vol.gain.value;
    to.filterKnob = from.filterKnob;
    to.lp.frequency.value = from.lp.frequency.value;
    to.hp.frequency.value = from.hp.frequency.value;
    to.low.gain.value = from.low.gain.value;
    to.mid.gain.value = from.mid.gain.value;
    to.high.gain.value = from.high.gain.value;
  }

  /** Stop-and-restart the live deck's source at a new media position (AudioBufferSourceNode can't seek in place). */
  private reseat(offset: number) {
    if (!this.deck || this.fading) return;
    const d = this.deck;
    const clamped = Math.max(0, Math.min(offset, d.buf.duration - 0.05));
    const gain0 = d.gain.gain.value;
    try { d.src.stop(); } catch { /* already stopped */ }
    d.gain.disconnect(); d.vol.disconnect();
    this.deck = this.startDeck(d.buf, clamped, d.rate, gain0);
    this.carryMixer(d, this.deck);
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
      this.deck = this.startDeck(buf, Math.max(0, Math.min(off, buf.duration - 1)), this.warpRate(queue[0].bpm), 1);
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
    for (const d of [this.deck, this.fadingDeck, ...this.cueDecks()]) d?.gain.connect(this.recordDest);
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
      if (remaining / this.deck.rate <= this.fadeS + 1.5) this.startFade(); // remaining is media time; rate ≠ 1 under master tempo
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
    const bAlreadyCued = !!this.cues.get(to.path)?.deck;

    let buf: AudioBuffer;
    try { buf = await this.load(to.path); } catch { if (sess === this.session) this.stop(); return; }
    if (sess !== this.session) return;

    const ctx = this.getCtx();
    // Tempo match: incoming track starts at the outgoing tempo (within ±8%),
    // then eases back to its own tempo after the fade.
    const rawRatio = from.bpm && to.bpm ? bpmRatio(from.bpm, to.bpm) : 1;
    // Master tempo on: both decks are already warped to the same BPM, so B just takes its warp
    // rate (no clamp — the master is a deliberate choice). Off: legacy ±8% match-then-ease.
    const rate = this.masterBpm ? this.warpRate(to.bpm) : Math.min(1.08, Math.max(0.92, rawRatio));
    const canSync = (this.masterBpm ? !!to.bpm : rate === rawRatio) && from.beatOffset != null && to.beatOffset != null && !!from.bpm && !!to.bpm;

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

    const b = bAlreadyCued ? this.cues.get(to.path)!.deck! : this.startDeck(buf, bOffset, rate, 0, t0);
    if (bAlreadyCued) { this.cues.delete(to.path); b.src.loop = false; } // other cued decks keep playing
    this.fadingDeck = b;
    const tEnd = t0 + this.fadeS;
    this.fadeStart = t0;
    this.fadeDuration = this.fadeS;
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
    // (skip when it's a manually cued deck — its pitch is the DJ's own choice —
    //  or when a master tempo is set: the deck stays warped to the master)
    if (!bAlreadyCued && rate !== 1 && !this.masterBpm) {
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
