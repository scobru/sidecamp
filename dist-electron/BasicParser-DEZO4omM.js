import { o as __toESM, r as __exportAll, t as __commonJSMin } from "./rolldown-runtime-CE-6LUnI.js";
import { textDecode } from "@borewit/text-codec";
//#region node_modules/ieee754/index.js
var require_ieee754 = /* @__PURE__ */ __commonJSMin(((exports) => {
	/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
	exports.read = function(buffer, offset, isLE, mLen, nBytes) {
		var e, m;
		var eLen = nBytes * 8 - mLen - 1;
		var eMax = (1 << eLen) - 1;
		var eBias = eMax >> 1;
		var nBits = -7;
		var i = isLE ? nBytes - 1 : 0;
		var d = isLE ? -1 : 1;
		var s = buffer[offset + i];
		i += d;
		e = s & (1 << -nBits) - 1;
		s >>= -nBits;
		nBits += eLen;
		for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);
		m = e & (1 << -nBits) - 1;
		e >>= -nBits;
		nBits += mLen;
		for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);
		if (e === 0) e = 1 - eBias;
		else if (e === eMax) return m ? NaN : (s ? -1 : 1) * Infinity;
		else {
			m = m + Math.pow(2, mLen);
			e = e - eBias;
		}
		return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
	};
	exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
		var e, m, c;
		var eLen = nBytes * 8 - mLen - 1;
		var eMax = (1 << eLen) - 1;
		var eBias = eMax >> 1;
		var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
		var i = isLE ? 0 : nBytes - 1;
		var d = isLE ? 1 : -1;
		var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
		value = Math.abs(value);
		if (isNaN(value) || value === Infinity) {
			m = isNaN(value) ? 1 : 0;
			e = eMax;
		} else {
			e = Math.floor(Math.log(value) / Math.LN2);
			if (value * (c = Math.pow(2, -e)) < 1) {
				e--;
				c *= 2;
			}
			if (e + eBias >= 1) value += rt / c;
			else value += rt * Math.pow(2, 1 - eBias);
			if (value * c >= 2) {
				e++;
				c /= 2;
			}
			if (e + eBias >= eMax) {
				m = 0;
				e = eMax;
			} else if (e + eBias >= 1) {
				m = (value * c - 1) * Math.pow(2, mLen);
				e = e + eBias;
			} else {
				m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
				e = 0;
			}
		}
		for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8);
		e = e << mLen | m;
		eLen += mLen;
		for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8);
		buffer[offset + i - d] |= s * 128;
	};
}));
//#endregion
//#region node_modules/token-types/lib/index.js
var lib_exports = /* @__PURE__ */ __exportAll({
	AnsiStringType: () => AnsiStringType,
	Float16_BE: () => Float16_BE,
	Float16_LE: () => Float16_LE,
	Float32_BE: () => Float32_BE,
	Float32_LE: () => Float32_LE,
	Float64_BE: () => Float64_BE,
	Float64_LE: () => Float64_LE,
	Float80_BE: () => Float80_BE,
	Float80_LE: () => Float80_LE,
	INT16_BE: () => INT16_BE,
	INT16_LE: () => INT16_LE,
	INT24_BE: () => INT24_BE,
	INT24_LE: () => INT24_LE,
	INT32_BE: () => INT32_BE,
	INT32_LE: () => INT32_LE,
	INT64_BE: () => INT64_BE,
	INT64_LE: () => INT64_LE,
	INT8: () => INT8,
	IgnoreType: () => IgnoreType,
	StringType: () => StringType,
	UINT16_BE: () => UINT16_BE,
	UINT16_LE: () => UINT16_LE,
	UINT24_BE: () => UINT24_BE,
	UINT24_LE: () => UINT24_LE,
	UINT32_BE: () => UINT32_BE,
	UINT32_LE: () => UINT32_LE,
	UINT64_BE: () => UINT64_BE,
	UINT64_LE: () => UINT64_LE,
	UINT8: () => UINT8,
	Uint8ArrayType: () => Uint8ArrayType
});
var import_ieee754 = /* @__PURE__ */ __toESM(require_ieee754(), 1);
function dv(array) {
	return new DataView(array.buffer, array.byteOffset);
}
var UINT8 = {
	len: 1,
	get(array, offset) {
		return dv(array).getUint8(offset);
	},
	put(array, offset, value) {
		dv(array).setUint8(offset, value);
		return offset + 1;
	}
};
/**
* 16-bit unsigned integer, Little Endian byte order
*/
var UINT16_LE = {
	len: 2,
	get(array, offset) {
		return dv(array).getUint16(offset, true);
	},
	put(array, offset, value) {
		dv(array).setUint16(offset, value, true);
		return offset + 2;
	}
};
/**
* 16-bit unsigned integer, Big Endian byte order
*/
var UINT16_BE = {
	len: 2,
	get(array, offset) {
		return dv(array).getUint16(offset);
	},
	put(array, offset, value) {
		dv(array).setUint16(offset, value);
		return offset + 2;
	}
};
/**
* 24-bit unsigned integer, Little Endian byte order
*/
var UINT24_LE = {
	len: 3,
	get(array, offset) {
		const dataView = dv(array);
		return dataView.getUint8(offset) + (dataView.getUint16(offset + 1, true) << 8);
	},
	put(array, offset, value) {
		const dataView = dv(array);
		dataView.setUint8(offset, value & 255);
		dataView.setUint16(offset + 1, value >> 8, true);
		return offset + 3;
	}
};
/**
* 24-bit unsigned integer, Big Endian byte order
*/
var UINT24_BE = {
	len: 3,
	get(array, offset) {
		const dataView = dv(array);
		return (dataView.getUint16(offset) << 8) + dataView.getUint8(offset + 2);
	},
	put(array, offset, value) {
		const dataView = dv(array);
		dataView.setUint16(offset, value >> 8);
		dataView.setUint8(offset + 2, value & 255);
		return offset + 3;
	}
};
/**
* 32-bit unsigned integer, Little Endian byte order
*/
var UINT32_LE = {
	len: 4,
	get(array, offset) {
		return dv(array).getUint32(offset, true);
	},
	put(array, offset, value) {
		dv(array).setUint32(offset, value, true);
		return offset + 4;
	}
};
/**
* 32-bit unsigned integer, Big Endian byte order
*/
var UINT32_BE = {
	len: 4,
	get(array, offset) {
		return dv(array).getUint32(offset);
	},
	put(array, offset, value) {
		dv(array).setUint32(offset, value);
		return offset + 4;
	}
};
/**
* 8-bit signed integer
*/
var INT8 = {
	len: 1,
	get(array, offset) {
		return dv(array).getInt8(offset);
	},
	put(array, offset, value) {
		dv(array).setInt8(offset, value);
		return offset + 1;
	}
};
/**
* 16-bit signed integer, Big Endian byte order
*/
var INT16_BE = {
	len: 2,
	get(array, offset) {
		return dv(array).getInt16(offset);
	},
	put(array, offset, value) {
		dv(array).setInt16(offset, value);
		return offset + 2;
	}
};
/**
* 16-bit signed integer, Little Endian byte order
*/
var INT16_LE = {
	len: 2,
	get(array, offset) {
		return dv(array).getInt16(offset, true);
	},
	put(array, offset, value) {
		dv(array).setInt16(offset, value, true);
		return offset + 2;
	}
};
/**
* 24-bit signed integer, Little Endian byte order
*/
var INT24_LE = {
	len: 3,
	get(array, offset) {
		const unsigned = UINT24_LE.get(array, offset);
		return unsigned > 8388607 ? unsigned - 16777216 : unsigned;
	},
	put(array, offset, value) {
		const dataView = dv(array);
		dataView.setUint8(offset, value & 255);
		dataView.setUint16(offset + 1, value >> 8, true);
		return offset + 3;
	}
};
/**
* 24-bit signed integer, Big Endian byte order
*/
var INT24_BE = {
	len: 3,
	get(array, offset) {
		const unsigned = UINT24_BE.get(array, offset);
		return unsigned > 8388607 ? unsigned - 16777216 : unsigned;
	},
	put(array, offset, value) {
		const dataView = dv(array);
		dataView.setUint16(offset, value >> 8);
		dataView.setUint8(offset + 2, value & 255);
		return offset + 3;
	}
};
/**
* 32-bit signed integer, Big Endian byte order
*/
var INT32_BE = {
	len: 4,
	get(array, offset) {
		return dv(array).getInt32(offset);
	},
	put(array, offset, value) {
		dv(array).setInt32(offset, value);
		return offset + 4;
	}
};
/**
* 32-bit signed integer, Big Endian byte order
*/
var INT32_LE = {
	len: 4,
	get(array, offset) {
		return dv(array).getInt32(offset, true);
	},
	put(array, offset, value) {
		dv(array).setInt32(offset, value, true);
		return offset + 4;
	}
};
/**
* 64-bit unsigned integer, Little Endian byte order
*/
var UINT64_LE = {
	len: 8,
	get(array, offset) {
		return dv(array).getBigUint64(offset, true);
	},
	put(array, offset, value) {
		dv(array).setBigUint64(offset, value, true);
		return offset + 8;
	}
};
/**
* 64-bit signed integer, Little Endian byte order
*/
var INT64_LE = {
	len: 8,
	get(array, offset) {
		return dv(array).getBigInt64(offset, true);
	},
	put(array, offset, value) {
		dv(array).setBigInt64(offset, value, true);
		return offset + 8;
	}
};
/**
* 64-bit unsigned integer, Big Endian byte order
*/
var UINT64_BE = {
	len: 8,
	get(array, offset) {
		return dv(array).getBigUint64(offset);
	},
	put(array, offset, value) {
		dv(array).setBigUint64(offset, value);
		return offset + 8;
	}
};
/**
* 64-bit signed integer, Big Endian byte order
*/
var INT64_BE = {
	len: 8,
	get(array, offset) {
		return dv(array).getBigInt64(offset);
	},
	put(array, offset, value) {
		dv(array).setBigInt64(offset, value);
		return offset + 8;
	}
};
/**
* IEEE 754 16-bit (half precision) float, big endian
*/
var Float16_BE = {
	len: 2,
	get(dataView, offset) {
		return import_ieee754.read(dataView, offset, false, 10, this.len);
	},
	put(dataView, offset, value) {
		import_ieee754.write(dataView, value, offset, false, 10, this.len);
		return offset + this.len;
	}
};
/**
* IEEE 754 16-bit (half precision) float, little endian
*/
var Float16_LE = {
	len: 2,
	get(array, offset) {
		return import_ieee754.read(array, offset, true, 10, this.len);
	},
	put(array, offset, value) {
		import_ieee754.write(array, value, offset, true, 10, this.len);
		return offset + this.len;
	}
};
/**
* IEEE 754 32-bit (single precision) float, big endian
*/
var Float32_BE = {
	len: 4,
	get(array, offset) {
		return dv(array).getFloat32(offset);
	},
	put(array, offset, value) {
		dv(array).setFloat32(offset, value);
		return offset + 4;
	}
};
/**
* IEEE 754 32-bit (single precision) float, little endian
*/
var Float32_LE = {
	len: 4,
	get(array, offset) {
		return dv(array).getFloat32(offset, true);
	},
	put(array, offset, value) {
		dv(array).setFloat32(offset, value, true);
		return offset + 4;
	}
};
/**
* IEEE 754 64-bit (double precision) float, big endian
*/
var Float64_BE = {
	len: 8,
	get(array, offset) {
		return dv(array).getFloat64(offset);
	},
	put(array, offset, value) {
		dv(array).setFloat64(offset, value);
		return offset + 8;
	}
};
/**
* IEEE 754 64-bit (double precision) float, little endian
*/
var Float64_LE = {
	len: 8,
	get(array, offset) {
		return dv(array).getFloat64(offset, true);
	},
	put(array, offset, value) {
		dv(array).setFloat64(offset, value, true);
		return offset + 8;
	}
};
/**
* IEEE 754 80-bit (extended precision) float, big endian
*/
var Float80_BE = {
	len: 10,
	get(array, offset) {
		return import_ieee754.read(array, offset, false, 63, this.len);
	},
	put(array, offset, value) {
		import_ieee754.write(array, value, offset, false, 63, this.len);
		return offset + this.len;
	}
};
/**
* IEEE 754 80-bit (extended precision) float, little endian
*/
var Float80_LE = {
	len: 10,
	get(array, offset) {
		return import_ieee754.read(array, offset, true, 63, this.len);
	},
	put(array, offset, value) {
		import_ieee754.write(array, value, offset, true, 63, this.len);
		return offset + this.len;
	}
};
/**
* Ignore a given number of bytes
*/
var IgnoreType = class {
	/**
	* @param len number of bytes to ignore
	*/
	constructor(len) {
		this.len = len;
	}
	get(_array, _off) {}
};
var Uint8ArrayType = class {
	constructor(len) {
		this.len = len;
	}
	get(array, offset) {
		return array.subarray(offset, offset + this.len);
	}
};
/**
* Consume a fixed number of bytes from the stream and return a string with a specified encoding.
* Supports all encodings supported by TextDecoder, plus 'windows-1252'.
*/
var StringType = class {
	constructor(len, encoding) {
		this.len = len;
		this.encoding = encoding;
	}
	get(data, offset = 0) {
		return textDecode(data.subarray(offset, offset + this.len), this.encoding);
	}
};
/**
* ANSI Latin 1 String using Windows-1252 (Code Page 1252)
* Windows-1252 is a superset of ISO 8859-1 / Latin-1.
*/
var AnsiStringType = class extends StringType {
	constructor(len) {
		super(len, "windows-1252");
	}
};
//#endregion
//#region node_modules/music-metadata/lib/ParseError.js
var makeParseError = (name) => {
	return class ParseError extends Error {
		constructor(message) {
			super(message);
			this.name = name;
		}
	};
};
var CouldNotDetermineFileTypeError = class extends makeParseError("CouldNotDetermineFileTypeError") {};
var UnsupportedFileTypeError = class extends makeParseError("UnsupportedFileTypeError") {};
var UnexpectedFileContentError = class extends makeParseError("UnexpectedFileContentError") {
	constructor(fileType, message) {
		super(message);
		this.fileType = fileType;
	}
	toString() {
		return `${this.name} (FileType: ${this.fileType}): ${this.message}`;
	}
};
var FieldDecodingError = class extends makeParseError("FieldDecodingError") {};
var InternalParserError = class extends makeParseError("InternalParserError") {};
var makeUnexpectedFileContentError = (fileType) => {
	return class extends UnexpectedFileContentError {
		constructor(message) {
			super(fileType, message);
		}
	};
};
//#endregion
//#region node_modules/music-metadata/lib/common/BasicParser.js
var BasicParser = class {
	/**
	* Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
	* @param {INativeMetadataCollector} metadata Output
	* @param {ITokenizer} tokenizer Input
	* @param {IOptions} options Parsing options
	*/
	constructor(metadata, tokenizer, options) {
		this.metadata = metadata;
		this.tokenizer = tokenizer;
		this.options = options;
	}
};
//#endregion
export { UINT64_BE as C, lib_exports as D, Uint8ArrayType as E, UINT32_LE as S, UINT8 as T, UINT16_BE as _, UnsupportedFileTypeError as a, UINT24_LE as b, Float64_BE as c, INT32_BE as d, INT32_LE as f, StringType as g, INT8 as h, InternalParserError as i, INT16_BE as l, INT64_LE as m, CouldNotDetermineFileTypeError as n, makeUnexpectedFileContentError as o, INT64_BE as p, FieldDecodingError as r, Float32_BE as s, BasicParser as t, INT24_BE as u, UINT16_LE as v, UINT64_LE as w, UINT32_BE as x, UINT24_BE as y };
