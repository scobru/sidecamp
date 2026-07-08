import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import "./lib-_6OEUs1_.js";
import { i as t, o as n } from "./APEv2Parser-CfakAbiy.js";
import { t as r } from "./src-DFEHZHzb.js";
import { E as i, S as a, T as o, _ as s, g as c, o as l, p as u, t as d, x as f } from "./BasicParser-Ds__TCD-.js";
import { t as p } from "./ID3v2Parser-BdX3lF6l.js";
//#region node_modules/music-metadata/lib/dsdiff/DsdiffToken.js
var m = /* @__PURE__ */ e(r(), 1), h = {
	len: 12,
	get: (e, n) => ({
		chunkID: t.get(e, n),
		chunkSize: u.get(e, n + 4)
	})
}, g = (0, m.default)("music-metadata:parser:aiff"), _ = class extends l("DSDIFF") {}, v = class extends d {
	async parse() {
		let e = await this.tokenizer.readToken(h);
		if (e.chunkID !== "FRM8") throw new _("Unexpected chunk-ID");
		this.metadata.setAudioOnly();
		let n = (await this.tokenizer.readToken(t)).trim();
		switch (n) {
			case "DSD": return this.metadata.setFormat("container", `DSDIFF/${n}`), this.metadata.setFormat("lossless", !0), this.readFmt8Chunks(e.chunkSize - BigInt(t.len));
			default: throw new _(`Unsupported DSDIFF type: ${n}`);
		}
	}
	async readFmt8Chunks(e) {
		for (; e >= h.len;) {
			let t = await this.tokenizer.readToken(h);
			g(`Chunk id=${t.chunkID}`), await this.readData(t), e -= BigInt(h.len) + t.chunkSize;
		}
	}
	async readData(e) {
		g(`Reading data of chunk[ID=${e.chunkID}, size=${e.chunkSize}]`);
		let r = this.tokenizer.position;
		switch (e.chunkID.trim()) {
			case "FVER":
				g(`DSDIFF version=${await this.tokenizer.readToken(a)}`);
				break;
			case "PROP":
				if (await this.tokenizer.readToken(t) !== "SND ") throw new _("Unexpected PROP-chunk ID");
				await this.handleSoundPropertyChunks(e.chunkSize - BigInt(t.len));
				break;
			case "ID3": {
				let t = n(await this.tokenizer.readToken(new i(Number(e.chunkSize))));
				await new p().parse(this.metadata, t, this.options);
				break;
			}
			case "DSD":
				this.metadata.format.numberOfChannels && this.metadata.setFormat("numberOfSamples", Number(e.chunkSize * BigInt(8) / BigInt(this.metadata.format.numberOfChannels))), this.metadata.format.numberOfSamples && this.metadata.format.sampleRate && this.metadata.setFormat("duration", this.metadata.format.numberOfSamples / this.metadata.format.sampleRate);
				break;
			default:
				g(`Ignore chunk[ID=${e.chunkID}, size=${e.chunkSize}]`);
				break;
		}
		let o = e.chunkSize - BigInt(this.tokenizer.position - r);
		o > 0 && (g(`After Parsing chunk, remaining ${o} bytes`), await this.tokenizer.ignore(Number(o)));
	}
	async handleSoundPropertyChunks(e) {
		for (g(`Parsing sound-property-chunks, remainingSize=${e}`); e > 0;) {
			let n = await this.tokenizer.readToken(h);
			g(`Sound-property-chunk[ID=${n.chunkID}, size=${n.chunkSize}]`);
			let r = this.tokenizer.position;
			switch (n.chunkID.trim()) {
				case "FS": {
					let e = await this.tokenizer.readToken(f);
					this.metadata.setFormat("sampleRate", e);
					break;
				}
				case "CHNL": {
					let e = await this.tokenizer.readToken(s);
					this.metadata.setFormat("numberOfChannels", e), await this.handleChannelChunks(n.chunkSize - BigInt(s.len));
					break;
				}
				case "CMPR": {
					let e = (await this.tokenizer.readToken(t)).trim(), n = await this.tokenizer.readToken(o), r = await this.tokenizer.readToken(new c(n, "ascii"));
					e === "DSD" && (this.metadata.setFormat("lossless", !0), this.metadata.setFormat("bitsPerSample", 1)), this.metadata.setFormat("codec", `${e} (${r})`);
					break;
				}
				case "ABSS":
					g(`ABSS ${await this.tokenizer.readToken(s)}:${await this.tokenizer.readToken(o)}:${await this.tokenizer.readToken(o)}.${await this.tokenizer.readToken(f)}`);
					break;
				case "LSCO":
					g(`LSCO lsConfig=${await this.tokenizer.readToken(s)}`);
					break;
				default: g(`Unknown sound-property-chunk[ID=${n.chunkID}, size=${n.chunkSize}]`), await this.tokenizer.ignore(Number(n.chunkSize));
			}
			let i = n.chunkSize - BigInt(this.tokenizer.position - r);
			i > 0 && (g(`After Parsing sound-property-chunk ${n.chunkSize}, remaining ${i} bytes`), await this.tokenizer.ignore(Number(i))), e -= BigInt(h.len) + n.chunkSize, g(`Parsing sound-property-chunks, remainingSize=${e}`);
		}
		if (this.metadata.format.lossless && this.metadata.format.sampleRate && this.metadata.format.numberOfChannels && this.metadata.format.bitsPerSample) {
			let e = this.metadata.format.sampleRate * this.metadata.format.numberOfChannels * this.metadata.format.bitsPerSample;
			this.metadata.setFormat("bitrate", e);
		}
	}
	async handleChannelChunks(e) {
		g(`Parsing channel-chunks, remainingSize=${e}`);
		let n = [];
		for (; e >= t.len;) {
			let r = await this.tokenizer.readToken(t);
			g(`Channel[ID=${r}]`), n.push(r), e -= BigInt(t.len);
		}
		return g(`Channels: ${n.join(", ")}`), n;
	}
};
//#endregion
export { v as DsdiffParser };
