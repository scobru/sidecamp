import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWasmBytes, WASM_BASE64 } from './wasmBinary';

describe('wasmBinary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getWasmBytes', () => {
    it('should decode the actual WASM_BASE64 string to a valid WASM Uint8Array', () => {
      const bytes = getWasmBytes();

      // Verify return type
      expect(bytes).toBeInstanceOf(Uint8Array);

      // Verify length matches decoded base64 length
      const expectedLength = atob(WASM_BASE64).length;
      expect(bytes.length).toBe(expectedLength);

      // Verify it starts with the WASM magic header (\0asm)
      expect(bytes[0]).toBe(0x00);
      expect(bytes[1]).toBe(0x61);
      expect(bytes[2]).toBe(0x73);
      expect(bytes[3]).toBe(0x6d);

      // Verify WASM version is 1
      expect(bytes[4]).toBe(0x01);
      expect(bytes[5]).toBe(0x00);
      expect(bytes[6]).toBe(0x00);
      expect(bytes[7]).toBe(0x00);
    });

    it('should accurately convert characters to byte values', () => {
      // Mock atob to return a known short string for testing exact byte conversion
      const mockBinaryString = '\x00\xFF\x42\x0A';
      const mockAtob = vi.fn().mockReturnValue(mockBinaryString);
      vi.stubGlobal('atob', mockAtob);

      const bytes = getWasmBytes();

      // Verify atob was called with the constant
      expect(mockAtob).toHaveBeenCalledWith(WASM_BASE64);

      // Verify the conversion logic is correct
      expect(bytes.length).toBe(4);
      expect(bytes[0]).toBe(0x00);
      expect(bytes[1]).toBe(0xFF);
      expect(bytes[2]).toBe(0x42);
      expect(bytes[3]).toBe(0x0A);
    });
  });
});
