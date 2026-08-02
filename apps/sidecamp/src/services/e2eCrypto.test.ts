import { describe, it, expect, vi } from 'vitest';
import { generateKeyPair, encryptFor, decryptFrom } from './e2eCrypto';

vi.mock('@tunecamp/chat', () => ({
	generateKeyPair: vi.fn().mockResolvedValue({ pub: 'pub', priv: 'priv', epub: 'epub', epriv: 'epriv' }),
	encryptFor: vi.fn().mockResolvedValue('cipher'),
	decryptFrom: vi.fn().mockResolvedValue('plain'),
}));

describe('e2eCrypto wrapper', () => {
  it('generateKeyPair maps pub/priv to publicKey/secretKey', async () => {
    const kp = await generateKeyPair();
    expect(kp.publicKey).toBe('pub');
    expect(kp.secretKey).toBe('priv');
  });

  it('encryptFor forwards args to chat encryptFor', async () => {
    const cipher = await encryptFor('hello', 'recipientPub', 'mySecret');
    expect(cipher).toBe('cipher');
  });

  it('decryptFrom forwards args to chat decryptFrom', async () => {
    const plain = await decryptFrom('cipher', 'senderPub', 'mySecret');
    expect(plain).toBe('plain');
  });
});