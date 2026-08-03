import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const mockGetPath = vi.fn();
vi.mock('electron', () => ({
	app: { getPath: (...args: any[]) => mockGetPath(...args) },
}));

vi.mock('ws', () => ({
	WebSocket: class {
		static OPEN = 1;
	},
}));

const mockGenerateKeyPair = vi.fn();
const mockEncryptFor = vi.fn();
const mockDecryptFrom = vi.fn();
vi.mock('../../../src/services/e2eCrypto', () => ({
	generateKeyPair: (...args: any[]) => mockGenerateKeyPair(...args),
	encryptFor: (...args: any[]) => mockEncryptFor(...args),
	decryptFrom: (...args: any[]) => mockDecryptFrom(...args),
}));

import { PeerDaemon } from '../daemon';
import { WebSocket } from 'ws';

function makeDaemon() {
	return new PeerDaemon({ server: 'http://localhost', token: 't', folders: [], allowDownloads: false });
}

describe('PeerDaemon E2E chat identity (regression: was never awaited, so it never worked)', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecamp-daemon-test-'));
		mockGetPath.mockReturnValue(tmpDir);
		mockGenerateKeyPair.mockReset();
		mockEncryptFor.mockReset();
		mockDecryptFrom.mockReset();
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('ensureKeyPair generates and persists a keypair to disk on first call', async () => {
		const pair = { publicKey: 'pub', secretKey: 'priv' };
		mockGenerateKeyPair.mockResolvedValue(pair);

		const daemon = makeDaemon();
		const result = await (daemon as any).ensureKeyPair();

		expect(result).toEqual(pair);
		expect(mockGenerateKeyPair).toHaveBeenCalledTimes(1);

		const stored = JSON.parse(fs.readFileSync(path.join(tmpDir, 'peer-chat-identity.json'), 'utf-8'));
		expect(stored).toEqual(pair);
	});

	test('ensureKeyPair reuses the persisted keypair across daemon instances (app restarts)', async () => {
		const pair = { publicKey: 'pub', secretKey: 'priv' };
		mockGenerateKeyPair.mockResolvedValue(pair);

		const first = makeDaemon();
		await (first as any).ensureKeyPair();
		expect(mockGenerateKeyPair).toHaveBeenCalledTimes(1);

		const second = makeDaemon();
		const result = await (second as any).ensureKeyPair();

		expect(result).toEqual(pair);
		expect(mockGenerateKeyPair).toHaveBeenCalledTimes(1); // not regenerated — loaded from disk
	});

	test('ensureKeyPair called concurrently only generates once', async () => {
		mockGenerateKeyPair.mockResolvedValue({ publicKey: 'pub', secretKey: 'priv' });
		const daemon = makeDaemon();

		const [a, b] = await Promise.all([(daemon as any).ensureKeyPair(), (daemon as any).ensureKeyPair()]);

		expect(a).toBe(b);
		expect(mockGenerateKeyPair).toHaveBeenCalledTimes(1);
	});

	test('sendChat awaits keypair derivation and real ciphertext before sending', async () => {
		mockGenerateKeyPair.mockResolvedValue({ publicKey: 'pub', secretKey: 'mysecret' });
		mockEncryptFor.mockResolvedValue('real-ciphertext');

		const daemon = makeDaemon();
		(daemon as any).peerPublicKeys.set('bob', 'bobpub');
		const send = vi.fn();
		(daemon as any).ws = { readyState: WebSocket.OPEN, send };

		const result = await daemon.sendChat('bob', 'hello');

		expect(result).toEqual({ success: true, e2e: true });
		expect(mockEncryptFor).toHaveBeenCalledWith('hello', 'bobpub', 'mysecret');

		const sentMessage = JSON.parse(send.mock.calls[0][0]);
		expect(sentMessage.text).toBe('real-ciphertext');
	});

	test('sendChat sends plaintext when no pubkey has been exchanged yet for the peer', async () => {
		mockGenerateKeyPair.mockResolvedValue({ publicKey: 'pub', secretKey: 'mysecret' });

		const daemon = makeDaemon();
		const send = vi.fn();
		(daemon as any).ws = { readyState: WebSocket.OPEN, send };

		const result = await daemon.sendChat('unknown-peer', 'hello');

		expect(result).toEqual({ success: true, e2e: false });
		expect(mockEncryptFor).not.toHaveBeenCalled();

		const sentMessage = JSON.parse(send.mock.calls[0][0]);
		expect(sentMessage.text).toBe('hello');
	});
});
