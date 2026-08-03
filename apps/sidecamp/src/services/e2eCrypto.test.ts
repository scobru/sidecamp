// @vitest-environment node
// ponytail: real ZEN crypto needs WebCrypto subtle (native in node) and loads
// crypto.wasm via fs.readFile with a file:// URL. jsdom lacks subtle and Vite's
// inlined transform corrupts the wasm path, so run this in node env — same as
// tunecamp-chat's passing suite.
import { describe, it, expect } from "vitest";
import { generateKeyPair, encryptFor, decryptFrom } from "./e2eCrypto";

describe("e2eCrypto", () => {
	it("generateKeyPair returns a ZEN key pair", async () => {
		const kp = await generateKeyPair();
		expect(kp.pub).toBeTruthy();
		expect(kp.priv).toBeTruthy();
	});

	it("round-trips a message between two key pairs", async () => {
		const alice = await generateKeyPair();
		const bob = await generateKeyPair();

		const cipher = await encryptFor("hello bob", bob.pub, alice);
		const plain = await decryptFrom(cipher, alice.pub, bob);

		expect(plain).toBe("hello bob");
	});

	it("returns null when decrypting with the wrong key pair", async () => {
		const alice = await generateKeyPair();
		const bob = await generateKeyPair();
		const mallory = await generateKeyPair();

		const cipher = await encryptFor("hello bob", bob.pub, alice);
		const plain = await decryptFrom(cipher, alice.pub, mallory);

		expect(plain).toBeNull();
	});

	it("returns null when the ciphertext has been tampered with", async () => {
		const alice = await generateKeyPair();
		const bob = await generateKeyPair();

		const cipher = await encryptFor("hello bob", bob.pub, alice);
		const tampered =
			cipher.slice(0, -4) + (cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA");

		expect(await decryptFrom(tampered, alice.pub, bob)).toBeNull();
	});
});
