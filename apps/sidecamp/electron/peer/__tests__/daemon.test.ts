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

describe('PeerDaemon byte-range streaming', () => {
	let tmpDir: string;
	let filePath: string;
	const CONTENT = 'abcdefghij'; // 10 bytes, offsets easy to read in assertions

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecamp-range-test-'));
		mockGetPath.mockReturnValue(tmpDir);
		filePath = path.join(tmpDir, 'track.mp3');
		fs.writeFileSync(filePath, CONTENT);
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	// Drives handleRequest to completion, returning every message the daemon put
	// on the wire.
	function request(trackId: string, start?: number, end?: number): Promise<any[]> {
		const daemon = makeDaemon();
		(daemon as any).fileIndex.set('t1', { id: 't1', path: filePath, title: 'Track' });
		const sent: any[] = [];
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('daemon never finished the request')), 2000);
			(daemon as any).ws = {
				readyState: WebSocket.OPEN,
				send: (raw: string) => {
					const msg = JSON.parse(raw);
					sent.push(msg);
					if (msg.type === 'chunk_end' || msg.type === 'chunk_error') {
						clearTimeout(timer);
						resolve(sent);
					}
				},
			};
			(daemon as any).handleRequest('req-1', trackId, start, end);
		});
	}

	const body = (sent: any[]) =>
		Buffer.concat(sent.filter(m => m.type === 'chunk').map(m => Buffer.from(m.data, 'base64'))).toString();

	test('serves only the requested byte range and announces it with chunk_start', async () => {
		const sent = await request('t1', 2, 5);

		expect(sent[0]).toEqual({ type: 'chunk_start', requestId: 'req-1', start: 2, end: 5, totalSize: 10 });
		expect(body(sent)).toBe('cdef');
		expect(sent[sent.length - 1].type).toBe('chunk_end');
	});

	test('an open-ended range runs to the last byte', async () => {
		const sent = await request('t1', 7);

		expect(sent[0]).toMatchObject({ type: 'chunk_start', start: 7, end: 9, totalSize: 10 });
		expect(body(sent)).toBe('hij');
	});

	test('clamps a range that runs past the end of the file', async () => {
		const sent = await request('t1', 8, 99);

		expect(sent[0]).toMatchObject({ type: 'chunk_start', start: 8, end: 9 });
		expect(body(sent)).toBe('ij');
	});

	test('rejects a start beyond EOF instead of serving the wrong bytes', async () => {
		const sent = await request('t1', 50, 60);

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({ type: 'chunk_error', requestId: 'req-1', code: 'range_not_satisfiable' });
	});

	test('sends no chunk_start for an unranged request, so older instances see no unknown message', async () => {
		const sent = await request('t1');

		expect(sent.some(m => m.type === 'chunk_start')).toBe(false);
		expect(body(sent)).toBe(CONTENT);
	});

	test('reports a missing track as a plain error, not a range failure', async () => {
		const sent = await request('nope', 0, 1);

		expect(sent[0]).toMatchObject({ type: 'chunk_error', message: 'File non trovato' });
		expect(sent[0].code).toBeUndefined();
	});
});

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
