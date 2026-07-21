import { getWasmBytes } from './wasmBinary.js';

export interface WasmExports {
  memory: WebAssembly.Memory;
  compute_3band_peaks: (
    dataPtr: number,
    dataLen: number,
    sampleRate: number,
    s0: number,
    e0: number,
    nBuckets: number,
    outLowPtr: number,
    outMidPtr: number,
    outHighPtr: number
  ) => number;
  alloc_f32_buffer: (size: number) => number;
  free_f32_buffer: (ptr: number, size: number) => void;
  alloc_u8_buffer: (size: number) => number;
  free_u8_buffer: (ptr: number, size: number) => void;
}

let wasmInstancePromise: Promise<WasmExports | null> | null = null;
let cachedSyncEngine: WasmExports | null = null;

export async function getWasmEngine(): Promise<WasmExports | null> {
  if (wasmInstancePromise) return wasmInstancePromise;
  wasmInstancePromise = (async () => {
    try {
      const bytes = getWasmBytes();
      const res = await WebAssembly.instantiate(bytes.buffer as ArrayBuffer, {});
      const instance = 'instance' in res ? res.instance : (res as unknown as WebAssembly.Instance);
      return instance.exports as unknown as WasmExports;
    } catch (err) {
      console.warn('[audio-wasm] Failed async WASM init, falling back to JS:', err);
      return null;
    }
  })();
  return wasmInstancePromise;
}

export function getWasmEngineSync(): WasmExports | null {
  if (cachedSyncEngine) return cachedSyncEngine;
  try {
    const bytes = getWasmBytes();
    const module = new WebAssembly.Module(bytes.buffer as ArrayBuffer);
    const instance = new WebAssembly.Instance(module, {});
    cachedSyncEngine = instance.exports as unknown as WasmExports;
    return cachedSyncEngine;
  } catch (err) {
    console.warn('[audio-wasm] Failed sync WASM init, falling back to JS:', err);
    return null;
  }
}

export function compute3BandPeaksWasm(
  wasm: WasmExports,
  channelData: Float32Array,
  sampleRate: number,
  s0: number,
  e0: number,
  N: number
): { low: number[]; mid: number[]; high: number[] } | null {
  try {
    const dataLen = channelData.length;
    const dataPtr = wasm.alloc_f32_buffer(dataLen);
    const lowPtr = wasm.alloc_u8_buffer(N);
    const midPtr = wasm.alloc_u8_buffer(N);
    const highPtr = wasm.alloc_u8_buffer(N);

    // Copy input data into WASM heap
    const heapF32 = new Float32Array(wasm.memory.buffer, dataPtr, dataLen);
    heapF32.set(channelData);

    const count = wasm.compute_3band_peaks(
      dataPtr,
      dataLen,
      sampleRate,
      s0,
      e0,
      N,
      lowPtr,
      midPtr,
      highPtr
    );

    if (count === 0) {
      wasm.free_f32_buffer(dataPtr, dataLen);
      wasm.free_u8_buffer(lowPtr, N);
      wasm.free_u8_buffer(midPtr, N);
      wasm.free_u8_buffer(highPtr, N);
      return null;
    }

    // Read result back from WASM heap
    const heapU8Low = new Uint8Array(wasm.memory.buffer, lowPtr, N);
    const heapU8Mid = new Uint8Array(wasm.memory.buffer, midPtr, N);
    const heapU8High = new Uint8Array(wasm.memory.buffer, highPtr, N);

    const low = Array.from(heapU8Low);
    const mid = Array.from(heapU8Mid);
    const high = Array.from(heapU8High);

    // Clean up memory
    wasm.free_f32_buffer(dataPtr, dataLen);
    wasm.free_u8_buffer(lowPtr, N);
    wasm.free_u8_buffer(midPtr, N);
    wasm.free_u8_buffer(highPtr, N);

    return { low, mid, high };
  } catch (e) {
    console.error('[audio-wasm] Error executing WASM peak calculation:', e);
    return null;
  }
}
