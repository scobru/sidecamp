import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import { i as t, n, r } from "./lib-_6OEUs1_.js";
import { t as i } from "./src-DFEHZHzb.js";
import { E as a, O as o, S as s, g as c, i as l, k as u, o as d, r as f, t as p, v as m } from "./BasicParser-Ds__TCD-.js";
import { i as h, t as g } from "./Util-CA2PSMPD.js";
//#region node_modules/strtok3/lib/stream/AbstractStreamReader.js
var _ = class {
	constructor() {
		this.endOfStream = !1, this.interrupted = !1, this.peekQueue = [];
	}
	async peek(e, t = !1) {
		let n = await this.read(e, t);
		return this.peekQueue.push(e.subarray(0, n)), n;
	}
	async read(e, n = !1) {
		if (e.length === 0) return 0;
		let r = this.readFromPeekBuffer(e);
		if (this.endOfStream || (r += await this.readRemainderFromStream(e.subarray(r), n)), r === 0 && !n) throw new t();
		return r;
	}
	readFromPeekBuffer(e) {
		let t = e.length, n = 0;
		for (; this.peekQueue.length > 0 && t > 0;) {
			let r = this.peekQueue.pop();
			if (!r) throw Error("peekData should be defined");
			let i = Math.min(r.length, t);
			e.set(r.subarray(0, i), n), n += i, t -= i, i < r.length && this.peekQueue.push(r.subarray(i));
		}
		return n;
	}
	async readRemainderFromStream(e, n) {
		let i = 0;
		for (; i < e.length && !this.endOfStream;) {
			if (this.interrupted) throw new r();
			let t = await this.readFromStream(e.subarray(i), n);
			if (t === 0) break;
			i += t;
		}
		if (!n && i < e.length) throw new t();
		return i;
	}
}, v = class extends _ {
	constructor(e) {
		super(), this.reader = e;
	}
	async abort() {
		return this.close();
	}
	async close() {
		this.reader.releaseLock();
	}
}, y = class extends v {
	async readFromStream(e, t) {
		if (e.length === 0) return 0;
		let n = await this.reader.read(new Uint8Array(e.length), { min: t ? void 0 : e.length });
		return n.done && (this.endOfStream = n.done), n.value ? (e.set(n.value), n.value.length) : 0;
	}
}, b = class extends _ {
	constructor(e) {
		super(), this.reader = e, this.buffer = null;
	}
	writeChunk(e, t) {
		let n = Math.min(t.length, e.length);
		return e.set(t.subarray(0, n)), n < t.length ? this.buffer = t.subarray(n) : this.buffer = null, n;
	}
	async readFromStream(e, n) {
		if (e.length === 0) return 0;
		let r = 0;
		for (this.buffer && (r += this.writeChunk(e, this.buffer)); r < e.length && !this.endOfStream;) {
			let t = await this.reader.read();
			if (t.done) {
				this.endOfStream = !0;
				break;
			}
			t.value && (r += this.writeChunk(e.subarray(r), t.value));
		}
		if (!n && r === 0 && this.endOfStream) throw new t();
		return r;
	}
	abort() {
		return this.interrupted = !0, this.reader.cancel();
	}
	async close() {
		await this.abort(), this.reader.releaseLock();
	}
};
//#endregion
//#region node_modules/strtok3/lib/stream/WebStreamReaderFactory.js
function x(e) {
	try {
		let t = e.getReader({ mode: "byob" });
		return t instanceof ReadableStreamDefaultReader ? new b(t) : new y(t);
	} catch (t) {
		if (t instanceof TypeError) return new b(e.getReader());
		throw t;
	}
}
//#endregion
//#region node_modules/strtok3/lib/ReadStreamTokenizer.js
var S = 256e3, C = class extends n {
	constructor(e, t) {
		super(t), this.streamReader = e, this.fileInfo = t?.fileInfo ?? {};
	}
	async readBuffer(e, n) {
		let r = this.normalizeOptions(e, n), i = r.position - this.position;
		if (i > 0) return await this.ignore(i), this.readBuffer(e, n);
		if (i < 0) throw Error("`options.position` must be equal or greater than `tokenizer.position`");
		if (r.length === 0) return 0;
		let a = await this.streamReader.read(e.subarray(0, r.length), r.mayBeLess);
		if (this.position += a, (!n || !n.mayBeLess) && a < r.length) throw new t();
		return a;
	}
	async peekBuffer(e, n) {
		let r = this.normalizeOptions(e, n), i = 0;
		if (r.position) {
			let t = r.position - this.position;
			if (t > 0) {
				let n = new Uint8Array(r.length + t);
				return i = await this.peekBuffer(n, { mayBeLess: r.mayBeLess }), e.set(n.subarray(t)), i - t;
			}
			if (t < 0) throw Error("Cannot peek from a negative offset in a stream");
		}
		if (r.length > 0) {
			try {
				i = await this.streamReader.peek(e.subarray(0, r.length), r.mayBeLess);
			} catch (e) {
				if (n?.mayBeLess && e instanceof t) return 0;
				throw e;
			}
			if (!r.mayBeLess && i < r.length) throw new t();
		}
		return i;
	}
	async ignore(e) {
		if (e < 0) throw RangeError("ignore length must be ≥ 0 bytes");
		let t = Math.min(S, e), n = new Uint8Array(t), r = 0;
		for (; r < e;) {
			let i = e - r, a = await this.readBuffer(n, { length: Math.min(t, i) });
			if (a < 0) return a;
			r += a;
		}
		return r;
	}
	abort() {
		return this.streamReader.abort();
	}
	async close() {
		return this.streamReader.close();
	}
	supportsRandomAccess() {
		return !1;
	}
}, w = class extends n {
	constructor(e, t) {
		super(t), this.uint8Array = e, this.fileInfo = {
			...t?.fileInfo ?? {},
			size: e.length
		};
	}
	async readBuffer(e, t) {
		t?.position && (this.position = t.position);
		let n = await this.peekBuffer(e, t);
		return this.position += n, n;
	}
	async peekBuffer(e, n) {
		let r = this.normalizeOptions(e, n), i = Math.min(this.uint8Array.length - r.position, r.length);
		if (!r.mayBeLess && i < r.length) throw new t();
		return e.set(this.uint8Array.subarray(r.position, r.position + i)), i;
	}
	close() {
		return super.close();
	}
	supportsRandomAccess() {
		return !0;
	}
	setPosition(e) {
		this.position = e;
	}
}, T = class extends n {
	constructor(e, t) {
		super(t), this.blob = e, this.fileInfo = {
			...t?.fileInfo ?? {},
			size: e.size,
			mimeType: e.type
		};
	}
	async readBuffer(e, t) {
		t?.position && (this.position = t.position);
		let n = await this.peekBuffer(e, t);
		return this.position += n, n;
	}
	async peekBuffer(e, n) {
		let r = this.normalizeOptions(e, n), i = Math.min(this.blob.size - r.position, r.length);
		if (!r.mayBeLess && i < r.length) throw new t();
		let a = await this.blob.slice(r.position, r.position + i).arrayBuffer();
		return e.set(new Uint8Array(a)), i;
	}
	close() {
		return super.close();
	}
	supportsRandomAccess() {
		return !0;
	}
	setPosition(e) {
		this.position = e;
	}
};
//#endregion
//#region node_modules/strtok3/lib/core.js
function E(e, t) {
	let n = x(e), r = t ?? {}, i = r.onClose;
	return r.onClose = async () => {
		if (await n.close(), i) return i();
	}, new C(n, r);
}
function D(e, t) {
	return new w(e, t);
}
function O(e, t) {
	return new T(e, t);
}
//#endregion
//#region node_modules/music-metadata/lib/common/FourCC.js
var k = /* @__PURE__ */ e(i(), 1), A = /^[\x21-\x7e©][\x20-\x7e\x00()]{3}/, j = {
	len: 4,
	get: (e, t) => {
		let n = o(e.subarray(t, t + j.len), "latin1");
		if (!n.match(A)) throw new f(`FourCC contains invalid characters: ${g(n)} "${n}"`);
		return n;
	},
	put: (e, t, n) => {
		let r = u(n, "latin1");
		if (r.length !== 4) throw new l("Invalid length");
		return e.set(r, t), t + 4;
	}
}, M = {
	text_utf8: 0,
	binary: 1,
	external_info: 2,
	reserved: 3
}, N = {
	len: 52,
	get: (e, t) => ({
		ID: j.get(e, t),
		version: s.get(e, t + 4) / 1e3,
		descriptorBytes: s.get(e, t + 8),
		headerBytes: s.get(e, t + 12),
		seekTableBytes: s.get(e, t + 16),
		headerDataBytes: s.get(e, t + 20),
		apeFrameDataBytes: s.get(e, t + 24),
		apeFrameDataBytesHigh: s.get(e, t + 28),
		terminatingDataBytes: s.get(e, t + 32),
		fileMD5: new a(16).get(e, t + 36)
	})
}, P = {
	len: 24,
	get: (e, t) => ({
		compressionLevel: m.get(e, t),
		formatFlags: m.get(e, t + 2),
		blocksPerFrame: s.get(e, t + 4),
		finalFrameBlocks: s.get(e, t + 8),
		totalFrames: s.get(e, t + 12),
		bitsPerSample: m.get(e, t + 16),
		channel: m.get(e, t + 18),
		sampleRate: s.get(e, t + 20)
	})
}, F = {
	len: 32,
	get: (e, t) => ({
		ID: new c(8, "ascii").get(e, t),
		version: s.get(e, t + 8),
		size: s.get(e, t + 12),
		fields: s.get(e, t + 16),
		flags: L(s.get(e, t + 20))
	})
}, I = {
	len: 8,
	get: (e, t) => ({
		size: s.get(e, t),
		flags: L(s.get(e, t + 4))
	})
};
function L(e) {
	return {
		containsHeader: R(e, 31),
		containsFooter: R(e, 30),
		isHeader: R(e, 29),
		readOnly: R(e, 0),
		dataType: (e & 6) >> 1
	};
}
function R(e, t) {
	return (e & 1 << t) != 0;
}
//#endregion
//#region node_modules/music-metadata/lib/apev2/APEv2Parser.js
var z = (0, k.default)("music-metadata:parser:APEv2"), B = "APEv2", V = "APETAGEX", H = class extends d("APEv2") {};
function U(e, t, n) {
	return new W(e, t, n).tryParseApeHeader();
}
var W = class e extends p {
	constructor() {
		super(...arguments), this.ape = {};
	}
	static calculateDuration(e) {
		let t = e.totalFrames > 1 ? e.blocksPerFrame * (e.totalFrames - 1) : 0;
		return t += e.finalFrameBlocks, t / e.sampleRate;
	}
	static async findApeFooterOffset(e, t) {
		let n = new Uint8Array(F.len), r = e.position;
		if (t <= F.len) {
			z(`Offset is too small to read APE footer: offset=${t}`);
			return;
		}
		if (t > F.len) {
			await e.readBuffer(n, { position: t - F.len }), e.setPosition(r);
			let i = F.get(n, 0);
			if (i.ID === "APETAGEX") return i.flags.isHeader ? z(`APE Header found at offset=${t - F.len}`) : (z(`APE Footer found at offset=${t - F.len}`), t -= i.size), {
				footer: i,
				offset: t
			};
		}
	}
	static parseTagFooter(t, n, r) {
		let i = F.get(n, n.length - F.len);
		if (i.ID !== V) throw new H("Unexpected APEv2 Footer ID preamble value");
		return D(n), new e(t, D(n), r).parseTags(i);
	}
	async tryParseApeHeader() {
		if (this.tokenizer.fileInfo.size && this.tokenizer.fileInfo.size - this.tokenizer.position < F.len) {
			z("No APEv2 header found, end-of-file reached");
			return;
		}
		let t = await this.tokenizer.peekToken(F);
		if (t.ID === V) return await this.tokenizer.ignore(F.len), this.parseTags(t);
		if (z(`APEv2 header not found at offset=${this.tokenizer.position}`), this.tokenizer.fileInfo.size) {
			let t = this.tokenizer.fileInfo.size - this.tokenizer.position, n = new Uint8Array(t);
			return await this.tokenizer.readBuffer(n), e.parseTagFooter(this.metadata, n, this.options);
		}
	}
	async parse() {
		let e = await this.tokenizer.readToken(N);
		if (e.ID !== "MAC ") throw new H("Unexpected descriptor ID");
		this.ape.descriptor = e;
		let t = e.descriptorBytes - N.len, n = await (t > 0 ? this.parseDescriptorExpansion(t) : this.parseHeader());
		return this.metadata.setAudioOnly(), await this.tokenizer.ignore(n.forwardBytes), this.tryParseApeHeader();
	}
	async parseTags(e) {
		let t = /* @__PURE__ */ new Uint8Array(256), n = e.size - F.len;
		z(`Parse APE tags at offset=${this.tokenizer.position}, size=${n}`);
		for (let r = 0; r < e.fields; r++) {
			if (n < I.len) {
				this.metadata.addWarning(`APEv2 Tag-header: ${e.fields - r} items remaining, but no more tag data to read.`);
				break;
			}
			let i = await this.tokenizer.readToken(I);
			n -= I.len + i.size, await this.tokenizer.peekBuffer(t, { length: Math.min(t.length, n) });
			let a = h(t), s = await this.tokenizer.readToken(new c(a, "ascii"));
			switch (await this.tokenizer.ignore(1), n -= s.length + 1, i.flags.dataType) {
				case M.text_utf8: {
					let e = (await this.tokenizer.readToken(new c(i.size, "utf8"))).split(/\x00/g);
					await Promise.all(e.map((e) => this.metadata.addTag(B, s, e)));
					break;
				}
				case M.binary:
					if (this.options.skipCovers) await this.tokenizer.ignore(i.size);
					else {
						let e = new Uint8Array(i.size);
						await this.tokenizer.readBuffer(e), a = h(e);
						let t = o(e.subarray(0, a), "utf-8"), n = e.subarray(a + 1);
						await this.metadata.addTag(B, s, {
							description: t,
							data: n
						});
					}
					break;
				case M.external_info:
					z(`Ignore external info ${s}`), await this.tokenizer.ignore(i.size);
					break;
				case M.reserved:
					z(`Ignore external info ${s}`), this.metadata.addWarning(`APEv2 header declares a reserved datatype for "${s}"`), await this.tokenizer.ignore(i.size);
					break;
			}
		}
	}
	async parseDescriptorExpansion(e) {
		return await this.tokenizer.ignore(e), this.parseHeader();
	}
	async parseHeader() {
		let t = await this.tokenizer.readToken(P);
		if (this.metadata.setFormat("lossless", !0), this.metadata.setFormat("container", "Monkey's Audio"), this.metadata.setFormat("bitsPerSample", t.bitsPerSample), this.metadata.setFormat("sampleRate", t.sampleRate), this.metadata.setFormat("numberOfChannels", t.channel), this.metadata.setFormat("duration", e.calculateDuration(t)), !this.ape.descriptor) throw new H("Missing APE descriptor");
		return { forwardBytes: this.ape.descriptor.seekTableBytes + this.ape.descriptor.headerDataBytes + this.ape.descriptor.apeFrameDataBytes + this.ape.descriptor.terminatingDataBytes };
	}
};
//#endregion
export { O as a, j as i, H as n, D as o, U as r, E as s, W as t };
