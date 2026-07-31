import { describe, it, expect } from 'vitest';
import { computePeaks } from './audio-utils';

function createMockAudioBuffer(data: number[]): AudioBuffer {
  return {
    getChannelData: (channel: number) => new Float32Array(data),
    length: data.length,
    duration: data.length / 44100,
    sampleRate: 44100,
    numberOfChannels: 1,
  } as unknown as AudioBuffer;
}

describe('computePeaks', () => {
  it('returns array of default targetCount 140', () => {
    const data = new Array(1000).fill(0).map(() => Math.random());
    const buffer = createMockAudioBuffer(data);
    const peaks = computePeaks(buffer);
    expect(peaks.length).toBe(140);
  });

  it('computes and normalizes peaks to 0-100 range', () => {
    // Generate data with exactly 10 samples for a target of 5.
    // Step size = Math.floor(10 / 5) = 2.
    // Windows:
    // [0.1, 0.5] => max 0.5
    // [0.2, -0.1] => max 0.2 (due to Math.abs(-0.1) = 0.1)
    // [0.8, -0.6] => max 0.8 (due to Math.abs(-0.6) = 0.6)
    // [0.1, 0.0] => max 0.1
    // [1.0, 0.9] => max 1.0
    const data = [0.1, 0.5, 0.2, -0.1, 0.8, -0.6, 0.1, 0.0, 1.0, 0.9];
    const buffer = createMockAudioBuffer(data);

    const peaks = computePeaks(buffer, 5);

    expect(peaks.length).toBe(5);
    // Peak max is 1.0, so values should be (peak / 1.0) * 100
    // [0.5, 0.2, 0.8, 0.1, 1.0] -> [50, 20, 80, 10, 100]
    expect(peaks).toEqual([50, 20, 80, 10, 100]);
  });

  it('handles negative values correctly via Math.abs', () => {
    const data = [-0.1, -0.5, -0.2, -0.9, -1.0, 0.2];
    const buffer = createMockAudioBuffer(data);
    const peaks = computePeaks(buffer, 3);

    // Windows size 2:
    // [-0.1, -0.5] => peak 0.5
    // [-0.2, -0.9] => peak 0.9
    // [-1.0, 0.2] => peak 1.0
    // Max peak = 1.0
    // Peaks = [50, 90, 100]
    expect(peaks).toEqual([50, 90, 100]);
  });

  it('handles array of zeros', () => {
    const data = new Array(10).fill(0);
    const buffer = createMockAudioBuffer(data);
    const peaks = computePeaks(buffer, 5);

    // With all zeros, max is 0, so it uses `max || 1` which is 1.
    // So 0 / 1 * 100 = 0.
    expect(peaks).toEqual([0, 0, 0, 0, 0]);
  });

  it('works with a custom targetCount', () => {
    const data = new Array(200).fill(0.5);
    const buffer = createMockAudioBuffer(data);
    const peaks = computePeaks(buffer, 10);
    expect(peaks.length).toBe(10);
  });
});
