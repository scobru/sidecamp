import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import { i as t, r as n } from "./APEv2Parser-CfakAbiy.js";
import { t as r } from "./src-DFEHZHzb.js";
import { E as i, S as a, T as o, b as s, o as c, t as l, v as u } from "./BasicParser-Ds__TCD-.js";
import { f as d } from "./Util-CA2PSMPD.js";
//#region node_modules/music-metadata/lib/wavpack/WavPackToken.js
var f = [
	6e3,
	8e3,
	9600,
	11025,
	12e3,
	16e3,
	22050,
	24e3,
	32e3,
	44100,
	48e3,
	64e3,
	88200,
	96e3,
	192e3,
	-1
], p = {
	len: 32,
	get: (e, n) => {
		let r = a.get(e, n + 24), o = {
			BlockID: t.get(e, n),
			blockSize: a.get(e, n + 4),
			version: u.get(e, n + 8),
			totalSamples: a.get(e, n + 12),
			blockIndex: a.get(e, n + 16),
			blockSamples: a.get(e, n + 20),
			flags: {
				bitsPerSample: (1 + g(r, 0, 2)) * 8,
				isMono: h(r, 2),
				isHybrid: h(r, 3),
				isJointStereo: h(r, 4),
				crossChannel: h(r, 5),
				hybridNoiseShaping: h(r, 6),
				floatingPoint: h(r, 7),
				samplingRate: f[g(r, 23, 4)],
				isDSD: h(r, 31)
			},
			crc: new i(4).get(e, n + 28)
		};
		return o.flags.isDSD && (o.totalSamples *= 8), o;
	}
}, m = {
	len: 1,
	get: (e, t) => ({
		functionId: g(e[t], 0, 6),
		isOptional: h(e[t], 5),
		isOddSize: h(e[t], 6),
		largeBlock: h(e[t], 7)
	})
};
function h(e, t) {
	return g(e, t, 1) === 1;
}
function g(e, t, n) {
	return e >>> t & 4294967295 >>> 32 - n;
}
var _ = (0, (/* @__PURE__ */ e(r(), 1)).default)("music-metadata:parser:WavPack"), v = class extends c("WavPack") {}, y = class extends l {
	constructor() {
		super(...arguments), this.audioDataSize = 0;
	}
	async parse() {
		return this.metadata.setAudioOnly(), this.audioDataSize = 0, await this.parseWavPackBlocks(), n(this.metadata, this.tokenizer, this.options);
	}
	async parseWavPackBlocks() {
		do {
			if (await this.tokenizer.peekToken(t) !== "wvpk") break;
			let e = await this.tokenizer.readToken(p);
			if (e.BlockID !== "wvpk") throw new v("Invalid WavPack Block-ID");
			_(`WavPack header blockIndex=${e.blockIndex}, len=${p.len}`), e.blockIndex === 0 && !this.metadata.format.container && (this.metadata.setFormat("container", "WavPack"), this.metadata.setFormat("lossless", !e.flags.isHybrid), this.metadata.setFormat("bitsPerSample", e.flags.bitsPerSample), e.flags.isDSD || (this.metadata.setFormat("sampleRate", e.flags.samplingRate), this.metadata.setFormat("duration", e.totalSamples / e.flags.samplingRate)), this.metadata.setFormat("numberOfChannels", e.flags.isMono ? 1 : 2), this.metadata.setFormat("numberOfSamples", e.totalSamples), this.metadata.setFormat("codec", e.flags.isDSD ? "DSD" : "PCM"));
			let n = e.blockSize - (p.len - 8);
			await (e.blockIndex === 0 ? this.parseMetadataSubBlock(e, n) : this.tokenizer.ignore(n)), e.blockSamples > 0 && (this.audioDataSize += e.blockSize);
		} while (!this.tokenizer.fileInfo.size || this.tokenizer.fileInfo.size - this.tokenizer.position >= p.len);
		this.metadata.format.duration && this.metadata.setFormat("bitrate", this.audioDataSize * 8 / this.metadata.format.duration);
	}
	async parseMetadataSubBlock(e, t) {
		let n = t;
		for (; n > m.len;) {
			let t = await this.tokenizer.readToken(m), r = await this.tokenizer.readNumber(t.largeBlock ? s : o), i = new Uint8Array(r * 2 - !!t.isOddSize);
			switch (await this.tokenizer.readBuffer(i), _(`Metadata Sub-Blocks functionId=0x${t.functionId.toString(16)}, id.largeBlock=${t.largeBlock},data-size=${i.length}`), t.functionId) {
				case 0: break;
				case 14: {
					_("ID_DSD_BLOCK");
					let t = 1 << o.get(i, 0), n = e.flags.samplingRate * t * 8;
					if (!e.flags.isDSD) throw new v("Only expect DSD block if DSD-flag is set");
					this.metadata.setFormat("sampleRate", n), this.metadata.setFormat("duration", e.totalSamples / n);
					break;
				}
				case 36:
					_("ID_ALT_TRAILER: trailer for non-wav files");
					break;
				case 38:
					this.metadata.setFormat("audioMD5", i);
					break;
				case 47:
					_(`ID_BLOCK_CHECKSUM: checksum=${d(i)}`);
					break;
				default:
					_(`Ignore unsupported meta-sub-block-id functionId=0x${t.functionId.toString(16)}`);
					break;
			}
			n -= m.len + (t.largeBlock ? s.len : o.len) + r * 2, _(`remainingLength=${n}`), t.isOddSize && this.tokenizer.ignore(1);
		}
		if (n !== 0) throw new v("metadata-sub-block should fit it remaining length");
	}
};
//#endregion
export { y as WavPackParser };
