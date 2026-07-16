// AudioWorklet processor: pitch-preserving time-stretch playback (Ableton-style
// warp) of a PCM buffer via SoundTouch (WSOLA). Replaces AudioBufferSourceNode's
// varispeed playbackRate — tempo changes no longer shift pitch.
//
// The processor mimics the AudioBufferSourceNode features CrossfadePlayer uses:
// scheduled start(when, offset), stop(when), loop/loopStart/loopEnd, and
// playbackRate automation (setValueAtTime / linearRampToValueAtTime /
// cancelScheduledValues) — all driven by port messages from WarpSource.
import { SoundTouch } from 'soundtouch-ts';

// Worklet global scope (not in lib.dom).
declare const sampleRate: number;
declare const currentTime: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: unknown): void;

type RateEvent = { t: number; v: number; ramp: boolean };

const FEED_FRAMES = 4096;

class WarpProcessor extends AudioWorkletProcessor {
  private left: Float32Array | null = null;
  private right: Float32Array | null = null;
  private st: SoundTouch | null = null;
  private pos = 0;              // input read position, frames
  private startAt = Infinity;   // ctx time
  private stopAt = Infinity;    // ctx time
  private ended = false;
  private loop = false;
  private loopStart = 0;        // frames
  private loopEnd = 0;          // frames
  private rate = 1;             // base rate when no automation events apply
  private primed = true;        // WSOLA pre-roll done (see prime())
  private events: RateEvent[] = [];
  private usingST = false;      // SoundTouch active flag
  private inChunk = new Float32Array(FEED_FRAMES * 2);
  private outChunk = new Float32Array(128 * 2);

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data;
      switch (m.type) {
        case 'load':
          this.left = m.left; this.right = m.right;
          this.st = new SoundTouch(sampleRate);
          break;
        case 'start': this.startAt = m.when; this.pos = Math.round(m.offset * sampleRate); this.primed = false; break;
        case 'stop': this.stopAt = m.when || 0; break;
        case 'loop':
          this.loop = m.loop;
          this.loopStart = Math.round(m.loopStart * sampleRate);
          this.loopEnd = Math.round(m.loopEnd * sampleRate);
          break;
        case 'rate': this.rate = m.value; this.events = []; console.log(`[warp] rate=${m.value.toFixed(4)}`); break;
        case 'rate-set': this.pushEvent({ t: m.t, v: m.v, ramp: false }); break;
        case 'rate-ramp': this.pushEvent({ t: m.t, v: m.v, ramp: true }); break;
        case 'rate-cancel': this.events = this.events.filter(ev => ev.t < m.t); break;
      }
    };
  }

  private pushEvent(ev: RateEvent) {
    this.events.push(ev);
    this.events.sort((a, b) => a.t - b.t);
  }

  private rateAt(t: number): number {
    let v = this.rate, tPrev = -Infinity;
    for (const e of this.events) {
      if (e.t <= t) { v = e.v; tPrev = e.t; continue; }
      if (e.ramp && tPrev > -Infinity) return v + (e.v - v) * ((t - tPrev) / (e.t - tPrev));
      return v;
    }
    return v;
  }

  /** Interleave up to `frames` input frames into SoundTouch, honoring loop wrap. Returns frames fed. */
  private feed(frames: number): number {
    const left = this.left!, right = this.right!;
    const looping = this.loop && this.loopEnd > this.loopStart;
    let w = 0;
    while (w < frames) {
      if (looping && this.pos >= this.loopEnd) {
        this.pos = this.loopStart + ((this.pos - this.loopStart) % (this.loopEnd - this.loopStart));
      }
      const limit = looping ? Math.min(this.loopEnd, left.length) : left.length;
      if (this.pos >= limit) {
        if (looping) { this.pos = this.loopStart; continue; }
        break;
      }
      const take = Math.min(frames - w, limit - this.pos);
      for (let i = 0; i < take; i++) {
        this.inChunk[2 * (w + i)] = left[this.pos + i];
        this.inChunk[2 * (w + i) + 1] = right[this.pos + i];
      }
      w += take;
      this.pos += take;
    }
    if (w > 0) this.st!.inputBuffer.putSamples(this.inChunk, 0, w);
    return w;
  }

  /** Pull `need` stretched output frames into outChunk. Returns frames produced (< need only at end of source). */
  private pull(need: number): number {
    const ob = this.st!.outputBuffer;
    while (ob.frameCount < need) {
      const fed = this.feed(FEED_FRAMES);
      this.st!.process();
      if (fed === 0) break;
    }
    const got = Math.min(need, ob.frameCount);
    if (got > 0) ob.receiveSamples(this.outChunk, got);
    return got;
  }

  /** WSOLA warm-up: the pipeline starts cold (zeroed overlap buffer), which smears the first
   *  ~40ms — exactly the kick a quantized cue is aligned to. Rewind input a bit, run it through
   *  and discard the output, so the first audible frame has full attack and lands on `offset`. */
  private prime() {
    this.primed = true;
    const target = this.pos;
    const pre = Math.min(target, FEED_FRAMES);
    if (pre === 0) return;
    this.pos = target - pre;
    const tempo = this.rateAt(this.startAt);
    if (this.st!.tempo !== tempo) this.st!.tempo = tempo; // pull() below must consume at the real rate
    let discard = Math.round(pre / tempo);
    while (discard > 0) {
      const got = this.pull(Math.min(128, discard));
      if (got === 0) break;
      discard -= got;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.ended) return false;
    const out = outputs[0];
    const L = out[0], R = out[1] ?? out[0];
    const n = L.length;
    const t0 = currentTime;
    if (t0 >= this.stopAt) { this.finish(); return false; }
    if (!this.left || !this.st) return true; // not loaded yet
    if (t0 + n / sampleRate <= this.startAt) return true; // not started yet

    const lead = Math.max(0, Math.round((this.startAt - t0) * sampleRate)); // sample-accurate scheduled start
    const tempo = this.rateAt(Math.max(t0, this.startAt));

    // If tempo is not 1.0, we must use SoundTouch for time stretching.
    if (tempo !== 1.0 && !this.usingST) {
      this.usingST = true;
      if (t0 > this.startAt + 0.1) {
        this.primed = true; // Don't rewind/prime if we are already playing mid-track
      }
    }

    const need = n - lead;
    let got = 0;

    if (this.usingST) {
      if (this.startAt < Infinity && !this.primed) this.prime();
      if (this.st.tempo !== tempo) this.st.tempo = tempo;
      got = this.pull(need);
      for (let i = 0; i < got; i++) {
        L[lead + i] = this.outChunk[2 * i];
        R[lead + i] = this.outChunk[2 * i + 1];
      }
    } else {
      // Direct pass-through mode: copy samples directly from PCM buffer to bypass WSOLA jitter
      const left = this.left!, right = this.right!;
      const looping = this.loop && this.loopEnd > this.loopStart;
      for (let i = 0; i < need; i++) {
        if (looping && this.pos >= this.loopEnd) {
          this.pos = this.loopStart + ((this.pos - this.loopStart) % (this.loopEnd - this.loopStart));
        }
        if (this.pos >= left.length) {
          if (looping) {
            this.pos = this.loopStart;
          } else {
            break;
          }
        }
        L[lead + i] = left[this.pos];
        R[lead + i] = right[this.pos];
        this.pos++;
        got++;
      }
    }

    if (this.stopAt < t0 + n / sampleRate) {
      const cut = Math.max(0, Math.round((this.stopAt - t0) * sampleRate));
      L.fill(0, cut); R.fill(0, cut);
      this.finish();
      return false;
    }
    if (got < need) { this.finish(); return false; } // source exhausted
    return true;
  }

  private finish() {
    this.ended = true;
    this.left = this.right = null;
    this.st = null;
    this.port.postMessage({ type: 'ended' });
  }
}

registerProcessor('warp-source', WarpProcessor);
