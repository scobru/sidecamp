import { i as __require, t as __commonJSMin } from "./rolldown-runtime-CE-6LUnI.js";
//#region node_modules/events-universal/default.js
var require_default = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = __require("events");
}));
//#endregion
//#region node_modules/fast-fifo/fixed-size.js
var require_fixed_size = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = class FixedFIFO {
		constructor(hwm) {
			if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
			this.buffer = new Array(hwm);
			this.mask = hwm - 1;
			this.top = 0;
			this.btm = 0;
			this.next = null;
		}
		clear() {
			this.top = this.btm = 0;
			this.next = null;
			this.buffer.fill(void 0);
		}
		push(data) {
			if (this.buffer[this.top] !== void 0) return false;
			this.buffer[this.top] = data;
			this.top = this.top + 1 & this.mask;
			return true;
		}
		shift() {
			const last = this.buffer[this.btm];
			if (last === void 0) return void 0;
			this.buffer[this.btm] = void 0;
			this.btm = this.btm + 1 & this.mask;
			return last;
		}
		peek() {
			return this.buffer[this.btm];
		}
		isEmpty() {
			return this.buffer[this.btm] === void 0;
		}
	};
}));
//#endregion
//#region node_modules/fast-fifo/index.js
var require_fast_fifo = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var FixedFIFO = require_fixed_size();
	module.exports = class FastFIFO {
		constructor(hwm) {
			this.hwm = hwm || 16;
			this.head = new FixedFIFO(this.hwm);
			this.tail = this.head;
			this.length = 0;
		}
		clear() {
			this.head = this.tail;
			this.head.clear();
			this.length = 0;
		}
		push(val) {
			this.length++;
			if (!this.head.push(val)) {
				const prev = this.head;
				this.head = prev.next = new FixedFIFO(2 * this.head.buffer.length);
				this.head.push(val);
			}
		}
		shift() {
			if (this.length !== 0) this.length--;
			const val = this.tail.shift();
			if (val === void 0 && this.tail.next) {
				const next = this.tail.next;
				this.tail.next = null;
				this.tail = next;
				return this.tail.shift();
			}
			return val;
		}
		peek() {
			const val = this.tail.peek();
			if (val === void 0 && this.tail.next) return this.tail.next.peek();
			return val;
		}
		isEmpty() {
			return this.length === 0;
		}
	};
}));
//#endregion
//#region node_modules/b4a/index.js
var require_b4a = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function isBuffer(value) {
		return Buffer.isBuffer(value) || value instanceof Uint8Array;
	}
	function isEncoding(encoding) {
		return Buffer.isEncoding(encoding);
	}
	function alloc(size, fill, encoding) {
		return Buffer.alloc(size, fill, encoding);
	}
	function allocUnsafe(size) {
		return Buffer.allocUnsafe(size);
	}
	function allocUnsafeSlow(size) {
		return Buffer.allocUnsafeSlow(size);
	}
	function byteLength(string, encoding) {
		return Buffer.byteLength(string, encoding);
	}
	function compare(a, b) {
		return Buffer.compare(a, b);
	}
	function concat(buffers, totalLength) {
		return Buffer.concat(buffers, totalLength);
	}
	function copy(source, target, targetStart, start, end) {
		return toBuffer(source).copy(target, targetStart, start, end);
	}
	function equals(a, b) {
		return toBuffer(a).equals(b);
	}
	function fill(buffer, value, offset, end, encoding) {
		return toBuffer(buffer).fill(value, offset, end, encoding);
	}
	function from(value, encodingOrOffset, length) {
		return Buffer.from(value, encodingOrOffset, length);
	}
	function includes(buffer, value, byteOffset, encoding) {
		return toBuffer(buffer).includes(value, byteOffset, encoding);
	}
	function indexOf(buffer, value, byfeOffset, encoding) {
		return toBuffer(buffer).indexOf(value, byfeOffset, encoding);
	}
	function lastIndexOf(buffer, value, byteOffset, encoding) {
		return toBuffer(buffer).lastIndexOf(value, byteOffset, encoding);
	}
	function swap16(buffer) {
		return toBuffer(buffer).swap16();
	}
	function swap32(buffer) {
		return toBuffer(buffer).swap32();
	}
	function swap64(buffer) {
		return toBuffer(buffer).swap64();
	}
	function toBuffer(buffer) {
		if (Buffer.isBuffer(buffer)) return buffer;
		return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	}
	function toString(buffer, encoding, start, end) {
		return toBuffer(buffer).toString(encoding, start, end);
	}
	function write(buffer, string, offset, length, encoding) {
		return toBuffer(buffer).write(string, offset, length, encoding);
	}
	function readDoubleBE(buffer, offset) {
		return toBuffer(buffer).readDoubleBE(offset);
	}
	function readDoubleLE(buffer, offset) {
		return toBuffer(buffer).readDoubleLE(offset);
	}
	function readFloatBE(buffer, offset) {
		return toBuffer(buffer).readFloatBE(offset);
	}
	function readFloatLE(buffer, offset) {
		return toBuffer(buffer).readFloatLE(offset);
	}
	function readInt32BE(buffer, offset) {
		return toBuffer(buffer).readInt32BE(offset);
	}
	function readInt32LE(buffer, offset) {
		return toBuffer(buffer).readInt32LE(offset);
	}
	function readUInt32BE(buffer, offset) {
		return toBuffer(buffer).readUInt32BE(offset);
	}
	function readUInt32LE(buffer, offset) {
		return toBuffer(buffer).readUInt32LE(offset);
	}
	function writeDoubleBE(buffer, value, offset) {
		return toBuffer(buffer).writeDoubleBE(value, offset);
	}
	function writeDoubleLE(buffer, value, offset) {
		return toBuffer(buffer).writeDoubleLE(value, offset);
	}
	function writeFloatBE(buffer, value, offset) {
		return toBuffer(buffer).writeFloatBE(value, offset);
	}
	function writeFloatLE(buffer, value, offset) {
		return toBuffer(buffer).writeFloatLE(value, offset);
	}
	function writeInt32BE(buffer, value, offset) {
		return toBuffer(buffer).writeInt32BE(value, offset);
	}
	function writeInt32LE(buffer, value, offset) {
		return toBuffer(buffer).writeInt32LE(value, offset);
	}
	function writeUInt32BE(buffer, value, offset) {
		return toBuffer(buffer).writeUInt32BE(value, offset);
	}
	function writeUInt32LE(buffer, value, offset) {
		return toBuffer(buffer).writeUInt32LE(value, offset);
	}
	module.exports = {
		isBuffer,
		isEncoding,
		alloc,
		allocUnsafe,
		allocUnsafeSlow,
		byteLength,
		compare,
		concat,
		copy,
		equals,
		fill,
		from,
		includes,
		indexOf,
		lastIndexOf,
		swap16,
		swap32,
		swap64,
		toBuffer,
		toString,
		write,
		readDoubleBE,
		readDoubleLE,
		readFloatBE,
		readFloatLE,
		readInt32BE,
		readInt32LE,
		readUInt32BE,
		readUInt32LE,
		writeDoubleBE,
		writeDoubleLE,
		writeFloatBE,
		writeFloatLE,
		writeInt32BE,
		writeInt32LE,
		writeUInt32BE,
		writeUInt32LE
	};
}));
//#endregion
//#region node_modules/text-decoder/lib/pass-through-decoder.js
var require_pass_through_decoder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var b4a = require_b4a();
	module.exports = class PassThroughDecoder {
		constructor(encoding) {
			this.encoding = encoding;
		}
		get remaining() {
			return 0;
		}
		decode(data) {
			return b4a.toString(data, this.encoding);
		}
		flush() {
			return "";
		}
	};
}));
//#endregion
//#region node_modules/text-decoder/lib/utf8-decoder.js
var require_utf8_decoder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var b4a = require_b4a();
	/**
	* https://encoding.spec.whatwg.org/#utf-8-decoder
	*/
	module.exports = class UTF8Decoder {
		constructor() {
			this._reset();
		}
		get remaining() {
			return this.bytesSeen;
		}
		decode(data) {
			if (data.byteLength === 0) return "";
			if (this.bytesNeeded === 0 && trailingIncomplete(data, 0) === 0) {
				this.bytesSeen = trailingBytesSeen(data);
				return b4a.toString(data, "utf8");
			}
			let result = "";
			let start = 0;
			if (this.bytesNeeded > 0) {
				while (start < data.byteLength) {
					const byte = data[start];
					if (byte < this.lowerBoundary || byte > this.upperBoundary) {
						result += "�";
						this._reset();
						break;
					}
					this.lowerBoundary = 128;
					this.upperBoundary = 191;
					this.codePoint = this.codePoint << 6 | byte & 63;
					this.bytesSeen++;
					start++;
					if (this.bytesSeen === this.bytesNeeded) {
						result += String.fromCodePoint(this.codePoint);
						this._reset();
						break;
					}
				}
				if (this.bytesNeeded > 0) return result;
			}
			const trailing = trailingIncomplete(data, start);
			const end = data.byteLength - trailing;
			if (end > start) result += b4a.toString(data, "utf8", start, end);
			for (let i = end; i < data.byteLength; i++) {
				const byte = data[i];
				if (this.bytesNeeded === 0) {
					if (byte <= 127) {
						this.bytesSeen = 0;
						result += String.fromCharCode(byte);
					} else if (byte >= 194 && byte <= 223) {
						this.bytesNeeded = 2;
						this.bytesSeen = 1;
						this.codePoint = byte & 31;
					} else if (byte >= 224 && byte <= 239) {
						if (byte === 224) this.lowerBoundary = 160;
						else if (byte === 237) this.upperBoundary = 159;
						this.bytesNeeded = 3;
						this.bytesSeen = 1;
						this.codePoint = byte & 15;
					} else if (byte >= 240 && byte <= 244) {
						if (byte === 240) this.lowerBoundary = 144;
						else if (byte === 244) this.upperBoundary = 143;
						this.bytesNeeded = 4;
						this.bytesSeen = 1;
						this.codePoint = byte & 7;
					} else {
						this.bytesSeen = 1;
						result += "�";
					}
					continue;
				}
				if (byte < this.lowerBoundary || byte > this.upperBoundary) {
					result += "�";
					i--;
					this._reset();
					continue;
				}
				this.lowerBoundary = 128;
				this.upperBoundary = 191;
				this.codePoint = this.codePoint << 6 | byte & 63;
				this.bytesSeen++;
				if (this.bytesSeen === this.bytesNeeded) {
					result += String.fromCodePoint(this.codePoint);
					this._reset();
				}
			}
			return result;
		}
		flush() {
			const result = this.bytesNeeded > 0 ? "�" : "";
			this._reset();
			return result;
		}
		_reset() {
			this.codePoint = 0;
			this.bytesNeeded = 0;
			this.bytesSeen = 0;
			this.lowerBoundary = 128;
			this.upperBoundary = 191;
		}
	};
	function trailingIncomplete(data, start) {
		const len = data.byteLength;
		if (len <= start) return 0;
		const limit = Math.max(start, len - 4);
		let i = len - 1;
		while (i > limit && (data[i] & 192) === 128) i--;
		if (i < start) return 0;
		const byte = data[i];
		let needed;
		if (byte <= 127) return 0;
		if (byte >= 194 && byte <= 223) needed = 2;
		else if (byte >= 224 && byte <= 239) needed = 3;
		else if (byte >= 240 && byte <= 244) needed = 4;
		else return 0;
		const available = len - i;
		return available < needed ? available : 0;
	}
	function trailingBytesSeen(data) {
		const len = data.byteLength;
		if (len === 0) return 0;
		const last = data[len - 1];
		if (last <= 127) return 0;
		if ((last & 192) !== 128) return 1;
		const limit = Math.max(0, len - 4);
		let i = len - 2;
		while (i >= limit && (data[i] & 192) === 128) i--;
		if (i < 0) return 1;
		const first = data[i];
		let needed;
		if (first >= 194 && first <= 223) needed = 2;
		else if (first >= 224 && first <= 239) needed = 3;
		else if (first >= 240 && first <= 244) needed = 4;
		else return 1;
		if (len - i !== needed) return 1;
		if (needed >= 3) {
			const second = data[i + 1];
			if (first === 224 && second < 160) return 1;
			if (first === 237 && second > 159) return 1;
			if (first === 240 && second < 144) return 1;
			if (first === 244 && second > 143) return 1;
		}
		return 0;
	}
}));
//#endregion
//#region node_modules/text-decoder/index.js
var require_text_decoder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var PassThroughDecoder = require_pass_through_decoder();
	var UTF8Decoder = require_utf8_decoder();
	module.exports = class TextDecoder {
		constructor(encoding = "utf8") {
			this.encoding = normalizeEncoding(encoding);
			switch (this.encoding) {
				case "utf8":
					this.decoder = new UTF8Decoder();
					break;
				case "utf16le":
				case "base64": throw new Error("Unsupported encoding: " + this.encoding);
				default: this.decoder = new PassThroughDecoder(this.encoding);
			}
		}
		get remaining() {
			return this.decoder.remaining;
		}
		push(data) {
			if (typeof data === "string") return data;
			return this.decoder.decode(data);
		}
		write(data) {
			return this.push(data);
		}
		end(data) {
			let result = "";
			if (data) result = this.push(data);
			result += this.decoder.flush();
			return result;
		}
	};
	function normalizeEncoding(encoding) {
		encoding = encoding.toLowerCase();
		switch (encoding) {
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
			case "hex": return encoding;
			default: throw new Error("Unknown encoding: " + encoding);
		}
	}
}));
//#endregion
//#region node_modules/streamx/index.js
var require_streamx = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { EventEmitter } = require_default();
	var STREAM_DESTROYED = /* @__PURE__ */ new Error("Stream was destroyed");
	var PREMATURE_CLOSE = /* @__PURE__ */ new Error("Premature close");
	var FIFO = require_fast_fifo();
	var TextDecoder = require_text_decoder();
	var qmt = typeof queueMicrotask === "undefined" ? (fn) => global.process.nextTick(fn) : queueMicrotask;
	var OPENING = 1;
	var PREDESTROYING = 2;
	var DESTROYING = 4;
	var DESTROYED = 8;
	var NOT_OPENING = 536870910;
	var NOT_PREDESTROYING = 536870909;
	var READ_UPDATING = 32;
	var READ_PRIMARY = 64;
	var READ_QUEUED = 128;
	var READ_RESUMED = 256;
	var READ_PIPE_DRAINED = 512;
	var READ_ENDING = 1024;
	var READ_EMIT_DATA = 2048;
	var READ_EMIT_READABLE = 4096;
	var READ_EMITTED_READABLE = 8192;
	var READ_DONE = 16384;
	var READ_NEXT_TICK = 32768;
	var READ_READ_AHEAD = 131072;
	var READ_FLOWING = 768;
	var READ_ACTIVE_AND_NEEDS_PUSH = 65552;
	var READ_PRIMARY_AND_ACTIVE = 80;
	var READ_EMIT_READABLE_AND_QUEUED = 4224;
	var READ_RESUMED_READ_AHEAD = 131328;
	var READ_NOT_ACTIVE = 536870895;
	var READ_NON_PRIMARY_AND_PUSHED = 536805311;
	var READ_PUSHED = 536805375;
	var READ_PAUSED = 536870655;
	var READ_NOT_QUEUED = 536862591;
	var READ_NOT_ENDING = 536869887;
	var READ_PIPE_NOT_DRAINED = 536870143;
	var READ_NOT_NEXT_TICK = 536838143;
	var READ_NOT_UPDATING = 536870879;
	var READ_NO_READ_AHEAD = 536739839;
	var READ_PAUSED_NO_READ_AHEAD = 536739583;
	var WRITE_ACTIVE = 1 << 18;
	var WRITE_UPDATING = 2 << 18;
	var WRITE_PRIMARY = 4 << 18;
	var WRITE_QUEUED = 8 << 18;
	var WRITE_UNDRAINED = 16 << 18;
	var WRITE_DONE = 32 << 18;
	var WRITE_EMIT_DRAIN = 64 << 18;
	var WRITE_NEXT_TICK = 128 << 18;
	var WRITE_WRITING = 256 << 18;
	var WRITE_FINISHING = 512 << 18;
	var WRITE_CORKED = 1024 << 18;
	var WRITE_NOT_ACTIVE = 469499903;
	var WRITE_NON_PRIMARY = 535822335;
	var WRITE_NOT_FINISHING = 402391039;
	var WRITE_DRAINED = 532676607;
	var WRITE_NOT_QUEUED = 534773759;
	var WRITE_NOT_NEXT_TICK = 503316479;
	var WRITE_NOT_UPDATING = 536346623;
	var WRITE_NOT_CORKED = 268435455;
	var ACTIVE = 262160;
	var NOT_ACTIVE = 536608751;
	var DONE = 8404992;
	var DESTROY_STATUS = 14;
	var OPEN_STATUS = 15;
	var AUTO_DESTROY = 8405006;
	var NON_PRIMARY = 535822271;
	var ACTIVE_OR_TICKING = 33587200;
	var IS_OPENING = 33587215;
	var READ_PRIMARY_STATUS = 17423;
	var READ_STATUS = 16527;
	var READ_ENDING_STATUS = 1167;
	var READ_READABLE_STATUS = 12431;
	var SHOULD_NOT_READ = 214047;
	var READ_BACKPRESSURE_STATUS = 17422;
	var READ_UPDATE_SYNC_STATUS = 32879;
	var READ_NEXT_TICK_OR_OPENING = 32769;
	var WRITE_PRIMARY_STATUS = 142606351;
	var WRITE_QUEUED_AND_UNDRAINED = 6291456;
	var WRITE_QUEUED_AND_ACTIVE = 2359296;
	var WRITE_DRAIN_STATUS = 6553615;
	var WRITE_STATUS = 270794767;
	var WRITE_PRIMARY_AND_ACTIVE = 1310720;
	var WRITE_ACTIVE_AND_WRITING = 67371008;
	var WRITE_FINISHING_STATUS = 144965647;
	var WRITE_BACKPRESSURE_STATUS = 146800654;
	var WRITE_UPDATE_SYNC_STATUS = 35127311;
	var WRITE_DROP_DATA = 142606350;
	var asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
	var WritableState = class {
		constructor(stream, { highWaterMark = 16384, map = null, mapWritable, byteLength, byteLengthWritable } = {}) {
			this.stream = stream;
			this.queue = new FIFO();
			this.highWaterMark = highWaterMark;
			this.buffered = 0;
			this.error = null;
			this.pipeline = null;
			this.drains = null;
			this.byteLength = byteLengthWritable || byteLength || defaultByteLength;
			this.map = mapWritable || map;
			this.afterWrite = afterWrite.bind(this);
			this.afterUpdateNextTick = updateWriteNT.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & WRITE_FINISHING) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & WRITE_DONE) !== 0;
		}
		push(data) {
			if ((this.stream._duplexState & WRITE_DROP_DATA) !== 0) return false;
			if (this.map !== null) data = this.map(data);
			this.buffered += this.byteLength(data);
			this.queue.push(data);
			if (this.buffered < this.highWaterMark) {
				this.stream._duplexState |= WRITE_QUEUED;
				return true;
			}
			this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
			return false;
		}
		shift() {
			const data = this.queue.shift();
			this.buffered -= this.byteLength(data);
			if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
			return data;
		}
		end(data) {
			if (typeof data === "function") this.stream.once("finish", data);
			else if (data !== void 0 && data !== null) this.push(data);
			this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
		}
		autoBatch(data, cb) {
			const buffer = [];
			const stream = this.stream;
			buffer.push(data);
			while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) buffer.push(stream._writableState.shift());
			if ((stream._duplexState & OPEN_STATUS) !== 0) return cb(null);
			stream._writev(buffer, cb);
		}
		update() {
			const stream = this.stream;
			stream._duplexState |= WRITE_UPDATING;
			do {
				while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
					const data = this.shift();
					stream._duplexState |= WRITE_ACTIVE_AND_WRITING;
					stream._write(data, this.afterWrite);
				}
				if ((stream._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
			} while (this.continueUpdate() === true);
			stream._duplexState &= WRITE_NOT_UPDATING;
		}
		updateNonPrimary() {
			const stream = this.stream;
			if ((stream._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
				stream._duplexState = stream._duplexState | WRITE_ACTIVE;
				stream._final(afterFinal.bind(this));
				return;
			}
			if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
				if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
					stream._duplexState |= ACTIVE;
					stream._destroy(afterDestroy.bind(this));
				}
				return;
			}
			if ((stream._duplexState & IS_OPENING) === OPENING) {
				stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
				stream._open(afterOpen.bind(this));
			}
		}
		continueUpdate() {
			if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
			this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
			return true;
		}
		updateCallback() {
			if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) this.update();
			else this.updateNextTick();
		}
		updateNextTick() {
			if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
			this.stream._duplexState |= WRITE_NEXT_TICK;
			if ((this.stream._duplexState & WRITE_UPDATING) === 0) qmt(this.afterUpdateNextTick);
		}
	};
	var ReadableState = class {
		constructor(stream, { highWaterMark = 16384, map = null, mapReadable, byteLength, byteLengthReadable } = {}) {
			this.stream = stream;
			this.queue = new FIFO();
			this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
			this.buffered = 0;
			this.readAhead = highWaterMark > 0;
			this.error = null;
			this.pipeline = null;
			this.byteLength = byteLengthReadable || byteLength || defaultByteLength;
			this.map = mapReadable || map;
			this.pipeTo = null;
			this.afterRead = afterRead.bind(this);
			this.afterUpdateNextTick = updateReadNT.bind(this);
		}
		get ending() {
			return (this.stream._duplexState & READ_ENDING) !== 0;
		}
		get ended() {
			return (this.stream._duplexState & READ_DONE) !== 0;
		}
		pipe(pipeTo, cb) {
			if (this.pipeTo !== null) throw new Error("Can only pipe to one destination");
			if (typeof cb !== "function") cb = null;
			this.stream._duplexState |= READ_PIPE_DRAINED;
			this.pipeTo = pipeTo;
			this.pipeline = new Pipeline(this.stream, pipeTo, cb);
			if (cb) this.stream.on("error", noop);
			if (isStreamx(pipeTo)) {
				pipeTo._writableState.pipeline = this.pipeline;
				if (cb) pipeTo.on("error", noop);
				pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
			} else {
				const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
				const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
				pipeTo.on("error", onerror);
				pipeTo.on("close", onclose);
				pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
			}
			pipeTo.on("drain", afterDrain.bind(this));
			this.stream.emit("piping", pipeTo);
			pipeTo.emit("pipe", this.stream);
		}
		push(data) {
			const stream = this.stream;
			if (data === null) {
				this.highWaterMark = 0;
				stream._duplexState = (stream._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
				return false;
			}
			if (this.map !== null) {
				data = this.map(data);
				if (data === null) {
					stream._duplexState &= READ_PUSHED;
					return this.buffered < this.highWaterMark;
				}
			}
			this.buffered += this.byteLength(data);
			this.queue.push(data);
			stream._duplexState = (stream._duplexState | READ_QUEUED) & READ_PUSHED;
			return this.buffered < this.highWaterMark;
		}
		shift() {
			const data = this.queue.shift();
			this.buffered -= this.byteLength(data);
			if (this.buffered === 0) this.stream._duplexState &= READ_NOT_QUEUED;
			return data;
		}
		unshift(data) {
			const pending = [this.map !== null ? this.map(data) : data];
			while (this.buffered > 0) pending.push(this.shift());
			for (let i = 0; i < pending.length - 1; i++) {
				const data = pending[i];
				this.buffered += this.byteLength(data);
				this.queue.push(data);
			}
			this.push(pending[pending.length - 1]);
		}
		read() {
			const stream = this.stream;
			if ((stream._duplexState & READ_STATUS) === READ_QUEUED) {
				const data = this.shift();
				if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
				if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
				return data;
			}
			if (this.readAhead === false) {
				stream._duplexState |= READ_READ_AHEAD;
				this.updateNextTick();
			}
			return null;
		}
		drain() {
			const stream = this.stream;
			while ((stream._duplexState & READ_STATUS) === READ_QUEUED && (stream._duplexState & READ_FLOWING) !== 0) {
				const data = this.shift();
				if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
				if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
			}
		}
		update() {
			const stream = this.stream;
			stream._duplexState |= READ_UPDATING;
			do {
				this.drain();
				while (this.buffered < this.highWaterMark && (stream._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
					stream._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
					stream._read(this.afterRead);
					this.drain();
				}
				if ((stream._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
					stream._duplexState |= READ_EMITTED_READABLE;
					stream.emit("readable");
				}
				if ((stream._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
			} while (this.continueUpdate() === true);
			stream._duplexState &= READ_NOT_UPDATING;
		}
		updateNonPrimary() {
			const stream = this.stream;
			if ((stream._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
				stream._duplexState = (stream._duplexState | READ_DONE) & READ_NOT_ENDING;
				stream.emit("end");
				if ((stream._duplexState & AUTO_DESTROY) === DONE) stream._duplexState |= DESTROYING;
				if (this.pipeTo !== null) this.pipeTo.end();
			}
			if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
				if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
					stream._duplexState |= ACTIVE;
					stream._destroy(afterDestroy.bind(this));
				}
				return;
			}
			if ((stream._duplexState & IS_OPENING) === OPENING) {
				stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
				stream._open(afterOpen.bind(this));
			}
		}
		continueUpdate() {
			if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
			this.stream._duplexState &= READ_NOT_NEXT_TICK;
			return true;
		}
		updateCallback() {
			if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) this.update();
			else this.updateNextTick();
		}
		updateNextTickIfOpen() {
			if ((this.stream._duplexState & READ_NEXT_TICK_OR_OPENING) !== 0) return;
			this.stream._duplexState |= READ_NEXT_TICK;
			if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
		}
		updateNextTick() {
			if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
			this.stream._duplexState |= READ_NEXT_TICK;
			if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
		}
	};
	var TransformState = class {
		constructor(stream) {
			this.data = null;
			this.afterTransform = afterTransform.bind(stream);
			this.afterFinal = null;
		}
	};
	var Pipeline = class {
		constructor(src, dst, cb) {
			this.from = src;
			this.to = dst;
			this.afterPipe = cb;
			this.error = null;
			this.pipeToFinished = false;
		}
		finished() {
			this.pipeToFinished = true;
		}
		done(stream, err) {
			if (err) this.error = err;
			if (stream === this.to) {
				this.to = null;
				if (this.from !== null) {
					if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) this.from.destroy(this.error || /* @__PURE__ */ new Error("Writable stream closed prematurely"));
					return;
				}
			}
			if (stream === this.from) {
				this.from = null;
				if (this.to !== null) {
					if ((stream._duplexState & READ_DONE) === 0) this.to.destroy(this.error || /* @__PURE__ */ new Error("Readable stream closed before ending"));
					return;
				}
			}
			if (this.afterPipe !== null) this.afterPipe(this.error);
			this.to = this.from = this.afterPipe = null;
		}
	};
	function afterDrain() {
		this.stream._duplexState |= READ_PIPE_DRAINED;
		this.updateCallback();
	}
	function afterFinal(err) {
		const stream = this.stream;
		if (err) stream.destroy(err);
		if ((stream._duplexState & DESTROY_STATUS) === 0) {
			stream._duplexState |= WRITE_DONE;
			stream.emit("finish");
		}
		if ((stream._duplexState & AUTO_DESTROY) === DONE) stream._duplexState |= DESTROYING;
		stream._duplexState &= WRITE_NOT_FINISHING;
		if ((stream._duplexState & WRITE_UPDATING) === 0) this.update();
		else this.updateNextTick();
	}
	function afterDestroy(err) {
		const stream = this.stream;
		if (!err && this.error !== STREAM_DESTROYED) err = this.error;
		if (err) stream.emit("error", err);
		stream._duplexState |= DESTROYED;
		stream.emit("close");
		const rs = stream._readableState;
		const ws = stream._writableState;
		if (rs !== null && rs.pipeline !== null) rs.pipeline.done(stream, err);
		if (ws !== null) {
			while (ws.drains !== null && ws.drains.length > 0) ws.drains.shift().resolve(false);
			if (ws.pipeline !== null) ws.pipeline.done(stream, err);
		}
	}
	function afterWrite(err) {
		const stream = this.stream;
		if (err) stream.destroy(err);
		stream._duplexState &= WRITE_NOT_ACTIVE;
		if (this.drains !== null) tickDrains(this.drains);
		if ((stream._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
			stream._duplexState &= WRITE_DRAINED;
			if ((stream._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) stream.emit("drain");
		}
		this.updateCallback();
	}
	function afterRead(err) {
		if (err) this.stream.destroy(err);
		this.stream._duplexState &= READ_NOT_ACTIVE;
		if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) this.stream._duplexState &= READ_NO_READ_AHEAD;
		this.updateCallback();
	}
	function updateReadNT() {
		if ((this.stream._duplexState & READ_UPDATING) === 0) {
			this.stream._duplexState &= READ_NOT_NEXT_TICK;
			this.update();
		}
	}
	function updateWriteNT() {
		if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
			this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
			this.update();
		}
	}
	function tickDrains(drains) {
		for (let i = 0; i < drains.length; i++) if (--drains[i].writes === 0) {
			drains.shift().resolve(true);
			i--;
		}
	}
	function afterOpen(err) {
		const stream = this.stream;
		if (err) stream.destroy(err);
		if ((stream._duplexState & DESTROYING) === 0) {
			if ((stream._duplexState & READ_PRIMARY_STATUS) === 0) stream._duplexState |= READ_PRIMARY;
			if ((stream._duplexState & WRITE_PRIMARY_STATUS) === 0) stream._duplexState |= WRITE_PRIMARY;
			stream.emit("open");
		}
		stream._duplexState &= NOT_ACTIVE;
		if (stream._writableState !== null) stream._writableState.updateCallback();
		if (stream._readableState !== null) stream._readableState.updateCallback();
	}
	function afterTransform(err, data) {
		if (data !== void 0 && data !== null) this.push(data);
		this._writableState.afterWrite(err);
	}
	function newListener(name) {
		if (this._readableState !== null) {
			if (name === "data") {
				this._duplexState |= 133376;
				this._readableState.updateNextTick();
			}
			if (name === "readable") {
				this._duplexState |= READ_EMIT_READABLE;
				this._readableState.updateNextTick();
			}
		}
		if (this._writableState !== null) {
			if (name === "drain") {
				this._duplexState |= WRITE_EMIT_DRAIN;
				this._writableState.updateNextTick();
			}
		}
	}
	var Stream = class extends EventEmitter {
		constructor(opts) {
			super();
			this._duplexState = 0;
			this._readableState = null;
			this._writableState = null;
			if (opts) {
				if (opts.open) this._open = opts.open;
				if (opts.destroy) this._destroy = opts.destroy;
				if (opts.predestroy) this._predestroy = opts.predestroy;
				if (opts.signal) opts.signal.addEventListener("abort", abort.bind(this));
			}
			this.on("newListener", newListener);
		}
		_open(cb) {
			cb(null);
		}
		_destroy(cb) {
			cb(null);
		}
		_predestroy() {}
		get readable() {
			return this._readableState !== null ? true : void 0;
		}
		get writable() {
			return this._writableState !== null ? true : void 0;
		}
		get destroyed() {
			return (this._duplexState & DESTROYED) !== 0;
		}
		get destroying() {
			return (this._duplexState & DESTROY_STATUS) !== 0;
		}
		destroy(err) {
			if ((this._duplexState & DESTROY_STATUS) === 0) {
				if (!err) err = STREAM_DESTROYED;
				this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
				if (this._readableState !== null) {
					this._readableState.highWaterMark = 0;
					this._readableState.error = err;
				}
				if (this._writableState !== null) {
					this._writableState.highWaterMark = 0;
					this._writableState.error = err;
				}
				this._duplexState |= PREDESTROYING;
				this._predestroy();
				this._duplexState &= NOT_PREDESTROYING;
				if (this._readableState !== null) this._readableState.updateNextTick();
				if (this._writableState !== null) this._writableState.updateNextTick();
			}
		}
	};
	var Readable = class Readable extends Stream {
		constructor(opts) {
			super(opts);
			this._duplexState |= 8519681;
			this._readableState = new ReadableState(this, opts);
			if (opts) {
				if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
				if (opts.read) this._read = opts.read;
				if (opts.eagerOpen) this._readableState.updateNextTick();
				if (opts.encoding) this.setEncoding(opts.encoding);
			}
		}
		setEncoding(encoding) {
			const dec = new TextDecoder(encoding);
			const map = this._readableState.map || echo;
			this._readableState.map = mapOrSkip;
			return this;
			function mapOrSkip(data) {
				const next = dec.push(data);
				return next === "" && (data.byteLength !== 0 || dec.remaining > 0) ? null : map(next);
			}
		}
		_read(cb) {
			cb(null);
		}
		pipe(dest, cb) {
			this._readableState.updateNextTick();
			this._readableState.pipe(dest, cb);
			return dest;
		}
		read() {
			this._readableState.updateNextTick();
			return this._readableState.read();
		}
		push(data) {
			this._readableState.updateNextTickIfOpen();
			return this._readableState.push(data);
		}
		unshift(data) {
			this._readableState.updateNextTickIfOpen();
			return this._readableState.unshift(data);
		}
		resume() {
			this._duplexState |= READ_RESUMED_READ_AHEAD;
			this._readableState.updateNextTick();
			return this;
		}
		pause() {
			this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
			return this;
		}
		static _fromAsyncIterator(ite, opts) {
			let destroy;
			const rs = new Readable({
				...opts,
				read(cb) {
					ite.next().then(push).then(cb.bind(null, null)).catch(cb);
				},
				predestroy() {
					destroy = ite.return();
				},
				destroy(cb) {
					if (!destroy) return cb(null);
					destroy.then(cb.bind(null, null)).catch(cb);
				}
			});
			return rs;
			function push(data) {
				if (data.done) rs.push(null);
				else rs.push(data.value);
			}
		}
		static from(data, opts) {
			if (isReadStreamx(data)) return data;
			if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
			if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
			let i = 0;
			return new Readable({
				...opts,
				read(cb) {
					this.push(i === data.length ? null : data[i++]);
					cb(null);
				}
			});
		}
		static isBackpressured(rs) {
			return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
		}
		static isPaused(rs) {
			return (rs._duplexState & READ_RESUMED) === 0;
		}
		[asyncIterator]() {
			const stream = this;
			let error = null;
			let promiseResolve = null;
			let promiseReject = null;
			this.on("error", (err) => {
				error = err;
			});
			this.on("readable", onreadable);
			this.on("close", onclose);
			return {
				[asyncIterator]() {
					return this;
				},
				next() {
					return new Promise(function(resolve, reject) {
						promiseResolve = resolve;
						promiseReject = reject;
						const data = stream.read();
						if (data !== null) ondata(data);
						else if ((stream._duplexState & DESTROYED) !== 0) ondata(null);
					});
				},
				return() {
					return destroy(null);
				},
				throw(err) {
					return destroy(err);
				}
			};
			function onreadable() {
				if (promiseResolve !== null) ondata(stream.read());
			}
			function onclose() {
				if (promiseResolve !== null) ondata(null);
			}
			function ondata(data) {
				if (promiseReject === null) return;
				if (error) promiseReject(error);
				else if (data === null && (stream._duplexState & READ_DONE) === 0) promiseReject(STREAM_DESTROYED);
				else promiseResolve({
					value: data,
					done: data === null
				});
				promiseReject = promiseResolve = null;
			}
			function destroy(err) {
				stream.destroy(err);
				return new Promise((resolve, reject) => {
					if (stream._duplexState & DESTROYED) return resolve({
						value: void 0,
						done: true
					});
					stream.once("close", function() {
						if (err) reject(err);
						else resolve({
							value: void 0,
							done: true
						});
					});
				});
			}
		}
	};
	var Writable = class extends Stream {
		constructor(opts) {
			super(opts);
			this._duplexState |= 16385;
			this._writableState = new WritableState(this, opts);
			if (opts) {
				if (opts.writev) this._writev = opts.writev;
				if (opts.write) this._write = opts.write;
				if (opts.final) this._final = opts.final;
				if (opts.eagerOpen) this._writableState.updateNextTick();
			}
		}
		cork() {
			this._duplexState |= WRITE_CORKED;
		}
		uncork() {
			this._duplexState &= WRITE_NOT_CORKED;
			this._writableState.updateNextTick();
		}
		_writev(batch, cb) {
			cb(null);
		}
		_write(data, cb) {
			this._writableState.autoBatch(data, cb);
		}
		_final(cb) {
			cb(null);
		}
		static isBackpressured(ws) {
			return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
		}
		static drained(ws) {
			if (ws.destroyed) return Promise.resolve(false);
			const state = ws._writableState;
			const writes = (isWritev(ws) ? Math.min(1, state.queue.length) : state.queue.length) + (ws._duplexState & WRITE_WRITING ? 1 : 0);
			if (writes === 0) return Promise.resolve(true);
			if (state.drains === null) state.drains = [];
			return new Promise((resolve) => {
				state.drains.push({
					writes,
					resolve
				});
			});
		}
		write(data) {
			this._writableState.updateNextTick();
			return this._writableState.push(data);
		}
		end(data) {
			this._writableState.updateNextTick();
			this._writableState.end(data);
			return this;
		}
	};
	var Duplex = class extends Readable {
		constructor(opts) {
			super(opts);
			this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
			this._writableState = new WritableState(this, opts);
			if (opts) {
				if (opts.writev) this._writev = opts.writev;
				if (opts.write) this._write = opts.write;
				if (opts.final) this._final = opts.final;
			}
		}
		cork() {
			this._duplexState |= WRITE_CORKED;
		}
		uncork() {
			this._duplexState &= WRITE_NOT_CORKED;
			this._writableState.updateNextTick();
		}
		_writev(batch, cb) {
			cb(null);
		}
		_write(data, cb) {
			this._writableState.autoBatch(data, cb);
		}
		_final(cb) {
			cb(null);
		}
		write(data) {
			this._writableState.updateNextTick();
			return this._writableState.push(data);
		}
		end(data) {
			this._writableState.updateNextTick();
			this._writableState.end(data);
			return this;
		}
	};
	var Transform = class extends Duplex {
		constructor(opts) {
			super(opts);
			this._transformState = new TransformState(this);
			if (opts) {
				if (opts.transform) this._transform = opts.transform;
				if (opts.flush) this._flush = opts.flush;
			}
		}
		_write(data, cb) {
			if (this._readableState.buffered >= this._readableState.highWaterMark) this._transformState.data = data;
			else this._transform(data, this._transformState.afterTransform);
		}
		_read(cb) {
			if (this._transformState.data !== null) {
				const data = this._transformState.data;
				this._transformState.data = null;
				cb(null);
				this._transform(data, this._transformState.afterTransform);
			} else cb(null);
		}
		destroy(err) {
			super.destroy(err);
			if (this._transformState.data !== null) {
				this._transformState.data = null;
				this._transformState.afterTransform();
			}
		}
		_transform(data, cb) {
			cb(null, data);
		}
		_flush(cb) {
			cb(null);
		}
		_final(cb) {
			this._transformState.afterFinal = cb;
			this._flush(transformAfterFlush.bind(this));
		}
	};
	var PassThrough = class extends Transform {};
	function transformAfterFlush(err, data) {
		const cb = this._transformState.afterFinal;
		if (err) return cb(err);
		if (data !== null && data !== void 0) this.push(data);
		this.push(null);
		cb(null);
	}
	function pipelinePromise(...streams) {
		return new Promise((resolve, reject) => {
			return pipeline(...streams, (err) => {
				if (err) return reject(err);
				resolve();
			});
		});
	}
	function pipeline(stream, ...streams) {
		const all = Array.isArray(stream) ? [...stream, ...streams] : [stream, ...streams];
		const done = all.length && typeof all[all.length - 1] === "function" ? all.pop() : null;
		if (all.length < 2) throw new Error("Pipeline requires at least 2 streams");
		let src = all[0];
		let dest = null;
		let error = null;
		for (let i = 1; i < all.length; i++) {
			dest = all[i];
			if (isStreamx(src)) src.pipe(dest, onerror);
			else {
				errorHandle(src, true, i > 1, onerror);
				src.pipe(dest);
			}
			src = dest;
		}
		if (done) {
			let fin = false;
			const autoDestroy = isStreamx(dest) || !!(dest._writableState && dest._writableState.autoDestroy);
			dest.on("error", (err) => {
				if (error === null) error = err;
			});
			dest.on("finish", () => {
				fin = true;
				if (!autoDestroy) done(error);
			});
			if (autoDestroy) dest.on("close", () => done(error || (fin ? null : PREMATURE_CLOSE)));
		}
		return dest;
		function errorHandle(s, rd, wr, onerror) {
			s.on("error", onerror);
			s.on("close", onclose);
			function onclose() {
				if (rd && s._readableState && !s._readableState.ended) return onerror(PREMATURE_CLOSE);
				if (wr && s._writableState && !s._writableState.ended) return onerror(PREMATURE_CLOSE);
			}
		}
		function onerror(err) {
			if (!err || error) return;
			error = err;
			for (const s of all) s.destroy(err);
		}
	}
	function echo(s) {
		return s;
	}
	function isStream(stream) {
		return !!stream._readableState || !!stream._writableState;
	}
	function isStreamx(stream) {
		return typeof stream._duplexState === "number" && isStream(stream);
	}
	function isEnding(stream) {
		return !!stream._readableState && stream._readableState.ending;
	}
	function isEnded(stream) {
		return !!stream._readableState && stream._readableState.ended;
	}
	function isFinishing(stream) {
		return !!stream._writableState && stream._writableState.ending;
	}
	function isFinished(stream) {
		return !!stream._writableState && stream._writableState.ended;
	}
	function getStreamError(stream, opts = {}) {
		const err = stream._readableState && stream._readableState.error || stream._writableState && stream._writableState.error;
		return !opts.all && err === STREAM_DESTROYED ? null : err;
	}
	function isReadStreamx(stream) {
		return isStreamx(stream) && stream.readable;
	}
	function isDisturbed(stream) {
		return (stream._duplexState & OPENING) !== OPENING || (stream._duplexState & DESTROYING) === DESTROYING || (stream._duplexState & ACTIVE_OR_TICKING) !== 0;
	}
	function isTypedArray(data) {
		return typeof data === "object" && data !== null && typeof data.byteLength === "number";
	}
	function defaultByteLength(data) {
		return isTypedArray(data) ? data.byteLength : 1024;
	}
	function noop() {}
	function abort() {
		this.destroy(/* @__PURE__ */ new Error("Stream aborted."));
	}
	function isWritev(s) {
		return s._writev !== Writable.prototype._writev && s._writev !== Duplex.prototype._writev;
	}
	module.exports = {
		pipeline,
		pipelinePromise,
		isStream,
		isStreamx,
		isEnding,
		isEnded,
		isFinishing,
		isFinished,
		isDisturbed,
		getStreamError,
		Stream,
		Writable,
		Readable,
		Duplex,
		Transform,
		PassThrough
	};
}));
//#endregion
export { require_default as a, require_fast_fifo as i, require_text_decoder as n, require_b4a as r, require_streamx as t };
