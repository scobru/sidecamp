// Computes 3-band peak envelopes off the main thread. Channel data crosses the
// thread boundary once per track and is cached here (same cap as bufCache); if a
// path was evicted the worker answers needData and the main side resends.
type Req = { id: number; path: string; ch?: Float32Array; sr: number; s0: number; e0: number; N: number };

const cache = new Map<string, Float32Array>();

self.onmessage = (ev: MessageEvent<Req>) => {
  const { id, path, ch, sr, s0, e0, N } = ev.data;
  if (ch) {
    cache.set(path, ch);
    while (cache.size > 5) cache.delete(cache.keys().next().value!);
  }
  const data = cache.get(path);
  if (!data) {
    (self as unknown as Worker).postMessage({ id, needData: true });
    return;
  }
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
      const x = data[j];
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
  (self as unknown as Worker).postMessage({
    id,
    peaks: {
      low: low.map(v => (topLow > 0 ? Math.round((v / topLow) * 100) : 0)),
      mid: mid.map(v => (topMid > 0 ? Math.round((v / topMid) * 100) : 0)),
      high: high.map(v => (topHigh > 0 ? Math.round((v / topHigh) * 100) : 0)),
    },
  });
};
