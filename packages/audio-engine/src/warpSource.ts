// Main-thread wrapper around the 'warp-source' AudioWorklet (see warpWorklet.ts).
// Drop-in replacement for the AudioBufferSourceNode API subset CrossfadePlayer
// uses, but playbackRate changes stretch time without shifting pitch.
import workletUrl from './warpWorklet.ts?worker&url';

const workletReady = new WeakMap<AudioContext, Promise<void>>();

export function ensureWarpWorklet(ctx: AudioContext): Promise<void> {
  let p = workletReady.get(ctx);
  if (!p) {
    p = ctx.audioWorklet.addModule(workletUrl);
    workletReady.set(ctx, p);
  }
  return p;
}

class WarpParam {
  private post: (m: object) => void;
  private _value = 1;
  constructor(post: (m: object) => void) { this.post = post; }
  get value() { return this._value; }
  set value(v: number) { this._value = v; this.post({ type: 'rate', value: v }); }
  setValueAtTime(v: number, t: number) { this._value = v; this.post({ type: 'rate-set', v, t }); }
  linearRampToValueAtTime(v: number, t: number) { this._value = v; this.post({ type: 'rate-ramp', v, t }); }
  cancelScheduledValues(t: number) { this.post({ type: 'rate-cancel', t }); }
}

export class WarpSource {
  readonly playbackRate: WarpParam;
  private node: AudioWorkletNode;
  private _loop = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  /** ensureWarpWorklet(ctx) must have resolved before constructing. Buffer must be at ctx's sample rate (decodeAudioData guarantees this). */
  constructor(ctx: AudioContext, buf: AudioBuffer) {
    this.node = new AudioWorkletNode(ctx, 'warp-source', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    const left = new Float32Array(buf.length);
    const right = new Float32Array(buf.length);
    buf.copyFromChannel(left, 0);
    buf.copyFromChannel(right, buf.numberOfChannels > 1 ? 1 : 0);
    this.node.port.postMessage({ type: 'load', left, right }, [left.buffer, right.buffer]);
    this.node.port.onmessage = (e) => { if (e.data?.type === 'ended') this.node.disconnect(); };
    this.playbackRate = new WarpParam(m => this.node.port.postMessage(m));
  }

  get loop() { return this._loop; }
  set loop(v: boolean) { this._loop = v; this.sendLoop(); }
  get loopStart() { return this._loopStart; }
  set loopStart(v: number) { this._loopStart = v; this.sendLoop(); }
  get loopEnd() { return this._loopEnd; }
  set loopEnd(v: number) { this._loopEnd = v; this.sendLoop(); }
  private sendLoop() {
    this.node.port.postMessage({ type: 'loop', loop: this._loop, loopStart: this._loopStart, loopEnd: this._loopEnd });
  }

  connect(dest: AudioNode) { return this.node.connect(dest); }
  start(when = 0, offset = 0) { this.node.port.postMessage({ type: 'start', when, offset }); }
  stop(when = 0) { this.node.port.postMessage({ type: 'stop', when }); }
}
