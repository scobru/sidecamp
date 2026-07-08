import { open as e } from "node:fs/promises";
//#region node_modules/strtok3/lib/stream/Errors.js
var t = "End-Of-Stream", n = class extends Error {
	constructor() {
		super(t), this.name = "EndOfStreamError";
	}
}, r = class extends Error {
	constructor(e = "The operation was aborted") {
		super(e), this.name = "AbortError";
	}
}, i = class {
	constructor(e) {
		this.numBuffer = /* @__PURE__ */ new Uint8Array(8), this.position = 0, this.onClose = e?.onClose, e?.abortSignal && e.abortSignal.addEventListener("abort", () => {
			this.abort();
		});
	}
	async readToken(e, t = this.position) {
		let r = new Uint8Array(e.len);
		if (await this.readBuffer(r, { position: t }) < e.len) throw new n();
		return e.get(r, 0);
	}
	async peekToken(e, t = this.position) {
		let r = new Uint8Array(e.len);
		if (await this.peekBuffer(r, { position: t }) < e.len) throw new n();
		return e.get(r, 0);
	}
	async readNumber(e) {
		if (await this.readBuffer(this.numBuffer, { length: e.len }) < e.len) throw new n();
		return e.get(this.numBuffer, 0);
	}
	async peekNumber(e) {
		if (await this.peekBuffer(this.numBuffer, { length: e.len }) < e.len) throw new n();
		return e.get(this.numBuffer, 0);
	}
	async ignore(e) {
		if (e < 0) throw RangeError("ignore length must be ≥ 0 bytes");
		if (this.fileInfo.size !== void 0) {
			let t = this.fileInfo.size - this.position;
			if (e > t) return this.position += t, t;
		}
		return this.position += e, e;
	}
	async close() {
		await this.abort(), await this.onClose?.();
	}
	normalizeOptions(e, t) {
		if (!this.supportsRandomAccess() && t && t.position !== void 0 && t.position < this.position) throw Error("`options.position` must be equal or greater than `tokenizer.position`");
		return {
			mayBeLess: !1,
			offset: 0,
			length: e.length,
			position: this.position,
			...t
		};
	}
	abort() {
		return Promise.resolve();
	}
}, a = class t extends i {
	static async fromFile(n) {
		let r = await e(n, "r"), i = await r.stat();
		return new t(r, { fileInfo: {
			path: n,
			size: i.size
		} });
	}
	constructor(e, t) {
		super(t), this.fileHandle = e, this.fileInfo = t.fileInfo;
	}
	async readBuffer(e, t) {
		let r = this.normalizeOptions(e, t);
		if (this.position = r.position, r.length === 0) return 0;
		let i = await this.fileHandle.read(e, 0, r.length, r.position);
		if (this.position += i.bytesRead, i.bytesRead < r.length && (!t || !t.mayBeLess)) throw new n();
		return i.bytesRead;
	}
	async peekBuffer(e, t) {
		let r = this.normalizeOptions(e, t), i = await this.fileHandle.read(e, 0, r.length, r.position);
		if (!r.mayBeLess && i.bytesRead < r.length) throw new n();
		return i.bytesRead;
	}
	async close() {
		return await this.fileHandle.close(), super.close();
	}
	setPosition(e) {
		this.position = e;
	}
	supportsRandomAccess() {
		return !0;
	}
}.fromFile;
//#endregion
export { n as i, i as n, r, a as t };
