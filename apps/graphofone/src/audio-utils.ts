export const computePeaks = (buffer: AudioBuffer, targetCount = 140): number[] => {
  const chan = buffer.getChannelData(0);
  const step = Math.floor(chan.length / targetCount);
  const res = new Float32Array(targetCount);
  let max = 0;
  for (let i = 0; i < targetCount; i++) {
    let peak = 0;
    const start = i * step;
    for (let j = 0; j < step && start + j < chan.length; j++) {
      const v = Math.abs(chan[start + j]);
      if (v > peak) peak = v;
    }
    res[i] = peak;
    if (peak > max) max = peak;
  }
  // normalize to 0-100
  return Array.from(res).map(v => Math.round((v / (max || 1)) * 100));
};
