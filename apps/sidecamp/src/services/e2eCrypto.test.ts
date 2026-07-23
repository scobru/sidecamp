import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { decodeBase64 } from 'tweetnacl-util';
import { generateKeyPair, encryptFor, decryptFrom } from './e2eCrypto';

describe('e2eCrypto', () => {
  it('generateKeyPair returns valid base64 Curve25519 keys', () => {
    const kp = generateKeyPair();
    expect(decodeBase64(kp.publicKey).length).toBe(nacl.box.publicKeyLength);
    expect(decodeBase64(kp.secretKey).length).toBe(nacl.box.secretKeyLength);
  });

  it('round-trips a message between two key pairs', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();

    const cipher = encryptFor('hello bob', bob.publicKey, alice.secretKey);
    const plain = decryptFrom(cipher, alice.publicKey, bob.secretKey);

    expect(plain).toBe('hello bob');
  });

  it('returns null when decrypting with the wrong secret key', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const mallory = generateKeyPair();

    const cipher = encryptFor('hello bob', bob.publicKey, alice.secretKey);
    const plain = decryptFrom(cipher, alice.publicKey, mallory.secretKey);

    expect(plain).toBeNull();
  });

  it('returns null when the ciphertext has been tampered with', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();

    const cipher = encryptFor('hello bob', bob.publicKey, alice.secretKey);
    const tampered = cipher.slice(0, -4) + (cipher.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');

    expect(decryptFrom(tampered, alice.publicKey, bob.secretKey)).toBeNull();
  });

  it('uses a fresh nonce each call, so ciphertext differs for the same plaintext', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();

    const cipher1 = encryptFor('same message', bob.publicKey, alice.secretKey);
    const cipher2 = encryptFor('same message', bob.publicKey, alice.secretKey);

    expect(cipher1).not.toBe(cipher2);
    expect(decryptFrom(cipher1, alice.publicKey, bob.secretKey)).toBe('same message');
    expect(decryptFrom(cipher2, alice.publicKey, bob.secretKey)).toBe('same message');
  });
});
