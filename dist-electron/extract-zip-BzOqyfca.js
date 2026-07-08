import { i as e, t } from "./rolldown-runtime-C6GIJ8is.js";
import { t as n } from "./src-DNwYZ0CH.js";
import { t as r } from "./pump-MsfR0OT9.js";
//#region node_modules/extract-zip/node_modules/get-stream/buffer-stream.js
var i = /* @__PURE__ */ t(((t, n) => {
	var { PassThrough: r } = e("stream");
	n.exports = (e) => {
		e = { ...e };
		let { array: t } = e, { encoding: n } = e, i = n === "buffer", a = !1;
		t ? a = !(n || i) : n ||= "utf8", i && (n = null);
		let o = new r({ objectMode: a });
		n && o.setEncoding(n);
		let s = 0, c = [];
		return o.on("data", (e) => {
			c.push(e), a ? s = c.length : s += e.length;
		}), o.getBufferedValue = () => t ? c : i ? Buffer.concat(c, s) : c.join(""), o.getBufferedLength = () => s, o;
	};
})), a = /* @__PURE__ */ t(((t, n) => {
	var { constants: a } = e("buffer"), o = r(), s = i(), c = class extends Error {
		constructor() {
			super("maxBuffer exceeded"), this.name = "MaxBufferError";
		}
	};
	async function l(e, t) {
		if (!e) return Promise.reject(/* @__PURE__ */ Error("Expected a stream"));
		t = {
			maxBuffer: Infinity,
			...t
		};
		let { maxBuffer: n } = t, r;
		return await new Promise((i, l) => {
			let u = (e) => {
				e && r.getBufferedLength() <= a.MAX_LENGTH && (e.bufferedData = r.getBufferedValue()), l(e);
			};
			r = o(e, s(t), (e) => {
				if (e) {
					u(e);
					return;
				}
				i();
			}), r.on("data", () => {
				r.getBufferedLength() > n && u(new c());
			});
		}), r.getBufferedValue();
	}
	n.exports = l, n.exports.default = l, n.exports.buffer = (e, t) => l(e, {
		...t,
		encoding: "buffer"
	}), n.exports.array = (e, t) => l(e, {
		...t,
		array: !0
	}), n.exports.MaxBufferError = c;
})), o = /* @__PURE__ */ t(((e, t) => {
	t.exports = n;
	function n() {
		this.pending = 0, this.max = Infinity, this.listeners = [], this.waiting = [], this.error = null;
	}
	n.prototype.go = function(e) {
		this.pending < this.max ? i(this, e) : this.waiting.push(e);
	}, n.prototype.wait = function(e) {
		this.pending === 0 ? e(this.error) : this.listeners.push(e);
	}, n.prototype.hold = function() {
		return r(this);
	};
	function r(e) {
		e.pending += 1;
		var t = !1;
		return n;
		function n(n) {
			if (t) throw Error("callback called twice");
			if (t = !0, e.error = e.error || n, --e.pending, e.waiting.length > 0 && e.pending < e.max) i(e, e.waiting.shift());
			else if (e.pending === 0) {
				var a = e.listeners;
				e.listeners = [], a.forEach(r);
			}
		}
		function r(t) {
			t(e.error);
		}
	}
	function i(e, t) {
		t(r(e));
	}
})), s = /* @__PURE__ */ t(((t) => {
	var n = e("fs"), r = e("util"), i = e("stream"), a = i.Readable, s = i.Writable, c = i.PassThrough, l = o(), u = e("events").EventEmitter;
	t.createFromBuffer = h, t.createFromFd = g, t.BufferSlicer = m, t.FdSlicer = d, r.inherits(d, u);
	function d(e, t) {
		t ||= {}, u.call(this), this.fd = e, this.pend = new l(), this.pend.max = 1, this.refCount = 0, this.autoClose = !!t.autoClose;
	}
	d.prototype.read = function(e, t, r, i, a) {
		var o = this;
		o.pend.go(function(s) {
			n.read(o.fd, e, t, r, i, function(e, t, n) {
				s(), a(e, t, n);
			});
		});
	}, d.prototype.write = function(e, t, r, i, a) {
		var o = this;
		o.pend.go(function(s) {
			n.write(o.fd, e, t, r, i, function(e, t, n) {
				s(), a(e, t, n);
			});
		});
	}, d.prototype.createReadStream = function(e) {
		return new f(this, e);
	}, d.prototype.createWriteStream = function(e) {
		return new p(this, e);
	}, d.prototype.ref = function() {
		this.refCount += 1;
	}, d.prototype.unref = function() {
		var e = this;
		if (--e.refCount, e.refCount > 0) return;
		if (e.refCount < 0) throw Error("invalid unref");
		e.autoClose && n.close(e.fd, t);
		function t(t) {
			t ? e.emit("error", t) : e.emit("close");
		}
	}, r.inherits(f, a);
	function f(e, t) {
		t ||= {}, a.call(this, t), this.context = e, this.context.ref(), this.start = t.start || 0, this.endOffset = t.end, this.pos = this.start, this.destroyed = !1;
	}
	f.prototype._read = function(e) {
		var t = this;
		if (!t.destroyed) {
			var r = Math.min(t._readableState.highWaterMark, e);
			if (t.endOffset != null && (r = Math.min(r, t.endOffset - t.pos)), r <= 0) {
				t.destroyed = !0, t.push(null), t.context.unref();
				return;
			}
			t.context.pend.go(function(e) {
				if (t.destroyed) return e();
				var i = new Buffer(r);
				n.read(t.context.fd, i, 0, r, t.pos, function(n, r) {
					n ? t.destroy(n) : r === 0 ? (t.destroyed = !0, t.push(null), t.context.unref()) : (t.pos += r, t.push(i.slice(0, r))), e();
				});
			});
		}
	}, f.prototype.destroy = function(e) {
		this.destroyed || (e ||= /* @__PURE__ */ Error("stream destroyed"), this.destroyed = !0, this.emit("error", e), this.context.unref());
	}, r.inherits(p, s);
	function p(e, t) {
		t ||= {}, s.call(this, t), this.context = e, this.context.ref(), this.start = t.start || 0, this.endOffset = t.end == null ? Infinity : +t.end, this.bytesWritten = 0, this.pos = this.start, this.destroyed = !1, this.on("finish", this.destroy.bind(this));
	}
	p.prototype._write = function(e, t, r) {
		var i = this;
		if (!i.destroyed) {
			if (i.pos + e.length > i.endOffset) {
				var a = /* @__PURE__ */ Error("maximum file length exceeded");
				a.code = "ETOOBIG", i.destroy(), r(a);
				return;
			}
			i.context.pend.go(function(t) {
				if (i.destroyed) return t();
				n.write(i.context.fd, e, 0, e.length, i.pos, function(e, n) {
					e ? (i.destroy(), t(), r(e)) : (i.bytesWritten += n, i.pos += n, i.emit("progress"), t(), r());
				});
			});
		}
	}, p.prototype.destroy = function() {
		this.destroyed || (this.destroyed = !0, this.context.unref());
	}, r.inherits(m, u);
	function m(e, t) {
		u.call(this), t ||= {}, this.refCount = 0, this.buffer = e, this.maxChunkSize = t.maxChunkSize || 2 ** 53 - 1;
	}
	m.prototype.read = function(e, t, n, r, i) {
		var a = r + n, o = a - this.buffer.length, s = o > 0 ? o : n;
		this.buffer.copy(e, t, r, a), setImmediate(function() {
			i(null, s);
		});
	}, m.prototype.write = function(e, t, n, r, i) {
		e.copy(this.buffer, r, t, t + n), setImmediate(function() {
			i(null, n, e);
		});
	}, m.prototype.createReadStream = function(e) {
		e ||= {};
		var t = new c(e);
		t.destroyed = !1, t.start = e.start || 0, t.endOffset = e.end, t.pos = t.endOffset || this.buffer.length;
		for (var n = this.buffer.slice(t.start, t.pos), r = 0;;) {
			var i = r + this.maxChunkSize;
			if (i >= n.length) {
				r < n.length && t.write(n.slice(r, n.length));
				break;
			}
			t.write(n.slice(r, i)), r = i;
		}
		return t.end(), t.destroy = function() {
			t.destroyed = !0;
		}, t;
	}, m.prototype.createWriteStream = function(e) {
		var t = this;
		e ||= {};
		var n = new s(e);
		return n.start = e.start || 0, n.endOffset = e.end == null ? this.buffer.length : +e.end, n.bytesWritten = 0, n.pos = n.start, n.destroyed = !1, n._write = function(e, r, i) {
			if (!n.destroyed) {
				var a = n.pos + e.length;
				if (a > n.endOffset) {
					var o = /* @__PURE__ */ Error("maximum file length exceeded");
					o.code = "ETOOBIG", n.destroyed = !0, i(o);
					return;
				}
				e.copy(t.buffer, n.pos, 0, e.length), n.bytesWritten += e.length, n.pos = a, n.emit("progress"), i();
			}
		}, n.destroy = function() {
			n.destroyed = !0;
		}, n;
	}, m.prototype.ref = function() {
		this.refCount += 1;
	}, m.prototype.unref = function() {
		if (--this.refCount, this.refCount < 0) throw Error("invalid unref");
	};
	function h(e, t) {
		return new m(e, t);
	}
	function g(e, t) {
		return new d(e, t);
	}
})), c = /* @__PURE__ */ t(((t, n) => {
	var r = e("buffer").Buffer, i = [
		0,
		1996959894,
		3993919788,
		2567524794,
		124634137,
		1886057615,
		3915621685,
		2657392035,
		249268274,
		2044508324,
		3772115230,
		2547177864,
		162941995,
		2125561021,
		3887607047,
		2428444049,
		498536548,
		1789927666,
		4089016648,
		2227061214,
		450548861,
		1843258603,
		4107580753,
		2211677639,
		325883990,
		1684777152,
		4251122042,
		2321926636,
		335633487,
		1661365465,
		4195302755,
		2366115317,
		997073096,
		1281953886,
		3579855332,
		2724688242,
		1006888145,
		1258607687,
		3524101629,
		2768942443,
		901097722,
		1119000684,
		3686517206,
		2898065728,
		853044451,
		1172266101,
		3705015759,
		2882616665,
		651767980,
		1373503546,
		3369554304,
		3218104598,
		565507253,
		1454621731,
		3485111705,
		3099436303,
		671266974,
		1594198024,
		3322730930,
		2970347812,
		795835527,
		1483230225,
		3244367275,
		3060149565,
		1994146192,
		31158534,
		2563907772,
		4023717930,
		1907459465,
		112637215,
		2680153253,
		3904427059,
		2013776290,
		251722036,
		2517215374,
		3775830040,
		2137656763,
		141376813,
		2439277719,
		3865271297,
		1802195444,
		476864866,
		2238001368,
		4066508878,
		1812370925,
		453092731,
		2181625025,
		4111451223,
		1706088902,
		314042704,
		2344532202,
		4240017532,
		1658658271,
		366619977,
		2362670323,
		4224994405,
		1303535960,
		984961486,
		2747007092,
		3569037538,
		1256170817,
		1037604311,
		2765210733,
		3554079995,
		1131014506,
		879679996,
		2909243462,
		3663771856,
		1141124467,
		855842277,
		2852801631,
		3708648649,
		1342533948,
		654459306,
		3188396048,
		3373015174,
		1466479909,
		544179635,
		3110523913,
		3462522015,
		1591671054,
		702138776,
		2966460450,
		3352799412,
		1504918807,
		783551873,
		3082640443,
		3233442989,
		3988292384,
		2596254646,
		62317068,
		1957810842,
		3939845945,
		2647816111,
		81470997,
		1943803523,
		3814918930,
		2489596804,
		225274430,
		2053790376,
		3826175755,
		2466906013,
		167816743,
		2097651377,
		4027552580,
		2265490386,
		503444072,
		1762050814,
		4150417245,
		2154129355,
		426522225,
		1852507879,
		4275313526,
		2312317920,
		282753626,
		1742555852,
		4189708143,
		2394877945,
		397917763,
		1622183637,
		3604390888,
		2714866558,
		953729732,
		1340076626,
		3518719985,
		2797360999,
		1068828381,
		1219638859,
		3624741850,
		2936675148,
		906185462,
		1090812512,
		3747672003,
		2825379669,
		829329135,
		1181335161,
		3412177804,
		3160834842,
		628085408,
		1382605366,
		3423369109,
		3138078467,
		570562233,
		1426400815,
		3317316542,
		2998733608,
		733239954,
		1555261956,
		3268935591,
		3050360625,
		752459403,
		1541320221,
		2607071920,
		3965973030,
		1969922972,
		40735498,
		2617837225,
		3943577151,
		1913087877,
		83908371,
		2512341634,
		3803740692,
		2075208622,
		213261112,
		2463272603,
		3855990285,
		2094854071,
		198958881,
		2262029012,
		4057260610,
		1759359992,
		534414190,
		2176718541,
		4139329115,
		1873836001,
		414664567,
		2282248934,
		4279200368,
		1711684554,
		285281116,
		2405801727,
		4167216745,
		1634467795,
		376229701,
		2685067896,
		3608007406,
		1308918612,
		956543938,
		2808555105,
		3495958263,
		1231636301,
		1047427035,
		2932959818,
		3654703836,
		1088359270,
		936918e3,
		2847714899,
		3736837829,
		1202900863,
		817233897,
		3183342108,
		3401237130,
		1404277552,
		615818150,
		3134207493,
		3453421203,
		1423857449,
		601450431,
		3009837614,
		3294710456,
		1567103746,
		711928724,
		3020668471,
		3272380065,
		1510334235,
		755167117
	];
	typeof Int32Array < "u" && (i = new Int32Array(i));
	function a(e) {
		if (r.isBuffer(e)) return e;
		var t = typeof r.alloc == "function" && typeof r.from == "function";
		if (typeof e == "number") return t ? r.alloc(e) : new r(e);
		if (typeof e == "string") return t ? r.from(e) : new r(e);
		throw Error("input must be buffer, number, or string, received " + typeof e);
	}
	function o(e) {
		var t = a(4);
		return t.writeInt32BE(e, 0), t;
	}
	function s(e, t) {
		e = a(e), r.isBuffer(t) && (t = t.readUInt32BE(0));
		for (var n = ~~t ^ -1, o = 0; o < e.length; o++) n = i[(n ^ e[o]) & 255] ^ n >>> 8;
		return n ^ -1;
	}
	function c() {
		return o(s.apply(null, arguments));
	}
	c.signed = function() {
		return s.apply(null, arguments);
	}, c.unsigned = function() {
		return s.apply(null, arguments) >>> 0;
	}, n.exports = c;
})), l = /* @__PURE__ */ t(((t) => {
	var n = e("fs"), r = e("zlib"), i = s(), a = c(), o = e("util"), l = e("events").EventEmitter, u = e("stream").Transform, d = e("stream").PassThrough, f = e("stream").Writable;
	t.open = p, t.fromFd = m, t.fromBuffer = h, t.fromRandomAccessReader = g, t.dosDateTimeToDate = x, t.validateFileName = S, t.ZipFile = _, t.Entry = b, t.RandomAccessReader = T;
	function p(e, t, r) {
		typeof t == "function" && (r = t, t = null), t ??= {}, t.autoClose ??= !0, t.lazyEntries ??= !1, t.decodeStrings ??= !0, t.validateEntrySizes ??= !0, t.strictFileNames ??= !1, r ??= j, n.open(e, "r", function(e, i) {
			if (e) return r(e);
			m(i, t, function(e, t) {
				e && n.close(i, j), r(e, t);
			});
		});
	}
	function m(e, t, r) {
		typeof t == "function" && (r = t, t = null), t ??= {}, t.autoClose ??= !1, t.lazyEntries ??= !1, t.decodeStrings ??= !0, t.validateEntrySizes ??= !0, t.strictFileNames ??= !1, r ??= j, n.fstat(e, function(n, a) {
			if (n) return r(n);
			g(i.createFromFd(e, { autoClose: !0 }), a.size, t, r);
		});
	}
	function h(e, t, n) {
		typeof t == "function" && (n = t, t = null), t ??= {}, t.autoClose = !1, t.lazyEntries ??= !1, t.decodeStrings ??= !0, t.validateEntrySizes ??= !0, t.strictFileNames ??= !1, g(i.createFromBuffer(e, { maxChunkSize: 65536 }), e.length, t, n);
	}
	function g(e, t, n, r) {
		typeof n == "function" && (r = n, n = null), n ??= {}, n.autoClose ??= !0, n.lazyEntries ??= !1, n.decodeStrings ??= !0;
		var i = !!n.decodeStrings;
		if (n.validateEntrySizes ??= !0, n.strictFileNames ??= !1, r ??= j, typeof t != "number") throw Error("expected totalSize parameter to be a number");
		if (t > 2 ** 53 - 1) throw Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
		e.ref();
		var a = 22, o = Math.min(a + 65535, t), s = A(o), c = t - s.length;
		C(e, s, 0, o, c, function(l) {
			if (l) return r(l);
			for (var u = o - a; u >= 0; --u) if (s.readUInt32LE(u) === 101010256) {
				var d = s.slice(u), f = d.readUInt16LE(4);
				if (f !== 0) return r(/* @__PURE__ */ Error("multi-disk zip files are not supported: found disk number: " + f));
				var p = d.readUInt16LE(10), m = d.readUInt32LE(16), h = d.readUInt16LE(20), g = d.length - a;
				if (h !== g) return r(/* @__PURE__ */ Error("invalid comment length. expected: " + g + ". found: " + h));
				var v = i ? O(d, 22, d.length, !1) : d.slice(22);
				if (!(p === 65535 || m === 4294967295)) return r(null, new _(e, m, t, p, v, n.autoClose, n.lazyEntries, i, n.validateEntrySizes, n.strictFileNames));
				var y = A(20), b = c + u - y.length;
				C(e, y, 0, y.length, b, function(a) {
					if (a) return r(a);
					if (y.readUInt32LE(0) !== 117853008) return r(/* @__PURE__ */ Error("invalid zip64 end of central directory locator signature"));
					var o = k(y, 8), s = A(56);
					C(e, s, 0, s.length, o, function(a) {
						return a ? r(a) : s.readUInt32LE(0) === 101075792 ? (p = k(s, 32), m = k(s, 48), r(null, new _(e, m, t, p, v, n.autoClose, n.lazyEntries, i, n.validateEntrySizes, n.strictFileNames))) : r(/* @__PURE__ */ Error("invalid zip64 end of central directory record signature"));
					});
				});
				return;
			}
			r(/* @__PURE__ */ Error("end of central directory record signature not found"));
		});
	}
	o.inherits(_, l);
	function _(e, t, n, r, i, a, o, s, c, u) {
		var d = this;
		l.call(d), d.reader = e, d.reader.on("error", function(e) {
			y(d, e);
		}), d.reader.once("close", function() {
			d.emit("close");
		}), d.readEntryCursor = t, d.fileSize = n, d.entryCount = r, d.comment = i, d.entriesRead = 0, d.autoClose = !!a, d.lazyEntries = !!o, d.decodeStrings = !!s, d.validateEntrySizes = !!c, d.strictFileNames = !!u, d.isOpen = !0, d.emittedError = !1, d.lazyEntries || d._readEntry();
	}
	_.prototype.close = function() {
		this.isOpen && (this.isOpen = !1, this.reader.unref());
	};
	function v(e, t) {
		e.autoClose && e.close(), y(e, t);
	}
	function y(e, t) {
		e.emittedError || (e.emittedError = !0, e.emit("error", t));
	}
	_.prototype.readEntry = function() {
		if (!this.lazyEntries) throw Error("readEntry() called without lazyEntries:true");
		this._readEntry();
	}, _.prototype._readEntry = function() {
		var e = this;
		if (e.entryCount === e.entriesRead) {
			setImmediate(function() {
				e.autoClose && e.close(), !e.emittedError && e.emit("end");
			});
			return;
		}
		if (!e.emittedError) {
			var t = A(46);
			C(e.reader, t, 0, t.length, e.readEntryCursor, function(n) {
				if (n) return v(e, n);
				if (!e.emittedError) {
					var r = new b(), i = t.readUInt32LE(0);
					if (i !== 33639248) return v(e, /* @__PURE__ */ Error("invalid central directory file header signature: 0x" + i.toString(16)));
					if (r.versionMadeBy = t.readUInt16LE(4), r.versionNeededToExtract = t.readUInt16LE(6), r.generalPurposeBitFlag = t.readUInt16LE(8), r.compressionMethod = t.readUInt16LE(10), r.lastModFileTime = t.readUInt16LE(12), r.lastModFileDate = t.readUInt16LE(14), r.crc32 = t.readUInt32LE(16), r.compressedSize = t.readUInt32LE(20), r.uncompressedSize = t.readUInt32LE(24), r.fileNameLength = t.readUInt16LE(28), r.extraFieldLength = t.readUInt16LE(30), r.fileCommentLength = t.readUInt16LE(32), r.internalFileAttributes = t.readUInt16LE(36), r.externalFileAttributes = t.readUInt32LE(38), r.relativeOffsetOfLocalHeader = t.readUInt32LE(42), r.generalPurposeBitFlag & 64) return v(e, /* @__PURE__ */ Error("strong encryption is not supported"));
					e.readEntryCursor += 46, t = A(r.fileNameLength + r.extraFieldLength + r.fileCommentLength), C(e.reader, t, 0, t.length, e.readEntryCursor, function(n) {
						if (n) return v(e, n);
						if (!e.emittedError) {
							var i = (r.generalPurposeBitFlag & 2048) != 0;
							r.fileName = e.decodeStrings ? O(t, 0, r.fileNameLength, i) : t.slice(0, r.fileNameLength);
							var o = r.fileNameLength + r.extraFieldLength, s = t.slice(r.fileNameLength, o);
							r.extraFields = [];
							for (var c = 0; c < s.length - 3;) {
								var l = s.readUInt16LE(c + 0), u = s.readUInt16LE(c + 2), d = c + 4, f = d + u;
								if (f > s.length) return v(e, /* @__PURE__ */ Error("extra field length exceeds extra field buffer size"));
								var p = A(u);
								s.copy(p, 0, d, f), r.extraFields.push({
									id: l,
									data: p
								}), c = f;
							}
							if (r.fileComment = e.decodeStrings ? O(t, o, o + r.fileCommentLength, i) : t.slice(o, o + r.fileCommentLength), r.comment = r.fileComment, e.readEntryCursor += t.length, e.entriesRead += 1, r.uncompressedSize === 4294967295 || r.compressedSize === 4294967295 || r.relativeOffsetOfLocalHeader === 4294967295) {
								for (var m = null, c = 0; c < r.extraFields.length; c++) {
									var h = r.extraFields[c];
									if (h.id === 1) {
										m = h.data;
										break;
									}
								}
								if (m == null) return v(e, /* @__PURE__ */ Error("expected zip64 extended information extra field"));
								var g = 0;
								if (r.uncompressedSize === 4294967295) {
									if (g + 8 > m.length) return v(e, /* @__PURE__ */ Error("zip64 extended information extra field does not include uncompressed size"));
									r.uncompressedSize = k(m, g), g += 8;
								}
								if (r.compressedSize === 4294967295) {
									if (g + 8 > m.length) return v(e, /* @__PURE__ */ Error("zip64 extended information extra field does not include compressed size"));
									r.compressedSize = k(m, g), g += 8;
								}
								if (r.relativeOffsetOfLocalHeader === 4294967295) {
									if (g + 8 > m.length) return v(e, /* @__PURE__ */ Error("zip64 extended information extra field does not include relative header offset"));
									r.relativeOffsetOfLocalHeader = k(m, g), g += 8;
								}
							}
							if (e.decodeStrings) for (var c = 0; c < r.extraFields.length; c++) {
								var h = r.extraFields[c];
								if (h.id === 28789) {
									if (h.data.length < 6 || h.data.readUInt8(0) !== 1) continue;
									var _ = h.data.readUInt32LE(1);
									if (a.unsigned(t.slice(0, r.fileNameLength)) !== _) continue;
									r.fileName = O(h.data, 5, h.data.length, !0);
									break;
								}
							}
							if (e.validateEntrySizes && r.compressionMethod === 0) {
								var y = r.uncompressedSize;
								if (r.isEncrypted() && (y += 12), r.compressedSize !== y) {
									var b = "compressed/uncompressed size mismatch for stored file: " + r.compressedSize + " != " + r.uncompressedSize;
									return v(e, Error(b));
								}
							}
							if (e.decodeStrings) {
								e.strictFileNames || (r.fileName = r.fileName.replace(/\\/g, "/"));
								var x = S(r.fileName, e.validateFileNameOptions);
								if (x != null) return v(e, Error(x));
							}
							e.emit("entry", r), e.lazyEntries || e._readEntry();
						}
					});
				}
			});
		}
	}, _.prototype.openReadStream = function(e, t, n) {
		var i = this, a = 0, o = e.compressedSize;
		if (n == null) n = t, t = {};
		else {
			if (t.decrypt != null) {
				if (!e.isEncrypted()) throw Error("options.decrypt can only be specified for encrypted entries");
				if (t.decrypt !== !1) throw Error("invalid options.decrypt value: " + t.decrypt);
				if (e.isCompressed() && t.decompress !== !1) throw Error("entry is encrypted and compressed, and options.decompress !== false");
			}
			if (t.decompress != null) {
				if (!e.isCompressed()) throw Error("options.decompress can only be specified for compressed entries");
				if (!(t.decompress === !1 || t.decompress === !0)) throw Error("invalid options.decompress value: " + t.decompress);
			}
			if (t.start != null || t.end != null) {
				if (e.isCompressed() && t.decompress !== !1) throw Error("start/end range not allowed for compressed entry without options.decompress === false");
				if (e.isEncrypted() && t.decrypt !== !1) throw Error("start/end range not allowed for encrypted entry without options.decrypt === false");
			}
			if (t.start != null) {
				if (a = t.start, a < 0) throw Error("options.start < 0");
				if (a > e.compressedSize) throw Error("options.start > entry.compressedSize");
			}
			if (t.end != null) {
				if (o = t.end, o < 0) throw Error("options.end < 0");
				if (o > e.compressedSize) throw Error("options.end > entry.compressedSize");
				if (o < a) throw Error("options.end < options.start");
			}
		}
		if (!i.isOpen) return n(/* @__PURE__ */ Error("closed"));
		if (e.isEncrypted() && t.decrypt !== !1) return n(/* @__PURE__ */ Error("entry is encrypted, and options.decrypt !== false"));
		i.reader.ref();
		var s = A(30);
		C(i.reader, s, 0, s.length, e.relativeOffsetOfLocalHeader, function(c) {
			try {
				if (c) return n(c);
				var l = s.readUInt32LE(0);
				if (l !== 67324752) return n(/* @__PURE__ */ Error("invalid local file header signature: 0x" + l.toString(16)));
				var u = s.readUInt16LE(26), d = s.readUInt16LE(28), f = e.relativeOffsetOfLocalHeader + s.length + u + d, p;
				if (e.compressionMethod === 0) p = !1;
				else if (e.compressionMethod === 8) p = t.decompress == null || t.decompress;
				else return n(/* @__PURE__ */ Error("unsupported compression method: " + e.compressionMethod));
				var m = f, h = m + e.compressedSize;
				if (e.compressedSize !== 0 && h > i.fileSize) return n(/* @__PURE__ */ Error("file data overflows file bounds: " + m + " + " + e.compressedSize + " > " + i.fileSize));
				var g = i.reader.createReadStream({
					start: m + a,
					end: m + o
				}), _ = g;
				if (p) {
					var v = !1, y = r.createInflateRaw();
					g.on("error", function(e) {
						setImmediate(function() {
							v || y.emit("error", e);
						});
					}), g.pipe(y), i.validateEntrySizes ? (_ = new w(e.uncompressedSize), y.on("error", function(e) {
						setImmediate(function() {
							v || _.emit("error", e);
						});
					}), y.pipe(_)) : _ = y, _.destroy = function() {
						v = !0, y !== _ && y.unpipe(_), g.unpipe(y), g.destroy();
					};
				}
				n(null, _);
			} finally {
				i.reader.unref();
			}
		});
	};
	function b() {}
	b.prototype.getLastModDate = function() {
		return x(this.lastModFileDate, this.lastModFileTime);
	}, b.prototype.isEncrypted = function() {
		return (this.generalPurposeBitFlag & 1) != 0;
	}, b.prototype.isCompressed = function() {
		return this.compressionMethod === 8;
	};
	function x(e, t) {
		var n = e & 31, r = (e >> 5 & 15) - 1, i = (e >> 9 & 127) + 1980, a = 0, o = (t & 31) * 2, s = t >> 5 & 63, c = t >> 11 & 31;
		return new Date(i, r, n, c, s, o, a);
	}
	function S(e) {
		return e.indexOf("\\") === -1 ? /^[a-zA-Z]:/.test(e) || /^\//.test(e) ? "absolute path: " + e : e.split("/").indexOf("..") === -1 ? null : "invalid relative path: " + e : "invalid characters in fileName: " + e;
	}
	function C(e, t, n, r, i, a) {
		if (r === 0) return setImmediate(function() {
			a(null, A(0));
		});
		e.read(t, n, r, i, function(e, t) {
			if (e) return a(e);
			if (t < r) return a(/* @__PURE__ */ Error("unexpected EOF"));
			a();
		});
	}
	o.inherits(w, u);
	function w(e) {
		u.call(this), this.actualByteCount = 0, this.expectedByteCount = e;
	}
	w.prototype._transform = function(e, t, n) {
		if (this.actualByteCount += e.length, this.actualByteCount > this.expectedByteCount) {
			var r = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
			return n(Error(r));
		}
		n(null, e);
	}, w.prototype._flush = function(e) {
		if (this.actualByteCount < this.expectedByteCount) {
			var t = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
			return e(Error(t));
		}
		e();
	}, o.inherits(T, l);
	function T() {
		l.call(this), this.refCount = 0;
	}
	T.prototype.ref = function() {
		this.refCount += 1;
	}, T.prototype.unref = function() {
		var e = this;
		if (--e.refCount, e.refCount > 0) return;
		if (e.refCount < 0) throw Error("invalid unref");
		e.close(t);
		function t(t) {
			if (t) return e.emit("error", t);
			e.emit("close");
		}
	}, T.prototype.createReadStream = function(e) {
		var t = e.start, n = e.end;
		if (t === n) {
			var r = new d();
			return setImmediate(function() {
				r.end();
			}), r;
		}
		var i = this._readStreamForRange(t, n), a = !1, o = new E(this);
		i.on("error", function(e) {
			setImmediate(function() {
				a || o.emit("error", e);
			});
		}), o.destroy = function() {
			i.unpipe(o), o.unref(), i.destroy();
		};
		var s = new w(n - t);
		return o.on("error", function(e) {
			setImmediate(function() {
				a || s.emit("error", e);
			});
		}), s.destroy = function() {
			a = !0, o.unpipe(s), o.destroy();
		}, i.pipe(o).pipe(s);
	}, T.prototype._readStreamForRange = function(e, t) {
		throw Error("not implemented");
	}, T.prototype.read = function(e, t, n, r, i) {
		var a = this.createReadStream({
			start: r,
			end: r + n
		}), o = new f(), s = 0;
		o._write = function(n, r, i) {
			n.copy(e, t + s, 0, n.length), s += n.length, i();
		}, o.on("finish", i), a.on("error", function(e) {
			i(e);
		}), a.pipe(o);
	}, T.prototype.close = function(e) {
		setImmediate(e);
	}, o.inherits(E, d);
	function E(e) {
		d.call(this), this.context = e, this.context.ref(), this.unreffedYet = !1;
	}
	E.prototype._flush = function(e) {
		this.unref(), e();
	}, E.prototype.unref = function(e) {
		this.unreffedYet || (this.unreffedYet = !0, this.context.unref());
	};
	var D = "\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0";
	function O(e, t, n, r) {
		if (r) return e.toString("utf8", t, n);
		for (var i = "", a = t; a < n; a++) i += D[e[a]];
		return i;
	}
	function k(e, t) {
		var n = e.readUInt32LE(t);
		return e.readUInt32LE(t + 4) * 4294967296 + n;
	}
	var A = typeof Buffer.allocUnsafe == "function" ? function(e) {
		return Buffer.allocUnsafe(e);
	} : function(e) {
		return new Buffer(e);
	};
	function j(e) {
		if (e) throw e;
	}
})), u = /* @__PURE__ */ t(((t, r) => {
	var i = n()("extract-zip"), { createWriteStream: o, promises: s } = e("fs"), c = a(), u = e("path"), { promisify: d } = e("util"), f = e("stream"), p = d(l().open), m = d(f.pipeline), h = class {
		constructor(e, t) {
			this.zipPath = e, this.opts = t;
		}
		async extract() {
			return i("opening", this.zipPath, "with opts", this.opts), this.zipfile = await p(this.zipPath, { lazyEntries: !0 }), this.canceled = !1, new Promise((e, t) => {
				this.zipfile.on("error", (e) => {
					this.canceled = !0, t(e);
				}), this.zipfile.readEntry(), this.zipfile.on("close", () => {
					this.canceled || (i("zip extraction complete"), e());
				}), this.zipfile.on("entry", async (e) => {
					/* istanbul ignore if */
					if (this.canceled) {
						i("skipping entry", e.fileName, { cancelled: this.canceled });
						return;
					}
					if (i("zipfile entry", e.fileName), e.fileName.startsWith("__MACOSX/")) {
						this.zipfile.readEntry();
						return;
					}
					let n = u.dirname(u.join(this.opts.dir, e.fileName));
					try {
						await s.mkdir(n, { recursive: !0 });
						let t = await s.realpath(n);
						if (u.relative(this.opts.dir, t).split(u.sep).includes("..")) throw Error(`Out of bound path "${t}" found while processing file ${e.fileName}`);
						await this.extractEntry(e), i("finished processing", e.fileName), this.zipfile.readEntry();
					} catch (e) {
						this.canceled = !0, this.zipfile.close(), t(e);
					}
				});
			});
		}
		async extractEntry(e) {
			/* istanbul ignore if */
			if (this.canceled) {
				i("skipping entry extraction", e.fileName, { cancelled: this.canceled });
				return;
			}
			this.opts.onEntry && this.opts.onEntry(e, this.zipfile);
			let t = u.join(this.opts.dir, e.fileName), n = e.externalFileAttributes >> 16 & 65535, r = 61440, a = (n & r) == 40960, l = (n & r) == 16384;
			!l && e.fileName.endsWith("/") && (l = !0);
			let f = e.versionMadeBy >> 8;
			l ||= f === 0 && e.externalFileAttributes === 16, i("extracting entry", {
				filename: e.fileName,
				isDir: l,
				isSymlink: a
			});
			let p = this.getExtractedMode(n, l) & 511, h = l ? t : u.dirname(t), g = { recursive: !0 };
			if (l && (g.mode = p), i("mkdir", {
				dir: h,
				...g
			}), await s.mkdir(h, g), l) return;
			i("opening read stream", t);
			let _ = await d(this.zipfile.openReadStream.bind(this.zipfile))(e);
			if (a) {
				let e = await c(_);
				i("creating symlink", e, t), await s.symlink(e, t);
			} else await m(_, o(t, { mode: p }));
		}
		getExtractedMode(e, t) {
			let n = e;
			return n === 0 && (t ? (this.opts.defaultDirMode && (n = parseInt(this.opts.defaultDirMode, 10)), n ||= 493) : (this.opts.defaultFileMode && (n = parseInt(this.opts.defaultFileMode, 10)), n ||= 420)), n;
		}
	};
	r.exports = async function(e, t) {
		if (i("creating target directory", t.dir), !u.isAbsolute(t.dir)) throw Error("Target directory is expected to be absolute");
		return await s.mkdir(t.dir, { recursive: !0 }), t.dir = await s.realpath(t.dir), new h(e, t).extract();
	};
}));
//#endregion
export default u();
export {};
