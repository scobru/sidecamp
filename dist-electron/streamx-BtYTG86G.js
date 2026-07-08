import { i as e, t } from "./rolldown-runtime-C6GIJ8is.js";
//#region node_modules/events-universal/default.js
var n = /* @__PURE__ */ t(((t, n) => {
	n.exports = e("events");
})), r = /* @__PURE__ */ t(((e, t) => {
	t.exports = class {
		constructor(e) {
			if (!(e > 0) || e - 1 & e) throw Error("Max size for a FixedFIFO should be a power of two");
			this.buffer = Array(e), this.mask = e - 1, this.top = 0, this.btm = 0, this.next = null;
		}
		clear() {
			this.top = this.btm = 0, this.next = null, this.buffer.fill(void 0);
		}
		push(e) {
			return this.buffer[this.top] === void 0 ? (this.buffer[this.top] = e, this.top = this.top + 1 & this.mask, !0) : !1;
		}
		shift() {
			let e = this.buffer[this.btm];
			if (e !== void 0) return this.buffer[this.btm] = void 0, this.btm = this.btm + 1 & this.mask, e;
		}
		peek() {
			return this.buffer[this.btm];
		}
		isEmpty() {
			return this.buffer[this.btm] === void 0;
		}
	};
})), i = /* @__PURE__ */ t(((e, t) => {
	var n = r();
	t.exports = class {
		constructor(e) {
			this.hwm = e || 16, this.head = new n(this.hwm), this.tail = this.head, this.length = 0;
		}
		clear() {
			this.head = this.tail, this.head.clear(), this.length = 0;
		}
		push(e) {
			if (this.length++, !this.head.push(e)) {
				let t = this.head;
				this.head = t.next = new n(2 * this.head.buffer.length), this.head.push(e);
			}
		}
		shift() {
			this.length !== 0 && this.length--;
			let e = this.tail.shift();
			if (e === void 0 && this.tail.next) {
				let e = this.tail.next;
				return this.tail.next = null, this.tail = e, this.tail.shift();
			}
			return e;
		}
		peek() {
			let e = this.tail.peek();
			return e === void 0 && this.tail.next ? this.tail.next.peek() : e;
		}
		isEmpty() {
			return this.length === 0;
		}
	};
})), a = /* @__PURE__ */ t(((e, t) => {
	function n(e) {
		return Buffer.isBuffer(e) || e instanceof Uint8Array;
	}
	function r(e) {
		return Buffer.isEncoding(e);
	}
	function i(e, t, n) {
		return Buffer.alloc(e, t, n);
	}
	function a(e) {
		return Buffer.allocUnsafe(e);
	}
	function o(e) {
		return Buffer.allocUnsafeSlow(e);
	}
	function s(e, t) {
		return Buffer.byteLength(e, t);
	}
	function c(e, t) {
		return Buffer.compare(e, t);
	}
	function l(e, t) {
		return Buffer.concat(e, t);
	}
	function u(e, t, n, r, i) {
		return b(e).copy(t, n, r, i);
	}
	function d(e, t) {
		return b(e).equals(t);
	}
	function f(e, t, n, r, i) {
		return b(e).fill(t, n, r, i);
	}
	function p(e, t, n) {
		return Buffer.from(e, t, n);
	}
	function m(e, t, n, r) {
		return b(e).includes(t, n, r);
	}
	function h(e, t, n, r) {
		return b(e).indexOf(t, n, r);
	}
	function g(e, t, n, r) {
		return b(e).lastIndexOf(t, n, r);
	}
	function _(e) {
		return b(e).swap16();
	}
	function v(e) {
		return b(e).swap32();
	}
	function y(e) {
		return b(e).swap64();
	}
	function b(e) {
		return Buffer.isBuffer(e) ? e : Buffer.from(e.buffer, e.byteOffset, e.byteLength);
	}
	function x(e, t, n, r) {
		return b(e).toString(t, n, r);
	}
	function S(e, t, n, r, i) {
		return b(e).write(t, n, r, i);
	}
	function C(e, t) {
		return b(e).readDoubleBE(t);
	}
	function w(e, t) {
		return b(e).readDoubleLE(t);
	}
	function ee(e, t) {
		return b(e).readFloatBE(t);
	}
	function T(e, t) {
		return b(e).readFloatLE(t);
	}
	function E(e, t) {
		return b(e).readInt32BE(t);
	}
	function D(e, t) {
		return b(e).readInt32LE(t);
	}
	function O(e, t) {
		return b(e).readUInt32BE(t);
	}
	function k(e, t) {
		return b(e).readUInt32LE(t);
	}
	function A(e, t, n) {
		return b(e).writeDoubleBE(t, n);
	}
	function te(e, t, n) {
		return b(e).writeDoubleLE(t, n);
	}
	function ne(e, t, n) {
		return b(e).writeFloatBE(t, n);
	}
	function re(e, t, n) {
		return b(e).writeFloatLE(t, n);
	}
	function ie(e, t, n) {
		return b(e).writeInt32BE(t, n);
	}
	function j(e, t, n) {
		return b(e).writeInt32LE(t, n);
	}
	function ae(e, t, n) {
		return b(e).writeUInt32BE(t, n);
	}
	function oe(e, t, n) {
		return b(e).writeUInt32LE(t, n);
	}
	t.exports = {
		isBuffer: n,
		isEncoding: r,
		alloc: i,
		allocUnsafe: a,
		allocUnsafeSlow: o,
		byteLength: s,
		compare: c,
		concat: l,
		copy: u,
		equals: d,
		fill: f,
		from: p,
		includes: m,
		indexOf: h,
		lastIndexOf: g,
		swap16: _,
		swap32: v,
		swap64: y,
		toBuffer: b,
		toString: x,
		write: S,
		readDoubleBE: C,
		readDoubleLE: w,
		readFloatBE: ee,
		readFloatLE: T,
		readInt32BE: E,
		readInt32LE: D,
		readUInt32BE: O,
		readUInt32LE: k,
		writeDoubleBE: A,
		writeDoubleLE: te,
		writeFloatBE: ne,
		writeFloatLE: re,
		writeInt32BE: ie,
		writeInt32LE: j,
		writeUInt32BE: ae,
		writeUInt32LE: oe
	};
})), o = /* @__PURE__ */ t(((e, t) => {
	var n = a();
	t.exports = class {
		constructor(e) {
			this.encoding = e;
		}
		get remaining() {
			return 0;
		}
		decode(e) {
			return n.toString(e, this.encoding);
		}
		flush() {
			return "";
		}
	};
})), s = /* @__PURE__ */ t(((e, t) => {
	var n = a();
	t.exports = class {
		constructor() {
			this._reset();
		}
		get remaining() {
			return this.bytesSeen;
		}
		decode(e) {
			if (e.byteLength === 0) return "";
			if (this.bytesNeeded === 0 && r(e, 0) === 0) return this.bytesSeen = i(e), n.toString(e, "utf8");
			let t = "", a = 0;
			if (this.bytesNeeded > 0) {
				for (; a < e.byteLength;) {
					let n = e[a];
					if (n < this.lowerBoundary || n > this.upperBoundary) {
						t += "�", this._reset();
						break;
					}
					if (this.lowerBoundary = 128, this.upperBoundary = 191, this.codePoint = this.codePoint << 6 | n & 63, this.bytesSeen++, a++, this.bytesSeen === this.bytesNeeded) {
						t += String.fromCodePoint(this.codePoint), this._reset();
						break;
					}
				}
				if (this.bytesNeeded > 0) return t;
			}
			let o = r(e, a), s = e.byteLength - o;
			s > a && (t += n.toString(e, "utf8", a, s));
			for (let n = s; n < e.byteLength; n++) {
				let r = e[n];
				if (this.bytesNeeded === 0) {
					r <= 127 ? (this.bytesSeen = 0, t += String.fromCharCode(r)) : r >= 194 && r <= 223 ? (this.bytesNeeded = 2, this.bytesSeen = 1, this.codePoint = r & 31) : r >= 224 && r <= 239 ? (r === 224 ? this.lowerBoundary = 160 : r === 237 && (this.upperBoundary = 159), this.bytesNeeded = 3, this.bytesSeen = 1, this.codePoint = r & 15) : r >= 240 && r <= 244 ? (r === 240 ? this.lowerBoundary = 144 : r === 244 && (this.upperBoundary = 143), this.bytesNeeded = 4, this.bytesSeen = 1, this.codePoint = r & 7) : (this.bytesSeen = 1, t += "�");
					continue;
				}
				if (r < this.lowerBoundary || r > this.upperBoundary) {
					t += "�", n--, this._reset();
					continue;
				}
				this.lowerBoundary = 128, this.upperBoundary = 191, this.codePoint = this.codePoint << 6 | r & 63, this.bytesSeen++, this.bytesSeen === this.bytesNeeded && (t += String.fromCodePoint(this.codePoint), this._reset());
			}
			return t;
		}
		flush() {
			let e = this.bytesNeeded > 0 ? "�" : "";
			return this._reset(), e;
		}
		_reset() {
			this.codePoint = 0, this.bytesNeeded = 0, this.bytesSeen = 0, this.lowerBoundary = 128, this.upperBoundary = 191;
		}
	};
	function r(e, t) {
		let n = e.byteLength;
		if (n <= t) return 0;
		let r = Math.max(t, n - 4), i = n - 1;
		for (; i > r && (e[i] & 192) == 128;) i--;
		if (i < t) return 0;
		let a = e[i], o;
		if (a <= 127) return 0;
		if (a >= 194 && a <= 223) o = 2;
		else if (a >= 224 && a <= 239) o = 3;
		else if (a >= 240 && a <= 244) o = 4;
		else return 0;
		let s = n - i;
		return s < o ? s : 0;
	}
	function i(e) {
		let t = e.byteLength;
		if (t === 0) return 0;
		let n = e[t - 1];
		if (n <= 127) return 0;
		if ((n & 192) != 128) return 1;
		let r = Math.max(0, t - 4), i = t - 2;
		for (; i >= r && (e[i] & 192) == 128;) i--;
		if (i < 0) return 1;
		let a = e[i], o;
		if (a >= 194 && a <= 223) o = 2;
		else if (a >= 224 && a <= 239) o = 3;
		else if (a >= 240 && a <= 244) o = 4;
		else return 1;
		if (t - i !== o) return 1;
		if (o >= 3) {
			let t = e[i + 1];
			if (a === 224 && t < 160 || a === 237 && t > 159 || a === 240 && t < 144 || a === 244 && t > 143) return 1;
		}
		return 0;
	}
})), c = /* @__PURE__ */ t(((e, t) => {
	var n = o(), r = s();
	t.exports = class {
		constructor(e = "utf8") {
			switch (this.encoding = i(e), this.encoding) {
				case "utf8":
					this.decoder = new r();
					break;
				case "utf16le":
				case "base64": throw Error("Unsupported encoding: " + this.encoding);
				default: this.decoder = new n(this.encoding);
			}
		}
		get remaining() {
			return this.decoder.remaining;
		}
		push(e) {
			return typeof e == "string" ? e : this.decoder.decode(e);
		}
		write(e) {
			return this.push(e);
		}
		end(e) {
			let t = "";
			return e && (t = this.push(e)), t += this.decoder.flush(), t;
		}
	};
	function i(e) {
		switch (e = e.toLowerCase(), e) {
			case "utf8":
			case "utf-8": return "utf8";
			case "ucs2":
			case "ucs-2":
			case "utf16le":
			case "utf-16le": return "utf16le";
			case "latin1":
			case "binary": return "latin1";
			case "base64":
			case "ascii":
			case "hex": return e;
			default: throw Error("Unknown encoding: " + e);
		}
	}
})), l = /* @__PURE__ */ t(((e, t) => {
	t.exports = class e extends Error {
		constructor(t, n, r = e) {
			super(t), this.code = n, Error.captureStackTrace && Error.captureStackTrace(this, r);
		}
		static isStreamDestroyed(e) {
			return e && e.code === "STREAM_DESTROYED";
		}
		static isPrematureClose(e) {
			return e && e.code === "PREMATURE_CLOSE";
		}
		static isAborted(e) {
			return e && e.code === "ABORTED";
		}
		static isBadArgument(e) {
			return e && e.code === "BAD_ARGUMENT";
		}
		get name() {
			return "StreamError";
		}
		static STREAM_DESTROYED() {
			return new e("Stream was destroyed", "STREAM_DESTROYED", e.STREAM_DESTROYED);
		}
		static PREMATURE_CLOSE(t = "Premature close") {
			return new e(t, "PREMATURE_CLOSE", e.PREMATURE_CLOSE);
		}
		static ABORTED() {
			return new e("Stream aborted", "ABORTED", e.ABORTED);
		}
		static BAD_ARGUMENT(t = "Bad argument") {
			return new e(t, "BAD_ARGUMENT", e.BAD_ARGUMENT);
		}
	};
})), u = /* @__PURE__ */ t(((e, t) => {
	var { EventEmitter: r } = n(), a = i(), o = c(), s = l(), u = typeof queueMicrotask > "u" ? (e) => global.process.nextTick(e) : queueMicrotask, d = 1, f = 2, p = 4, m = 8, h = 536870910, g = 536870909, _ = 32, v = 64, y = 128, b = 256, x = 512, S = 1024, C = 2048, w = 4096, ee = 8192, T = 16384, E = 32768, D = 131072, O = 768, k = 65552, A = 80, te = 4224, ne = 131328, re = 536870895, ie = 536805311, j = 536805375, ae = 536870655, oe = 536862591, se = 536869887, ce = 536870143, le = 536838143, ue = 536870879, M = 536739839, de = 536739583, fe = 1 << 18, N = 2 << 18, P = 4 << 18, F = 8 << 18, pe = 16 << 18, I = 32 << 18, L = 64 << 18, R = 128 << 18, me = 256 << 18, z = 512 << 18, B = 1024 << 18, he = 469499903, ge = 535822335, _e = 402391039, ve = 532676607, ye = 534773759, V = 503316479, be = 536346623, H = 268435455, U = 262160, xe = 536608751, W = 8404992, G = 14, Se = 15, Ce = 8405006, we = 535822271, K = 33587200, q = 33587215, Te = 17423, Ee = 16527, De = 1167, Oe = 12431, ke = 214047, Ae = 17422, je = 32879, Me = 32769, Ne = 142606351, Pe = 6291456, Fe = 2359296, Ie = 6553615, Le = 270794767, Re = 1310720, ze = 67371008, Be = 144965647, Ve = 146800654, He = 35127311, Ue = 142606350, J = Symbol.asyncIterator || Symbol("asyncIterator"), We = class {
		constructor(e, { highWaterMark: t = 16384, map: n = null, mapWritable: r, byteLength: i, byteLengthWritable: o } = {}) {
			this.stream = e, this.queue = new a(), this.highWaterMark = t, this.buffered = 0, this.error = null, this.pipeline = null, this.drains = null, this.byteLength = o || i || xt, this.map = r || n, this.afterWrite = Ze.bind(this), this.afterUpdateNextTick = et.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & z) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & I) !== 0;
		}
		push(e) {
			return (this.stream._duplexState & Ue) === 0 ? (this.map !== null && (e = this.map(e)), this.buffered += this.byteLength(e), this.queue.push(e), this.buffered < this.highWaterMark ? (this.stream._duplexState |= F, !0) : (this.stream._duplexState |= Pe, !1)) : !1;
		}
		shift() {
			let e = this.queue.shift();
			return this.buffered -= this.byteLength(e), this.buffered === 0 && (this.stream._duplexState &= ye), e;
		}
		end(e) {
			typeof e == "function" ? this.stream.once("finish", e) : e != null && this.push(e), this.stream._duplexState = (this.stream._duplexState | z) & ge;
		}
		autoBatch(e, t) {
			let n = [], r = this.stream;
			for (n.push(e); (r._duplexState & Le) === Fe;) n.push(r._writableState.shift());
			if ((r._duplexState & Se) !== 0) return t(null);
			r._writev(n, t);
		}
		update() {
			let e = this.stream;
			e._duplexState |= N;
			do {
				for (; (e._duplexState & Le) === F;) {
					let t = this.shift();
					e._duplexState |= ze, e._write(t, this.afterWrite);
				}
				(e._duplexState & Re) === 0 && this.updateNonPrimary();
			} while (this.continueUpdate() === !0);
			e._duplexState &= be;
		}
		updateNonPrimary() {
			let e = this.stream;
			if ((e._duplexState & Be) === z) {
				e._duplexState |= fe, e._final(Ye.bind(this));
				return;
			}
			if ((e._duplexState & G) === p) {
				(e._duplexState & K) === 0 && (e._duplexState |= U, e._destroy(Xe.bind(this)));
				return;
			}
			(e._duplexState & q) === d && (e._duplexState = (e._duplexState | U) & h, e._open(nt.bind(this)));
		}
		continueUpdate() {
			return (this.stream._duplexState & R) === 0 ? !1 : (this.stream._duplexState &= V, !0);
		}
		updateCallback() {
			(this.stream._duplexState & He) === P ? this.update() : this.updateNextTick();
		}
		updateNextTick() {
			(this.stream._duplexState & R) === 0 && (this.stream._duplexState |= R, (this.stream._duplexState & N) === 0 && u(this.afterUpdateNextTick));
		}
	}, Ge = class {
		constructor(e, { highWaterMark: t = 16384, map: n = null, mapReadable: r, byteLength: i, byteLengthReadable: o } = {}) {
			this.stream = e, this.queue = new a(), this.highWaterMark = t === 0 ? 1 : t, this.buffered = 0, this.readAhead = t > 0, this.error = null, this.pipeline = null, this.byteLength = o || i || xt, this.map = r || n, this.pipeTo = null, this.afterRead = Qe.bind(this), this.afterUpdateNextTick = $e.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & S) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & T) !== 0;
		}
		pipe(e, t) {
			if (this.pipeTo !== null) throw s.BAD_ARGUMENT("Can only pipe to one destination");
			if (typeof t != "function" && (t = null), this.stream._duplexState |= x, this.pipeTo = e, this.pipeline = new qe(this.stream, e, t), t && this.stream.on("error", $), Q(e)) e._writableState.pipeline = this.pipeline, t && e.on("error", $), e.on("finish", this.pipeline.finished.bind(this.pipeline));
			else {
				let t = this.pipeline.done.bind(this.pipeline, e), n = this.pipeline.done.bind(this.pipeline, e, null);
				e.on("error", t), e.on("close", n), e.on("finish", this.pipeline.finished.bind(this.pipeline));
			}
			e.on("drain", Je.bind(this)), this.stream.emit("piping", e), e.emit("pipe", this.stream);
		}
		push(e) {
			let t = this.stream;
			return e === null ? (this.highWaterMark = 0, t._duplexState = (t._duplexState | S) & ie, !1) : this.map !== null && (e = this.map(e), e === null) ? (t._duplexState &= j, this.buffered < this.highWaterMark) : (this.buffered += this.byteLength(e), this.queue.push(e), t._duplexState = (t._duplexState | y) & j, this.buffered < this.highWaterMark);
		}
		shift() {
			let e = this.queue.shift();
			return this.buffered -= this.byteLength(e), this.buffered === 0 && (this.stream._duplexState &= oe), e;
		}
		unshift(e) {
			let t = [this.map === null ? e : this.map(e)];
			for (; this.buffered > 0;) t.push(this.shift());
			for (let e = 0; e < t.length - 1; e++) {
				let n = t[e];
				this.buffered += this.byteLength(n), this.queue.push(n);
			}
			this.push(t[t.length - 1]);
		}
		read() {
			let e = this.stream;
			if ((e._duplexState & Ee) === y) {
				let t = this.shift();
				return this.pipeTo !== null && this.pipeTo.write(t) === !1 && (e._duplexState &= ce), (e._duplexState & C) !== 0 && e.emit("data", t), t;
			}
			return this.readAhead === !1 && (e._duplexState |= D, this.updateNextTick()), null;
		}
		drain() {
			let e = this.stream;
			for (; (e._duplexState & Ee) === y && (e._duplexState & O) !== 0;) {
				let t = this.shift();
				this.pipeTo !== null && this.pipeTo.write(t) === !1 && (e._duplexState &= ce), (e._duplexState & C) !== 0 && e.emit("data", t);
			}
		}
		update() {
			let e = this.stream;
			e._duplexState |= _;
			do {
				for (this.drain(); this.buffered < this.highWaterMark && (e._duplexState & ke) === D;) e._duplexState |= k, e._read(this.afterRead), this.drain();
				(e._duplexState & Oe) === te && (e._duplexState |= ee, e.emit("readable")), (e._duplexState & A) === 0 && this.updateNonPrimary();
			} while (this.continueUpdate() === !0);
			e._duplexState &= ue;
		}
		updateNonPrimary() {
			let e = this.stream;
			if ((e._duplexState & De) === S && (e._duplexState = (e._duplexState | T) & se, e.emit("end"), (e._duplexState & Ce) === W && (e._duplexState |= p), this.pipeTo !== null && this.pipeTo.end()), (e._duplexState & G) === p) {
				(e._duplexState & K) === 0 && (e._duplexState |= U, e._destroy(Xe.bind(this)));
				return;
			}
			(e._duplexState & q) === d && (e._duplexState = (e._duplexState | U) & h, e._open(nt.bind(this)));
		}
		continueUpdate() {
			return (this.stream._duplexState & E) === 0 ? !1 : (this.stream._duplexState &= le, !0);
		}
		updateCallback() {
			(this.stream._duplexState & je) === v ? this.update() : this.updateNextTick();
		}
		updateNextTickIfOpen() {
			(this.stream._duplexState & Me) === 0 && (this.stream._duplexState |= E, (this.stream._duplexState & _) === 0 && u(this.afterUpdateNextTick));
		}
		updateNextTick() {
			(this.stream._duplexState & E) === 0 && (this.stream._duplexState |= E, (this.stream._duplexState & _) === 0 && u(this.afterUpdateNextTick));
		}
	}, Ke = class {
		constructor(e) {
			this.data = null, this.afterTransform = rt.bind(e), this.afterFinal = null;
		}
	}, qe = class {
		constructor(e, t, n) {
			this.from = e, this.to = t, this.afterPipe = n, this.error = null, this.pipeToFinished = !1;
		}
		finished() {
			this.pipeToFinished = !0;
		}
		done(e, t) {
			if (t && (this.error = t), e === this.to && (this.to = null, this.from !== null)) {
				((this.from._duplexState & T) === 0 || !this.pipeToFinished) && this.from.destroy(this.error || s.PREMATURE_CLOSE("Writable stream closed"));
				return;
			}
			if (e === this.from && (this.from = null, this.to !== null)) {
				(e._duplexState & T) === 0 && this.to.destroy(this.error || s.PREMATURE_CLOSE("Readable stream closed"));
				return;
			}
			this.afterPipe !== null && this.afterPipe(this.error), this.to = this.from = this.afterPipe = null;
		}
	};
	function Je() {
		this.stream._duplexState |= x, this.updateCallback();
	}
	function Ye(e) {
		let t = this.stream;
		e && t.destroy(e), (t._duplexState & G) === 0 && (t._duplexState |= I, t.emit("finish")), (t._duplexState & Ce) === W && (t._duplexState |= p), t._duplexState &= _e, (t._duplexState & N) === 0 ? this.update() : this.updateNextTick();
	}
	function Xe(e) {
		let t = this.stream;
		!e && !s.isStreamDestroyed(this.error) && (e = this.error), e && t.emit("error", e), t._duplexState |= m, t.emit("close");
		let n = t._readableState, r = t._writableState;
		if (n !== null && n.pipeline !== null && n.pipeline.done(t, e), r !== null) {
			for (; r.drains !== null && r.drains.length > 0;) r.drains.shift().resolve(!1);
			r.pipeline !== null && r.pipeline.done(t, e);
		}
	}
	function Ze(e) {
		let t = this.stream;
		e && t.destroy(e), t._duplexState &= he, this.drains !== null && tt(this.drains), (t._duplexState & Ie) === pe && (t._duplexState &= ve, (t._duplexState & L) === L && t.emit("drain")), this.updateCallback();
	}
	function Qe(e) {
		e && this.stream.destroy(e), this.stream._duplexState &= re, this.readAhead === !1 && (this.stream._duplexState & b) === 0 && (this.stream._duplexState &= M), this.updateCallback();
	}
	function $e() {
		(this.stream._duplexState & _) === 0 && (this.stream._duplexState &= le, this.update());
	}
	function et() {
		(this.stream._duplexState & N) === 0 && (this.stream._duplexState &= V, this.update());
	}
	function tt(e) {
		for (let t = 0; t < e.length; t++) --e[t].writes === 0 && (e.shift().resolve(!0), t--);
	}
	function nt(e) {
		let t = this.stream;
		e && t.destroy(e), (t._duplexState & p) === 0 && ((t._duplexState & Te) === 0 && (t._duplexState |= v), (t._duplexState & Ne) === 0 && (t._duplexState |= P), t.emit("open")), t._duplexState &= xe, t._writableState !== null && t._writableState.updateCallback(), t._readableState !== null && t._readableState.updateCallback();
	}
	function rt(e, t) {
		t != null && this.push(t), this._writableState.afterWrite(e);
	}
	function it(e) {
		this._readableState !== null && (e === "data" && (this._duplexState |= 133376, this._readableState.updateNextTick()), e === "readable" && (this._duplexState |= w, this._readableState.updateNextTick())), this._writableState !== null && e === "drain" && (this._duplexState |= L, this._writableState.updateNextTick());
	}
	var Y = class extends r {
		constructor(e) {
			super(), this._duplexState = 0, this._readableState = null, this._writableState = null, e && (e.open && (this._open = e.open), e.destroy && (this._destroy = e.destroy), e.predestroy && (this._predestroy = e.predestroy), e.signal && e.signal.addEventListener("abort", St.bind(this))), this.on("newListener", it);
		}
		_open(e) {
			e(null);
		}
		_destroy(e) {
			e(null);
		}
		_predestroy() {}
		get readable() {
			return this._readableState !== null || void 0;
		}
		get writable() {
			return this._writableState !== null || void 0;
		}
		get destroyed() {
			return (this._duplexState & m) !== 0;
		}
		get destroying() {
			return (this._duplexState & G) !== 0;
		}
		destroy(e) {
			(this._duplexState & G) === 0 && (e ||= s.STREAM_DESTROYED(), this._duplexState = (this._duplexState | p) & we, this._readableState !== null && (this._readableState.highWaterMark = 0, this._readableState.error = e), this._writableState !== null && (this._writableState.highWaterMark = 0, this._writableState.error = e), this._duplexState |= f, this._predestroy(), this._duplexState &= g, this._readableState !== null && this._readableState.updateNextTick(), this._writableState !== null && this._writableState.updateNextTick());
		}
	}, at = class e extends Y {
		constructor(e) {
			super(e), this._duplexState |= 8519681, this._readableState = new Ge(this, e), e && (this._readableState.readAhead === !1 && (this._duplexState &= M), e.read && (this._read = e.read), e.eagerOpen && this._readableState.updateNextTick(), e.encoding && this.setEncoding(e.encoding));
		}
		static deferred(e, t) {
			let n = new ct(t);
			return e().then((e) => {
				if (e === null) return n.end();
				n.destroying || Z(e, n, $);
			}).catch((e) => n.destroy(e)), n;
		}
		setEncoding(e) {
			let t = new o(e), n = this._readableState.map || dt;
			return this._readableState.map = r, this;
			function r(e) {
				let r = t.push(e);
				return r === "" && (e.byteLength !== 0 || t.remaining > 0) ? null : n(r);
			}
		}
		_read(e) {
			e(null);
		}
		pipe(e, t) {
			return this._readableState.updateNextTick(), this._readableState.pipe(e, t), e;
		}
		read() {
			return this._readableState.updateNextTick(), this._readableState.read();
		}
		push(e) {
			return this._readableState.updateNextTickIfOpen(), this._readableState.push(e);
		}
		unshift(e) {
			return this._readableState.updateNextTickIfOpen(), this._readableState.unshift(e);
		}
		resume() {
			return this._duplexState |= ne, this._readableState.updateNextTick(), this;
		}
		pause() {
			return this._duplexState &= this._readableState.readAhead === !1 ? de : ae, this;
		}
		static _fromAsyncIterator(t, n) {
			let r, i = new e({
				...n,
				read(e) {
					t.next().then(a).then(e.bind(null, null)).catch(e);
				},
				predestroy() {
					r = t.return();
				},
				destroy(e) {
					if (!r) return e(null);
					r.then(e.bind(null, null)).catch(e);
				}
			});
			return i;
			function a(e) {
				e.done ? i.push(null) : i.push(e.value);
			}
		}
		static from(t, n) {
			if (vt(t)) return t;
			if (t[J]) return this._fromAsyncIterator(t[J](), n);
			Array.isArray(t) || (t = t === void 0 ? [] : [t]);
			let r = 0;
			return new e({
				...n,
				read(e) {
					this.push(r === t.length ? null : t[r++]), e(null);
				}
			});
		}
		static isBackpressured(e) {
			return (e._duplexState & Ae) !== 0 || e._readableState.buffered >= e._readableState.highWaterMark;
		}
		static isPaused(e) {
			return (e._duplexState & b) === 0;
		}
		[J]() {
			let e = this, t = null, n = null, r = null;
			return this.on("error", (e) => {
				t = e;
			}), this.on("readable", i), this.on("close", a), {
				[J]() {
					return this;
				},
				next() {
					return new Promise(function(t, i) {
						n = t, r = i;
						let a = e.read();
						a === null ? (e._duplexState & m) !== 0 && o(null) : o(a);
					});
				},
				return() {
					return c(null);
				},
				throw(e) {
					return c(e);
				}
			};
			function i() {
				n !== null && o(e.read());
			}
			function a() {
				n !== null && o(null);
			}
			function o(i) {
				r !== null && (t ? r(t) : i === null && (e._duplexState & T) === 0 ? r(s.STREAM_DESTROYED()) : n({
					value: i,
					done: i === null
				}), r = n = null);
			}
			function c(t) {
				return e.destroy(t), new Promise((n, r) => {
					if (e._duplexState & m) return n({
						value: void 0,
						done: !0
					});
					e.once("close", function() {
						t ? r(t) : n({
							value: void 0,
							done: !0
						});
					});
				});
			}
		}
	}, ot = class extends Y {
		constructor(e) {
			super(e), this._duplexState |= 16385, this._writableState = new We(this, e), e && (e.writev && (this._writev = e.writev), e.write && (this._write = e.write), e.final && (this._final = e.final), e.eagerOpen && this._writableState.updateNextTick());
		}
		cork() {
			this._duplexState |= B;
		}
		uncork() {
			this._duplexState &= H, this._writableState.updateNextTick();
		}
		_writev(e, t) {
			t(null);
		}
		_write(e, t) {
			this._writableState.autoBatch(e, t);
		}
		_final(e) {
			e(null);
		}
		static isBackpressured(e) {
			return (e._duplexState & Ve) !== 0;
		}
		static drained(e) {
			if (e.destroyed) return Promise.resolve(!1);
			let t = e._writableState, n = (Ct(e) ? Math.min(1, t.queue.length) : t.queue.length) + (e._duplexState & me ? 1 : 0);
			return n === 0 ? Promise.resolve(!0) : (t.drains === null && (t.drains = []), new Promise((e) => {
				t.drains.push({
					writes: n,
					resolve: e
				});
			}));
		}
		write(e) {
			return this._writableState.updateNextTick(), this._writableState.push(e);
		}
		end(e) {
			return this._writableState.updateNextTick(), this._writableState.end(e), this;
		}
	}, X = class extends at {
		constructor(e) {
			super(e), this._duplexState = d | this._duplexState & D, this._writableState = new We(this, e), e && (e.writev && (this._writev = e.writev), e.write && (this._write = e.write), e.final && (this._final = e.final));
		}
		cork() {
			this._duplexState |= B;
		}
		uncork() {
			this._duplexState &= H, this._writableState.updateNextTick();
		}
		_writev(e, t) {
			t(null);
		}
		_write(e, t) {
			this._writableState.autoBatch(e, t);
		}
		_final(e) {
			e(null);
		}
		write(e) {
			return this._writableState.updateNextTick(), this._writableState.push(e);
		}
		end(e) {
			return this._writableState.updateNextTick(), this._writableState.end(e), this;
		}
	}, st = class extends X {
		constructor(e) {
			super(e), this._transformState = new Ke(this), e && (e.transform && (this._transform = e.transform), e.flush && (this._flush = e.flush));
		}
		_write(e, t) {
			this._readableState.buffered >= this._readableState.highWaterMark ? this._transformState.data = e : this._transform(e, this._transformState.afterTransform);
		}
		_read(e) {
			if (this._transformState.data !== null) {
				let t = this._transformState.data;
				this._transformState.data = null, e(null), this._transform(t, this._transformState.afterTransform);
			} else e(null);
		}
		destroy(e) {
			super.destroy(e), this._transformState.data !== null && (this._transformState.data = null, this._transformState.afterTransform());
		}
		_transform(e, t) {
			t(null, e);
		}
		_flush(e) {
			e(null);
		}
		_final(e) {
			this._transformState.afterFinal = e, this._flush(lt.bind(this));
		}
	}, ct = class extends st {};
	function lt(e, t) {
		let n = this._transformState.afterFinal;
		if (e) return n(e);
		t != null && this.push(t), this.push(null), n(null);
	}
	function ut(...e) {
		return new Promise((t, n) => Z(...e, (e) => {
			if (e) return n(e);
			t();
		}));
	}
	function Z(e, ...t) {
		let n = Array.isArray(e) ? [...e, ...t] : [e, ...t], r = n.length && typeof n[n.length - 1] == "function" ? n.pop() : null;
		if (n.length < 2) throw s.BAD_ARGUMENT("Pipeline requires at least 2 streams");
		let i = n[0], a = null, o = null;
		for (let e = 1; e < n.length; e++) a = n[e], Q(i) ? i.pipe(a, l) : (c(i, !0, e > 1, l), i.pipe(a)), i = a;
		if (r) {
			let e = !1, t = Q(a) || !!(a._writableState && a._writableState.autoDestroy);
			a.on("error", (e) => {
				o === null && (o = e);
			}), a.on("finish", () => {
				e = !0, t || r(o);
			}), t && a.on("close", () => r(o || (e ? null : s.PREMATURE_CLOSE())));
		}
		return a;
		function c(e, t, n, r) {
			e.on("error", r), e.on("close", i);
			function i() {
				if (t && e._readableState && !e._readableState.ended || n && e._writableState && !e._writableState.ended) return r(s.PREMATURE_CLOSE());
			}
		}
		function l(e) {
			if (!(!e || o)) {
				o = e;
				for (let t of n) t.destroy(e);
			}
		}
	}
	function dt(e) {
		return e;
	}
	function ft(e) {
		return !!e._readableState || !!e._writableState;
	}
	function Q(e) {
		return typeof e._duplexState == "number" && ft(e);
	}
	function pt(e) {
		return !!e._readableState && e._readableState.ending;
	}
	function mt(e) {
		return !!e._readableState && e._readableState.ended;
	}
	function ht(e) {
		return !!e._writableState && e._writableState.ending;
	}
	function gt(e) {
		return !!e._writableState && e._writableState.ended;
	}
	function _t(e, t = {}) {
		let n = e._readableState && e._readableState.error || e._writableState && e._writableState.error;
		return !t.all && s.isStreamDestroyed(n) ? null : n;
	}
	function vt(e) {
		return Q(e) && e.readable;
	}
	function yt(e) {
		return (e._duplexState & d) !== d || (e._duplexState & p) === p || (e._duplexState & K) !== 0;
	}
	function bt(e) {
		return typeof e == "object" && !!e && typeof e.byteLength == "number";
	}
	function xt(e) {
		return bt(e) ? e.byteLength : 1024;
	}
	function $() {}
	function St() {
		this.destroy(s.ABORTED());
	}
	function Ct(e) {
		return e._writev !== ot.prototype._writev && e._writev !== X.prototype._writev;
	}
	t.exports = {
		pipeline: Z,
		pipelinePromise: ut,
		isStream: ft,
		isStreamx: Q,
		isEnding: pt,
		isEnded: mt,
		isFinishing: ht,
		isFinished: gt,
		isDisturbed: yt,
		getStreamError: _t,
		Stream: Y,
		Writable: ot,
		Readable: at,
		Duplex: X,
		Transform: st,
		PassThrough: ct
	};
}));
//#endregion
export { n as a, i, c as n, a as r, u as t };
