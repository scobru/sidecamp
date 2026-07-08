import { i as e, t } from "./rolldown-runtime-C6GIJ8is.js";
import { t as n } from "./pump-MsfR0OT9.js";
//#region node_modules/events-universal/default.js
var r = /* @__PURE__ */ t(((t, n) => {
	n.exports = e("events");
})), i = /* @__PURE__ */ t(((e, t) => {
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
})), a = /* @__PURE__ */ t(((e, t) => {
	var n = i();
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
})), o = /* @__PURE__ */ t(((e, t) => {
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
	function T(e, t) {
		return b(e).readFloatBE(t);
	}
	function E(e, t) {
		return b(e).readFloatLE(t);
	}
	function D(e, t) {
		return b(e).readInt32BE(t);
	}
	function O(e, t) {
		return b(e).readInt32LE(t);
	}
	function k(e, t) {
		return b(e).readUInt32BE(t);
	}
	function A(e, t) {
		return b(e).readUInt32LE(t);
	}
	function j(e, t, n) {
		return b(e).writeDoubleBE(t, n);
	}
	function M(e, t, n) {
		return b(e).writeDoubleLE(t, n);
	}
	function N(e, t, n) {
		return b(e).writeFloatBE(t, n);
	}
	function P(e, t, n) {
		return b(e).writeFloatLE(t, n);
	}
	function ee(e, t, n) {
		return b(e).writeInt32BE(t, n);
	}
	function F(e, t, n) {
		return b(e).writeInt32LE(t, n);
	}
	function I(e, t, n) {
		return b(e).writeUInt32BE(t, n);
	}
	function L(e, t, n) {
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
		readFloatBE: T,
		readFloatLE: E,
		readInt32BE: D,
		readInt32LE: O,
		readUInt32BE: k,
		readUInt32LE: A,
		writeDoubleBE: j,
		writeDoubleLE: M,
		writeFloatBE: N,
		writeFloatLE: P,
		writeInt32BE: ee,
		writeInt32LE: F,
		writeUInt32BE: I,
		writeUInt32LE: L
	};
})), s = /* @__PURE__ */ t(((e, t) => {
	var n = o();
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
})), c = /* @__PURE__ */ t(((e, t) => {
	var n = o();
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
})), l = /* @__PURE__ */ t(((e, t) => {
	var n = s(), r = c();
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
})), u = /* @__PURE__ */ t(((e, t) => {
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
})), d = /* @__PURE__ */ t(((e, t) => {
	var { EventEmitter: n } = r(), i = a(), o = l(), s = u(), c = typeof queueMicrotask > "u" ? (e) => global.process.nextTick(e) : queueMicrotask, d = 1, f = 2, p = 4, m = 8, h = 536870910, g = 536870909, _ = 32, v = 64, y = 128, b = 256, x = 512, S = 1024, C = 2048, w = 4096, T = 8192, E = 16384, D = 32768, O = 131072, k = 768, A = 65552, j = 80, M = 4224, N = 131328, P = 536870895, ee = 536805311, F = 536805375, I = 536870655, L = 536862591, te = 536869887, ne = 536870143, re = 536838143, ie = 536870879, ae = 536739839, oe = 536739583, se = 1 << 18, R = 2 << 18, ce = 4 << 18, le = 8 << 18, ue = 16 << 18, z = 32 << 18, B = 64 << 18, V = 128 << 18, de = 256 << 18, H = 512 << 18, U = 1024 << 18, fe = 469499903, pe = 535822335, me = 402391039, he = 532676607, ge = 534773759, _e = 503316479, ve = 536346623, ye = 268435455, W = 262160, be = 536608751, xe = 8404992, G = 14, Se = 15, Ce = 8405006, we = 535822271, K = 33587200, q = 33587215, Te = 17423, Ee = 16527, De = 1167, Oe = 12431, ke = 214047, Ae = 17422, je = 32879, Me = 32769, Ne = 142606351, Pe = 6291456, Fe = 2359296, Ie = 6553615, Le = 270794767, Re = 1310720, ze = 67371008, Be = 144965647, Ve = 146800654, He = 35127311, Ue = 142606350, J = Symbol.asyncIterator || Symbol("asyncIterator"), We = class {
		constructor(e, { highWaterMark: t = 16384, map: n = null, mapWritable: r, byteLength: a, byteLengthWritable: o } = {}) {
			this.stream = e, this.queue = new i(), this.highWaterMark = t, this.buffered = 0, this.error = null, this.pipeline = null, this.drains = null, this.byteLength = o || a || xt, this.map = r || n, this.afterWrite = Ze.bind(this), this.afterUpdateNextTick = et.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & H) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & z) !== 0;
		}
		push(e) {
			return (this.stream._duplexState & Ue) === 0 ? (this.map !== null && (e = this.map(e)), this.buffered += this.byteLength(e), this.queue.push(e), this.buffered < this.highWaterMark ? (this.stream._duplexState |= le, !0) : (this.stream._duplexState |= Pe, !1)) : !1;
		}
		shift() {
			let e = this.queue.shift();
			return this.buffered -= this.byteLength(e), this.buffered === 0 && (this.stream._duplexState &= ge), e;
		}
		end(e) {
			typeof e == "function" ? this.stream.once("finish", e) : e != null && this.push(e), this.stream._duplexState = (this.stream._duplexState | H) & pe;
		}
		autoBatch(e, t) {
			let n = [], r = this.stream;
			for (n.push(e); (r._duplexState & Le) === Fe;) n.push(r._writableState.shift());
			if ((r._duplexState & Se) !== 0) return t(null);
			r._writev(n, t);
		}
		update() {
			let e = this.stream;
			e._duplexState |= R;
			do {
				for (; (e._duplexState & Le) === le;) {
					let t = this.shift();
					e._duplexState |= ze, e._write(t, this.afterWrite);
				}
				(e._duplexState & Re) === 0 && this.updateNonPrimary();
			} while (this.continueUpdate() === !0);
			e._duplexState &= ve;
		}
		updateNonPrimary() {
			let e = this.stream;
			if ((e._duplexState & Be) === H) {
				e._duplexState |= se, e._final(Ye.bind(this));
				return;
			}
			if ((e._duplexState & G) === p) {
				(e._duplexState & K) === 0 && (e._duplexState |= W, e._destroy(Xe.bind(this)));
				return;
			}
			(e._duplexState & q) === d && (e._duplexState = (e._duplexState | W) & h, e._open(nt.bind(this)));
		}
		continueUpdate() {
			return (this.stream._duplexState & V) === 0 ? !1 : (this.stream._duplexState &= _e, !0);
		}
		updateCallback() {
			(this.stream._duplexState & He) === ce ? this.update() : this.updateNextTick();
		}
		updateNextTick() {
			(this.stream._duplexState & V) === 0 && (this.stream._duplexState |= V, (this.stream._duplexState & R) === 0 && c(this.afterUpdateNextTick));
		}
	}, Ge = class {
		constructor(e, { highWaterMark: t = 16384, map: n = null, mapReadable: r, byteLength: a, byteLengthReadable: o } = {}) {
			this.stream = e, this.queue = new i(), this.highWaterMark = t === 0 ? 1 : t, this.buffered = 0, this.readAhead = t > 0, this.error = null, this.pipeline = null, this.byteLength = o || a || xt, this.map = r || n, this.pipeTo = null, this.afterRead = Qe.bind(this), this.afterUpdateNextTick = $e.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & S) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & E) !== 0;
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
			return e === null ? (this.highWaterMark = 0, t._duplexState = (t._duplexState | S) & ee, !1) : this.map !== null && (e = this.map(e), e === null) ? (t._duplexState &= F, this.buffered < this.highWaterMark) : (this.buffered += this.byteLength(e), this.queue.push(e), t._duplexState = (t._duplexState | y) & F, this.buffered < this.highWaterMark);
		}
		shift() {
			let e = this.queue.shift();
			return this.buffered -= this.byteLength(e), this.buffered === 0 && (this.stream._duplexState &= L), e;
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
				return this.pipeTo !== null && this.pipeTo.write(t) === !1 && (e._duplexState &= ne), (e._duplexState & C) !== 0 && e.emit("data", t), t;
			}
			return this.readAhead === !1 && (e._duplexState |= O, this.updateNextTick()), null;
		}
		drain() {
			let e = this.stream;
			for (; (e._duplexState & Ee) === y && (e._duplexState & k) !== 0;) {
				let t = this.shift();
				this.pipeTo !== null && this.pipeTo.write(t) === !1 && (e._duplexState &= ne), (e._duplexState & C) !== 0 && e.emit("data", t);
			}
		}
		update() {
			let e = this.stream;
			e._duplexState |= _;
			do {
				for (this.drain(); this.buffered < this.highWaterMark && (e._duplexState & ke) === O;) e._duplexState |= A, e._read(this.afterRead), this.drain();
				(e._duplexState & Oe) === M && (e._duplexState |= T, e.emit("readable")), (e._duplexState & j) === 0 && this.updateNonPrimary();
			} while (this.continueUpdate() === !0);
			e._duplexState &= ie;
		}
		updateNonPrimary() {
			let e = this.stream;
			if ((e._duplexState & De) === S && (e._duplexState = (e._duplexState | E) & te, e.emit("end"), (e._duplexState & Ce) === xe && (e._duplexState |= p), this.pipeTo !== null && this.pipeTo.end()), (e._duplexState & G) === p) {
				(e._duplexState & K) === 0 && (e._duplexState |= W, e._destroy(Xe.bind(this)));
				return;
			}
			(e._duplexState & q) === d && (e._duplexState = (e._duplexState | W) & h, e._open(nt.bind(this)));
		}
		continueUpdate() {
			return (this.stream._duplexState & D) === 0 ? !1 : (this.stream._duplexState &= re, !0);
		}
		updateCallback() {
			(this.stream._duplexState & je) === v ? this.update() : this.updateNextTick();
		}
		updateNextTickIfOpen() {
			(this.stream._duplexState & Me) === 0 && (this.stream._duplexState |= D, (this.stream._duplexState & _) === 0 && c(this.afterUpdateNextTick));
		}
		updateNextTick() {
			(this.stream._duplexState & D) === 0 && (this.stream._duplexState |= D, (this.stream._duplexState & _) === 0 && c(this.afterUpdateNextTick));
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
				((this.from._duplexState & E) === 0 || !this.pipeToFinished) && this.from.destroy(this.error || s.PREMATURE_CLOSE("Writable stream closed"));
				return;
			}
			if (e === this.from && (this.from = null, this.to !== null)) {
				(e._duplexState & E) === 0 && this.to.destroy(this.error || s.PREMATURE_CLOSE("Readable stream closed"));
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
		e && t.destroy(e), (t._duplexState & G) === 0 && (t._duplexState |= z, t.emit("finish")), (t._duplexState & Ce) === xe && (t._duplexState |= p), t._duplexState &= me, (t._duplexState & R) === 0 ? this.update() : this.updateNextTick();
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
		e && t.destroy(e), t._duplexState &= fe, this.drains !== null && tt(this.drains), (t._duplexState & Ie) === ue && (t._duplexState &= he, (t._duplexState & B) === B && t.emit("drain")), this.updateCallback();
	}
	function Qe(e) {
		e && this.stream.destroy(e), this.stream._duplexState &= P, this.readAhead === !1 && (this.stream._duplexState & b) === 0 && (this.stream._duplexState &= ae), this.updateCallback();
	}
	function $e() {
		(this.stream._duplexState & _) === 0 && (this.stream._duplexState &= re, this.update());
	}
	function et() {
		(this.stream._duplexState & R) === 0 && (this.stream._duplexState &= _e, this.update());
	}
	function tt(e) {
		for (let t = 0; t < e.length; t++) --e[t].writes === 0 && (e.shift().resolve(!0), t--);
	}
	function nt(e) {
		let t = this.stream;
		e && t.destroy(e), (t._duplexState & p) === 0 && ((t._duplexState & Te) === 0 && (t._duplexState |= v), (t._duplexState & Ne) === 0 && (t._duplexState |= ce), t.emit("open")), t._duplexState &= be, t._writableState !== null && t._writableState.updateCallback(), t._readableState !== null && t._readableState.updateCallback();
	}
	function rt(e, t) {
		t != null && this.push(t), this._writableState.afterWrite(e);
	}
	function it(e) {
		this._readableState !== null && (e === "data" && (this._duplexState |= 133376, this._readableState.updateNextTick()), e === "readable" && (this._duplexState |= w, this._readableState.updateNextTick())), this._writableState !== null && e === "drain" && (this._duplexState |= B, this._writableState.updateNextTick());
	}
	var Y = class extends n {
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
			super(e), this._duplexState |= 8519681, this._readableState = new Ge(this, e), e && (this._readableState.readAhead === !1 && (this._duplexState &= ae), e.read && (this._read = e.read), e.eagerOpen && this._readableState.updateNextTick(), e.encoding && this.setEncoding(e.encoding));
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
			return this._duplexState |= N, this._readableState.updateNextTick(), this;
		}
		pause() {
			return this._duplexState &= this._readableState.readAhead === !1 ? oe : I, this;
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
				r !== null && (t ? r(t) : i === null && (e._duplexState & E) === 0 ? r(s.STREAM_DESTROYED()) : n({
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
			this._duplexState |= U;
		}
		uncork() {
			this._duplexState &= ye, this._writableState.updateNextTick();
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
			let t = e._writableState, n = (Ct(e) ? Math.min(1, t.queue.length) : t.queue.length) + (e._duplexState & de ? 1 : 0);
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
			super(e), this._duplexState = d | this._duplexState & O, this._writableState = new We(this, e), e && (e.writev && (this._writev = e.writev), e.write && (this._write = e.write), e.final && (this._final = e.final));
		}
		cork() {
			this._duplexState |= U;
		}
		uncork() {
			this._duplexState &= ye, this._writableState.updateNextTick();
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
})), f = /* @__PURE__ */ t(((e) => {
	var t = o(), n = "0000000000000000000", r = "7777777777777777777", i = 48, a = t.from([
		117,
		115,
		116,
		97,
		114,
		0
	]), s = t.from([i, i]), c = t.from([
		117,
		115,
		116,
		97,
		114,
		32
	]), l = t.from([32, 0]), u = 4095, d = 257, f = 263;
	e.decodeLongPath = function(e, t) {
		return T(e, 0, e.length, t);
	}, e.encodePax = function(e) {
		let n = "";
		e.name && (n += E(" path=" + e.name + "\n")), e.linkname && (n += E(" linkpath=" + e.linkname + "\n"));
		let r = e.pax;
		if (r) for (let e in r) n += E(" " + e + "=" + r[e] + "\n");
		return t.from(n);
	}, e.decodePax = function(e) {
		let n = {};
		for (; e.length;) {
			let r = 0;
			for (; r < e.length && e[r] !== 32;) r++;
			let i = parseInt(t.toString(e.subarray(0, r)), 10);
			if (!i) return n;
			let a = t.toString(e.subarray(r + 1, i - 1)), o = a.indexOf("=");
			if (o === -1) return n;
			n[a.slice(0, o)] = a.slice(o + 1), e = e.subarray(i);
		}
		return n;
	}, e.encode = function(e) {
		let n = t.alloc(512), r = e.name, o = "";
		if (e.typeflag === 5 && r[r.length - 1] !== "/" && (r += "/"), t.byteLength(r) !== r.length) return null;
		for (; t.byteLength(r) > 100;) {
			let e = r.indexOf("/");
			if (e === -1) return null;
			o += o ? "/" + r.slice(0, e) : r.slice(0, e), r = r.slice(e + 1);
		}
		return t.byteLength(r) > 100 || t.byteLength(o) > 155 || e.linkname && t.byteLength(e.linkname) > 100 ? null : (t.write(n, r), t.write(n, b(e.mode & u, 6), 100), t.write(n, b(e.uid, 6), 108), t.write(n, b(e.gid, 6), 116), S(e.size, n, 124), t.write(n, b(e.mtime.getTime() / 1e3 | 0, 11), 136), n[156] = i + _(e.type), e.linkname && t.write(n, e.linkname, 157), t.copy(a, n, d), t.copy(s, n, f), e.uname && t.write(n, e.uname, 265), e.gname && t.write(n, e.gname, 297), t.write(n, b(e.devmajor || 0, 6), 329), t.write(n, b(e.devminor || 0, 6), 337), o && t.write(n, o, 345), t.write(n, b(y(n), 6), 148), n);
	}, e.decode = function(e, t, n) {
		let r = e[156] === 0 ? 0 : e[156] - i, a = T(e, 0, 100, t), o = w(e, 100, 8), s = w(e, 108, 8), c = w(e, 116, 8), l = w(e, 124, 12), u = w(e, 136, 12), d = g(r), f = e[157] === 0 ? null : T(e, 157, 100, t), h = T(e, 265, 32), _ = T(e, 297, 32), v = w(e, 329, 8), b = w(e, 337, 8), x = y(e);
		if (x === 256) return null;
		if (x !== w(e, 148, 8)) throw Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
		if (p(e)) e[345] && (a = T(e, 345, 155, t) + "/" + a);
		else if (!m(e) && !n) throw Error("Invalid tar header: unknown format.");
		return r === 0 && a && a[a.length - 1] === "/" && (r = 5), {
			name: a,
			mode: o,
			uid: s,
			gid: c,
			size: l,
			byteOffset: 0,
			mtime: /* @__PURE__ */ new Date(1e3 * u),
			type: d,
			linkname: f,
			uname: h,
			gname: _,
			devmajor: v,
			devminor: b,
			pax: null
		};
	};
	function p(e) {
		return t.equals(a, e.subarray(d, 263));
	}
	function m(e) {
		return t.equals(c, e.subarray(d, 263)) && t.equals(l, e.subarray(f, 265));
	}
	function h(e, t, n) {
		return typeof e == "number" ? (e = ~~e, e >= t ? t : e >= 0 || (e += t, e >= 0) ? e : 0) : n;
	}
	function g(e) {
		switch (e) {
			case 0: return "file";
			case 1: return "link";
			case 2: return "symlink";
			case 3: return "character-device";
			case 4: return "block-device";
			case 5: return "directory";
			case 6: return "fifo";
			case 7: return "contiguous-file";
			case 72: return "pax-header";
			case 55: return "pax-global-header";
			case 27: return "gnu-long-link-path";
			case 28:
			case 30: return "gnu-long-path";
		}
		return null;
	}
	function _(e) {
		switch (e) {
			case "file": return 0;
			case "link": return 1;
			case "symlink": return 2;
			case "character-device": return 3;
			case "block-device": return 4;
			case "directory": return 5;
			case "fifo": return 6;
			case "contiguous-file": return 7;
			case "pax-header": return 72;
		}
		return 0;
	}
	function v(e, t, n, r) {
		for (; n < r; n++) if (e[n] === t) return n;
		return r;
	}
	function y(e) {
		let t = 256;
		for (let n = 0; n < 148; n++) t += e[n];
		for (let n = 156; n < 512; n++) t += e[n];
		return t;
	}
	function b(e, t) {
		return e = e.toString(8), e.length > t ? r.slice(0, t) + " " : n.slice(0, t - e.length) + e + " ";
	}
	function x(e, t, n) {
		t[n] = 128;
		for (let r = 11; r > 0; r--) t[n + r] = e & 255, e = Math.floor(e / 256);
	}
	function S(e, n, r) {
		e.toString(8).length > 11 ? x(e, n, r) : t.write(n, b(e, 11), r);
	}
	function C(e) {
		let t;
		if (e[0] === 128) t = !0;
		else if (e[0] === 255) t = !1;
		else return null;
		let n = [], r;
		for (r = e.length - 1; r > 0; r--) {
			let i = e[r];
			t ? n.push(i) : n.push(255 - i);
		}
		let i = 0, a = n.length;
		for (r = 0; r < a; r++) i += n[r] * 256 ** r;
		return t ? i : -1 * i;
	}
	function w(e, n, r) {
		if (e = e.subarray(n, n + r), n = 0, e[n] & 128) return C(e);
		{
			for (; n < e.length && e[n] === 32;) n++;
			let r = h(v(e, 32, n, e.length), e.length, e.length);
			for (; n < r && e[n] === 0;) n++;
			return r === n ? 0 : parseInt(t.toString(e.subarray(n, r)), 8);
		}
	}
	function T(e, n, r, i) {
		return t.toString(e.subarray(n, v(e, 0, n, n + r)), i);
	}
	function E(e) {
		let n = t.byteLength(e), r = Math.floor(Math.log(n) / Math.log(10)) + 1;
		return n + r >= 10 ** r && r++, n + r + e;
	}
})), p = /* @__PURE__ */ t(((e, t) => {
	var { Writable: n, Readable: r, getStreamError: i } = d(), s = a(), c = o(), l = f(), u = c.alloc(0), p = 4 * 1024 * 1024, m = class {
		constructor() {
			this.buffered = 0, this.shifted = 0, this.queue = new s(), this._offset = 0;
		}
		push(e) {
			this.buffered += e.byteLength, this.queue.push(e);
		}
		shiftFirst(e) {
			return this.buffered === 0 ? null : this._next(e);
		}
		shift(e) {
			if (e > this.buffered) return null;
			if (e === 0) return u;
			let t = this._next(e);
			if (e === t.byteLength) return t;
			let n = [t];
			for (; (e -= t.byteLength) > 0;) t = this._next(e), n.push(t);
			return c.concat(n);
		}
		_next(e) {
			let t = this.queue.peek(), n = t.byteLength - this._offset;
			if (e >= n) {
				let e = this._offset ? t.subarray(this._offset, t.byteLength) : t;
				return this.queue.shift(), this._offset = 0, this.buffered -= n, this.shifted += n, e;
			}
			return this.buffered -= e, this.shifted += e, t.subarray(this._offset, this._offset += e);
		}
	}, h = class extends r {
		constructor(e, t, n) {
			super(), this.header = t, this.offset = n, this._parent = e;
		}
		_read(e) {
			this.header.size === 0 && this.push(null), this._parent._stream === this && this._parent._update(), e(null);
		}
		_predestroy() {
			this._parent.destroy(i(this));
		}
		_detach() {
			this._parent._stream === this && (this._parent._stream = null, this._parent._missing = v(this.header.size), this._parent._update());
		}
		_destroy(e) {
			this._detach(), e(null);
		}
	}, g = class extends n {
		constructor(e) {
			super(e), e ||= {}, this._buffer = new m(), this._offset = 0, this._header = null, this._stream = null, this._missing = 0, this._longHeader = !1, this._callback = _, this._locked = !1, this._finished = !1, this._pax = null, this._paxGlobal = null, this._gnuLongPath = null, this._gnuLongLinkPath = null, this._filenameEncoding = e.filenameEncoding || "utf-8", this._allowUnknownFormat = !!e.allowUnknownFormat, this._unlockBound = this._unlock.bind(this);
		}
		_unlock(e) {
			if (this._locked = !1, e) {
				this.destroy(e), this._continueWrite(e);
				return;
			}
			this._update();
		}
		_consumeHeader() {
			if (this._locked) return !1;
			this._offset = this._buffer.shifted;
			try {
				this._header = l.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
			} catch (e) {
				return this._continueWrite(e), !1;
			}
			if (!this._header) return !0;
			switch (this._header.byteOffset = this._buffer.shifted, this._header.type) {
				case "gnu-long-path":
				case "gnu-long-link-path":
				case "pax-global-header":
				case "pax-header": return this._longHeader = !0, this._missing = this._header.size, this._missing > p ? (this._continueWrite(/* @__PURE__ */ Error("Header exceeds max size")), !1) : !0;
			}
			return this._locked = !0, this._applyLongHeaders(), this._header.size >= 0 ? this._header.size === 0 || this._header.type === "directory" ? (this.emit("entry", this._header, this._createStream(), this._unlockBound), !0) : (this._stream = this._createStream(), this._missing = this._header.size, this.emit("entry", this._header, this._stream, this._unlockBound), !0) : (this._continueWrite(/* @__PURE__ */ Error("Invalid header")), !1);
		}
		_applyLongHeaders() {
			this._gnuLongPath &&= (this._header.name = this._gnuLongPath, null), this._gnuLongLinkPath &&= (this._header.linkname = this._gnuLongLinkPath, null), this._pax &&= (this._pax.path && (this._header.name = this._pax.path), this._pax.linkpath && (this._header.linkname = this._pax.linkpath), this._pax.size && (this._header.size = parseInt(this._pax.size, 10)), this._header.pax = this._pax, null);
		}
		_decodeLongHeader(e) {
			switch (this._header.type) {
				case "gnu-long-path":
					this._gnuLongPath = l.decodeLongPath(e, this._filenameEncoding);
					break;
				case "gnu-long-link-path":
					this._gnuLongLinkPath = l.decodeLongPath(e, this._filenameEncoding);
					break;
				case "pax-global-header":
					this._paxGlobal = l.decodePax(e);
					break;
				case "pax-header":
					this._pax = this._paxGlobal === null ? l.decodePax(e) : Object.assign({}, this._paxGlobal, l.decodePax(e));
					break;
			}
		}
		_consumeLongHeader() {
			this._longHeader = !1, this._missing = v(this._header.size);
			let e = this._buffer.shift(this._header.size);
			try {
				this._decodeLongHeader(e);
			} catch (e) {
				return this._continueWrite(e), !1;
			}
			return !0;
		}
		_consumeStream() {
			let e = this._buffer.shiftFirst(this._missing);
			if (e === null) return !1;
			this._missing -= e.byteLength;
			let t = this._stream.push(e);
			return this._missing === 0 ? (this._stream.push(null), t && this._stream._detach(), t && this._locked === !1) : t;
		}
		_createStream() {
			return new h(this, this._header, this._offset);
		}
		_update() {
			for (; this._buffer.buffered > 0 && !this.destroying;) {
				if (this._missing > 0) {
					if (this._stream !== null) {
						if (this._consumeStream() === !1) return;
						continue;
					}
					if (this._longHeader === !0) {
						if (this._missing > this._buffer.buffered) break;
						if (this._consumeLongHeader() === !1) return !1;
						continue;
					}
					let e = this._buffer.shiftFirst(this._missing);
					e !== null && (this._missing -= e.byteLength);
					continue;
				}
				if (this._buffer.buffered < 512) break;
				if (this._stream !== null || this._consumeHeader() === !1) return;
			}
			this._continueWrite(null);
		}
		_continueWrite(e) {
			let t = this._callback;
			this._callback = _, t(e);
		}
		_write(e, t) {
			this._callback = t, this._buffer.push(e), this._update();
		}
		_final(e) {
			this._finished = this._missing === 0 && this._buffer.buffered === 0, e(this._finished ? null : /* @__PURE__ */ Error("Unexpected end of data"));
		}
		_predestroy() {
			this._continueWrite(null);
		}
		_destroy(e) {
			this._stream && this._stream.destroy(i(this)), e(null);
		}
		[Symbol.asyncIterator]() {
			let e = null, t = null, n = null, r = null, i = null, a = this;
			return this.on("entry", c), this.on("error", (t) => {
				e = t;
			}), this.on("close", l), {
				[Symbol.asyncIterator]() {
					return this;
				},
				next() {
					return new Promise(s);
				},
				return() {
					return u(null);
				},
				throw(e) {
					return u(e);
				}
			};
			function o(e) {
				if (!i) return;
				let t = i;
				i = null, t(e);
			}
			function s(i, s) {
				if (e) return s(e);
				if (r) {
					i({
						value: r,
						done: !1
					}), r = null;
					return;
				}
				t = i, n = s, o(null), a._finished && t && (t({
					value: void 0,
					done: !0
				}), t = n = null);
			}
			function c(e, a, o) {
				i = o, a.on("error", _), t ? (t({
					value: a,
					done: !1
				}), t = n = null) : r = a;
			}
			function l() {
				o(e), t &&= (e ? n(e) : t({
					value: void 0,
					done: !0
				}), n = null);
			}
			function u(e) {
				return a.destroy(e), o(e), new Promise((t, n) => {
					if (a.destroyed) return t({
						value: void 0,
						done: !0
					});
					a.once("close", function() {
						e ? n(e) : t({
							value: void 0,
							done: !0
						});
					});
				});
			}
		}
	};
	t.exports = function(e) {
		return new g(e);
	};
	function _() {}
	function v(e) {
		return e &= 511, e && 512 - e;
	}
})), m = /* @__PURE__ */ t(((t, n) => {
	var r = {
		S_IFMT: 61440,
		S_IFDIR: 16384,
		S_IFCHR: 8192,
		S_IFBLK: 24576,
		S_IFIFO: 4096,
		S_IFLNK: 40960
	};
	try {
		n.exports = e("fs").constants || r;
	} catch {
		n.exports = r;
	}
})), h = /* @__PURE__ */ t(((e, t) => {
	var { Readable: n, Writable: r, getStreamError: i } = d(), a = o(), s = m(), c = f(), l = 493, u = 420, p = a.alloc(1024), h = class extends r {
		constructor(e, t, n) {
			super({
				mapWritable: b,
				eagerOpen: !0
			}), this.written = 0, this.header = t, this._callback = n, this._linkname = null, this._isLinkname = t.type === "symlink" && !t.linkname, this._isVoid = t.type !== "file" && t.type !== "contiguous-file", this._finished = !1, this._pack = e, this._openCallback = null, this._pack._stream === null ? this._pack._stream = this : this._pack._pending.push(this);
		}
		_open(e) {
			this._openCallback = e, this._pack._stream === this && this._continueOpen();
		}
		_continuePack(e) {
			if (this._callback === null) return;
			let t = this._callback;
			this._callback = null, t(e);
		}
		_continueOpen() {
			this._pack._stream === null && (this._pack._stream = this);
			let e = this._openCallback;
			if (this._openCallback = null, e !== null) {
				if (this._pack.destroying) return e(/* @__PURE__ */ Error("pack stream destroyed"));
				if (this._pack._finalized) return e(/* @__PURE__ */ Error("pack stream is already finalized"));
				this._pack._stream = this, this._isLinkname || this._pack._encode(this.header), this._isVoid && (this._finish(), this._continuePack(null)), e(null);
			}
		}
		_write(e, t) {
			if (this._isLinkname) return this._linkname = this._linkname ? a.concat([this._linkname, e]) : e, t(null);
			if (this._isVoid) return e.byteLength > 0 ? t(/* @__PURE__ */ Error("No body allowed for this entry")) : t();
			if (this.written += e.byteLength, this._pack.push(e)) return t();
			this._pack._drain = t;
		}
		_finish() {
			this._finished || (this._finished = !0, this._isLinkname && (this.header.linkname = this._linkname ? a.toString(this._linkname, "utf-8") : "", this._pack._encode(this.header)), y(this._pack, this.header.size), this._pack._done(this));
		}
		_final(e) {
			if (this.written !== this.header.size) return e(/* @__PURE__ */ Error("Size mismatch"));
			this._finish(), e(null);
		}
		_getError() {
			return i(this) || /* @__PURE__ */ Error("tar entry destroyed");
		}
		_predestroy() {
			this._pack.destroy(this._getError());
		}
		_destroy(e) {
			this._pack._done(this), this._continuePack(this._finished ? null : this._getError()), e();
		}
	}, g = class extends n {
		constructor(e) {
			super(e), this._drain = v, this._finalized = !1, this._finalizing = !1, this._pending = [], this._stream = null;
		}
		entry(e, t, n) {
			if (this._finalized || this.destroying) throw Error("already finalized or destroyed");
			typeof t == "function" && (n = t, t = null), n ||= v, (!e.size || e.type === "symlink") && (e.size = 0), e.type ||= _(e.mode), e.mode ||= e.type === "directory" ? l : u, e.uid ||= 0, e.gid ||= 0, e.mtime ||= /* @__PURE__ */ new Date(), typeof t == "string" && (t = a.from(t));
			let r = new h(this, e, n);
			return a.isBuffer(t) ? (e.size = t.byteLength, r.write(t), r.end(), r) : (r._isVoid, r);
		}
		finalize() {
			if (this._stream || this._pending.length > 0) {
				this._finalizing = !0;
				return;
			}
			this._finalized || (this._finalized = !0, this.push(p), this.push(null));
		}
		_done(e) {
			e === this._stream && (this._stream = null, this._finalizing && this.finalize(), this._pending.length && this._pending.shift()._continueOpen());
		}
		_encode(e) {
			if (!e.pax) {
				let t = c.encode(e);
				if (t) {
					this.push(t);
					return;
				}
			}
			this._encodePax(e);
		}
		_encodePax(e) {
			let t = c.encodePax({
				name: e.name,
				linkname: e.linkname,
				pax: e.pax
			}), n = {
				name: "PaxHeader",
				mode: e.mode,
				uid: e.uid,
				gid: e.gid,
				size: t.byteLength,
				mtime: e.mtime,
				type: "pax-header",
				linkname: e.linkname && "PaxHeader",
				uname: e.uname,
				gname: e.gname,
				devmajor: e.devmajor,
				devminor: e.devminor
			};
			this.push(c.encode(n)), this.push(t), y(this, t.byteLength), n.size = e.size, n.type = e.type, this.push(c.encode(n));
		}
		_doDrain() {
			let e = this._drain;
			this._drain = v, e();
		}
		_predestroy() {
			let e = i(this);
			for (this._stream && this._stream.destroy(e); this._pending.length;) {
				let t = this._pending.shift();
				t.destroy(e), t._continueOpen();
			}
			this._doDrain();
		}
		_read(e) {
			this._doDrain(), e();
		}
	};
	t.exports = function(e) {
		return new g(e);
	};
	function _(e) {
		switch (e & s.S_IFMT) {
			case s.S_IFBLK: return "block-device";
			case s.S_IFCHR: return "character-device";
			case s.S_IFDIR: return "directory";
			case s.S_IFIFO: return "fifo";
			case s.S_IFLNK: return "symlink";
		}
		return "file";
	}
	function v() {}
	function y(e, t) {
		t &= 511, t && e.push(p.subarray(0, 512 - t));
	}
	function b(e) {
		return a.isBuffer(e) ? e : a.from(e);
	}
})), g = /* @__PURE__ */ t(((e) => {
	e.extract = p(), e.pack = h();
})), _ = /* @__PURE__ */ t(((t) => {
	var r = g(), i = n(), a = e("fs"), o = e("path"), s = (global.Bare ? global.Bare.platform : process.platform) === "win32";
	t.pack = function(e, t) {
		e ||= ".", t ||= {};
		let n = t.fs || a, s = t.ignore || t.filter || m, c = t.mapStream || h, l = v(n, t.dereference ? n.stat : n.lstat, e, s, t.entries, t.sort), d = t.strict !== !1, f = typeof t.umask == "number" ? ~t.umask : ~u(), p = t.pack || r.pack(), g = t.finish || m, b = t.map || m, x = typeof t.dmode == "number" ? t.dmode : 0, S = typeof t.fmode == "number" ? t.fmode : 0;
		t.strip && (b = y(b, t.strip)), t.readable && (x |= 365, S |= 292), t.writable && (x |= 219, S |= 146), T();
		function C(t, r) {
			n.readlink(o.join(e, t), function(e, t) {
				if (e) return p.destroy(e);
				r.linkname = _(t), p.entry(r, T);
			});
		}
		function w(r, a, s) {
			if (p.destroyed) return;
			if (r) return p.destroy(r);
			if (!a) return t.finalize !== !1 && p.finalize(), g(p);
			if (s.isSocket()) return T();
			let l = {
				name: _(a),
				mode: (s.mode | (s.isDirectory() ? x : S)) & f,
				mtime: s.mtime,
				size: s.size,
				type: "file",
				uid: s.uid,
				gid: s.gid
			};
			if (s.isDirectory()) return l.size = 0, l.type = "directory", l = b(l) || l, p.entry(l, T);
			if (s.isSymbolicLink()) return l.size = 0, l.type = "symlink", l = b(l) || l, C(a, l);
			if (l = b(l) || l, !s.isFile()) return d ? p.destroy(/* @__PURE__ */ Error("unsupported type for " + a)) : T();
			let u = p.entry(l, T), m = c(n.createReadStream(o.join(e, a), {
				start: 0,
				end: l.size > 0 ? l.size - 1 : l.size
			}), l);
			m.on("error", function(e) {
				u.destroy(e);
			}), i(m, u);
		}
		function T(e) {
			if (e) return p.destroy(e);
			l(w);
		}
		return p;
	};
	function c(e) {
		return e.length ? e[e.length - 1] : null;
	}
	function l() {
		return !global.Bare && process.getuid ? process.getuid() : -1;
	}
	function u() {
		return !global.Bare && process.umask ? process.umask() : 0;
	}
	t.extract = function(e, t) {
		e ||= ".", t ||= {}, e = o.resolve(e);
		let n = t.fs || a, p = t.ignore || t.filter || m, g = t.mapStream || h, v = t.chown !== !1 && !s && l() === 0, b = t.extract || r.extract(), x = [], S = /* @__PURE__ */ new Date(), C = typeof t.umask == "number" ? ~t.umask : ~u(), w = t.strict !== !1, T = t.validateSymlinks !== !1, E = t.map || m, D = typeof t.dmode == "number" ? t.dmode : 0, O = typeof t.fmode == "number" ? t.fmode : 0;
		return t.strip && (E = y(E, t.strip)), t.readable && (D |= 365, O |= 292), t.writable && (D |= 219, O |= 146), b.on("entry", k), t.finish && b.on("finish", t.finish), b;
		function k(r, a, c) {
			r = E(r) || r, r.name = _(r.name);
			let l = o.join(e, o.join("/", r.name));
			if (p(l, r)) return a.resume(), c();
			let u = o.join(l, ".") === o.join(e, ".") ? e : o.dirname(l);
			f(n, u, o.join(e, "."), function(e, t) {
				if (e) return c(e);
				if (!t) return c(/* @__PURE__ */ Error(u + " is not a valid path"));
				if (r.type === "directory") return x.push([l, r.mtime]), N(l, {
					fs: n,
					own: v,
					uid: r.uid,
					gid: r.gid,
					mode: r.mode
				}, m);
				N(u, {
					fs: n,
					own: v,
					uid: r.uid,
					gid: r.gid,
					mode: 493
				}, function(e) {
					if (e) return c(e);
					switch (r.type) {
						case "file": return S();
						case "link": return y();
						case "symlink": return h();
					}
					if (w) return c(/* @__PURE__ */ Error("unsupported type for " + l + " (" + r.type + ")"));
					a.resume(), c();
				});
			});
			function m(t) {
				if (t) return c(t);
				if (o.join(l, ".") === o.join(e, ".")) return c();
				j(l, r, function(e) {
					if (e) return c(e);
					if (s) return c();
					M(l, r, c);
				});
			}
			function h() {
				if (s) return c();
				n.unlink(l, function() {
					let i = o.resolve(o.dirname(l), r.linkname);
					if (!b(i) && (T || t.strip)) return c(/* @__PURE__ */ Error(l + " is not a valid symlink"));
					d(n, i, o.join(e, "."), function(e, t) {
						if (e) return c(e);
						if (!t && T) return c(/* @__PURE__ */ Error(l + " is not a valid symlink"));
						n.symlink(r.linkname, l, m);
					});
				});
			}
			function y() {
				if (s) return c();
				n.unlink(l, function() {
					let i = o.join(e, o.join("/", r.linkname));
					n.realpath(i, function(e, r) {
						if (e || !b(r)) return c(/* @__PURE__ */ Error(l + " is not a valid hardlink"));
						n.link(r, l, function(e) {
							if (e && e.code === "EPERM" && t.hardlinkAsFilesFallback) return a = n.createReadStream(r), S();
							m(e);
						});
					});
				});
			}
			function b(t) {
				return t === e || t.startsWith(e + o.sep);
			}
			function S() {
				n.lstat(l, function(t, r) {
					if (!t && r.isSymbolicLink()) return n.unlink(l, e);
					e();
				});
				function e(e) {
					if (e) return c(e);
					let t = n.createWriteStream(l), o = g(a, r);
					t.on("error", function(e) {
						o.destroy(e);
					}), i(o, t, function(e) {
						if (e) return c(e);
						t.on("close", m);
					});
				}
			}
		}
		function A(e, t) {
			let r;
			for (; (r = c(x)) && e.slice(0, r[0].length) !== r[0];) x.pop();
			if (!r) return t();
			n.utimes(r[0], S, r[1], t);
		}
		function j(e, r, i) {
			if (t.utimes === !1) return i();
			if (r.type === "directory") return n.utimes(e, S, r.mtime, i);
			if (r.type === "symlink") return A(e, i);
			n.utimes(e, S, r.mtime, function(t) {
				if (t) return i(t);
				A(e, i);
			});
		}
		function M(e, t, r) {
			let i = t.type === "symlink", a = i ? n.lchmod : n.chmod, o = i ? n.lchown : n.chown;
			if (!a) return r();
			let s = (t.mode | (t.type === "directory" ? D : O)) & C & 511;
			o && v ? o.call(n, e, t.uid, t.gid, c) : c(null);
			function c(t) {
				if (t) return r(t);
				if (!a) return r();
				a.call(n, e, s, r);
			}
		}
		function N(e, t, r) {
			n.stat(e, function(i) {
				if (!i) return r(null);
				if (i.code !== "ENOENT") return r(i);
				n.mkdir(e, {
					mode: t.mode,
					recursive: !0
				}, function(n, i) {
					if (n) return r(n);
					M(e, t, r);
				});
			});
		}
	};
	function d(e, t, n, r) {
		if (t === n) return r(null, !0);
		if (!t.startsWith(n + o.sep)) return r(null, !1);
		e.lstat(t, function(i, a) {
			if (i && i.code !== "ENOENT" && i.code !== "EPERM") return r(i);
			if (i || !a.isSymbolicLink()) return d(e, o.join(t, ".."), n, r);
			r(null, !1);
		});
	}
	function f(e, t, n, r) {
		if (t === n) return r(null, !0);
		e.lstat(t, function(i, a) {
			if (i && i.code !== "ENOENT" && i.code !== "EPERM") return r(i);
			if (i || a.isDirectory()) return f(e, o.join(t, ".."), n, r);
			r(null, !1);
		});
	}
	function p(e, t) {
		return t === e || t.startsWith(e + o.sep);
	}
	function m() {}
	function h(e) {
		return e;
	}
	function _(e) {
		return s ? e.replace(/\\/g, "/").replace(/[:?<>|]/g, "_") : e;
	}
	function v(e, t, n, r, i, a) {
		i ||= ["."];
		let s = i.slice(0), c = o.resolve(n);
		return function(l) {
			if (!s.length) return l(null);
			let u = s.shift(), d = o.join(n, u);
			if (!p(c, o.resolve(n, u))) return l(/* @__PURE__ */ Error(u + " is not a valid path"));
			t.call(e, d, function(t, c) {
				if (t) return l(i.indexOf(u) === -1 && t.code === "ENOENT" ? null : t);
				if (!c.isDirectory()) return l(null, u, c);
				e.readdir(d, function(e, t) {
					if (e) return l(e);
					a && t.sort();
					for (let e = 0; e < t.length; e++) r(o.join(n, u, t[e])) || s.push(o.join(u, t[e]));
					l(null, u, c);
				});
			});
		};
	}
	function y(e, t) {
		return function(n) {
			n.name = n.name.split("/").slice(t).join("/");
			let r = n.linkname;
			return r && (n.type === "link" || o.isAbsolute(r)) && (n.linkname = r.split("/").slice(t).join("/")), e(n);
		};
	}
}));
//#endregion
export default _();
export {};
