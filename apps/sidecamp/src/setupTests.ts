import "@testing-library/jest-dom";

// ponytail: ZEN crypto needs WebCrypto (subtle). jsdom's globalThis.crypto
// is a non-writable getter, so redefine it via defineProperty before any
// module (including the inlined `zen`) is evaluated in the worker.
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
	value: webcrypto,
	writable: true,
	configurable: true,
});
