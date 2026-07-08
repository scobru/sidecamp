import { o as e } from "./rolldown-runtime-C6GIJ8is.js";
import { i as t } from "./lib-_6OEUs1_.js";
import { t as n } from "./src-DFEHZHzb.js";
import { t as r } from "./BasicParser-Ds__TCD-.js";
import { r as i } from "./ID3v2Token-lKqloahX.js";
import { n as a } from "./ID3v1Parser-BDGgMqu1.js";
import { t as o } from "./ID3v2Parser-BdX3lF6l.js";
var s = (0, (/* @__PURE__ */ e(n(), 1)).default)("music-metadata:parser:ID3"), c = class extends r {
	constructor() {
		super(...arguments), this.id3parser = new o();
	}
	static async startsWithID3v2Header(e) {
		return (await e.peekToken(i)).fileIdentifier === "ID3";
	}
	async parse() {
		try {
			await this.parseID3v2();
		} catch (e) {
			if (e instanceof t) s("End-of-stream");
			else throw e;
		}
	}
	finalize() {}
	async parseID3v2() {
		await this.tryReadId3v2Headers(), s("End of ID3v2 header, go to MPEG-parser: pos=%s", this.tokenizer.position), await this.postId3v2Parse(), this.options.skipPostHeaders && this.metadata.hasAny() || await new a(this.metadata, this.tokenizer, this.options).parse(), this.finalize();
	}
	async tryReadId3v2Headers() {
		if ((await this.tokenizer.peekToken(i)).fileIdentifier === "ID3") return s("Found ID3v2 header, pos=%s", this.tokenizer.position), await this.id3parser.parse(this.metadata, this.tokenizer, this.options), this.tryReadId3v2Headers();
	}
};
//#endregion
export { c as t };
