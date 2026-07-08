import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import { i as t } from "./lib-_6OEUs1_.js";
import { i as n } from "./APEv2Parser-CfakAbiy.js";
import { t as r } from "./src-DFEHZHzb.js";
import { E as i, S as a, T as o, _ as s, f as c, g as l, o as u, t as d, v as f, w as p, y as m } from "./BasicParser-Ds__TCD-.js";
import { a as h, u as g } from "./Util-CA2PSMPD.js";
import { a as _, i as v, n as y, o as b, r as x, t as S } from "./FlacParser-ELStBBhG.js";
//#region node_modules/music-metadata/lib/ogg/opus/Opus.js
var C = /* @__PURE__ */ e(r(), 1), w = class extends u("Opus") {}, T = class {
	constructor(e) {
		if (e < 19) throw new w("ID-header-page 0 should be at least 19 bytes long");
		this.len = e;
	}
	get(e, t) {
		return {
			magicSignature: new l(8, "ascii").get(e, t + 0),
			version: o.get(e, t + 8),
			channelCount: o.get(e, t + 9),
			preSkip: f.get(e, t + 10),
			inputSampleRate: a.get(e, t + 12),
			outputGain: f.get(e, t + 16),
			channelMapping: o.get(e, t + 18)
		};
	}
}, E = class extends _ {
	constructor(e, t, n) {
		super(e, t), this.idHeader = null, this.lastPos = -1, this.tokenizer = n, this.durationOnLastPage = !0;
	}
	parseFirstPage(e, t) {
		if (this.metadata.setFormat("codec", "Opus"), this.idHeader = new T(t.length).get(t, 0), this.idHeader.magicSignature !== "OpusHead") throw new w("Illegal ogg/Opus magic-signature");
		this.metadata.setFormat("sampleRate", this.idHeader.inputSampleRate), this.metadata.setFormat("numberOfChannels", this.idHeader.channelCount), this.metadata.setAudioOnly();
	}
	async parseFullPage(e) {
		switch (new l(8, "ascii").get(e, 0)) {
			case "OpusTags":
				await this.parseUserCommentList(e, 8), this.lastPos = this.tokenizer.position - e.length;
				break;
			default: break;
		}
	}
	calculateDuration(e) {
		if (this.lastPageHeader && (e || this.lastPageHeader.headerType.lastPage) && this.metadata.format.sampleRate && this.lastPageHeader.absoluteGranulePosition >= 0) {
			let e = this.lastPageHeader.absoluteGranulePosition - this.idHeader.preSkip;
			if (this.metadata.setFormat("numberOfSamples", e), this.metadata.setFormat("duration", e / 48e3), this.lastPos !== -1 && this.tokenizer.fileInfo.size && this.metadata.format.duration) {
				let e = this.tokenizer.fileInfo.size - this.lastPos;
				this.metadata.setFormat("bitrate", 8 * e / this.metadata.format.duration);
			}
		}
	}
}, D = {
	len: 80,
	get: (e, t) => ({
		speex: new l(8, "ascii").get(e, t + 0),
		version: g(new l(20, "ascii").get(e, t + 8)),
		version_id: c.get(e, t + 28),
		header_size: c.get(e, t + 32),
		rate: c.get(e, t + 36),
		mode: c.get(e, t + 40),
		mode_bitstream_version: c.get(e, t + 44),
		nb_channels: c.get(e, t + 48),
		bitrate: c.get(e, t + 52),
		frame_size: c.get(e, t + 56),
		vbr: c.get(e, t + 60),
		frames_per_packet: c.get(e, t + 64),
		extra_headers: c.get(e, t + 68),
		reserved1: c.get(e, t + 72),
		reserved2: c.get(e, t + 76)
	})
}, O = (0, C.default)("music-metadata:parser:ogg:speex"), k = class extends _ {
	constructor(e, t, n) {
		super(e, t);
	}
	parseFirstPage(e, t) {
		O("First Ogg/Speex page");
		let n = D.get(t, 0);
		this.metadata.setFormat("codec", `Speex ${n.version}`), this.metadata.setFormat("numberOfChannels", n.nb_channels), this.metadata.setFormat("sampleRate", n.rate), n.bitrate !== -1 && this.metadata.setFormat("bitrate", n.bitrate), this.metadata.setAudioOnly();
	}
}, A = {
	len: 42,
	get: (e, t) => ({
		id: new l(7, "ascii").get(e, t),
		vmaj: o.get(e, t + 7),
		vmin: o.get(e, t + 8),
		vrev: o.get(e, t + 9),
		vmbw: s.get(e, t + 10),
		vmbh: s.get(e, t + 17),
		nombr: m.get(e, t + 37),
		nqual: o.get(e, t + 40)
	})
}, j = (0, C.default)("music-metadata:parser:ogg:theora"), M = class {
	constructor(e, t, n) {
		this.durationOnLastPage = !1, this.metadata = e;
	}
	async parsePage(e, t) {
		e.headerType.firstPage && await this.parseFirstPage(e, t);
	}
	calculateDuration() {
		j("duration calculation not implemented");
	}
	async parseFirstPage(e, t) {
		j("First Ogg/Theora page"), this.metadata.setFormat("codec", "Theora");
		let n = A.get(t, 0);
		this.metadata.setFormat("bitrate", n.nombr), this.metadata.setFormat("hasVideo", !0);
	}
	flush() {
		return Promise.resolve();
	}
}, N = {
	len: 27,
	get: (e, t) => ({
		capturePattern: new l(4, "latin1").get(e, t),
		version: o.get(e, t + 4),
		headerType: {
			continued: h(e, t + 5, 0),
			firstPage: h(e, t + 5, 1),
			lastPage: h(e, t + 5, 2)
		},
		absoluteGranulePosition: Number(p.get(e, t + 6)),
		streamSerialNumber: a.get(e, t + 14),
		pageSequenceNo: a.get(e, t + 18),
		pageChecksum: a.get(e, t + 22),
		page_segments: o.get(e, t + 26)
	})
}, P = class e {
	static sum(e, t, n) {
		let r = new DataView(e.buffer, 0), i = 0;
		for (let e = t; e < t + n; ++e) i += r.getUint8(e);
		return i;
	}
	constructor(e) {
		this.len = e.page_segments;
	}
	get(t, n) {
		return { totalPageSize: e.sum(t, n, this.len) };
	}
}, F = (0, C.default)("music-metadata:parser:ogg:theora"), I = class {
	constructor(e, t, n) {
		this.durationOnLastPage = !1, this.metadata = e, this.options = t, this.tokenizer = n, this.flacParser = new S(this.metadata, this.tokenizer, t);
	}
	async parsePage(e, t) {
		e.headerType.firstPage && await this.parseFirstPage(e, t);
	}
	calculateDuration() {
		F("duration calculation not implemented");
	}
	async parseFirstPage(e, t) {
		if (F("First Ogg/FLAC page"), (await n.get(t, 9)).toString() !== "fLaC") throw Error("Invalid FLAC preamble");
		let r = await y.get(t, 13);
		await this.parseDataBlock(r, t.subarray(13 + y.len));
	}
	async parseDataBlock(e, t) {
		switch (F(`blockHeader type=${e.type}, length=${e.length}`), e.type) {
			case v.STREAMINFO: {
				let e = x.get(t, 0);
				return this.flacParser.processsStreamInfo(e);
			}
			case v.PADDING: break;
			case v.APPLICATION: break;
			case v.SEEKTABLE: break;
			case v.VORBIS_COMMENT: return this.flacParser.parseComment(t);
			case v.PICTURE:
				if (!this.options.skipCovers) {
					let e = new b(t.length).get(t, 0);
					return this.flacParser.addPictureTag(e);
				}
				break;
			default: this.metadata.addWarning(`Unknown block type: ${e.type}`);
		}
		return this.tokenizer.ignore(e.length).then();
	}
	flush() {
		return Promise.resolve();
	}
}, L = class extends u("Ogg") {}, R = (0, C.default)("music-metadata:parser:ogg"), z = class {
	constructor(e, t, n) {
		this.pageNumber = 0, this.closed = !1, this.metadata = e, this.streamSerial = t, this.options = n;
	}
	async parsePage(e, t) {
		this.pageNumber = t.pageSequenceNo, R("serial=%s page#=%s, Ogg.id=%s", t.streamSerialNumber, t.pageSequenceNo, t.capturePattern);
		let n = await e.readToken(new P(t));
		R("totalPageSize=%s", n.totalPageSize);
		let r = await e.readToken(new i(n.totalPageSize));
		if (R("firstPage=%s, lastPage=%s, continued=%s", t.headerType.firstPage, t.headerType.lastPage, t.headerType.continued), t.headerType.firstPage) {
			this.metadata.setFormat("container", "Ogg");
			let n = r.subarray(0, 7), i = Array.from(n).filter((e) => e >= 32 && e <= 126).map((e) => String.fromCharCode(e)).join("");
			switch (i) {
				case "vorbis":
					R(`Set Ogg stream serial ${t.streamSerialNumber}, codec=Vorbis`), this.pageConsumer = new _(this.metadata, this.options);
					break;
				case "OpusHea":
					R("Set page consumer to Ogg/Opus"), this.pageConsumer = new E(this.metadata, this.options, e);
					break;
				case "Speex  ":
					R("Set page consumer to Ogg/Speex"), this.pageConsumer = new k(this.metadata, this.options, e);
					break;
				case "fishead":
				case "theora":
					R("Set page consumer to Ogg/Theora"), this.pageConsumer = new M(this.metadata, this.options, e);
					break;
				case "FLAC":
					R("Set page consumer to Vorbis"), this.pageConsumer = new I(this.metadata, this.options, e);
					break;
				default: throw new L(`Ogg codec not recognized (id=${i}`);
			}
		}
		if (t.headerType.lastPage && (this.closed = !0), this.pageConsumer) await this.pageConsumer.parsePage(t, r);
		else throw Error("pageConsumer should be initialized");
	}
}, B = class extends d {
	constructor() {
		super(...arguments), this.streams = /* @__PURE__ */ new Map();
	}
	async parse() {
		this.streams = /* @__PURE__ */ new Map();
		let e = !1, n;
		try {
			do {
				if (n = await this.tokenizer.readToken(N), n.capturePattern !== "OggS") throw new L("Invalid Ogg capture pattern");
				let e = this.streams.get(n.streamSerialNumber);
				if (e || (e = new z(this.metadata, n.streamSerialNumber, this.options), this.streams.set(n.streamSerialNumber, e)), await e.parsePage(this.tokenizer, n), e.pageNumber > 12 && !(this.options.duration && [...this.streams.values()].find((e) => e.pageConsumer?.durationOnLastPage))) {
					R("Stop processing Ogg stream");
					break;
				}
			} while (![...this.streams.values()].every((e) => e.closed));
		} catch (n) {
			if (n instanceof t) R("Reached end-of-stream"), e = !0;
			else if (n instanceof L) this.metadata.addWarning(`Corrupt Ogg content at ${this.tokenizer.position}`);
			else throw n;
		}
		for (let t of this.streams.values()) t.closed || (this.metadata.addWarning(`End-of-stream reached before reaching last page in Ogg stream serial=${t.streamSerial}`), await t.pageConsumer?.flush()), t.pageConsumer?.calculateDuration(e);
	}
};
//#endregion
export { B as OggParser };
