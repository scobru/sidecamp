import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import { i as t } from "./APEv2Parser-CfakAbiy.js";
import { t as n } from "./src-DFEHZHzb.js";
import { f as r, m as i, o as a, w as o } from "./BasicParser-Ds__TCD-.js";
import { t as s } from "./ID3v2Parser-BdX3lF6l.js";
import { t as c } from "./AbstractID3Parser-1zQPhXTC.js";
//#region node_modules/music-metadata/lib/dsf/DsfChunk.js
var l = /* @__PURE__ */ e(n(), 1), u = {
	len: 12,
	get: (e, n) => ({
		id: t.get(e, n),
		size: o.get(e, n + 4)
	})
}, d = {
	len: 16,
	get: (e, t) => ({
		fileSize: i.get(e, t),
		metadataPointer: i.get(e, t + 8)
	})
}, f = {
	len: 40,
	get: (e, t) => ({
		formatVersion: r.get(e, t),
		formatID: r.get(e, t + 4),
		channelType: r.get(e, t + 8),
		channelNum: r.get(e, t + 12),
		samplingFrequency: r.get(e, t + 16),
		bitsPerSample: r.get(e, t + 20),
		sampleCount: i.get(e, t + 24),
		blockSizePerChannel: r.get(e, t + 32)
	})
}, p = (0, l.default)("music-metadata:parser:DSF"), m = class extends a("DSD") {}, h = class extends c {
	async postId3v2Parse() {
		let e = this.tokenizer.position, t = await this.tokenizer.readToken(u);
		if (t.id !== "DSD ") throw new m("Invalid chunk signature");
		this.metadata.setFormat("container", "DSF"), this.metadata.setFormat("lossless", !0), this.metadata.setAudioOnly();
		let n = await this.tokenizer.readToken(d);
		if (n.metadataPointer === BigInt(0)) p("No ID3v2 tag present");
		else return p(`expect ID3v2 at offset=${n.metadataPointer}`), await this.parseChunks(n.fileSize - t.size), await this.tokenizer.ignore(Number(n.metadataPointer) - this.tokenizer.position - e), new s().parse(this.metadata, this.tokenizer, this.options);
	}
	async parseChunks(e) {
		for (; e >= u.len;) {
			let t = await this.tokenizer.readToken(u);
			switch (p(`Parsing chunk name=${t.id} size=${t.size}`), t.id) {
				case "fmt ": {
					let e = await this.tokenizer.readToken(f);
					this.metadata.setFormat("numberOfChannels", e.channelNum), this.metadata.setFormat("sampleRate", e.samplingFrequency), this.metadata.setFormat("bitsPerSample", e.bitsPerSample), this.metadata.setFormat("numberOfSamples", e.sampleCount), this.metadata.setFormat("duration", Number(e.sampleCount) / e.samplingFrequency);
					let t = e.bitsPerSample * e.samplingFrequency * e.channelNum;
					this.metadata.setFormat("bitrate", t);
					return;
				}
				default:
					this.tokenizer.ignore(Number(t.size) - u.len);
					break;
			}
			e -= t.size;
		}
	}
};
//#endregion
export { h as DsfParser };
