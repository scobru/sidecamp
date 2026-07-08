import { i as e, t } from "./rolldown-runtime-C6GIJ8is.js";
import { i as n, r, t as i } from "./streamx-BtYTG86G.js";
import { t as a } from "./pump-DQttRKCE.js";
//#region node_modules/@puppeteer/browsers/node_modules/tar-stream/headers.js
var o = /* @__PURE__ */ t(((e) => {
	var t = r(), n = "0000000000000000000", i = "7777777777777777777", a = 48, o = t.from([
		117,
		115,
		116,
		97,
		114,
		0
	]), s = t.from([a, a]), c = t.from([
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
		let n = t.alloc(512), r = e.name, i = "";
		if (e.typeflag === 5 && r[r.length - 1] !== "/" && (r += "/"), t.byteLength(r) !== r.length) return null;
		for (; t.byteLength(r) > 100;) {
			let e = r.indexOf("/");
			if (e === -1) return null;
			i += i ? "/" + r.slice(0, e) : r.slice(0, e), r = r.slice(e + 1);
		}
		return t.byteLength(r) > 100 || t.byteLength(i) > 155 || e.linkname && t.byteLength(e.linkname) > 100 ? null : (t.write(n, r), t.write(n, b(e.mode & u, 6), 100), t.write(n, b(e.uid, 6), 108), t.write(n, b(e.gid, 6), 116), S(e.size, n, 124), t.write(n, b(e.mtime.getTime() / 1e3 | 0, 11), 136), n[156] = a + _(e.type), e.linkname && t.write(n, e.linkname, 157), t.copy(o, n, d), t.copy(s, n, f), e.uname && t.write(n, e.uname, 265), e.gname && t.write(n, e.gname, 297), t.write(n, b(e.devmajor || 0, 6), 329), t.write(n, b(e.devminor || 0, 6), 337), i && t.write(n, i, 345), t.write(n, b(y(n), 6), 148), n);
	}, e.decode = function(e, t, n) {
		let r = e[156] === 0 ? 0 : e[156] - a, i = T(e, 0, 100, t), o = w(e, 100, 8), s = w(e, 108, 8), c = w(e, 116, 8), l = w(e, 124, 12), u = w(e, 136, 12), d = g(r), f = e[157] === 0 ? null : T(e, 157, 100, t), h = T(e, 265, 32), _ = T(e, 297, 32), v = w(e, 329, 8), b = w(e, 337, 8), x = y(e);
		if (x === 256) return null;
		if (x !== w(e, 148, 8)) throw Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
		if (p(e)) e[345] && (i = T(e, 345, 155, t) + "/" + i);
		else if (!m(e) && !n) throw Error("Invalid tar header: unknown format.");
		return r === 0 && i && i[i.length - 1] === "/" && (r = 5), {
			name: i,
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
		return t.equals(o, e.subarray(d, 263));
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
		return e = e.toString(8), e.length > t ? i.slice(0, t) + " " : n.slice(0, t - e.length) + e + " ";
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
})), s = /* @__PURE__ */ t(((e, t) => {
	var { Writable: a, Readable: s, getStreamError: c } = i(), l = n(), u = r(), d = o(), f = u.alloc(0), p = 4 * 1024 * 1024, m = class {
		constructor() {
			this.buffered = 0, this.shifted = 0, this.queue = new l(), this._offset = 0;
		}
		push(e) {
			this.buffered += e.byteLength, this.queue.push(e);
		}
		shiftFirst(e) {
			return this.buffered === 0 ? null : this._next(e);
		}
		shift(e) {
			if (e > this.buffered) return null;
			if (e === 0) return f;
			let t = this._next(e);
			if (e === t.byteLength) return t;
			let n = [t];
			for (; (e -= t.byteLength) > 0;) t = this._next(e), n.push(t);
			return u.concat(n);
		}
		_next(e) {
			let t = this.queue.peek(), n = t.byteLength - this._offset;
			if (e >= n) {
				let e = this._offset ? t.subarray(this._offset, t.byteLength) : t;
				return this.queue.shift(), this._offset = 0, this.buffered -= n, this.shifted += n, e;
			}
			return this.buffered -= e, this.shifted += e, t.subarray(this._offset, this._offset += e);
		}
	}, h = class extends s {
		constructor(e, t, n) {
			super(), this.header = t, this.offset = n, this._parent = e;
		}
		_read(e) {
			this.header.size === 0 && this.push(null), this._parent._stream === this && this._parent._update(), e(null);
		}
		_predestroy() {
			this._parent.destroy(c(this));
		}
		_detach() {
			this._parent._stream === this && (this._parent._stream = null, this._parent._missing = v(this.header.size), this._parent._update());
		}
		_destroy(e) {
			this._detach(), e(null);
		}
	}, g = class extends a {
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
				this._header = d.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
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
					this._gnuLongPath = d.decodeLongPath(e, this._filenameEncoding);
					break;
				case "gnu-long-link-path":
					this._gnuLongLinkPath = d.decodeLongPath(e, this._filenameEncoding);
					break;
				case "pax-global-header":
					this._paxGlobal = d.decodePax(e);
					break;
				case "pax-header":
					this._pax = this._paxGlobal === null ? d.decodePax(e) : Object.assign({}, this._paxGlobal, d.decodePax(e));
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
			this._stream && this._stream.destroy(c(this)), e(null);
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
})), c = /* @__PURE__ */ t(((t, n) => {
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
})), l = /* @__PURE__ */ t(((e, t) => {
	var { Readable: n, Writable: a, getStreamError: s } = i(), l = r(), u = c(), d = o(), f = 493, p = 420, m = l.alloc(1024), h = class extends a {
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
			if (this._isLinkname) return this._linkname = this._linkname ? l.concat([this._linkname, e]) : e, t(null);
			if (this._isVoid) return e.byteLength > 0 ? t(/* @__PURE__ */ Error("No body allowed for this entry")) : t();
			if (this.written += e.byteLength, this._pack.push(e)) return t();
			this._pack._drain = t;
		}
		_finish() {
			this._finished || (this._finished = !0, this._isLinkname && (this.header.linkname = this._linkname ? l.toString(this._linkname, "utf-8") : "", this._pack._encode(this.header)), y(this._pack, this.header.size), this._pack._done(this));
		}
		_final(e) {
			if (this.written !== this.header.size) return e(/* @__PURE__ */ Error("Size mismatch"));
			this._finish(), e(null);
		}
		_getError() {
			return s(this) || /* @__PURE__ */ Error("tar entry destroyed");
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
			typeof t == "function" && (n = t, t = null), n ||= v, (!e.size || e.type === "symlink") && (e.size = 0), e.type ||= _(e.mode), e.mode ||= e.type === "directory" ? f : p, e.uid ||= 0, e.gid ||= 0, e.mtime ||= /* @__PURE__ */ new Date(), typeof t == "string" && (t = l.from(t));
			let r = new h(this, e, n);
			return l.isBuffer(t) ? (e.size = t.byteLength, r.write(t), r.end(), r) : (r._isVoid, r);
		}
		finalize() {
			if (this._stream || this._pending.length > 0) {
				this._finalizing = !0;
				return;
			}
			this._finalized || (this._finalized = !0, this.push(m), this.push(null));
		}
		_done(e) {
			e === this._stream && (this._stream = null, this._finalizing && this.finalize(), this._pending.length && this._pending.shift()._continueOpen());
		}
		_encode(e) {
			if (!e.pax) {
				let t = d.encode(e);
				if (t) {
					this.push(t);
					return;
				}
			}
			this._encodePax(e);
		}
		_encodePax(e) {
			let t = d.encodePax({
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
			this.push(d.encode(n)), this.push(t), y(this, t.byteLength), n.size = e.size, n.type = e.type, this.push(d.encode(n));
		}
		_doDrain() {
			let e = this._drain;
			this._drain = v, e();
		}
		_predestroy() {
			let e = s(this);
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
		switch (e & u.S_IFMT) {
			case u.S_IFBLK: return "block-device";
			case u.S_IFCHR: return "character-device";
			case u.S_IFDIR: return "directory";
			case u.S_IFIFO: return "fifo";
			case u.S_IFLNK: return "symlink";
		}
		return "file";
	}
	function v() {}
	function y(e, t) {
		t &= 511, t && e.push(m.subarray(0, 512 - t));
	}
	function b(e) {
		return l.isBuffer(e) ? e : l.from(e);
	}
})), u = /* @__PURE__ */ t(((e) => {
	e.extract = s(), e.pack = l();
})), d = /* @__PURE__ */ t(((t) => {
	var n = u(), r = a(), i = e("fs"), o = e("path"), s = (global.Bare ? global.Bare.platform : process.platform) === "win32";
	t.pack = function(e, t) {
		e ||= ".", t ||= {};
		let a = t.fs || i, s = t.ignore || t.filter || h, c = t.mapStream || g, l = v(a, t.dereference ? a.stat : a.lstat, e, s, t.entries, t.sort), u = t.strict !== !1, f = typeof t.umask == "number" ? ~t.umask : ~d(), p = t.pack || n.pack(), m = t.finish || h, b = t.map || h, x = typeof t.dmode == "number" ? t.dmode : 0, S = typeof t.fmode == "number" ? t.fmode : 0;
		t.strip && (b = y(b, t.strip)), t.readable && (x |= 365, S |= 292), t.writable && (x |= 219, S |= 146), T();
		function C(t, n) {
			a.readlink(o.join(e, t), function(e, t) {
				if (e) return p.destroy(e);
				n.linkname = _(t), p.entry(n, T);
			});
		}
		function w(n, i, s) {
			if (p.destroyed) return;
			if (n) return p.destroy(n);
			if (!i) return t.finalize !== !1 && p.finalize(), m(p);
			if (s.isSocket()) return T();
			let l = {
				name: _(i),
				mode: (s.mode | (s.isDirectory() ? x : S)) & f,
				mtime: s.mtime,
				size: s.size,
				type: "file",
				uid: s.uid,
				gid: s.gid
			};
			if (s.isDirectory()) return l.size = 0, l.type = "directory", l = b(l) || l, p.entry(l, T);
			if (s.isSymbolicLink()) return l.size = 0, l.type = "symlink", l = b(l) || l, C(i, l);
			if (l = b(l) || l, !s.isFile()) return u ? p.destroy(/* @__PURE__ */ Error("unsupported type for " + i)) : T();
			let d = p.entry(l, T), h = c(a.createReadStream(o.join(e, i), {
				start: 0,
				end: l.size > 0 ? l.size - 1 : l.size
			}), l);
			h.on("error", function(e) {
				d.destroy(e);
			}), r(h, d);
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
	function d() {
		return !global.Bare && process.umask ? process.umask() : 0;
	}
	t.extract = function(e, t) {
		e ||= ".", t ||= {}, e = o.resolve(e);
		let a = t.fs || i, u = t.ignore || t.filter || h, m = t.mapStream || g, v = t.chown !== !1 && !s && l() === 0, b = t.extract || n.extract(), x = [], S = /* @__PURE__ */ new Date(), C = typeof t.umask == "number" ? ~t.umask : ~d(), w = t.strict !== !1, T = t.validateSymlinks !== !1, E = t.map || h, D = typeof t.dmode == "number" ? t.dmode : 0, O = typeof t.fmode == "number" ? t.fmode : 0;
		return t.strip && (E = y(E, t.strip)), t.readable && (D |= 365, O |= 292), t.writable && (D |= 219, O |= 146), b.on("entry", k), t.finish && b.on("finish", t.finish), b;
		function k(n, i, c) {
			n = E(n) || n, n.name = _(n.name);
			let l = o.join(e, o.join("/", n.name));
			if (u(l, n)) return i.resume(), c();
			let d = o.join(l, ".") === o.join(e, ".") ? e : o.dirname(l);
			p(a, d, o.join(e, "."), function(e, t) {
				if (e) return c(e);
				if (!t) return c(/* @__PURE__ */ Error(d + " is not a valid path"));
				if (n.type === "directory") return x.push([l, n.mtime]), N(l, {
					fs: a,
					own: v,
					uid: n.uid,
					gid: n.gid,
					mode: n.mode
				}, h);
				N(d, {
					fs: a,
					own: v,
					uid: n.uid,
					gid: n.gid,
					mode: 493
				}, function(e) {
					if (e) return c(e);
					switch (n.type) {
						case "file": return S();
						case "link": return y();
						case "symlink": return g();
					}
					if (w) return c(/* @__PURE__ */ Error("unsupported type for " + l + " (" + n.type + ")"));
					i.resume(), c();
				});
			});
			function h(t) {
				if (t) return c(t);
				if (o.join(l, ".") === o.join(e, ".")) return c();
				j(l, n, function(e) {
					if (e) return c(e);
					if (s) return c();
					M(l, n, c);
				});
			}
			function g() {
				if (s) return c();
				a.unlink(l, function() {
					let r = o.resolve(o.dirname(l), n.linkname);
					if (!b(r) && (T || t.strip)) return c(/* @__PURE__ */ Error(l + " is not a valid symlink"));
					f(a, r, o.join(e, "."), function(e, t) {
						if (e) return c(e);
						if (!t && T) return c(/* @__PURE__ */ Error(l + " is not a valid symlink"));
						a.symlink(n.linkname, l, h);
					});
				});
			}
			function y() {
				if (s) return c();
				a.unlink(l, function() {
					let r = o.join(e, o.join("/", n.linkname));
					a.realpath(r, function(e, n) {
						if (e || !b(n)) return c(/* @__PURE__ */ Error(l + " is not a valid hardlink"));
						a.link(n, l, function(e) {
							if (e && e.code === "EPERM" && t.hardlinkAsFilesFallback) return i = a.createReadStream(n), S();
							h(e);
						});
					});
				});
			}
			function b(t) {
				return t === e || t.startsWith(e + o.sep);
			}
			function S() {
				a.lstat(l, function(t, n) {
					if (!t && n.isSymbolicLink()) return a.unlink(l, e);
					e();
				});
				function e(e) {
					if (e) return c(e);
					let t = a.createWriteStream(l), o = m(i, n);
					t.on("error", function(e) {
						o.destroy(e);
					}), r(o, t, function(e) {
						if (e) return c(e);
						t.on("close", h);
					});
				}
			}
		}
		function A(e, t) {
			let n;
			for (; (n = c(x)) && e.slice(0, n[0].length) !== n[0];) x.pop();
			if (!n) return t();
			a.utimes(n[0], S, n[1], t);
		}
		function j(e, n, r) {
			if (t.utimes === !1) return r();
			if (n.type === "directory") return a.utimes(e, S, n.mtime, r);
			if (n.type === "symlink") return A(e, r);
			a.utimes(e, S, n.mtime, function(t) {
				if (t) return r(t);
				A(e, r);
			});
		}
		function M(e, t, n) {
			let r = t.type === "symlink", i = r ? a.lchmod : a.chmod, o = r ? a.lchown : a.chown;
			if (!i) return n();
			let s = (t.mode | (t.type === "directory" ? D : O)) & C & 511;
			o && v ? o.call(a, e, t.uid, t.gid, c) : c(null);
			function c(t) {
				if (t) return n(t);
				if (!i) return n();
				i.call(a, e, s, n);
			}
		}
		function N(e, t, n) {
			a.stat(e, function(r) {
				if (!r) return n(null);
				if (r.code !== "ENOENT") return n(r);
				a.mkdir(e, {
					mode: t.mode,
					recursive: !0
				}, function(r, i) {
					if (r) return n(r);
					M(e, t, n);
				});
			});
		}
	};
	function f(e, t, n, r) {
		if (t === n) return r(null, !0);
		if (!t.startsWith(n + o.sep)) return r(null, !1);
		e.lstat(t, function(i, a) {
			if (i && i.code !== "ENOENT" && i.code !== "EPERM") return r(i);
			if (i || !a.isSymbolicLink()) return f(e, o.join(t, ".."), n, r);
			r(null, !1);
		});
	}
	function p(e, t, n, r) {
		if (t === n) return r(null, !0);
		e.lstat(t, function(i, a) {
			if (i && i.code !== "ENOENT" && i.code !== "EPERM") return r(i);
			if (i || a.isDirectory()) return p(e, o.join(t, ".."), n, r);
			r(null, !1);
		});
	}
	function m(e, t) {
		return t === e || t.startsWith(e + o.sep);
	}
	function h() {}
	function g(e) {
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
			if (!m(c, o.resolve(n, u))) return l(/* @__PURE__ */ Error(u + " is not a valid path"));
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
export default d();
export {};
