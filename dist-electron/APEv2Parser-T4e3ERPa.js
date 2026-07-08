import { o as __toESM } from "./rolldown-runtime-CE-6LUnI.js";
import { i as EndOfStreamError, n as AbstractTokenizer, r as AbortError } from "./lib-B-UefZpJ.js";
import { t as require_src } from "./src-NCeEzNk1.js";
import { E as Uint8ArrayType, O as textDecode, S as UINT32_LE, g as StringType, i as InternalParserError, k as textEncode, o as makeUnexpectedFileContentError, r as FieldDecodingError, t as BasicParser, v as UINT16_LE } from "./BasicParser-MO9PD0ns.js";
import { i as findZero, t as a2hex } from "./Util-D-SIkfaE.js";
//#region node_modules/strtok3/lib/stream/AbstractStreamReader.js
var AbstractStreamReader = class {
	constructor() {
		this.endOfStream = false;
		this.interrupted = false;
		/**
		* Store peeked data
		* @type {Array}
		*/
		this.peekQueue = [];
	}
	async peek(uint8Array, mayBeLess = false) {
		const bytesRead = await this.read(uint8Array, mayBeLess);
		this.peekQueue.push(uint8Array.subarray(0, bytesRead));
		return bytesRead;
	}
	async read(buffer, mayBeLess = false) {
		if (buffer.length === 0) return 0;
		let bytesRead = this.readFromPeekBuffer(buffer);
		if (!this.endOfStream) bytesRead += await this.readRemainderFromStream(buffer.subarray(bytesRead), mayBeLess);
		if (bytesRead === 0 && !mayBeLess) throw new EndOfStreamError();
		return bytesRead;
	}
	/**
	* Read chunk from stream
	* @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
	* @returns Number of bytes read
	*/
	readFromPeekBuffer(buffer) {
		let remaining = buffer.length;
		let bytesRead = 0;
		while (this.peekQueue.length > 0 && remaining > 0) {
			const peekData = this.peekQueue.pop();
			if (!peekData) throw new Error("peekData should be defined");
			const lenCopy = Math.min(peekData.length, remaining);
			buffer.set(peekData.subarray(0, lenCopy), bytesRead);
			bytesRead += lenCopy;
			remaining -= lenCopy;
			if (lenCopy < peekData.length) this.peekQueue.push(peekData.subarray(lenCopy));
		}
		return bytesRead;
	}
	async readRemainderFromStream(buffer, mayBeLess) {
		let bytesRead = 0;
		while (bytesRead < buffer.length && !this.endOfStream) {
			if (this.interrupted) throw new AbortError();
			const chunkLen = await this.readFromStream(buffer.subarray(bytesRead), mayBeLess);
			if (chunkLen === 0) break;
			bytesRead += chunkLen;
		}
		if (!mayBeLess && bytesRead < buffer.length) throw new EndOfStreamError();
		return bytesRead;
	}
};
//#endregion
//#region node_modules/strtok3/lib/stream/WebStreamReader.js
var WebStreamReader = class extends AbstractStreamReader {
	constructor(reader) {
		super();
		this.reader = reader;
	}
	async abort() {
		return this.close();
	}
	async close() {
		this.reader.releaseLock();
	}
};
//#endregion
//#region node_modules/strtok3/lib/stream/WebStreamByobReader.js
/**
* Read from a WebStream using a BYOB reader
* Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
*/
var WebStreamByobReader = class extends WebStreamReader {
	/**
	* Read from stream
	* @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
	* @param mayBeLess - If true, may fill the buffer partially
	* @protected Bytes read
	*/
	async readFromStream(buffer, mayBeLess) {
		if (buffer.length === 0) return 0;
		const result = await this.reader.read(new Uint8Array(buffer.length), { min: mayBeLess ? void 0 : buffer.length });
		if (result.done) this.endOfStream = result.done;
		if (result.value) {
			buffer.set(result.value);
			return result.value.length;
		}
		return 0;
	}
};
//#endregion
//#region node_modules/strtok3/lib/stream/WebStreamDefaultReader.js
var WebStreamDefaultReader = class extends AbstractStreamReader {
	constructor(reader) {
		super();
		this.reader = reader;
		this.buffer = null;
	}
	/**
	* Copy chunk to target, and store the remainder in this.buffer
	*/
	writeChunk(target, chunk) {
		const written = Math.min(chunk.length, target.length);
		target.set(chunk.subarray(0, written));
		if (written < chunk.length) this.buffer = chunk.subarray(written);
		else this.buffer = null;
		return written;
	}
	/**
	* Read from stream
	* @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
	* @param mayBeLess - If true, may fill the buffer partially
	* @protected Bytes read
	*/
	async readFromStream(buffer, mayBeLess) {
		if (buffer.length === 0) return 0;
		let totalBytesRead = 0;
		if (this.buffer) totalBytesRead += this.writeChunk(buffer, this.buffer);
		while (totalBytesRead < buffer.length && !this.endOfStream) {
			const result = await this.reader.read();
			if (result.done) {
				this.endOfStream = true;
				break;
			}
			if (result.value) totalBytesRead += this.writeChunk(buffer.subarray(totalBytesRead), result.value);
		}
		if (!mayBeLess && totalBytesRead === 0 && this.endOfStream) throw new EndOfStreamError();
		return totalBytesRead;
	}
	abort() {
		this.interrupted = true;
		return this.reader.cancel();
	}
	async close() {
		await this.abort();
		this.reader.releaseLock();
	}
};
//#endregion
//#region node_modules/strtok3/lib/stream/WebStreamReaderFactory.js
function makeWebStreamReader(stream) {
	try {
		const reader = stream.getReader({ mode: "byob" });
		if (reader instanceof ReadableStreamDefaultReader) return new WebStreamDefaultReader(reader);
		return new WebStreamByobReader(reader);
	} catch (error) {
		if (error instanceof TypeError) return new WebStreamDefaultReader(stream.getReader());
		throw error;
	}
}
//#endregion
//#region node_modules/strtok3/lib/ReadStreamTokenizer.js
var maxBufferSize = 256e3;
var ReadStreamTokenizer = class extends AbstractTokenizer {
	/**
	* Constructor
	* @param streamReader stream-reader to read from
	* @param options Tokenizer options
	*/
	constructor(streamReader, options) {
		super(options);
		this.streamReader = streamReader;
		this.fileInfo = options?.fileInfo ?? {};
	}
	/**
	* Read buffer from tokenizer
	* @param uint8Array - Target Uint8Array to fill with data read from the tokenizer-stream
	* @param options - Read behaviour options
	* @returns Promise with number of bytes read
	*/
	async readBuffer(uint8Array, options) {
		const normOptions = this.normalizeOptions(uint8Array, options);
		const skipBytes = normOptions.position - this.position;
		if (skipBytes > 0) {
			await this.ignore(skipBytes);
			return this.readBuffer(uint8Array, options);
		}
		if (skipBytes < 0) throw new Error("`options.position` must be equal or greater than `tokenizer.position`");
		if (normOptions.length === 0) return 0;
		const bytesRead = await this.streamReader.read(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
		this.position += bytesRead;
		if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) throw new EndOfStreamError();
		return bytesRead;
	}
	/**
	* Peek (read ahead) buffer from tokenizer
	* @param uint8Array - Uint8Array (or Buffer) to write data to
	* @param options - Read behaviour options
	* @returns Promise with number of bytes peeked
	*/
	async peekBuffer(uint8Array, options) {
		const normOptions = this.normalizeOptions(uint8Array, options);
		let bytesRead = 0;
		if (normOptions.position) {
			const skipBytes = normOptions.position - this.position;
			if (skipBytes > 0) {
				const skipBuffer = new Uint8Array(normOptions.length + skipBytes);
				bytesRead = await this.peekBuffer(skipBuffer, { mayBeLess: normOptions.mayBeLess });
				uint8Array.set(skipBuffer.subarray(skipBytes));
				return bytesRead - skipBytes;
			}
			if (skipBytes < 0) throw new Error("Cannot peek from a negative offset in a stream");
		}
		if (normOptions.length > 0) {
			try {
				bytesRead = await this.streamReader.peek(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
			} catch (err) {
				if (options?.mayBeLess && err instanceof EndOfStreamError) return 0;
				throw err;
			}
			if (!normOptions.mayBeLess && bytesRead < normOptions.length) throw new EndOfStreamError();
		}
		return bytesRead;
	}
	/**
	* @param length Number of bytes to ignore. Must be ≥ 0.
	*/
	async ignore(length) {
		if (length < 0) throw new RangeError("ignore length must be ≥ 0 bytes");
		const bufSize = Math.min(maxBufferSize, length);
		const buf = new Uint8Array(bufSize);
		let totBytesRead = 0;
		while (totBytesRead < length) {
			const remaining = length - totBytesRead;
			const bytesRead = await this.readBuffer(buf, { length: Math.min(bufSize, remaining) });
			if (bytesRead < 0) return bytesRead;
			totBytesRead += bytesRead;
		}
		return totBytesRead;
	}
	abort() {
		return this.streamReader.abort();
	}
	async close() {
		return this.streamReader.close();
	}
	supportsRandomAccess() {
		return false;
	}
};
//#endregion
//#region node_modules/strtok3/lib/BufferTokenizer.js
var BufferTokenizer = class extends AbstractTokenizer {
	/**
	* Construct BufferTokenizer
	* @param uint8Array - Uint8Array to tokenize
	* @param options Tokenizer options
	*/
	constructor(uint8Array, options) {
		super(options);
		this.uint8Array = uint8Array;
		this.fileInfo = {
			...options?.fileInfo ?? {},
			size: uint8Array.length
		};
	}
	/**
	* Read buffer from tokenizer
	* @param uint8Array - Uint8Array to tokenize
	* @param options - Read behaviour options
	* @returns {Promise<number>}
	*/
	async readBuffer(uint8Array, options) {
		if (options?.position) this.position = options.position;
		const bytesRead = await this.peekBuffer(uint8Array, options);
		this.position += bytesRead;
		return bytesRead;
	}
	/**
	* Peek (read ahead) buffer from tokenizer
	* @param uint8Array
	* @param options - Read behaviour options
	* @returns {Promise<number>}
	*/
	async peekBuffer(uint8Array, options) {
		const normOptions = this.normalizeOptions(uint8Array, options);
		const bytes2read = Math.min(this.uint8Array.length - normOptions.position, normOptions.length);
		if (!normOptions.mayBeLess && bytes2read < normOptions.length) throw new EndOfStreamError();
		uint8Array.set(this.uint8Array.subarray(normOptions.position, normOptions.position + bytes2read));
		return bytes2read;
	}
	close() {
		return super.close();
	}
	supportsRandomAccess() {
		return true;
	}
	setPosition(position) {
		this.position = position;
	}
};
//#endregion
//#region node_modules/strtok3/lib/BlobTokenizer.js
var BlobTokenizer = class extends AbstractTokenizer {
	/**
	* Construct BufferTokenizer
	* @param blob - Uint8Array to tokenize
	* @param options Tokenizer options
	*/
	constructor(blob, options) {
		super(options);
		this.blob = blob;
		this.fileInfo = {
			...options?.fileInfo ?? {},
			size: blob.size,
			mimeType: blob.type
		};
	}
	/**
	* Read buffer from tokenizer
	* @param uint8Array - Uint8Array to tokenize
	* @param options - Read behaviour options
	* @returns {Promise<number>}
	*/
	async readBuffer(uint8Array, options) {
		if (options?.position) this.position = options.position;
		const bytesRead = await this.peekBuffer(uint8Array, options);
		this.position += bytesRead;
		return bytesRead;
	}
	/**
	* Peek (read ahead) buffer from tokenizer
	* @param buffer
	* @param options - Read behaviour options
	* @returns {Promise<number>}
	*/
	async peekBuffer(buffer, options) {
		const normOptions = this.normalizeOptions(buffer, options);
		const bytes2read = Math.min(this.blob.size - normOptions.position, normOptions.length);
		if (!normOptions.mayBeLess && bytes2read < normOptions.length) throw new EndOfStreamError();
		const arrayBuffer = await this.blob.slice(normOptions.position, normOptions.position + bytes2read).arrayBuffer();
		buffer.set(new Uint8Array(arrayBuffer));
		return bytes2read;
	}
	close() {
		return super.close();
	}
	supportsRandomAccess() {
		return true;
	}
	setPosition(position) {
		this.position = position;
	}
};
//#endregion
//#region node_modules/strtok3/lib/core.js
/**
* Construct ReadStreamTokenizer from given ReadableStream (WebStream API).
* Will set fileSize, if provided given Stream has set the .path property/
* @param webStream - Read from Node.js Stream.Readable (must be a byte stream)
* @param options - Tokenizer options
* @returns ReadStreamTokenizer
*/
function fromWebStream(webStream, options) {
	const webStreamReader = makeWebStreamReader(webStream);
	const _options = options ?? {};
	const chainedClose = _options.onClose;
	_options.onClose = async () => {
		await webStreamReader.close();
		if (chainedClose) return chainedClose();
	};
	return new ReadStreamTokenizer(webStreamReader, _options);
}
/**
* Construct ReadStreamTokenizer from given Buffer.
* @param uint8Array - Uint8Array to tokenize
* @param options - Tokenizer options
* @returns BufferTokenizer
*/
function fromBuffer(uint8Array, options) {
	return new BufferTokenizer(uint8Array, options);
}
/**
* Construct ReadStreamTokenizer from given Blob.
* @param blob - Uint8Array to tokenize
* @param options - Tokenizer options
* @returns BufferTokenizer
*/
function fromBlob(blob, options) {
	return new BlobTokenizer(blob, options);
}
//#endregion
//#region node_modules/music-metadata/lib/common/FourCC.js
var import_src = /* @__PURE__ */ __toESM(require_src(), 1);
var validFourCC = /^[\x21-\x7e©][\x20-\x7e\x00()]{3}/;
/**
* Token for read FourCC
* Ref: https://en.wikipedia.org/wiki/FourCC
*/
var FourCcToken = {
	len: 4,
	get: (buf, off) => {
		const id = textDecode(buf.subarray(off, off + FourCcToken.len), "latin1");
		if (!id.match(validFourCC)) throw new FieldDecodingError(`FourCC contains invalid characters: ${a2hex(id)} "${id}"`);
		return id;
	},
	put: (buffer, offset, id) => {
		const str = textEncode(id, "latin1");
		if (str.length !== 4) throw new InternalParserError("Invalid length");
		buffer.set(str, offset);
		return offset + 4;
	}
};
//#endregion
//#region node_modules/music-metadata/lib/apev2/APEv2Token.js
var DataType = {
	text_utf8: 0,
	binary: 1,
	external_info: 2,
	reserved: 3
};
/**
* APE_DESCRIPTOR: defines the sizes (and offsets) of all the pieces, as well as the MD5 checksum
*/
var DescriptorParser = {
	len: 52,
	get: (buf, off) => {
		return {
			ID: FourCcToken.get(buf, off),
			version: UINT32_LE.get(buf, off + 4) / 1e3,
			descriptorBytes: UINT32_LE.get(buf, off + 8),
			headerBytes: UINT32_LE.get(buf, off + 12),
			seekTableBytes: UINT32_LE.get(buf, off + 16),
			headerDataBytes: UINT32_LE.get(buf, off + 20),
			apeFrameDataBytes: UINT32_LE.get(buf, off + 24),
			apeFrameDataBytesHigh: UINT32_LE.get(buf, off + 28),
			terminatingDataBytes: UINT32_LE.get(buf, off + 32),
			fileMD5: new Uint8ArrayType(16).get(buf, off + 36)
		};
	}
};
/**
* APE_HEADER: describes all of the necessary information about the APE file
*/
var Header = {
	len: 24,
	get: (buf, off) => {
		return {
			compressionLevel: UINT16_LE.get(buf, off),
			formatFlags: UINT16_LE.get(buf, off + 2),
			blocksPerFrame: UINT32_LE.get(buf, off + 4),
			finalFrameBlocks: UINT32_LE.get(buf, off + 8),
			totalFrames: UINT32_LE.get(buf, off + 12),
			bitsPerSample: UINT16_LE.get(buf, off + 16),
			channel: UINT16_LE.get(buf, off + 18),
			sampleRate: UINT32_LE.get(buf, off + 20)
		};
	}
};
/**
* APE Tag Header/Footer Version 2.0
* TAG: describes all the properties of the file [optional]
*/
var TagFooter = {
	len: 32,
	get: (buf, off) => {
		return {
			ID: new StringType(8, "ascii").get(buf, off),
			version: UINT32_LE.get(buf, off + 8),
			size: UINT32_LE.get(buf, off + 12),
			fields: UINT32_LE.get(buf, off + 16),
			flags: parseTagFlags(UINT32_LE.get(buf, off + 20))
		};
	}
};
/**
* APE Tag v2.0 Item Header
*/
var TagItemHeader = {
	len: 8,
	get: (buf, off) => {
		return {
			size: UINT32_LE.get(buf, off),
			flags: parseTagFlags(UINT32_LE.get(buf, off + 4))
		};
	}
};
function parseTagFlags(flags) {
	return {
		containsHeader: isBitSet(flags, 31),
		containsFooter: isBitSet(flags, 30),
		isHeader: isBitSet(flags, 29),
		readOnly: isBitSet(flags, 0),
		dataType: (flags & 6) >> 1
	};
}
/**
* @param num {number}
* @param bit 0 is least significant bit (LSB)
* @return {boolean} true if bit is 1; otherwise false
*/
function isBitSet(num, bit) {
	return (num & 1 << bit) !== 0;
}
//#endregion
//#region node_modules/music-metadata/lib/apev2/APEv2Parser.js
var debug = (0, import_src.default)("music-metadata:parser:APEv2");
var tagFormat = "APEv2";
var preamble = "APETAGEX";
var ApeContentError = class extends makeUnexpectedFileContentError("APEv2") {};
function tryParseApeHeader(metadata, tokenizer, options) {
	return new APEv2Parser(metadata, tokenizer, options).tryParseApeHeader();
}
var APEv2Parser = class APEv2Parser extends BasicParser {
	constructor() {
		super(...arguments);
		this.ape = {};
	}
	/**
	* Calculate the media file duration
	* @param ah ApeHeader
	* @return {number} duration in seconds
	*/
	static calculateDuration(ah) {
		let duration = ah.totalFrames > 1 ? ah.blocksPerFrame * (ah.totalFrames - 1) : 0;
		duration += ah.finalFrameBlocks;
		return duration / ah.sampleRate;
	}
	/**
	* Calculates the APEv1 / APEv2 first field offset
	* @param tokenizer
	* @param offset
	*/
	static async findApeFooterOffset(tokenizer, offset) {
		const apeBuf = new Uint8Array(TagFooter.len);
		const position = tokenizer.position;
		if (offset <= TagFooter.len) {
			debug(`Offset is too small to read APE footer: offset=${offset}`);
			return;
		}
		if (offset > TagFooter.len) {
			await tokenizer.readBuffer(apeBuf, { position: offset - TagFooter.len });
			tokenizer.setPosition(position);
			const tagFooter = TagFooter.get(apeBuf, 0);
			if (tagFooter.ID === "APETAGEX") {
				if (tagFooter.flags.isHeader) debug(`APE Header found at offset=${offset - TagFooter.len}`);
				else {
					debug(`APE Footer found at offset=${offset - TagFooter.len}`);
					offset -= tagFooter.size;
				}
				return {
					footer: tagFooter,
					offset
				};
			}
		}
	}
	static parseTagFooter(metadata, buffer, options) {
		const footer = TagFooter.get(buffer, buffer.length - TagFooter.len);
		if (footer.ID !== preamble) throw new ApeContentError("Unexpected APEv2 Footer ID preamble value");
		fromBuffer(buffer);
		return new APEv2Parser(metadata, fromBuffer(buffer), options).parseTags(footer);
	}
	/**
	* Parse APEv1 / APEv2 header if header signature found
	*/
	async tryParseApeHeader() {
		if (this.tokenizer.fileInfo.size && this.tokenizer.fileInfo.size - this.tokenizer.position < TagFooter.len) {
			debug("No APEv2 header found, end-of-file reached");
			return;
		}
		const footer = await this.tokenizer.peekToken(TagFooter);
		if (footer.ID === preamble) {
			await this.tokenizer.ignore(TagFooter.len);
			return this.parseTags(footer);
		}
		debug(`APEv2 header not found at offset=${this.tokenizer.position}`);
		if (this.tokenizer.fileInfo.size) {
			const remaining = this.tokenizer.fileInfo.size - this.tokenizer.position;
			const buffer = new Uint8Array(remaining);
			await this.tokenizer.readBuffer(buffer);
			return APEv2Parser.parseTagFooter(this.metadata, buffer, this.options);
		}
	}
	async parse() {
		const descriptor = await this.tokenizer.readToken(DescriptorParser);
		if (descriptor.ID !== "MAC ") throw new ApeContentError("Unexpected descriptor ID");
		this.ape.descriptor = descriptor;
		const lenExp = descriptor.descriptorBytes - DescriptorParser.len;
		const header = await (lenExp > 0 ? this.parseDescriptorExpansion(lenExp) : this.parseHeader());
		this.metadata.setAudioOnly();
		await this.tokenizer.ignore(header.forwardBytes);
		return this.tryParseApeHeader();
	}
	async parseTags(footer) {
		const keyBuffer = /* @__PURE__ */ new Uint8Array(256);
		let bytesRemaining = footer.size - TagFooter.len;
		debug(`Parse APE tags at offset=${this.tokenizer.position}, size=${bytesRemaining}`);
		for (let i = 0; i < footer.fields; i++) {
			if (bytesRemaining < TagItemHeader.len) {
				this.metadata.addWarning(`APEv2 Tag-header: ${footer.fields - i} items remaining, but no more tag data to read.`);
				break;
			}
			const tagItemHeader = await this.tokenizer.readToken(TagItemHeader);
			bytesRemaining -= TagItemHeader.len + tagItemHeader.size;
			await this.tokenizer.peekBuffer(keyBuffer, { length: Math.min(keyBuffer.length, bytesRemaining) });
			let zero = findZero(keyBuffer);
			const key = await this.tokenizer.readToken(new StringType(zero, "ascii"));
			await this.tokenizer.ignore(1);
			bytesRemaining -= key.length + 1;
			switch (tagItemHeader.flags.dataType) {
				case DataType.text_utf8: {
					const values = (await this.tokenizer.readToken(new StringType(tagItemHeader.size, "utf8"))).split(/\x00/g);
					await Promise.all(values.map((val) => this.metadata.addTag(tagFormat, key, val)));
					break;
				}
				case DataType.binary:
					if (this.options.skipCovers) await this.tokenizer.ignore(tagItemHeader.size);
					else {
						const picData = new Uint8Array(tagItemHeader.size);
						await this.tokenizer.readBuffer(picData);
						zero = findZero(picData);
						const description = textDecode(picData.subarray(0, zero), "utf-8");
						const data = picData.subarray(zero + 1);
						await this.metadata.addTag(tagFormat, key, {
							description,
							data
						});
					}
					break;
				case DataType.external_info:
					debug(`Ignore external info ${key}`);
					await this.tokenizer.ignore(tagItemHeader.size);
					break;
				case DataType.reserved:
					debug(`Ignore external info ${key}`);
					this.metadata.addWarning(`APEv2 header declares a reserved datatype for "${key}"`);
					await this.tokenizer.ignore(tagItemHeader.size);
					break;
			}
		}
	}
	async parseDescriptorExpansion(lenExp) {
		await this.tokenizer.ignore(lenExp);
		return this.parseHeader();
	}
	async parseHeader() {
		const header = await this.tokenizer.readToken(Header);
		this.metadata.setFormat("lossless", true);
		this.metadata.setFormat("container", "Monkey's Audio");
		this.metadata.setFormat("bitsPerSample", header.bitsPerSample);
		this.metadata.setFormat("sampleRate", header.sampleRate);
		this.metadata.setFormat("numberOfChannels", header.channel);
		this.metadata.setFormat("duration", APEv2Parser.calculateDuration(header));
		if (!this.ape.descriptor) throw new ApeContentError("Missing APE descriptor");
		return { forwardBytes: this.ape.descriptor.seekTableBytes + this.ape.descriptor.headerDataBytes + this.ape.descriptor.apeFrameDataBytes + this.ape.descriptor.terminatingDataBytes };
	}
};
//#endregion
export { fromBlob as a, FourCcToken as i, ApeContentError as n, fromBuffer as o, tryParseApeHeader as r, fromWebStream as s, APEv2Parser as t };
