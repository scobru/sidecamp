import { i as e, n as t } from "./rolldown-runtime-C6GIJ8is.js";
import { basename as n, dirname as r, extname as i, normalize as a, relative as o, resolve as s } from "path";
import { readFileSync as c, readdirSync as l, statSync as u, writeFile as d } from "fs";
import { notStrictEqual as f, strictEqual as p } from "assert";
import { format as m, inspect as h } from "util";
import { fileURLToPath as g } from "url";
//#region node_modules/yargs/build/lib/yerror.js
var _, v = t((() => {
	_ = class e extends Error {
		constructor(t) {
			super(t || "yargs error"), this.name = "YError", Error.captureStackTrace && Error.captureStackTrace(this, e);
		}
	};
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/process-argv.js
function y() {
	return +!b();
}
function b() {
	return x() && !process.defaultApp;
}
function x() {
	return !!process.versions.electron;
}
function S(e) {
	return e.slice(y() + 1);
}
function C() {
	return process.argv[y()];
}
var w = t((() => {}));
//#endregion
//#region node_modules/yargs-parser/build/lib/string-utils.js
function T(e) {
	if (e !== e.toLowerCase() && e !== e.toUpperCase() || (e = e.toLowerCase()), e.indexOf("-") === -1 && e.indexOf("_") === -1) return e;
	{
		let t = "", n = !1, r = e.match(/^-+/);
		for (let i = r ? r[0].length : 0; i < e.length; i++) {
			let r = e.charAt(i);
			n && (n = !1, r = r.toUpperCase()), i !== 0 && (r === "-" || r === "_") ? n = !0 : r !== "-" && r !== "_" && (t += r);
		}
		return t;
	}
}
function ee(e, t) {
	let n = e.toLowerCase();
	t ||= "-";
	let r = "";
	for (let i = 0; i < e.length; i++) {
		let a = n.charAt(i), o = e.charAt(i);
		a !== o && i > 0 ? r += `${t}${n.charAt(i)}` : r += o;
	}
	return r;
}
function te(e) {
	return e == null ? !1 : typeof e == "number" || /^0x[0-9a-f]+$/i.test(e) ? !0 : !/^0[^.]/.test(e) && /^[-]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(e);
}
var E = t((() => {}));
//#endregion
//#region node_modules/yargs-parser/build/lib/tokenize-arg-string.js
function ne(e) {
	if (Array.isArray(e)) return e.map((e) => typeof e == "string" ? e : e + "");
	e = e.trim();
	let t = 0, n = null, r = null, i = null, a = [];
	for (let o = 0; o < e.length; o++) {
		if (n = r, r = e.charAt(o), r === " " && !i) {
			n !== " " && t++;
			continue;
		}
		r === i ? i = null : (r === "'" || r === "\"") && !i && (i = r), a[t] || (a[t] = ""), a[t] += r;
	}
	return a;
}
var D = t((() => {})), O, k = t((() => {
	(function(e) {
		e.BOOLEAN = "boolean", e.STRING = "string", e.NUMBER = "number", e.ARRAY = "array";
	})(O ||= {});
}));
//#endregion
//#region node_modules/yargs-parser/build/lib/yargs-parser.js
function re(e) {
	let t = [], n = Object.create(null), r = !0;
	for (Object.keys(e).forEach(function(n) {
		t.push([].concat(e[n], n));
	}); r;) {
		r = !1;
		for (let e = 0; e < t.length; e++) for (let n = e + 1; n < t.length; n++) if (t[e].filter(function(e) {
			return t[n].indexOf(e) !== -1;
		}).length) {
			t[e] = t[e].concat(t[n]), t.splice(n, 1), r = !0;
			break;
		}
	}
	return t.forEach(function(e) {
		e = e.filter(function(e, t, n) {
			return n.indexOf(e) === t;
		});
		let t = e.pop();
		t !== void 0 && typeof t == "string" && (n[t] = e);
	}), n;
}
function A(e) {
	return e === void 0 ? 1 : e + 1;
}
function ie(e) {
	return e === "__proto__" ? "___proto___" : e;
}
function ae(e) {
	return typeof e == "string" && (e[0] === "'" || e[0] === "\"") && e[e.length - 1] === e[0] ? e.substring(1, e.length - 1) : e;
}
var j, M, oe = t((() => {
	D(), k(), E(), M = class {
		constructor(e) {
			j = e;
		}
		parse(e, t) {
			let n = Object.assign({
				alias: void 0,
				array: void 0,
				boolean: void 0,
				config: void 0,
				configObjects: void 0,
				configuration: void 0,
				coerce: void 0,
				count: void 0,
				default: void 0,
				envPrefix: void 0,
				narg: void 0,
				normalize: void 0,
				string: void 0,
				number: void 0,
				__: void 0,
				key: void 0
			}, t), r = ne(e), i = typeof e == "string", a = re(Object.assign(Object.create(null), n.alias)), o = Object.assign({
				"boolean-negation": !0,
				"camel-case-expansion": !0,
				"combine-arrays": !1,
				"dot-notation": !0,
				"duplicate-arguments-array": !0,
				"flatten-duplicate-arrays": !0,
				"greedy-arrays": !0,
				"halt-at-non-option": !1,
				"nargs-eats-options": !1,
				"negation-prefix": "no-",
				"parse-numbers": !0,
				"parse-positional-numbers": !0,
				"populate--": !1,
				"set-placeholder-key": !1,
				"short-option-groups": !0,
				"strip-aliased": !1,
				"strip-dashed": !1,
				"unknown-options-as-args": !1
			}, n.configuration), s = Object.assign(Object.create(null), n.default), c = n.configObjects || [], l = n.envPrefix, u = o["populate--"], d = u ? "--" : "_", f = Object.create(null), p = Object.create(null), m = n.__ || j.format, h = {
				aliases: Object.create(null),
				arrays: Object.create(null),
				bools: Object.create(null),
				strings: Object.create(null),
				numbers: Object.create(null),
				counts: Object.create(null),
				normalize: Object.create(null),
				configs: Object.create(null),
				nargs: Object.create(null),
				coercions: Object.create(null),
				keys: []
			}, g = /^-([0-9]+(\.[0-9]+)?|\.[0-9]+)$/, _ = RegExp("^--" + o["negation-prefix"] + "(.+)");
			[].concat(n.array || []).filter(Boolean).forEach(function(e) {
				let t = typeof e == "object" ? e.key : e, n = Object.keys(e).map(function(e) {
					return {
						boolean: "bools",
						string: "strings",
						number: "numbers"
					}[e];
				}).filter(Boolean).pop();
				n && (h[n][t] = !0), h.arrays[t] = !0, h.keys.push(t);
			}), [].concat(n.boolean || []).filter(Boolean).forEach(function(e) {
				h.bools[e] = !0, h.keys.push(e);
			}), [].concat(n.string || []).filter(Boolean).forEach(function(e) {
				h.strings[e] = !0, h.keys.push(e);
			}), [].concat(n.number || []).filter(Boolean).forEach(function(e) {
				h.numbers[e] = !0, h.keys.push(e);
			}), [].concat(n.count || []).filter(Boolean).forEach(function(e) {
				h.counts[e] = !0, h.keys.push(e);
			}), [].concat(n.normalize || []).filter(Boolean).forEach(function(e) {
				h.normalize[e] = !0, h.keys.push(e);
			}), typeof n.narg == "object" && Object.entries(n.narg).forEach(([e, t]) => {
				typeof t == "number" && (h.nargs[e] = t, h.keys.push(e));
			}), typeof n.coerce == "object" && Object.entries(n.coerce).forEach(([e, t]) => {
				typeof t == "function" && (h.coercions[e] = t, h.keys.push(e));
			}), n.config !== void 0 && (Array.isArray(n.config) || typeof n.config == "string" ? [].concat(n.config).filter(Boolean).forEach(function(e) {
				h.configs[e] = !0;
			}) : typeof n.config == "object" && Object.entries(n.config).forEach(([e, t]) => {
				(typeof t == "boolean" || typeof t == "function") && (h.configs[e] = t);
			})), se(n.key, a, n.default, h.arrays), Object.keys(s).forEach(function(e) {
				(h.aliases[e] || []).forEach(function(t) {
					s[t] = s[e];
				});
			});
			let v = null;
			le();
			let y = [], b = Object.assign(Object.create(null), { _: [] }), x = {};
			for (let e = 0; e < r.length; e++) {
				let t = r[e], n = t.replace(/^-{3,}/, "---"), i, a, s, c, l, u;
				if (t !== "--" && /^-/.test(t) && W(t)) S(t);
				else if (n.match(/^---+(=|$)/)) {
					S(t);
					continue;
				} else if (t.match(/^--.+=/) || !o["short-option-groups"] && t.match(/^-.+=/)) c = t.match(/^--?([^=]+)=([\s\S]*)$/), c !== null && Array.isArray(c) && c.length >= 3 && (V(c[1], h.arrays) ? e = w(e, c[1], r, c[2]) : V(c[1], h.nargs) === !1 ? E(c[1], c[2], !0) : e = C(e, c[1], r, c[2]));
				else if (t.match(_) && o["boolean-negation"]) c = t.match(_), c !== null && Array.isArray(c) && c.length >= 2 && (a = c[1], E(a, V(a, h.arrays) ? [!1] : !1));
				else if (t.match(/^--.+/) || !o["short-option-groups"] && t.match(/^-[^-]+/)) c = t.match(/^--?(.+)/), c !== null && Array.isArray(c) && c.length >= 2 && (a = c[1], V(a, h.arrays) ? e = w(e, a, r) : V(a, h.nargs) === !1 ? (l = r[e + 1], l !== void 0 && (!l.match(/^-/) || l.match(g)) && !V(a, h.bools) && !V(a, h.counts) || /^(true|false)$/.test(l) ? (E(a, l), e++) : E(a, K(a))) : e = C(e, a, r));
				else if (t.match(/^-.\..+=/)) c = t.match(/^-([^=]+)=([\s\S]*)$/), c !== null && Array.isArray(c) && c.length >= 3 && E(c[1], c[2]);
				else if (t.match(/^-.\..+/) && !t.match(g)) l = r[e + 1], c = t.match(/^-(.\..+)/), c !== null && Array.isArray(c) && c.length >= 2 && (a = c[1], l !== void 0 && !l.match(/^-/) && !V(a, h.bools) && !V(a, h.counts) ? (E(a, l), e++) : E(a, K(a)));
				else if (t.match(/^-[^-]+/) && !t.match(g)) {
					s = t.slice(1, -1).split(""), i = !1;
					for (let n = 0; n < s.length; n++) {
						if (l = t.slice(n + 2), s[n + 1] && s[n + 1] === "=") {
							u = t.slice(n + 3), a = s[n], V(a, h.arrays) ? e = w(e, a, r, u) : V(a, h.nargs) === !1 ? E(a, u) : e = C(e, a, r, u), i = !0;
							break;
						}
						if (l === "-") {
							E(s[n], l);
							continue;
						}
						if (/[A-Za-z]/.test(s[n]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(l) && V(l, h.bools) === !1) {
							E(s[n], l), i = !0;
							break;
						}
						if (s[n + 1] && s[n + 1].match(/\W/)) {
							E(s[n], l), i = !0;
							break;
						} else E(s[n], K(s[n]));
					}
					a = t.slice(-1)[0], !i && a !== "-" && (V(a, h.arrays) ? e = w(e, a, r) : V(a, h.nargs) === !1 ? (l = r[e + 1], l !== void 0 && (!/^(-|--)[^-]/.test(l) || l.match(g)) && !V(a, h.bools) && !V(a, h.counts) || /^(true|false)$/.test(l) ? (E(a, l), e++) : E(a, K(a))) : e = C(e, a, r));
				} else if (t.match(/^-[0-9]$/) && t.match(g) && V(t.slice(1), h.bools)) a = t.slice(1), E(a, K(a));
				else if (t === "--") {
					y = r.slice(e + 1);
					break;
				} else if (o["halt-at-non-option"]) {
					y = r.slice(e);
					break;
				} else S(t);
			}
			F(b, !0), F(b, !1), oe(b), P(), R(b, h.aliases, s, !0), I(b), o["set-placeholder-key"] && L(b), Object.keys(h.counts).forEach(function(e) {
				z(b, e.split(".")) || E(e, 0);
			}), u && y.length && (b[d] = []), y.forEach(function(e) {
				b[d].push(e);
			}), o["camel-case-expansion"] && o["strip-dashed"] && Object.keys(b).filter((e) => e !== "--" && e.includes("-")).forEach((e) => {
				delete b[e];
			}), o["strip-aliased"] && [].concat(...Object.keys(a).map((e) => a[e])).forEach((e) => {
				o["camel-case-expansion"] && e.includes("-") && delete b[e.split(".").map((e) => T(e)).join(".")], delete b[e];
			});
			function S(e) {
				let t = M("_", e);
				(typeof t == "string" || typeof t == "number") && b._.push(t);
			}
			function C(e, t, n, r) {
				let i, a = V(t, h.nargs);
				if (a = typeof a != "number" || isNaN(a) ? 1 : a, a === 0) return Y(r) || (v = Error(m("Argument unexpected for: %s", t))), E(t, K(t)), e;
				let s = +!Y(r);
				if (o["nargs-eats-options"]) n.length - (e + 1) + s < a && (v = Error(m("Not enough arguments following: %s", t))), s = a;
				else {
					for (i = e + 1; i < n.length && (!n[i].match(/^-[^0-9]/) || n[i].match(g) || W(n[i])); i++) s++;
					s < a && (v = Error(m("Not enough arguments following: %s", t)));
				}
				let c = Math.min(s, a);
				for (!Y(r) && c > 0 && (E(t, r), c--), i = e + 1; i < c + e + 1; i++) E(t, n[i]);
				return e + c;
			}
			function w(e, t, n, r) {
				let a = [], c = r || n[e + 1], l = V(t, h.nargs);
				if (V(t, h.bools) && !/^(true|false)$/.test(c)) a.push(!0);
				else if (Y(c) || Y(r) && /^-/.test(c) && !g.test(c) && !W(c)) {
					if (s[t] !== void 0) {
						let e = s[t];
						a = Array.isArray(e) ? e : [e];
					}
				} else {
					Y(r) || a.push(k(t, r, !0));
					for (let r = e + 1; r < n.length && !(!o["greedy-arrays"] && a.length > 0 || l && typeof l == "number" && a.length >= l || (c = n[r], /^-/.test(c) && !g.test(c) && !W(c))); r++) e = r, a.push(k(t, c, i));
				}
				return typeof l == "number" && (l && a.length < l || isNaN(l) && a.length === 0) && (v = Error(m("Not enough arguments following: %s", t))), E(t, a), e;
			}
			function E(e, t, n = i) {
				/-/.test(e) && o["camel-case-expansion"] && D(e, e.split(".").map(function(e) {
					return T(e);
				}).join("."));
				let r = k(e, t, n), a = e.split(".");
				B(b, a, r), h.aliases[e] && h.aliases[e].forEach(function(e) {
					let t = e.split(".");
					B(b, t, r);
				}), a.length > 1 && o["dot-notation"] && (h.aliases[a[0]] || []).forEach(function(t) {
					let n = t.split("."), i = [].concat(a);
					i.shift(), n = n.concat(i), (h.aliases[e] || []).includes(n.join(".")) || B(b, n, r);
				}), V(e, h.normalize) && !V(e, h.arrays) && [e].concat(h.aliases[e] || []).forEach(function(e) {
					Object.defineProperty(x, e, {
						enumerable: !0,
						get() {
							return t;
						},
						set(e) {
							t = typeof e == "string" ? j.normalize(e) : e;
						}
					});
				});
			}
			function D(e, t) {
				h.aliases[e] && h.aliases[e].length || (h.aliases[e] = [t], f[t] = !0), h.aliases[t] && h.aliases[t].length || D(t, e);
			}
			function k(e, t, n) {
				n && (t = ae(t)), (V(e, h.bools) || V(e, h.counts)) && typeof t == "string" && (t = t === "true");
				let r = Array.isArray(t) ? t.map(function(t) {
					return M(e, t);
				}) : M(e, t);
				return V(e, h.counts) && (Y(r) || typeof r == "boolean") && (r = A()), V(e, h.normalize) && V(e, h.arrays) && (r = Array.isArray(t) ? t.map((e) => j.normalize(e)) : j.normalize(t)), r;
			}
			function M(e, t) {
				return !o["parse-positional-numbers"] && e === "_" || !V(e, h.strings) && !V(e, h.bools) && !Array.isArray(t) && (te(t) && o["parse-numbers"] && Number.isSafeInteger(Math.floor(parseFloat(`${t}`))) || !Y(t) && V(e, h.numbers)) && (t = Number(t)), t;
			}
			function oe(e) {
				let t = Object.create(null);
				R(t, h.aliases, s), Object.keys(h.configs).forEach(function(n) {
					let r = e[n] || t[n];
					if (r) try {
						let e = null, t = j.resolve(j.cwd(), r), i = h.configs[n];
						if (typeof i == "function") {
							try {
								e = i(t);
							} catch (t) {
								e = t;
							}
							if (e instanceof Error) {
								v = e;
								return;
							}
						} else e = j.require(t);
						N(e);
					} catch (t) {
						t.name === "PermissionDenied" ? v = t : e[n] && (v = Error(m("Invalid JSON config file: %s", r)));
					}
				});
			}
			function N(e, t) {
				Object.keys(e).forEach(function(n) {
					let r = e[n], i = t ? t + "." + n : n;
					typeof r == "object" && r && !Array.isArray(r) && o["dot-notation"] ? N(r, i) : (!z(b, i.split(".")) || V(i, h.arrays) && o["combine-arrays"]) && E(i, r);
				});
			}
			function P() {
				c !== void 0 && c.forEach(function(e) {
					N(e);
				});
			}
			function F(e, t) {
				if (l === void 0) return;
				let n = typeof l == "string" ? l : "", r = j.env();
				Object.keys(r).forEach(function(i) {
					if (n === "" || i.lastIndexOf(n, 0) === 0) {
						let a = i.split("__").map(function(e, t) {
							return t === 0 && (e = e.substring(n.length)), T(e);
						});
						(t && h.configs[a.join(".")] || !t) && !z(e, a) && E(a.join("."), r[i]);
					}
				});
			}
			function I(e) {
				let t, n = /* @__PURE__ */ new Set();
				Object.keys(e).forEach(function(r) {
					if (!n.has(r) && (t = V(r, h.coercions), typeof t == "function")) try {
						let i = M(r, t(e[r]));
						[].concat(h.aliases[r] || [], r).forEach((t) => {
							n.add(t), e[t] = i;
						});
					} catch (e) {
						v = e;
					}
				});
			}
			function L(e) {
				return h.keys.forEach((t) => {
					~t.indexOf(".") || e[t] === void 0 && (e[t] = void 0);
				}), e;
			}
			function R(e, t, n, r = !1) {
				Object.keys(n).forEach(function(i) {
					z(e, i.split(".")) || (B(e, i.split("."), n[i]), r && (p[i] = !0), (t[i] || []).forEach(function(t) {
						z(e, t.split(".")) || B(e, t.split("."), n[i]);
					}));
				});
			}
			function z(e, t) {
				let n = e;
				o["dot-notation"] || (t = [t.join(".")]), t.slice(0, -1).forEach(function(e) {
					n = n[e] || {};
				});
				let r = t[t.length - 1];
				return typeof n == "object" && r in n;
			}
			function B(e, t, n) {
				let r = e;
				o["dot-notation"] || (t = [t.join(".")]), t.slice(0, -1).forEach(function(e) {
					e = ie(e), typeof r == "object" && r[e] === void 0 && (r[e] = {}), typeof r[e] != "object" || Array.isArray(r[e]) ? (Array.isArray(r[e]) ? r[e].push({}) : r[e] = [r[e], {}], r = r[e][r[e].length - 1]) : r = r[e];
				});
				let i = ie(t[t.length - 1]), a = V(t.join("."), h.arrays), s = Array.isArray(n), c = o["duplicate-arguments-array"];
				!c && V(i, h.nargs) && (c = !0, (!Y(r[i]) && h.nargs[i] === 1 || Array.isArray(r[i]) && r[i].length === h.nargs[i]) && (r[i] = void 0)), n === A() ? r[i] = A(r[i]) : Array.isArray(r[i]) ? c && a && s ? r[i] = o["flatten-duplicate-arrays"] ? r[i].concat(n) : (Array.isArray(r[i][0]) ? r[i] : [r[i]]).concat([n]) : !c && !!a == !!s ? r[i] = n : r[i] = r[i].concat([n]) : r[i] === void 0 && a ? r[i] = s ? n : [n] : c && !(r[i] === void 0 || V(i, h.counts) || V(i, h.bools)) ? r[i] = [r[i], n] : r[i] = n;
			}
			function se(...e) {
				e.forEach(function(e) {
					Object.keys(e || {}).forEach(function(e) {
						h.aliases[e] || (h.aliases[e] = [].concat(a[e] || []), h.aliases[e].concat(e).forEach(function(t) {
							if (/-/.test(t) && o["camel-case-expansion"]) {
								let n = T(t);
								n !== e && h.aliases[e].indexOf(n) === -1 && (h.aliases[e].push(n), f[n] = !0);
							}
						}), h.aliases[e].concat(e).forEach(function(t) {
							if (t.length > 1 && /[A-Z]/.test(t) && o["camel-case-expansion"]) {
								let n = ee(t, "-");
								n !== e && h.aliases[e].indexOf(n) === -1 && (h.aliases[e].push(n), f[n] = !0);
							}
						}), h.aliases[e].forEach(function(t) {
							h.aliases[t] = [e].concat(h.aliases[e].filter(function(e) {
								return t !== e;
							}));
						}));
					});
				});
			}
			function V(e, t) {
				let n = [].concat(h.aliases[e] || [], e), r = Object.keys(t), i = n.find((e) => r.includes(e));
				return i ? t[i] : !1;
			}
			function H(e) {
				let t = Object.keys(h);
				return [].concat(t.map((e) => h[e])).some(function(t) {
					return Array.isArray(t) ? t.includes(e) : t[e];
				});
			}
			function ce(e, ...t) {
				return [].concat(...t).some(function(t) {
					let n = e.match(t);
					return n && H(n[1]);
				});
			}
			function U(e) {
				if (e.match(g) || !e.match(/^-[^-]+/)) return !1;
				let t = !0, n, r = e.slice(1).split("");
				for (let i = 0; i < r.length; i++) {
					if (n = e.slice(i + 2), !H(r[i])) {
						t = !1;
						break;
					}
					if (r[i + 1] && r[i + 1] === "=" || n === "-" || /[A-Za-z]/.test(r[i]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(n) || r[i + 1] && r[i + 1].match(/\W/)) break;
				}
				return t;
			}
			function W(e) {
				return o["unknown-options-as-args"] && G(e);
			}
			function G(e) {
				return e = e.replace(/^-{3,}/, "--"), e.match(g) || U(e) ? !1 : !ce(e, /^-+([^=]+?)=[\s\S]*$/, _, /^-+([^=]+?)$/, /^-+([^=]+?)-$/, /^-+([^=]+?\d+)$/, /^-+([^=]+?)\W+.*$/);
			}
			function K(e) {
				return !V(e, h.bools) && !V(e, h.counts) && `${e}` in s ? s[e] : q(J(e));
			}
			function q(e) {
				return {
					[O.BOOLEAN]: !0,
					[O.STRING]: "",
					[O.NUMBER]: void 0,
					[O.ARRAY]: []
				}[e];
			}
			function J(e) {
				let t = O.BOOLEAN;
				return V(e, h.strings) ? t = O.STRING : V(e, h.numbers) ? t = O.NUMBER : V(e, h.bools) ? t = O.BOOLEAN : V(e, h.arrays) && (t = O.ARRAY), t;
			}
			function Y(e) {
				return e === void 0;
			}
			function le() {
				Object.keys(h.counts).find((e) => V(e, h.arrays) ? (v = Error(m("Invalid configuration: %s, opts.count excludes opts.array.", e)), !0) : V(e, h.nargs) ? (v = Error(m("Invalid configuration: %s, opts.count excludes opts.narg.", e)), !0) : !1);
			}
			return {
				aliases: Object.assign({}, h.aliases),
				argv: Object.assign(x, b),
				configuration: o,
				defaulted: Object.assign({}, p),
				error: v,
				newAliases: Object.assign({}, f)
			};
		}
	};
})), N, P, F, I, L, R = t((() => {
	if (E(), oe(), N = process && process.env && process.env.YARGS_MIN_NODE_VERSION ? Number(process.env.YARGS_MIN_NODE_VERSION) : 12, P = (process == null ? void 0 : process.versions)?.node ?? (process == null ? void 0 : process.version)?.slice(1), P && Number(P.match(/^([^.]+)/)[1]) < N) throw Error(`yargs parser supports a minimum Node.js version of ${N}. Read our version support policy: https://github.com/yargs/yargs-parser#supported-nodejs-versions`);
	F = process ? process.env : {}, I = new M({
		cwd: process.cwd,
		env: () => F,
		format: m,
		normalize: a,
		resolve: s,
		require: (t) => {
			if (e !== void 0) return e(t);
			if (t.match(/\.json$/)) return JSON.parse(c(t, "utf8"));
			throw Error("only .json config files are supported in ESM");
		}
	}), L = function(e, t) {
		return I.parse(e.slice(), t).argv;
	}, L.detailed = function(e, t) {
		return I.parse(e.slice(), t);
	}, L.camelCase = T, L.decamelize = ee, L.looksLikeNumber = te;
}));
//#endregion
//#region node_modules/cliui/build/lib/index.js
function z(e, t, n) {
	return e.border ? /[.']-+[.']/.test(t) ? "" : t.trim().length === 0 ? "  " : n : "";
}
function B(e) {
	let t = e.padding || [], n = 1 + (t[q] || 0) + (t[G] || 0);
	return e.border ? n + 4 : n;
}
function se() {
	return typeof process == "object" && process.stdout && process.stdout.columns ? process.stdout.columns : 80;
}
function V(e, t) {
	e = e.trim();
	let n = Y.stringWidth(e);
	return n < t ? " ".repeat(t - n) + e : e;
}
function H(e, t) {
	e = e.trim();
	let n = Y.stringWidth(e);
	return n >= t ? e : " ".repeat(t - n >> 1) + e;
}
function ce(e, t) {
	return Y = t, new J({
		width: e?.width || se(),
		wrap: e?.wrap
	});
}
var U, W, G, K, q, J, Y, le = t((() => {
	U = {
		right: V,
		center: H
	}, W = 0, G = 1, K = 2, q = 3, J = class {
		constructor(e) {
			this.width = e.width, this.wrap = e.wrap ?? !0, this.rows = [];
		}
		span(...e) {
			let t = this.div(...e);
			t.span = !0;
		}
		resetOutput() {
			this.rows = [];
		}
		div(...e) {
			if (e.length === 0 && this.div(""), this.wrap && this.shouldApplyLayoutDSL(...e) && typeof e[0] == "string") return this.applyLayoutDSL(e[0]);
			let t = e.map((e) => typeof e == "string" ? this.colFromString(e) : e);
			return this.rows.push(t), t;
		}
		shouldApplyLayoutDSL(...e) {
			return e.length === 1 && typeof e[0] == "string" && /[\t\n]/.test(e[0]);
		}
		applyLayoutDSL(e) {
			let t = e.split("\n").map((e) => e.split("	")), n = 0;
			return t.forEach((e) => {
				e.length > 1 && Y.stringWidth(e[0]) > n && (n = Math.min(Math.floor(this.width * .5), Y.stringWidth(e[0])));
			}), t.forEach((e) => {
				this.div(...e.map((t, r) => ({
					text: t.trim(),
					padding: this.measurePadding(t),
					width: r === 0 && e.length > 1 ? n : void 0
				})));
			}), this.rows[this.rows.length - 1];
		}
		colFromString(e) {
			return {
				text: e,
				padding: this.measurePadding(e)
			};
		}
		measurePadding(e) {
			let t = Y.stripAnsi(e);
			return [
				0,
				t.match(/\s*$/)[0].length,
				0,
				t.match(/^\s*/)[0].length
			];
		}
		toString() {
			let e = [];
			return this.rows.forEach((t) => {
				this.rowToString(t, e);
			}), e.filter((e) => !e.hidden).map((e) => e.text).join("\n");
		}
		rowToString(e, t) {
			return this.rasterize(e).forEach((n, r) => {
				let i = "";
				n.forEach((n, a) => {
					let { width: o } = e[a], s = this.negatePadding(e[a]), c = n;
					if (s > Y.stringWidth(n) && (c += " ".repeat(s - Y.stringWidth(n))), e[a].align && e[a].align !== "left" && this.wrap) {
						let t = U[e[a].align];
						c = t(c, s), Y.stringWidth(c) < s && (c += " ".repeat((o || 0) - Y.stringWidth(c) - 1));
					}
					let l = e[a].padding || [
						0,
						0,
						0,
						0
					];
					l[q] && (i += " ".repeat(l[q])), i += z(e[a], c, "| "), i += c, i += z(e[a], c, " |"), l[G] && (i += " ".repeat(l[G])), r === 0 && t.length > 0 && (i = this.renderInline(i, t[t.length - 1]));
				}), t.push({
					text: i.replace(/ +$/, ""),
					span: e.span
				});
			}), t;
		}
		renderInline(e, t) {
			let n = e.match(/^ */), r = n ? n[0].length : 0, i = t.text, a = Y.stringWidth(i.trimRight());
			return t.span ? this.wrap ? r < a ? e : (t.hidden = !0, i.trimRight() + " ".repeat(r - a) + e.trimLeft()) : (t.hidden = !0, i + e) : e;
		}
		rasterize(e) {
			let t = [], n = this.columnWidths(e), r;
			return e.forEach((e, i) => {
				e.width = n[i], r = this.wrap ? Y.wrap(e.text, this.negatePadding(e), { hard: !0 }).split("\n") : e.text.split("\n"), e.border && (r.unshift("." + "-".repeat(this.negatePadding(e) + 2) + "."), r.push("'" + "-".repeat(this.negatePadding(e) + 2) + "'")), e.padding && (r.unshift(...Array(e.padding[W] || 0).fill("")), r.push(...Array(e.padding[K] || 0).fill(""))), r.forEach((e, n) => {
					t[n] || t.push([]);
					let r = t[n];
					for (let e = 0; e < i; e++) r[e] === void 0 && r.push("");
					r.push(e);
				});
			}), t;
		}
		negatePadding(e) {
			let t = e.width || 0;
			return e.padding && (t -= (e.padding[q] || 0) + (e.padding[G] || 0)), e.border && (t -= 4), t;
		}
		columnWidths(e) {
			if (!this.wrap) return e.map((e) => e.width || Y.stringWidth(e.text));
			let t = e.length, n = this.width, r = e.map((e) => {
				if (e.width) return t--, n -= e.width, e.width;
			}), i = t ? Math.floor(n / t) : 0;
			return r.map((t, n) => t === void 0 ? Math.max(i, B(e[n])) : t);
		}
	};
}));
//#endregion
//#region node_modules/cliui/build/lib/string-utils.js
function ue(e) {
	return e.replace(X, "");
}
function de(e, t) {
	let [n, r] = e.match(X) || ["", ""];
	e = ue(e);
	let i = "";
	for (let n = 0; n < e.length; n++) n !== 0 && n % t === 0 && (i += "\n"), i += e.charAt(n);
	return n && r && (i = `${n}${i}${r}`), i;
}
var X, fe = t((() => {
	X = /* @__PURE__ */ RegExp("\x1B(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)", "g");
}));
//#endregion
//#region node_modules/cliui/index.mjs
function pe(e) {
	return ce(e, {
		stringWidth: (e) => [...e].length,
		stripAnsi: ue,
		wrap: de
	});
}
var me = t((() => {
	le(), fe();
}));
//#endregion
//#region node_modules/escalade/sync/index.mjs
function he(e, t) {
	let n = s(".", e), i;
	for (u(n).isDirectory() || (n = r(n));;) {
		if (i = t(n, l(n)), i) return s(n, i);
		if (n = r(i = n), i === n) break;
	}
}
var ge = t((() => {})), _e, ve = t((() => {
	_e = {
		fs: {
			readFileSync: c,
			writeFile: d
		},
		format: m,
		resolve: s,
		exists: (e) => {
			try {
				return u(e).isFile();
			} catch {
				return !1;
			}
		}
	};
}));
//#endregion
//#region node_modules/y18n/build/lib/index.js
function ye(e, t) {
	Z = t;
	let n = new be(e);
	return {
		__: n.__.bind(n),
		__n: n.__n.bind(n),
		setLocale: n.setLocale.bind(n),
		getLocale: n.getLocale.bind(n),
		updateLocale: n.updateLocale.bind(n),
		locale: n.locale
	};
}
var Z, be, xe = t((() => {
	be = class {
		constructor(e) {
			e ||= {}, this.directory = e.directory || "./locales", this.updateFiles = typeof e.updateFiles != "boolean" || e.updateFiles, this.locale = e.locale || "en", this.fallbackToLanguage = typeof e.fallbackToLanguage != "boolean" || e.fallbackToLanguage, this.cache = Object.create(null), this.writeQueue = [];
		}
		__(...e) {
			if (typeof arguments[0] != "string") return this._taggedLiteral(arguments[0], ...arguments);
			let t = e.shift(), n = function() {};
			return typeof e[e.length - 1] == "function" && (n = e.pop()), n ||= function() {}, this.cache[this.locale] || this._readLocaleFile(), !this.cache[this.locale][t] && this.updateFiles ? (this.cache[this.locale][t] = t, this._enqueueWrite({
				directory: this.directory,
				locale: this.locale,
				cb: n
			})) : n(), Z.format.apply(Z.format, [this.cache[this.locale][t] || t].concat(e));
		}
		__n() {
			let e = Array.prototype.slice.call(arguments), t = e.shift(), n = e.shift(), r = e.shift(), i = function() {};
			typeof e[e.length - 1] == "function" && (i = e.pop()), this.cache[this.locale] || this._readLocaleFile();
			let a = r === 1 ? t : n;
			this.cache[this.locale][t] && (a = this.cache[this.locale][t][r === 1 ? "one" : "other"]), !this.cache[this.locale][t] && this.updateFiles ? (this.cache[this.locale][t] = {
				one: t,
				other: n
			}, this._enqueueWrite({
				directory: this.directory,
				locale: this.locale,
				cb: i
			})) : i();
			let o = [a];
			return ~a.indexOf("%d") && o.push(r), Z.format.apply(Z.format, o.concat(e));
		}
		setLocale(e) {
			this.locale = e;
		}
		getLocale() {
			return this.locale;
		}
		updateLocale(e) {
			this.cache[this.locale] || this._readLocaleFile();
			for (let t in e) Object.prototype.hasOwnProperty.call(e, t) && (this.cache[this.locale][t] = e[t]);
		}
		_taggedLiteral(e, ...t) {
			let n = "";
			return e.forEach(function(e, r) {
				let i = t[r + 1];
				n += e, i !== void 0 && (n += "%s");
			}), this.__.apply(this, [n].concat([].slice.call(t, 1)));
		}
		_enqueueWrite(e) {
			this.writeQueue.push(e), this.writeQueue.length === 1 && this._processWriteQueue();
		}
		_processWriteQueue() {
			let e = this, t = this.writeQueue[0], n = t.directory, r = t.locale, i = t.cb, a = this._resolveLocaleFile(n, r), o = JSON.stringify(this.cache[r], null, 2);
			Z.fs.writeFile(a, o, "utf-8", function(t) {
				e.writeQueue.shift(), e.writeQueue.length > 0 && e._processWriteQueue(), i(t);
			});
		}
		_readLocaleFile() {
			let e = {}, t = this._resolveLocaleFile(this.directory, this.locale);
			try {
				Z.fs.readFileSync && (e = JSON.parse(Z.fs.readFileSync(t, "utf-8")));
			} catch (n) {
				if (n instanceof SyntaxError && (n.message = "syntax error in " + t), n.code === "ENOENT") e = {};
				else throw n;
			}
			this.cache[this.locale] = e;
		}
		_resolveLocaleFile(e, t) {
			let n = Z.resolve(e, "./", t + ".json");
			if (this.fallbackToLanguage && !this._fileExistsSync(n) && ~t.lastIndexOf("_")) {
				let r = Z.resolve(e, "./", t.split("_")[0] + ".json");
				this._fileExistsSync(r) && (n = r);
			}
			return n;
		}
		_fileExistsSync(e) {
			return Z.exists(e);
		}
	};
})), Se, Ce = t((() => {
	ve(), xe(), Se = (e) => ye(e, _e);
})), we, Q, $, Te, Ee, De = t((() => {
	me(), ge(), R(), w(), v(), Ce(), we = "require is not supported by ESM", Q = "loading a directory of commands is not supported yet for ESM";
	try {
		$ = g(import.meta.url);
	} catch {
		$ = process.cwd();
	}
	Te = $.substring(0, $.lastIndexOf("node_modules")), Ee = {
		assert: {
			notStrictEqual: f,
			strictEqual: p
		},
		cliui: pe,
		findUp: he,
		getEnv: (e) => process.env[e],
		inspect: h,
		getCallerFile: () => {
			throw new _(Q);
		},
		getProcessArgvBin: C,
		mainFilename: Te || process.cwd(),
		Parser: L,
		path: {
			basename: n,
			dirname: r,
			extname: i,
			relative: o,
			resolve: s
		},
		process: {
			argv: () => process.argv,
			cwd: process.cwd,
			emitWarning: (e, t) => process.emitWarning(e, t),
			execPath: () => process.execPath,
			exit: process.exit,
			nextTick: process.nextTick,
			stdColumns: process.stdout.columns === void 0 ? null : process.stdout.columns
		},
		readFileSync: c,
		require: () => {
			throw new _(we);
		},
		requireDirectory: () => {
			throw new _(Q);
		},
		stringWidth: (e) => [...e].length,
		y18n: Se({
			directory: s($, "../../../locales"),
			updateFiles: !1
		})
	};
}));
//#endregion
export { S as a, v as c, L as i, De as n, w as o, R as r, _ as s, Ee as t };
