import { i as e, n as t } from "./rolldown-runtime-C6GIJ8is.js";
import { c as n, n as r, s as i, t as a } from "./esm-BsOHzDK9.js";
//#region node_modules/yargs/build/lib/utils/apply-extends.js
function o(t, n, r, i) {
	d = i;
	let a = {};
	if (Object.prototype.hasOwnProperty.call(t, "extends")) {
		if (typeof t.extends != "string") return a;
		let i = /\.json|\..*rc$/.test(t.extends), l = null;
		if (i) l = c(n, t.extends);
		else try {
			l = e.resolve(t.extends);
		} catch {
			return t;
		}
		s(l), u.push(l), a = i ? JSON.parse(d.readFileSync(l, "utf8")) : e(t.extends), delete t.extends, a = o(a, d.path.dirname(l), r, d);
	}
	return u = [], r ? l(a, t) : Object.assign({}, a, t);
}
function s(e) {
	if (u.indexOf(e) > -1) throw new i(`Circular extended configurations: '${e}'.`);
}
function c(e, t) {
	return d.path.resolve(e, t);
}
function l(e, t) {
	let n = {};
	function r(e) {
		return e && typeof e == "object" && !Array.isArray(e);
	}
	Object.assign(n, e);
	for (let i of Object.keys(t)) r(t[i]) && r(n[i]) ? n[i] = l(e[i], t[i]) : n[i] = t[i];
	return n;
}
var u, d, f = t((() => {
	n(), u = [];
}));
//#endregion
//#region node_modules/yargs/build/lib/typings/common-types.js
function p(e, t, n, r) {
	n.assert.notStrictEqual(e, t, r);
}
function m(e, t) {
	t.assert.strictEqual(typeof e, "string");
}
function h(e) {
	return Object.keys(e);
}
var g = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/utils/is-promise.js
function _(e) {
	return !!e && !!e.then && typeof e.then == "function";
}
var ee = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/parse-command.js
function v(e) {
	let t = e.replace(/\s{2,}/g, " ").split(/\s+(?![^[]*]|[^<]*>)/), n = /\.*[\][<>]/g, r = t.shift();
	if (!r) throw Error(`No command found in: ${e}`);
	let i = {
		cmd: r.replace(n, ""),
		demanded: [],
		optional: []
	};
	return t.forEach((e, r) => {
		let a = !1;
		e = e.replace(/\s/g, ""), /\.+[\]>]/.test(e) && r === t.length - 1 && (a = !0), /^\[/.test(e) ? i.optional.push({
			cmd: e.replace(n, "").split("|"),
			variadic: a
		}) : i.demanded.push({
			cmd: e.replace(n, "").split("|"),
			variadic: a
		});
	}), i;
}
var te = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/argsert.js
function y(e, t, n) {
	function r() {
		return typeof e == "object" ? [
			{
				demanded: [],
				optional: []
			},
			e,
			t
		] : [
			v(`cmd ${e}`),
			t,
			n
		];
	}
	try {
		let e = 0, [t, n, a] = r(), o = [].slice.call(n);
		for (; o.length && o[o.length - 1] === void 0;) o.pop();
		let s = a || o.length;
		if (s < t.demanded.length) throw new i(`Not enough arguments provided. Expected ${t.demanded.length} but received ${o.length}.`);
		let c = t.demanded.length + t.optional.length;
		if (s > c) throw new i(`Too many arguments provided. Expected max ${c} but received ${s}.`);
		t.demanded.forEach((t) => {
			let n = ne(o.shift());
			t.cmd.filter((e) => e === n || e === "*").length === 0 && re(n, t.cmd, e), e += 1;
		}), t.optional.forEach((t) => {
			if (o.length === 0) return;
			let n = ne(o.shift());
			t.cmd.filter((e) => e === n || e === "*").length === 0 && re(n, t.cmd, e), e += 1;
		});
	} catch (e) {
		console.warn(e.stack);
	}
}
function ne(e) {
	return Array.isArray(e) ? "array" : e === null ? "null" : typeof e;
}
function re(e, t, n) {
	throw new i(`Invalid ${ie[n] || "manyith"} argument. Expected ${t.join(" or ")} but received ${e}.`);
}
var ie, b = t((() => {
	n(), te(), ie = [
		"first",
		"second",
		"third",
		"fourth",
		"fifth",
		"sixth"
	];
}));
//#endregion
//#region node_modules/yargs/build/lib/middleware.js
function ae(e) {
	return e ? e.map((e) => (e.applyBeforeValidation = !1, e)) : [];
}
function x(e, t, n, r) {
	return n.reduce((e, n) => {
		if (n.applyBeforeValidation !== r) return e;
		if (n.mutates) {
			if (n.applied) return e;
			n.applied = !0;
		}
		if (_(e)) return e.then((e) => Promise.all([e, n(e, t)])).then(([e, t]) => Object.assign(e, t));
		{
			let r = n(e, t);
			return _(r) ? r.then((t) => Object.assign(e, t)) : Object.assign(e, r);
		}
	}, e);
}
var S, oe = t((() => {
	b(), ee(), S = class {
		constructor(e) {
			this.globalMiddleware = [], this.frozens = [], this.yargs = e;
		}
		addMiddleware(e, t, n = !0, r = !1) {
			if (y("<array|function> [boolean] [boolean] [boolean]", [
				e,
				t,
				n
			], arguments.length), Array.isArray(e)) {
				for (let r = 0; r < e.length; r++) {
					if (typeof e[r] != "function") throw Error("middleware must be a function");
					let i = e[r];
					i.applyBeforeValidation = t, i.global = n;
				}
				Array.prototype.push.apply(this.globalMiddleware, e);
			} else if (typeof e == "function") {
				let i = e;
				i.applyBeforeValidation = t, i.global = n, i.mutates = r, this.globalMiddleware.push(e);
			}
			return this.yargs;
		}
		addCoerceMiddleware(e, t) {
			let n = this.yargs.getAliases();
			return this.globalMiddleware = this.globalMiddleware.filter((e) => {
				let r = [...n[t] || [], t];
				return !e.option || !r.includes(e.option);
			}), e.option = t, this.addMiddleware(e, !0, !0, !0);
		}
		getMiddleware() {
			return this.globalMiddleware;
		}
		freeze() {
			this.frozens.push([...this.globalMiddleware]);
		}
		unfreeze() {
			let e = this.frozens.pop();
			e !== void 0 && (this.globalMiddleware = e);
		}
		reset() {
			this.globalMiddleware = this.globalMiddleware.filter((e) => e.global);
		}
	};
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/maybe-async-result.js
function se(e, t, n = (e) => {
	throw e;
}) {
	try {
		let n = ce(e) ? e() : e;
		return _(n) ? n.then((e) => t(e)) : t(n);
	} catch (e) {
		return n(e);
	}
}
function ce(e) {
	return typeof e == "function";
}
var le = t((() => {
	ee();
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/which-module.js
function ue(t) {
	if (e === void 0) return null;
	for (let n = 0, r = Object.keys(e.cache), i; n < r.length; n++) if (i = e.cache[r[n]], i.exports === t) return i;
	return null;
}
var de = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/command.js
function fe(e, t, n, r) {
	return new ve(e, t, n, r);
}
function pe(e) {
	return typeof e == "object" && !!e.builder && typeof e.handler == "function";
}
function me(e) {
	return e.every((e) => typeof e == "string");
}
function he(e) {
	return typeof e == "function";
}
function ge(e) {
	return typeof e == "object";
}
function _e(e) {
	return typeof e == "object" && !Array.isArray(e);
}
var C, ve, ye = t((() => {
	g(), ee(), oe(), te(), It(), le(), de(), C = /(^\*)|(^\$0)/, ve = class {
		constructor(e, t, n, r) {
			this.requireCache = /* @__PURE__ */ new Set(), this.handlers = {}, this.aliasMap = {}, this.frozens = [], this.shim = r, this.usage = e, this.globalMiddleware = n, this.validation = t;
		}
		addDirectory(e, t, n, r) {
			r ||= {}, typeof r.recurse != "boolean" && (r.recurse = !1), Array.isArray(r.extensions) || (r.extensions = ["js"]);
			let i = typeof r.visit == "function" ? r.visit : (e) => e;
			r.visit = (e, t, n) => {
				let r = i(e, t, n);
				if (r) {
					if (this.requireCache.has(t)) return r;
					this.requireCache.add(t), this.addHandler(r);
				}
				return r;
			}, this.shim.requireDirectory({
				require: t,
				filename: n
			}, e, r);
		}
		addHandler(e, t, n, r, i, a) {
			let o = [], s = ae(i);
			if (r ||= (() => {}), Array.isArray(e)) if (me(e)) [e, ...o] = e;
			else for (let t of e) this.addHandler(t);
			else if (_e(e)) {
				let t = Array.isArray(e.command) || typeof e.command == "string" ? e.command : this.moduleName(e);
				e.aliases && (t = [].concat(t, e.aliases)), this.addHandler(t, this.extractDesc(e), e.builder, e.handler, e.middlewares, e.deprecated);
				return;
			} else if (pe(n)) {
				this.addHandler([e].concat(o), t, n.builder, n.handler, n.middlewares, n.deprecated);
				return;
			}
			if (typeof e == "string") {
				let i = v(e);
				o = o.map((e) => v(e).cmd);
				let c = !1, l = [i.cmd].concat(o).filter((e) => C.test(e) ? (c = !0, !1) : !0);
				l.length === 0 && c && l.push("$0"), c && (i.cmd = l[0], o = l.slice(1), e = e.replace(C, i.cmd)), o.forEach((e) => {
					this.aliasMap[e] = i.cmd;
				}), t !== !1 && this.usage.command(e, t, c, o, a), this.handlers[i.cmd] = {
					original: e,
					description: t,
					handler: r,
					builder: n || {},
					middlewares: s,
					deprecated: a,
					demanded: i.demanded,
					optional: i.optional
				}, c && (this.defaultCommand = this.handlers[i.cmd]);
			}
		}
		getCommandHandlers() {
			return this.handlers;
		}
		getCommands() {
			return Object.keys(this.handlers).concat(Object.keys(this.aliasMap));
		}
		hasDefaultCommand() {
			return !!this.defaultCommand;
		}
		runCommand(e, t, n, r, i, a) {
			let o = this.handlers[e] || this.handlers[this.aliasMap[e]] || this.defaultCommand, s = t.getInternalMethods().getContext(), c = s.commands.slice(), l = !e;
			e && (s.commands.push(e), s.fullCommands.push(o.original));
			let u = this.applyBuilderUpdateUsageAndParse(l, o, t, n.aliases, c, r, i, a);
			return _(u) ? u.then((e) => this.applyMiddlewareAndGetResult(l, o, e.innerArgv, s, i, e.aliases, t)) : this.applyMiddlewareAndGetResult(l, o, u.innerArgv, s, i, u.aliases, t);
		}
		applyBuilderUpdateUsageAndParse(e, t, n, r, i, a, o, s) {
			let c = t.builder, l = n;
			if (he(c)) {
				n.getInternalMethods().getUsageInstance().freeze();
				let u = c(n.getInternalMethods().reset(r), s);
				if (_(u)) return u.then((r) => (l = Ge(r) ? r : n, this.parseAndUpdateUsage(e, t, l, i, a, o)));
			} else ge(c) && (n.getInternalMethods().getUsageInstance().freeze(), l = n.getInternalMethods().reset(r), Object.keys(t.builder).forEach((e) => {
				l.option(e, c[e]);
			}));
			return this.parseAndUpdateUsage(e, t, l, i, a, o);
		}
		parseAndUpdateUsage(e, t, n, r, i, a) {
			e && n.getInternalMethods().getUsageInstance().unfreeze(!0), this.shouldUpdateUsage(n) && n.getInternalMethods().getUsageInstance().usage(this.usageFromParentCommandsCommandHandler(r, t), t.description);
			let o = n.getInternalMethods().runYargsParserAndExecuteCommands(null, void 0, !0, i, a);
			return _(o) ? o.then((e) => ({
				aliases: n.parsed.aliases,
				innerArgv: e
			})) : {
				aliases: n.parsed.aliases,
				innerArgv: o
			};
		}
		shouldUpdateUsage(e) {
			return !e.getInternalMethods().getUsageInstance().getUsageDisabled() && e.getInternalMethods().getUsageInstance().getUsage().length === 0;
		}
		usageFromParentCommandsCommandHandler(e, t) {
			let n = C.test(t.original) ? t.original.replace(C, "").trim() : t.original, r = e.filter((e) => !C.test(e));
			return r.push(n), `$0 ${r.join(" ")}`;
		}
		handleValidationAndGetResult(e, t, n, r, i, a, o, s) {
			if (!a.getInternalMethods().getHasOutput()) {
				let t = a.getInternalMethods().runValidation(i, s, a.parsed.error, e);
				n = se(n, (e) => (t(e), e));
			}
			if (t.handler && !a.getInternalMethods().getHasOutput()) {
				a.getInternalMethods().setHasOutput();
				let r = !!a.getOptions().configuration["populate--"];
				a.getInternalMethods().postProcess(n, r, !1, !1), n = x(n, a, o, !1), n = se(n, (e) => {
					let n = t.handler(e);
					return _(n) ? n.then(() => e) : e;
				}), e || a.getInternalMethods().getUsageInstance().cacheHelpMessage(), _(n) && !a.getInternalMethods().hasParseCallback() && n.catch((e) => {
					try {
						a.getInternalMethods().getUsageInstance().fail(null, e);
					} catch {}
				});
			}
			return e || (r.commands.pop(), r.fullCommands.pop()), n;
		}
		applyMiddlewareAndGetResult(e, t, n, r, i, a, o) {
			let s = {};
			if (i) return n;
			o.getInternalMethods().getHasOutput() || (s = this.populatePositionals(t, n, r, o));
			let c = this.globalMiddleware.getMiddleware().slice(0).concat(t.middlewares), l = x(n, o, c, !0);
			return _(l) ? l.then((n) => this.handleValidationAndGetResult(e, t, n, r, a, o, c, s)) : this.handleValidationAndGetResult(e, t, l, r, a, o, c, s);
		}
		populatePositionals(e, t, n, r) {
			t._ = t._.slice(n.commands.length);
			let i = e.demanded.slice(0), a = e.optional.slice(0), o = {};
			for (this.validation.positionalCount(i.length, t._.length); i.length;) {
				let e = i.shift();
				this.populatePositional(e, t, o);
			}
			for (; a.length;) {
				let e = a.shift();
				this.populatePositional(e, t, o);
			}
			return t._ = n.commands.concat(t._.map((e) => "" + e)), this.postProcessPositionals(t, o, this.cmdToParseOptions(e.original), r), o;
		}
		populatePositional(e, t, n) {
			let r = e.cmd[0];
			e.variadic ? n[r] = t._.splice(0).map(String) : t._.length && (n[r] = [String(t._.shift())]);
		}
		cmdToParseOptions(e) {
			let t = {
				array: [],
				default: {},
				alias: {},
				demand: {}
			}, n = v(e);
			return n.demanded.forEach((e) => {
				let [n, ...r] = e.cmd;
				e.variadic && (t.array.push(n), t.default[n] = []), t.alias[n] = r, t.demand[n] = !0;
			}), n.optional.forEach((e) => {
				let [n, ...r] = e.cmd;
				e.variadic && (t.array.push(n), t.default[n] = []), t.alias[n] = r;
			}), t;
		}
		postProcessPositionals(e, t, n, r) {
			let i = Object.assign({}, r.getOptions());
			i.default = Object.assign(n.default, i.default);
			for (let e of Object.keys(n.alias)) i.alias[e] = (i.alias[e] || []).concat(n.alias[e]);
			i.array = i.array.concat(n.array), i.config = {};
			let a = [];
			if (Object.keys(t).forEach((e) => {
				t[e].map((t) => {
					i.configuration["unknown-options-as-args"] && (i.key[e] = !0), a.push(`--${e}`), a.push(t);
				});
			}), !a.length) return;
			let o = Object.assign({}, i.configuration, { "populate--": !1 }), s = this.shim.Parser.detailed(a, Object.assign({}, i, { configuration: o }));
			if (s.error) r.getInternalMethods().getUsageInstance().fail(s.error.message, s.error);
			else {
				let n = Object.keys(t);
				Object.keys(t).forEach((e) => {
					n.push(...s.aliases[e]);
				}), Object.keys(s.argv).forEach((i) => {
					n.includes(i) && (t[i] || (t[i] = s.argv[i]), !this.isInConfigs(r, i) && !this.isDefaulted(r, i) && Object.prototype.hasOwnProperty.call(e, i) && Object.prototype.hasOwnProperty.call(s.argv, i) && (Array.isArray(e[i]) || Array.isArray(s.argv[i])) ? e[i] = [].concat(e[i], s.argv[i]) : e[i] = s.argv[i]);
				});
			}
		}
		isDefaulted(e, t) {
			let { default: n } = e.getOptions();
			return Object.prototype.hasOwnProperty.call(n, t) || Object.prototype.hasOwnProperty.call(n, this.shim.Parser.camelCase(t));
		}
		isInConfigs(e, t) {
			let { configObjects: n } = e.getOptions();
			return n.some((e) => Object.prototype.hasOwnProperty.call(e, t)) || n.some((e) => Object.prototype.hasOwnProperty.call(e, this.shim.Parser.camelCase(t)));
		}
		runDefaultBuilderOn(e) {
			if (!this.defaultCommand) return;
			if (this.shouldUpdateUsage(e)) {
				let t = C.test(this.defaultCommand.original) ? this.defaultCommand.original : this.defaultCommand.original.replace(/^[^[\]<>]*/, "$0 ");
				e.getInternalMethods().getUsageInstance().usage(t, this.defaultCommand.description);
			}
			let t = this.defaultCommand.builder;
			if (he(t)) return t(e, !0);
			pe(t) || Object.keys(t).forEach((n) => {
				e.option(n, t[n]);
			});
		}
		moduleName(e) {
			let t = ue(e);
			if (!t) throw Error(`No command name given for module: ${this.shim.inspect(e)}`);
			return this.commandFromFilename(t.filename);
		}
		commandFromFilename(e) {
			return this.shim.path.basename(e, this.shim.path.extname(e));
		}
		extractDesc({ describe: e, description: t, desc: n }) {
			for (let r of [
				e,
				t,
				n
			]) {
				if (typeof r == "string" || r === !1) return r;
				p(r, !0, this.shim);
			}
			return !1;
		}
		freeze() {
			this.frozens.push({
				handlers: this.handlers,
				aliasMap: this.aliasMap,
				defaultCommand: this.defaultCommand
			});
		}
		unfreeze() {
			let e = this.frozens.pop();
			p(e, void 0, this.shim), {handlers: this.handlers, aliasMap: this.aliasMap, defaultCommand: this.defaultCommand} = e;
		}
		reset() {
			return this.handlers = {}, this.aliasMap = {}, this.defaultCommand = void 0, this.requireCache = /* @__PURE__ */ new Set(), this;
		}
	};
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/obj-filter.js
function be(e = {}, t = () => !0) {
	let n = {};
	return h(e).forEach((r) => {
		t(r, e[r]) && (n[r] = e[r]);
	}), n;
}
var xe = t((() => {
	g();
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/set-blocking.js
function Se(e) {
	typeof process > "u" || [process.stdout, process.stderr].forEach((t) => {
		let n = t;
		n._handle && n.isTTY && typeof n._handle.setBlocking == "function" && n._handle.setBlocking(e);
	});
}
var Ce = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/usage.js
function we(e) {
	return typeof e == "boolean";
}
function Te(e, t) {
	let n = t.y18n.__, r = {}, a = [];
	r.failFn = function(e) {
		a.push(e);
	};
	let o = null, s = null, c = !0;
	r.showHelpOnFail = function(t = !0, n) {
		let [i, a] = typeof t == "string" ? [!0, t] : [t, n];
		return e.getInternalMethods().isGlobalContext() && (s = a), o = a, c = i, r;
	};
	let l = !1;
	r.fail = function(t, n) {
		let u = e.getInternalMethods().getLoggerInstance();
		if (a.length) for (let e = a.length - 1; e >= 0; --e) {
			let i = a[e];
			if (we(i)) {
				if (n) throw n;
				if (t) throw Error(t);
			} else i(t, n, r);
		}
		else {
			if (e.getExitProcess() && Se(!0), !l) {
				l = !0, c && (e.showHelp("error"), u.error()), (t || n) && u.error(t || n);
				let r = o || s;
				r && ((t || n) && u.error(""), u.error(r));
			}
			if (n ||= new i(t), e.getExitProcess()) return e.exit(1);
			if (e.getInternalMethods().hasParseCallback()) return e.exit(1, n);
			throw n;
		}
	};
	let u = [], d = !1;
	r.usage = (e, t) => e === null ? (d = !0, u = [], r) : (d = !1, u.push([e, t || ""]), r), r.getUsage = () => u, r.getUsageDisabled = () => d, r.getPositionalGroupName = () => n("Positionals:");
	let f = [];
	r.example = (e, t) => {
		f.push([e, t || ""]);
	};
	let p = [];
	r.command = function(e, t, n, r, i = !1) {
		n && (p = p.map((e) => (e[2] = !1, e))), p.push([
			e,
			t || "",
			n,
			r,
			i
		]);
	}, r.getCommands = () => p;
	let m = {};
	r.describe = function(e, t) {
		Array.isArray(e) ? e.forEach((e) => {
			r.describe(e, t);
		}) : typeof e == "object" ? Object.keys(e).forEach((t) => {
			r.describe(t, e[t]);
		}) : m[e] = t;
	}, r.getDescriptions = () => m;
	let h = [];
	r.epilog = (e) => {
		h.push(e);
	};
	let g = !1, _;
	r.wrap = (e) => {
		g = !0, _ = e;
	}, r.getWrap = () => t.getEnv("YARGS_DISABLE_WRAP") ? null : (g ||= (_ = b(), !0), _);
	let ee = "__yargsString__:";
	r.deferY18nLookup = (e) => ee + e, r.help = function() {
		if (y) return y;
		te();
		let i = e.customScriptName ? e.$0 : t.path.basename(e.$0), a = e.getDemandedOptions(), o = e.getDemandedCommands(), s = e.getDeprecatedOptions(), c = e.getGroups(), l = e.getOptions(), g = [];
		g = g.concat(Object.keys(m)), g = g.concat(Object.keys(a)), g = g.concat(Object.keys(o)), g = g.concat(Object.keys(l.default)), g = g.filter(re), g = Object.keys(g.reduce((e, t) => (t !== "_" && (e[t] = !0), e), {}));
		let _ = r.getWrap(), b = t.cliui({
			width: _,
			wrap: !!_
		});
		if (!d) {
			if (u.length) u.forEach((e) => {
				b.div({ text: `${e[0].replace(/\$0/g, i)}` }), e[1] && b.div({
					text: `${e[1]}`,
					padding: [
						1,
						0,
						0,
						0
					]
				});
			}), b.div();
			else if (p.length) {
				let e = null;
				e = o._ ? `${i} <${n("command")}>\n` : `${i} [${n("command")}]\n`, b.div(`${e}`);
			}
		}
		if (p.length > 1 || p.length === 1 && !p[0][2]) {
			b.div(n("Commands:"));
			let t = e.getInternalMethods().getContext(), r = t.commands.length ? `${t.commands.join(" ")} ` : "";
			e.getInternalMethods().getParserConfiguration()["sort-commands"] === !0 && (p = p.sort((e, t) => e[0].localeCompare(t[0])));
			let a = i ? `${i} ` : "";
			p.forEach((e) => {
				let t = `${a}${r}${e[0].replace(/^\$0 ?/, "")}`;
				b.span({
					text: t,
					padding: [
						0,
						2,
						0,
						2
					],
					width: v(p, _, `${i}${r}`) + 4
				}, { text: e[1] });
				let o = [];
				e[2] && o.push(`[${n("default")}]`), e[3] && e[3].length && o.push(`[${n("aliases:")} ${e[3].join(", ")}]`), e[4] && (typeof e[4] == "string" ? o.push(`[${n("deprecated: %s", e[4])}]`) : o.push(`[${n("deprecated")}]`)), o.length ? b.div({
					text: o.join(" "),
					padding: [
						0,
						0,
						0,
						2
					],
					align: "right"
				}) : b.div();
			}), b.div();
		}
		let ae = (Object.keys(l.alias) || []).concat(Object.keys(e.parsed.newAliases) || []);
		g = g.filter((t) => !e.parsed.newAliases[t] && ae.every((e) => (l.alias[e] || []).indexOf(t) === -1));
		let x = n("Options:");
		c[x] || (c[x] = []), ne(g, l.alias, c, x);
		let S = (e) => /^--/.test(ke(e)), oe = Object.keys(c).filter((e) => c[e].length > 0).map((e) => ({
			groupName: e,
			normalizedKeys: c[e].filter(re).map((e) => {
				if (ae.includes(e)) return e;
				for (let t = 0, n; (n = ae[t]) !== void 0; t++) if ((l.alias[n] || []).includes(e)) return n;
				return e;
			})
		})).filter(({ normalizedKeys: e }) => e.length > 0).map(({ groupName: e, normalizedKeys: t }) => ({
			groupName: e,
			normalizedKeys: t,
			switches: t.reduce((t, n) => (t[n] = [n].concat(l.alias[n] || []).map((t) => e === r.getPositionalGroupName() ? t : (/^[0-9]$/.test(t) ? l.boolean.includes(n) ? "-" : "--" : t.length > 1 ? "--" : "-") + t).sort((e, t) => S(e) === S(t) ? 0 : S(e) ? 1 : -1).join(", "), t), {})
		}));
		if (oe.filter(({ groupName: e }) => e !== r.getPositionalGroupName()).some(({ normalizedKeys: e, switches: t }) => !e.every((e) => S(t[e]))) && oe.filter(({ groupName: e }) => e !== r.getPositionalGroupName()).forEach(({ normalizedKeys: e, switches: t }) => {
			e.forEach((e) => {
				S(t[e]) && (t[e] = De(t[e], 4));
			});
		}), oe.forEach(({ groupName: t, normalizedKeys: i, switches: o }) => {
			b.div(t), i.forEach((t) => {
				let i = o[t], c = m[t] || "", u = null;
				c.includes(ee) && (c = n(c.substring(16))), l.boolean.includes(t) && (u = `[${n("boolean")}]`), l.count.includes(t) && (u = `[${n("count")}]`), l.string.includes(t) && (u = `[${n("string")}]`), l.normalize.includes(t) && (u = `[${n("string")}]`), l.array.includes(t) && (u = `[${n("array")}]`), l.number.includes(t) && (u = `[${n("number")}]`);
				let d = [
					t in s ? ((e) => typeof e == "string" ? `[${n("deprecated: %s", e)}]` : `[${n("deprecated")}]`)(s[t]) : null,
					u,
					t in a ? `[${n("required")}]` : null,
					l.choices && l.choices[t] ? `[${n("choices:")} ${r.stringifiedValues(l.choices[t])}]` : null,
					ie(l.default[t], l.defaultDescription[t])
				].filter(Boolean).join(" ");
				b.span({
					text: ke(i),
					padding: [
						0,
						2,
						0,
						2 + Oe(i)
					],
					width: v(o, _) + 4
				}, c);
				let f = e.getInternalMethods().getUsageConfiguration()["hide-types"] === !0;
				d && !f ? b.div({
					text: d,
					padding: [
						0,
						0,
						0,
						2
					],
					align: "right"
				}) : b.div();
			}), b.div();
		}), f.length && (b.div(n("Examples:")), f.forEach((e) => {
			e[0] = e[0].replace(/\$0/g, i);
		}), f.forEach((e) => {
			e[1] === "" ? b.div({
				text: e[0],
				padding: [
					0,
					2,
					0,
					2
				]
			}) : b.div({
				text: e[0],
				padding: [
					0,
					2,
					0,
					2
				],
				width: v(f, _) + 4
			}, { text: e[1] });
		}), b.div()), h.length > 0) {
			let e = h.map((e) => e.replace(/\$0/g, i)).join("\n");
			b.div(`${e}\n`);
		}
		return b.toString().replace(/\s*$/, "");
	};
	function v(e, n, r) {
		let i = 0;
		return Array.isArray(e) || (e = Object.values(e).map((e) => [e])), e.forEach((e) => {
			i = Math.max(t.stringWidth(r ? `${r} ${ke(e[0])}` : ke(e[0])) + Oe(e[0]), i);
		}), n && (i = Math.min(i, parseInt((n * .5).toString(), 10))), i;
	}
	function te() {
		let t = e.getDemandedOptions(), n = e.getOptions();
		(Object.keys(n.alias) || []).forEach((i) => {
			n.alias[i].forEach((a) => {
				m[a] && r.describe(i, m[a]), a in t && e.demandOption(i, t[a]), n.boolean.includes(a) && e.boolean(i), n.count.includes(a) && e.count(i), n.string.includes(a) && e.string(i), n.normalize.includes(a) && e.normalize(i), n.array.includes(a) && e.array(i), n.number.includes(a) && e.number(i);
			});
		});
	}
	let y;
	r.cacheHelpMessage = function() {
		y = this.help();
	}, r.clearCachedHelpMessage = function() {
		y = void 0;
	}, r.hasCachedHelpMessage = function() {
		return !!y;
	};
	function ne(e, t, n, r) {
		let i = [], a = null;
		return Object.keys(n).forEach((e) => {
			i = i.concat(n[e]);
		}), e.forEach((e) => {
			a = [e].concat(t[e]), a.some((e) => i.indexOf(e) !== -1) || n[r].push(e);
		}), i;
	}
	function re(t) {
		return e.getOptions().hiddenOptions.indexOf(t) < 0 || e.parsed.argv[e.getOptions().showHiddenOpt];
	}
	r.showHelp = (t) => {
		let n = e.getInternalMethods().getLoggerInstance();
		t ||= "error", (typeof t == "function" ? t : n[t])(r.help());
	}, r.functionDescription = (e) => [
		"(",
		e.name ? t.Parser.decamelize(e.name, "-") : n("generated-value"),
		")"
	].join(""), r.stringifiedValues = function(e, t) {
		let n = "", r = t || ", ", i = [].concat(e);
		return !e || !i.length || i.forEach((e) => {
			n.length && (n += r), n += JSON.stringify(e);
		}), n;
	};
	function ie(e, t) {
		let r = `[${n("default:")} `;
		if (e === void 0 && !t) return null;
		if (t) r += t;
		else switch (typeof e) {
			case "string":
				r += `"${e}"`;
				break;
			case "object":
				r += JSON.stringify(e);
				break;
			default: r += e;
		}
		return `${r}]`;
	}
	function b() {
		return t.process.stdColumns ? Math.min(80, t.process.stdColumns) : 80;
	}
	let ae = null;
	r.version = (e) => {
		ae = e;
	}, r.showVersion = (t) => {
		let n = e.getInternalMethods().getLoggerInstance();
		t ||= "error", (typeof t == "function" ? t : n[t])(ae);
	}, r.reset = function(e) {
		return o = null, l = !1, u = [], d = !1, h = [], f = [], p = [], m = be(m, (t) => !e[t]), r;
	};
	let x = [];
	return r.freeze = function() {
		x.push({
			failMessage: o,
			failureOutput: l,
			usages: u,
			usageDisabled: d,
			epilogs: h,
			examples: f,
			commands: p,
			descriptions: m
		});
	}, r.unfreeze = function(e = !1) {
		let t = x.pop();
		t && (e ? (m = {
			...t.descriptions,
			...m
		}, p = [...t.commands, ...p], u = [...t.usages, ...u], f = [...t.examples, ...f], h = [...t.epilogs, ...h]) : {failMessage: o, failureOutput: l, usages: u, usageDisabled: d, epilogs: h, examples: f, commands: p, descriptions: m} = t);
	}, r;
}
function Ee(e) {
	return typeof e == "object";
}
function De(e, t) {
	return Ee(e) ? {
		text: e.text,
		indentation: e.indentation + t
	} : {
		text: e,
		indentation: t
	};
}
function Oe(e) {
	return Ee(e) ? e.indentation : 0;
}
function ke(e) {
	return Ee(e) ? e.text : e;
}
var Ae = t((() => {
	xe(), n(), Ce();
})), je, Me, Ne = t((() => {
	je = "###-begin-{{app_name}}-completions-###\n#\n# yargs command completion script\n#\n# Installation: {{app_path}} {{completion_command}} >> ~/.bashrc\n#    or {{app_path}} {{completion_command}} >> ~/.bash_profile on OSX.\n#\n_{{app_name}}_yargs_completions()\n{\n    local cur_word args type_list\n\n    cur_word=\"${COMP_WORDS[COMP_CWORD]}\"\n    args=(\"${COMP_WORDS[@]}\")\n\n    # ask yargs to generate completions.\n    type_list=$({{app_path}} --get-yargs-completions \"${args[@]}\")\n\n    COMPREPLY=( $(compgen -W \"${type_list}\" -- ${cur_word}) )\n\n    # if no match was found, fall back to filename completion\n    if [ ${#COMPREPLY[@]} -eq 0 ]; then\n      COMPREPLY=()\n    fi\n\n    return 0\n}\ncomplete -o bashdefault -o default -F _{{app_name}}_yargs_completions {{app_name}}\n###-end-{{app_name}}-completions-###\n", Me = "#compdef {{app_name}}\n###-begin-{{app_name}}-completions-###\n#\n# yargs command completion script\n#\n# Installation: {{app_path}} {{completion_command}} >> ~/.zshrc\n#    or {{app_path}} {{completion_command}} >> ~/.zprofile on OSX.\n#\n_{{app_name}}_yargs_completions()\n{\n  local reply\n  local si=$IFS\n  IFS=$'\n' reply=($(COMP_CWORD=\"$((CURRENT-1))\" COMP_LINE=\"$BUFFER\" COMP_POINT=\"$CURSOR\" {{app_path}} --get-yargs-completions \"${words[@]}\"))\n  IFS=$si\n  _describe 'values' reply\n}\ncompdef _{{app_name}}_yargs_completions {{app_name}}\n###-end-{{app_name}}-completions-###\n";
}));
//#endregion
//#region node_modules/yargs/build/lib/completion.js
function Pe(e, t, n, r) {
	return new Le(e, t, n, r);
}
function Fe(e) {
	return e.length < 3;
}
function Ie(e) {
	return e.length > 3;
}
var Le, Re = t((() => {
	ye(), g(), Ne(), ee(), te(), Le = class {
		constructor(e, t, n, r) {
			this.yargs = e, this.usage = t, this.command = n, this.shim = r, this.completionKey = "get-yargs-completions", this.aliases = null, this.customCompletionFunction = null, this.indexAfterLastReset = 0, this.zshShell = (this.shim.getEnv("SHELL")?.includes("zsh") || this.shim.getEnv("ZSH_NAME")?.includes("zsh")) ?? !1;
		}
		defaultCompletion(e, t, n, r) {
			let i = this.command.getCommandHandlers();
			for (let t = 0, n = e.length; t < n; ++t) if (i[e[t]] && i[e[t]].builder) {
				let n = i[e[t]].builder;
				if (he(n)) {
					this.indexAfterLastReset = t + 1;
					let e = this.yargs.getInternalMethods().reset();
					return n(e, !0), e.argv;
				}
			}
			let a = [];
			this.commandCompletions(a, e, n), this.optionCompletions(a, e, t, n), this.choicesFromOptionsCompletions(a, e, t, n), this.choicesFromPositionalsCompletions(a, e, t, n), r(null, a);
		}
		commandCompletions(e, t, n) {
			let r = this.yargs.getInternalMethods().getContext().commands;
			!n.match(/^-/) && r[r.length - 1] !== n && !this.previousArgHasChoices(t) && this.usage.getCommands().forEach((n) => {
				let r = v(n[0]).cmd;
				if (t.indexOf(r) === -1) if (!this.zshShell) e.push(r);
				else {
					let t = n[1] || "";
					e.push(r.replace(/:/g, "\\:") + ":" + t);
				}
			});
		}
		optionCompletions(e, t, n, r) {
			if ((r.match(/^-/) || r === "" && e.length === 0) && !this.previousArgHasChoices(t)) {
				let n = this.yargs.getOptions(), i = this.yargs.getGroups()[this.usage.getPositionalGroupName()] || [];
				Object.keys(n.key).forEach((a) => {
					let o = !!n.configuration["boolean-negation"] && n.boolean.includes(a);
					!i.includes(a) && !n.hiddenOptions.includes(a) && !this.argsContainKey(t, a, o) && this.completeOptionKey(a, e, r, o && !!n.default[a]);
				});
			}
		}
		choicesFromOptionsCompletions(e, t, n, r) {
			if (this.previousArgHasChoices(t)) {
				let n = this.getPreviousArgChoices(t);
				n && n.length > 0 && e.push(...n.map((e) => e.replace(/:/g, "\\:")));
			}
		}
		choicesFromPositionalsCompletions(e, t, n, r) {
			if (r === "" && e.length > 0 && this.previousArgHasChoices(t)) return;
			let i = this.yargs.getGroups()[this.usage.getPositionalGroupName()] || [], a = Math.max(this.indexAfterLastReset, this.yargs.getInternalMethods().getContext().commands.length + 1), o = i[n._.length - a - 1];
			if (!o) return;
			let s = this.yargs.getOptions().choices[o] || [];
			for (let t of s) t.startsWith(r) && e.push(t.replace(/:/g, "\\:"));
		}
		getPreviousArgChoices(e) {
			if (e.length < 1) return;
			let t = e[e.length - 1], n = "";
			if (!t.startsWith("-") && e.length > 1 && (n = t, t = e[e.length - 2]), !t.startsWith("-")) return;
			let r = t.replace(/^-+/, ""), i = this.yargs.getOptions(), a = [r, ...this.yargs.getAliases()[r] || []], o;
			for (let e of a) if (Object.prototype.hasOwnProperty.call(i.key, e) && Array.isArray(i.choices[e])) {
				o = i.choices[e];
				break;
			}
			if (o) return o.filter((e) => !n || e.startsWith(n));
		}
		previousArgHasChoices(e) {
			let t = this.getPreviousArgChoices(e);
			return t !== void 0 && t.length > 0;
		}
		argsContainKey(e, t, n) {
			let r = (t) => e.indexOf((/^[^0-9]$/.test(t) ? "-" : "--") + t) !== -1;
			if (r(t) || n && r(`no-${t}`)) return !0;
			if (this.aliases) {
				for (let e of this.aliases[t]) if (r(e)) return !0;
			}
			return !1;
		}
		completeOptionKey(e, t, n, r) {
			let i = e;
			if (this.zshShell) {
				let t = this.usage.getDescriptions(), n = ((this === null || this === void 0 ? void 0 : this.aliases)?.[e])?.find((e) => {
					let n = t[e];
					return typeof n == "string" && n.length > 0;
				}), r = n ? t[n] : void 0, a = t[e] ?? r ?? "";
				i = `${e.replace(/:/g, "\\:")}:${a.replace("__yargsString__:", "").replace(/(\r\n|\n|\r)/gm, " ")}`;
			}
			let a = !((e) => /^--/.test(e))(n) && ((e) => /^[^0-9]$/.test(e))(e) ? "-" : "--";
			t.push(a + i), r && t.push(a + "no-" + i);
		}
		customCompletion(e, t, n, r) {
			if (p(this.customCompletionFunction, null, this.shim), Fe(this.customCompletionFunction)) {
				let e = this.customCompletionFunction(n, t);
				return _(e) ? e.then((e) => {
					this.shim.process.nextTick(() => {
						r(null, e);
					});
				}).catch((e) => {
					this.shim.process.nextTick(() => {
						r(e, void 0);
					});
				}) : r(null, e);
			} else if (Ie(this.customCompletionFunction)) return this.customCompletionFunction(n, t, (i = r) => this.defaultCompletion(e, t, n, i), (e) => {
				r(null, e);
			});
			else return this.customCompletionFunction(n, t, (e) => {
				r(null, e);
			});
		}
		getCompletion(e, t) {
			let n = e.length ? e[e.length - 1] : "", r = this.yargs.parse(e, !0), i = this.customCompletionFunction ? (r) => this.customCompletion(e, r, n, t) : (r) => this.defaultCompletion(e, r, n, t);
			return _(r) ? r.then(i) : i(r);
		}
		generateCompletionScript(e, t) {
			let n = this.zshShell ? Me : je, r = this.shim.path.basename(e);
			return e.match(/\.js$/) && (e = `./${e}`), n = n.replace(/{{app_name}}/g, r), n = n.replace(/{{completion_command}}/g, t), n.replace(/{{app_path}}/g, e);
		}
		registerFunction(e) {
			this.customCompletionFunction = e;
		}
		setParsed(e) {
			this.aliases = e.aliases;
		}
	};
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/levenshtein.js
function ze(e, t) {
	if (e.length === 0) return t.length;
	if (t.length === 0) return e.length;
	let n = [], r;
	for (r = 0; r <= t.length; r++) n[r] = [r];
	let i;
	for (i = 0; i <= e.length; i++) n[0][i] = i;
	for (r = 1; r <= t.length; r++) for (i = 1; i <= e.length; i++) t.charAt(r - 1) === e.charAt(i - 1) ? n[r][i] = n[r - 1][i - 1] : r > 1 && i > 1 && t.charAt(r - 2) === e.charAt(i - 1) && t.charAt(r - 1) === e.charAt(i - 2) ? n[r][i] = n[r - 2][i - 2] + 1 : n[r][i] = Math.min(n[r - 1][i - 1] + 1, Math.min(n[r][i - 1] + 1, n[r - 1][i] + 1));
	return n[t.length][e.length];
}
var Be = t((() => {}));
//#endregion
//#region node_modules/yargs/build/lib/validation.js
function Ve(e, t, n) {
	let r = n.y18n.__, i = n.y18n.__n, a = {};
	a.nonOptionCount = function(n) {
		let r = e.getDemandedCommands(), a = n._.length + (n["--"] ? n["--"].length : 0) - e.getInternalMethods().getContext().commands.length;
		r._ && (a < r._.min || a > r._.max) && (a < r._.min ? r._.minMsg === void 0 ? t.fail(i("Not enough non-option arguments: got %s, need at least %s", "Not enough non-option arguments: got %s, need at least %s", a, a.toString(), r._.min.toString())) : t.fail(r._.minMsg ? r._.minMsg.replace(/\$0/g, a.toString()).replace(/\$1/, r._.min.toString()) : null) : a > r._.max && (r._.maxMsg === void 0 ? t.fail(i("Too many non-option arguments: got %s, maximum of %s", "Too many non-option arguments: got %s, maximum of %s", a, a.toString(), r._.max.toString())) : t.fail(r._.maxMsg ? r._.maxMsg.replace(/\$0/g, a.toString()).replace(/\$1/, r._.max.toString()) : null)));
	}, a.positionalCount = function(e, n) {
		n < e && t.fail(i("Not enough non-option arguments: got %s, need at least %s", "Not enough non-option arguments: got %s, need at least %s", n, n + "", e + ""));
	}, a.requiredArguments = function(e, n) {
		let r = null;
		for (let t of Object.keys(n)) (!Object.prototype.hasOwnProperty.call(e, t) || e[t] === void 0) && (r ||= {}, r[t] = n[t]);
		if (r) {
			let e = [];
			for (let t of Object.keys(r)) {
				let n = r[t];
				n && e.indexOf(n) < 0 && e.push(n);
			}
			let n = e.length ? `\n${e.join("\n")}` : "";
			t.fail(i("Missing required argument: %s", "Missing required arguments: %s", Object.keys(r).length, Object.keys(r).join(", ") + n));
		}
	}, a.unknownArguments = function(n, r, o, s, c = !0) {
		let l = e.getInternalMethods().getCommandInstance().getCommands(), u = [], d = e.getInternalMethods().getContext();
		if (Object.keys(n).forEach((t) => {
			!He.includes(t) && !Object.prototype.hasOwnProperty.call(o, t) && !Object.prototype.hasOwnProperty.call(e.getInternalMethods().getParseContext(), t) && !a.isValidAndSomeAliasIsNotNew(t, r) && u.push(t);
		}), c && (d.commands.length > 0 || l.length > 0 || s) && n._.slice(d.commands.length).forEach((e) => {
			l.includes("" + e) || u.push("" + e);
		}), c) {
			let t = e.getDemandedCommands()._?.max || 0, r = d.commands.length + t;
			r < n._.length && n._.slice(r).forEach((e) => {
				e = String(e), !d.commands.includes(e) && !u.includes(e) && u.push(e);
			});
		}
		u.length && t.fail(i("Unknown argument: %s", "Unknown arguments: %s", u.length, u.map((e) => e.trim() ? e : `"${e}"`).join(", ")));
	}, a.unknownCommands = function(n) {
		let r = e.getInternalMethods().getCommandInstance().getCommands(), a = [], o = e.getInternalMethods().getContext();
		return (o.commands.length > 0 || r.length > 0) && n._.slice(o.commands.length).forEach((e) => {
			r.includes("" + e) || a.push("" + e);
		}), a.length > 0 ? (t.fail(i("Unknown command: %s", "Unknown commands: %s", a.length, a.join(", "))), !0) : !1;
	}, a.isValidAndSomeAliasIsNotNew = function(t, n) {
		if (!Object.prototype.hasOwnProperty.call(n, t)) return !1;
		let r = e.parsed.newAliases;
		return [t, ...n[t]].some((e) => !Object.prototype.hasOwnProperty.call(r, e) || !r[t]);
	}, a.limitedChoices = function(n) {
		let i = e.getOptions(), a = {};
		if (!Object.keys(i.choices).length) return;
		Object.keys(n).forEach((e) => {
			He.indexOf(e) === -1 && Object.prototype.hasOwnProperty.call(i.choices, e) && [].concat(n[e]).forEach((t) => {
				i.choices[e].indexOf(t) === -1 && t !== void 0 && (a[e] = (a[e] || []).concat(t));
			});
		});
		let o = Object.keys(a);
		if (!o.length) return;
		let s = r("Invalid values:");
		o.forEach((e) => {
			s += `\n  ${r("Argument: %s, Given: %s, Choices: %s", e, t.stringifiedValues(a[e]), t.stringifiedValues(i.choices[e]))}`;
		}), t.fail(s);
	};
	let o = {};
	a.implies = function(t, r) {
		y("<string|object> [array|number|string]", [t, r], arguments.length), typeof t == "object" ? Object.keys(t).forEach((e) => {
			a.implies(e, t[e]);
		}) : (e.global(t), o[t] || (o[t] = []), Array.isArray(r) ? r.forEach((e) => a.implies(t, e)) : (p(r, void 0, n), o[t].push(r)));
	}, a.getImplied = function() {
		return o;
	};
	function s(e, t) {
		let n = Number(t);
		return t = isNaN(n) ? t : n, typeof t == "number" ? t = e._.length >= t : t.match(/^--no-.+/) ? (t = t.match(/^--no-(.+)/)[1], t = !Object.prototype.hasOwnProperty.call(e, t)) : t = Object.prototype.hasOwnProperty.call(e, t), t;
	}
	a.implications = function(e) {
		let n = [];
		if (Object.keys(o).forEach((t) => {
			let r = t;
			(o[t] || []).forEach((t) => {
				let i = r, a = t;
				i = s(e, i), t = s(e, t), i && !t && n.push(` ${r} -> ${a}`);
			});
		}), n.length) {
			let e = `${r("Implications failed:")}\n`;
			n.forEach((t) => {
				e += t;
			}), t.fail(e);
		}
	};
	let c = {};
	a.conflicts = function(t, n) {
		y("<string|object> [array|string]", [t, n], arguments.length), typeof t == "object" ? Object.keys(t).forEach((e) => {
			a.conflicts(e, t[e]);
		}) : (e.global(t), c[t] || (c[t] = []), Array.isArray(n) ? n.forEach((e) => a.conflicts(t, e)) : c[t].push(n));
	}, a.getConflicting = () => c, a.conflicting = function(i) {
		Object.keys(i).forEach((e) => {
			c[e] && c[e].forEach((n) => {
				n && i[e] !== void 0 && i[n] !== void 0 && t.fail(r("Arguments %s and %s are mutually exclusive", e, n));
			});
		}), e.getInternalMethods().getParserConfiguration()["strip-dashed"] && Object.keys(c).forEach((e) => {
			c[e].forEach((a) => {
				a && i[n.Parser.camelCase(e)] !== void 0 && i[n.Parser.camelCase(a)] !== void 0 && t.fail(r("Arguments %s and %s are mutually exclusive", e, a));
			});
		});
	}, a.recommendCommands = function(e, n) {
		n = n.sort((e, t) => t.length - e.length);
		let i = null, a = Infinity;
		for (let t = 0, r; (r = n[t]) !== void 0; t++) {
			let t = ze(e, r);
			t <= 3 && t < a && (a = t, i = r);
		}
		i && t.fail(r("Did you mean %s?", i));
	}, a.reset = function(e) {
		return o = be(o, (t) => !e[t]), c = be(c, (t) => !e[t]), a;
	};
	let l = [];
	return a.freeze = function() {
		l.push({
			implied: o,
			conflicting: c
		});
	}, a.unfreeze = function() {
		let e = l.pop();
		p(e, void 0, n), {implied: o, conflicting: c} = e;
	}, a;
}
var He, Ue = t((() => {
	b(), g(), Be(), xe(), He = [
		"$0",
		"--",
		"_"
	];
}));
//#endregion
//#region node_modules/yargs/build/lib/yargs-factory.js
function We(e) {
	return (t = [], n = e.process.cwd(), r) => {
		let i = new Ft(t, n, r, e);
		return Object.defineProperty(i, "argv", {
			get: () => i.parse(),
			enumerable: !0
		}), i.help(), i.version(), i;
	};
}
function Ge(e) {
	return !!e && typeof e.getInternalMethods == "function";
}
var w, T, E, D, Ke, O, k, qe, A, j, Je, M, Ye, N, P, F, I, Xe, Ze, L, R, Qe, $e, z, B, et, V, H, tt, U, W, G, K, q, nt, J, Y, rt, it, at, ot, st, ct, X, lt, ut, dt, ft, pt, Z, mt, ht, gt, _t, vt, yt, bt, xt, St, Ct, wt, Tt, Et, Dt, Ot, kt, Q, At, jt, Mt, Nt, Pt, $, Ft, It = t((() => {
	ye(), g(), n(), Ae(), b(), Re(), Ue(), xe(), f(), oe(), ee(), le(), Ce(), w = function(e, t, n, r, i) {
		if (r === "m") throw TypeError("Private method is not writable");
		if (r === "a" && !i) throw TypeError("Private accessor was defined without a setter");
		if (typeof t == "function" ? e !== t || !i : !t.has(e)) throw TypeError("Cannot write private member to an object whose class did not declare it");
		return r === "a" ? i.call(e, n) : i ? i.value = n : t.set(e, n), n;
	}, T = function(e, t, n, r) {
		if (n === "a" && !r) throw TypeError("Private accessor was defined without a getter");
		if (typeof t == "function" ? e !== t || !r : !t.has(e)) throw TypeError("Cannot read private member from an object whose class did not declare it");
		return n === "m" ? r : n === "a" ? r.call(e) : r ? r.value : t.get(e);
	}, rt = Symbol("copyDoubleDash"), it = Symbol("copyDoubleDash"), at = Symbol("deleteFromParserHintObject"), ot = Symbol("emitWarning"), st = Symbol("freeze"), ct = Symbol("getDollarZero"), X = Symbol("getParserConfiguration"), lt = Symbol("getUsageConfiguration"), ut = Symbol("guessLocale"), dt = Symbol("guessVersion"), ft = Symbol("parsePositionalNumbers"), pt = Symbol("pkgUp"), Z = Symbol("populateParserHintArray"), mt = Symbol("populateParserHintSingleValueDictionary"), ht = Symbol("populateParserHintArrayDictionary"), gt = Symbol("populateParserHintDictionary"), _t = Symbol("sanitizeKey"), vt = Symbol("setKey"), yt = Symbol("unfreeze"), bt = Symbol("validateAsync"), xt = Symbol("getCommandInstance"), St = Symbol("getContext"), Ct = Symbol("getHasOutput"), wt = Symbol("getLoggerInstance"), Tt = Symbol("getParseContext"), Et = Symbol("getUsageInstance"), Dt = Symbol("getValidationInstance"), Ot = Symbol("hasParseCallback"), kt = Symbol("isGlobalContext"), Q = Symbol("postProcess"), At = Symbol("rebase"), jt = Symbol("reset"), Mt = Symbol("runYargsParserAndExecuteCommands"), Nt = Symbol("runValidation"), Pt = Symbol("setHasOutput"), $ = Symbol("kTrackManuallySetKeys"), Ft = class {
		constructor(e = [], t, n, r) {
			this.customScriptName = !1, this.parsed = !1, E.set(this, void 0), D.set(this, void 0), Ke.set(this, {
				commands: [],
				fullCommands: []
			}), O.set(this, null), k.set(this, null), qe.set(this, "show-hidden"), A.set(this, null), j.set(this, !0), Je.set(this, {}), M.set(this, !0), Ye.set(this, []), N.set(this, void 0), P.set(this, {}), F.set(this, !1), I.set(this, null), Xe.set(this, !0), Ze.set(this, void 0), L.set(this, ""), R.set(this, void 0), Qe.set(this, void 0), $e.set(this, {}), z.set(this, null), B.set(this, null), et.set(this, {}), V.set(this, {}), H.set(this, void 0), tt.set(this, !1), U.set(this, void 0), W.set(this, !1), G.set(this, !1), K.set(this, !1), q.set(this, void 0), nt.set(this, {}), J.set(this, null), Y.set(this, void 0), w(this, U, r, "f"), w(this, H, e, "f"), w(this, D, t, "f"), w(this, Qe, n, "f"), w(this, N, new S(this), "f"), this.$0 = this[ct](), this[jt](), w(this, E, T(this, E, "f"), "f"), w(this, q, T(this, q, "f"), "f"), w(this, Y, T(this, Y, "f"), "f"), w(this, R, T(this, R, "f"), "f"), T(this, R, "f").showHiddenOpt = T(this, qe, "f"), w(this, Ze, this[it](), "f");
		}
		addHelpOpt(e, t) {
			return y("[string|boolean] [string]", [e, t], arguments.length), T(this, I, "f") && (this[at](T(this, I, "f")), w(this, I, null, "f")), e === !1 && t === void 0 ? this : (w(this, I, typeof e == "string" ? e : "help", "f"), this.boolean(T(this, I, "f")), this.describe(T(this, I, "f"), t || T(this, q, "f").deferY18nLookup("Show help")), this);
		}
		help(e, t) {
			return this.addHelpOpt(e, t);
		}
		addShowHiddenOpt(e, t) {
			if (y("[string|boolean] [string]", [e, t], arguments.length), e === !1 && t === void 0) return this;
			let n = typeof e == "string" ? e : T(this, qe, "f");
			return this.boolean(n), this.describe(n, t || T(this, q, "f").deferY18nLookup("Show hidden options")), T(this, R, "f").showHiddenOpt = n, this;
		}
		showHidden(e, t) {
			return this.addShowHiddenOpt(e, t);
		}
		alias(e, t) {
			return y("<object|string|array> [string|array]", [e, t], arguments.length), this[ht](this.alias.bind(this), "alias", e, t), this;
		}
		array(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("array", e), this[$](e), this;
		}
		boolean(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("boolean", e), this[$](e), this;
		}
		check(e, t) {
			return y("<function> [boolean]", [e, t], arguments.length), this.middleware((t, n) => se(() => e(t, n.getOptions()), (n) => (n ? (typeof n == "string" || n instanceof Error) && T(this, q, "f").fail(n.toString(), n) : T(this, q, "f").fail(T(this, U, "f").y18n.__("Argument check failed: %s", e.toString())), t), (e) => (T(this, q, "f").fail(e.message ? e.message : e.toString(), e), t)), !1, t), this;
		}
		choices(e, t) {
			return y("<object|string|array> [string|array]", [e, t], arguments.length), this[ht](this.choices.bind(this), "choices", e, t), this;
		}
		coerce(e, t) {
			if (y("<object|string|array> [function]", [e, t], arguments.length), Array.isArray(e)) {
				if (!t) throw new i("coerce callback must be provided");
				for (let n of e) this.coerce(n, t);
				return this;
			} else if (typeof e == "object") {
				for (let t of Object.keys(e)) this.coerce(t, e[t]);
				return this;
			}
			if (!t) throw new i("coerce callback must be provided");
			return T(this, R, "f").key[e] = !0, T(this, N, "f").addCoerceMiddleware((n, r) => {
				let a;
				return Object.prototype.hasOwnProperty.call(n, e) ? se(() => (a = r.getAliases(), t(n[e])), (t) => {
					n[e] = t;
					let i = r.getInternalMethods().getParserConfiguration()["strip-aliased"];
					if (a[e] && i !== !0) for (let r of a[e]) n[r] = t;
					return n;
				}, (e) => {
					throw new i(e.message);
				}) : n;
			}, e), this;
		}
		conflicts(e, t) {
			return y("<string|object> [string|array]", [e, t], arguments.length), T(this, Y, "f").conflicts(e, t), this;
		}
		config(e = "config", t, n) {
			return y("[object|string] [string|function] [function]", [
				e,
				t,
				n
			], arguments.length), typeof e == "object" && !Array.isArray(e) ? (e = o(e, T(this, D, "f"), this[X]()["deep-merge-config"] || !1, T(this, U, "f")), T(this, R, "f").configObjects = (T(this, R, "f").configObjects || []).concat(e), this) : (typeof t == "function" && (n = t, t = void 0), this.describe(e, t || T(this, q, "f").deferY18nLookup("Path to JSON config file")), (Array.isArray(e) ? e : [e]).forEach((e) => {
				T(this, R, "f").config[e] = n || !0;
			}), this);
		}
		completion(e, t, n) {
			return y("[string] [string|boolean|function] [function]", [
				e,
				t,
				n
			], arguments.length), typeof t == "function" && (n = t, t = void 0), w(this, k, e || T(this, k, "f") || "completion", "f"), !t && t !== !1 && (t = "generate completion script"), this.command(T(this, k, "f"), t), n && T(this, O, "f").registerFunction(n), this;
		}
		command(e, t, n, r, i, a) {
			return y("<string|array|object> [string|boolean] [function|object] [function] [array] [boolean|string]", [
				e,
				t,
				n,
				r,
				i,
				a
			], arguments.length), T(this, E, "f").addHandler(e, t, n, r, i, a), this;
		}
		commands(e, t, n, r, i, a) {
			return this.command(e, t, n, r, i, a);
		}
		commandDir(e, t) {
			y("<string> [object]", [e, t], arguments.length);
			let n = T(this, Qe, "f") || T(this, U, "f").require;
			return T(this, E, "f").addDirectory(e, n, T(this, U, "f").getCallerFile(), t), this;
		}
		count(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("count", e), this[$](e), this;
		}
		default(e, t, n) {
			return y("<object|string|array> [*] [string]", [
				e,
				t,
				n
			], arguments.length), n && (m(e, T(this, U, "f")), T(this, R, "f").defaultDescription[e] = n), typeof t == "function" && (m(e, T(this, U, "f")), T(this, R, "f").defaultDescription[e] || (T(this, R, "f").defaultDescription[e] = T(this, q, "f").functionDescription(t)), t = t.call()), this[mt](this.default.bind(this), "default", e, t), this;
		}
		defaults(e, t, n) {
			return this.default(e, t, n);
		}
		demandCommand(e = 1, t, n, r) {
			return y("[number] [number|string] [string|null|undefined] [string|null|undefined]", [
				e,
				t,
				n,
				r
			], arguments.length), typeof t != "number" && (n = t, t = Infinity), this.global("_", !1), T(this, R, "f").demandedCommands._ = {
				min: e,
				max: t,
				minMsg: n,
				maxMsg: r
			}, this;
		}
		demand(e, t, n) {
			return Array.isArray(t) ? (t.forEach((e) => {
				p(n, !0, T(this, U, "f")), this.demandOption(e, n);
			}), t = Infinity) : typeof t != "number" && (n = t, t = Infinity), typeof e == "number" ? (p(n, !0, T(this, U, "f")), this.demandCommand(e, t, n, n)) : Array.isArray(e) ? e.forEach((e) => {
				p(n, !0, T(this, U, "f")), this.demandOption(e, n);
			}) : typeof n == "string" ? this.demandOption(e, n) : (n === !0 || n === void 0) && this.demandOption(e), this;
		}
		demandOption(e, t) {
			return y("<object|string|array> [string]", [e, t], arguments.length), this[mt](this.demandOption.bind(this), "demandedOptions", e, t), this;
		}
		deprecateOption(e, t) {
			return y("<string> [string|boolean]", [e, t], arguments.length), T(this, R, "f").deprecatedOptions[e] = t, this;
		}
		describe(e, t) {
			return y("<object|string|array> [string]", [e, t], arguments.length), this[vt](e, !0), T(this, q, "f").describe(e, t), this;
		}
		detectLocale(e) {
			return y("<boolean>", [e], arguments.length), w(this, j, e, "f"), this;
		}
		env(e) {
			return y("[string|boolean]", [e], arguments.length), e === !1 ? delete T(this, R, "f").envPrefix : T(this, R, "f").envPrefix = e || "", this;
		}
		epilogue(e) {
			return y("<string>", [e], arguments.length), T(this, q, "f").epilog(e), this;
		}
		epilog(e) {
			return this.epilogue(e);
		}
		example(e, t) {
			return y("<string|array> [string]", [e, t], arguments.length), Array.isArray(e) ? e.forEach((e) => this.example(...e)) : T(this, q, "f").example(e, t), this;
		}
		exit(e, t) {
			w(this, F, !0, "f"), w(this, A, t, "f"), T(this, M, "f") && T(this, U, "f").process.exit(e);
		}
		exitProcess(e = !0) {
			return y("[boolean]", [e], arguments.length), w(this, M, e, "f"), this;
		}
		fail(e) {
			if (y("<function|boolean>", [e], arguments.length), typeof e == "boolean" && e !== !1) throw new i("Invalid first argument. Expected function or boolean 'false'");
			return T(this, q, "f").failFn(e), this;
		}
		getAliases() {
			return this.parsed ? this.parsed.aliases : {};
		}
		async getCompletion(e, t) {
			return y("<array> [function]", [e, t], arguments.length), t ? T(this, O, "f").getCompletion(e, t) : new Promise((t, n) => {
				T(this, O, "f").getCompletion(e, (e, r) => {
					e ? n(e) : t(r);
				});
			});
		}
		getDemandedOptions() {
			return y([], 0), T(this, R, "f").demandedOptions;
		}
		getDemandedCommands() {
			return y([], 0), T(this, R, "f").demandedCommands;
		}
		getDeprecatedOptions() {
			return y([], 0), T(this, R, "f").deprecatedOptions;
		}
		getDetectLocale() {
			return T(this, j, "f");
		}
		getExitProcess() {
			return T(this, M, "f");
		}
		getGroups() {
			return Object.assign({}, T(this, P, "f"), T(this, V, "f"));
		}
		getHelp() {
			if (w(this, F, !0, "f"), !T(this, q, "f").hasCachedHelpMessage()) {
				if (!this.parsed) {
					let e = this[Mt](T(this, H, "f"), void 0, void 0, 0, !0);
					if (_(e)) return e.then(() => T(this, q, "f").help());
				}
				let e = T(this, E, "f").runDefaultBuilderOn(this);
				if (_(e)) return e.then(() => T(this, q, "f").help());
			}
			return Promise.resolve(T(this, q, "f").help());
		}
		getOptions() {
			return T(this, R, "f");
		}
		getStrict() {
			return T(this, W, "f");
		}
		getStrictCommands() {
			return T(this, G, "f");
		}
		getStrictOptions() {
			return T(this, K, "f");
		}
		global(e, t) {
			return y("<string|array> [boolean]", [e, t], arguments.length), e = [].concat(e), t === !1 ? e.forEach((e) => {
				T(this, R, "f").local.includes(e) || T(this, R, "f").local.push(e);
			}) : T(this, R, "f").local = T(this, R, "f").local.filter((t) => e.indexOf(t) === -1), this;
		}
		group(e, t) {
			y("<string|array> <string>", [e, t], arguments.length);
			let n = T(this, V, "f")[t] || T(this, P, "f")[t];
			T(this, V, "f")[t] && delete T(this, V, "f")[t];
			let r = {};
			return T(this, P, "f")[t] = (n || []).concat(e).filter((e) => r[e] ? !1 : r[e] = !0), this;
		}
		hide(e) {
			return y("<string>", [e], arguments.length), T(this, R, "f").hiddenOptions.push(e), this;
		}
		implies(e, t) {
			return y("<string|object> [number|string|array]", [e, t], arguments.length), T(this, Y, "f").implies(e, t), this;
		}
		locale(e) {
			return y("[string]", [e], arguments.length), e === void 0 ? (this[ut](), T(this, U, "f").y18n.getLocale()) : (w(this, j, !1, "f"), T(this, U, "f").y18n.setLocale(e), this);
		}
		middleware(e, t, n) {
			return T(this, N, "f").addMiddleware(e, !!t, n);
		}
		nargs(e, t) {
			return y("<string|object|array> [number]", [e, t], arguments.length), this[mt](this.nargs.bind(this), "narg", e, t), this;
		}
		normalize(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("normalize", e), this;
		}
		number(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("number", e), this[$](e), this;
		}
		option(e, t) {
			if (y("<string|object> [object]", [e, t], arguments.length), typeof e == "object") Object.keys(e).forEach((t) => {
				this.options(t, e[t]);
			});
			else {
				typeof t != "object" && (t = {}), this[$](e), T(this, J, "f") && (e === "version" || t?.alias === "version") && this[ot]([
					"\"version\" is a reserved word.",
					"Please do one of the following:",
					"- Disable version with `yargs.version(false)` if using \"version\" as an option",
					"- Use the built-in `yargs.version` method instead (if applicable)",
					"- Use a different option key",
					"https://yargs.js.org/docs/#api-reference-version"
				].join("\n"), void 0, "versionWarning"), T(this, R, "f").key[e] = !0, t.alias && this.alias(e, t.alias);
				let n = t.deprecate || t.deprecated;
				n && this.deprecateOption(e, n);
				let r = t.demand || t.required || t.require;
				r && this.demand(e, r), t.demandOption && this.demandOption(e, typeof t.demandOption == "string" ? t.demandOption : void 0), t.conflicts && this.conflicts(e, t.conflicts), "default" in t && this.default(e, t.default), t.implies !== void 0 && this.implies(e, t.implies), t.nargs !== void 0 && this.nargs(e, t.nargs), t.config && this.config(e, t.configParser), t.normalize && this.normalize(e), t.choices && this.choices(e, t.choices), t.coerce && this.coerce(e, t.coerce), t.group && this.group(e, t.group), (t.boolean || t.type === "boolean") && (this.boolean(e), t.alias && this.boolean(t.alias)), (t.array || t.type === "array") && (this.array(e), t.alias && this.array(t.alias)), (t.number || t.type === "number") && (this.number(e), t.alias && this.number(t.alias)), (t.string || t.type === "string") && (this.string(e), t.alias && this.string(t.alias)), (t.count || t.type === "count") && this.count(e), typeof t.global == "boolean" && this.global(e, t.global), t.defaultDescription && (T(this, R, "f").defaultDescription[e] = t.defaultDescription), t.skipValidation && this.skipValidation(e);
				let i = t.describe || t.description || t.desc, a = T(this, q, "f").getDescriptions();
				(!Object.prototype.hasOwnProperty.call(a, e) || typeof i == "string") && this.describe(e, i), t.hidden && this.hide(e), t.requiresArg && this.requiresArg(e);
			}
			return this;
		}
		options(e, t) {
			return this.option(e, t);
		}
		parse(e, t, n) {
			y("[string|array] [function|boolean|object] [function]", [
				e,
				t,
				n
			], arguments.length), this[st](), e === void 0 && (e = T(this, H, "f")), typeof t == "object" && (w(this, B, t, "f"), t = n), typeof t == "function" && (w(this, z, t, "f"), t = !1), t || w(this, H, e, "f"), T(this, z, "f") && w(this, M, !1, "f");
			let r = this[Mt](e, !!t), i = this.parsed;
			return T(this, O, "f").setParsed(this.parsed), _(r) ? r.then((e) => (T(this, z, "f") && T(this, z, "f").call(this, T(this, A, "f"), e, T(this, L, "f")), e)).catch((e) => {
				throw T(this, z, "f") && T(this, z, "f")(e, this.parsed.argv, T(this, L, "f")), e;
			}).finally(() => {
				this[yt](), this.parsed = i;
			}) : (T(this, z, "f") && T(this, z, "f").call(this, T(this, A, "f"), r, T(this, L, "f")), this[yt](), this.parsed = i, r);
		}
		parseAsync(e, t, n) {
			let r = this.parse(e, t, n);
			return _(r) ? r : Promise.resolve(r);
		}
		parseSync(e, t, n) {
			let r = this.parse(e, t, n);
			if (_(r)) throw new i(".parseSync() must not be used with asynchronous builders, handlers, or middleware");
			return r;
		}
		parserConfiguration(e) {
			return y("<object>", [e], arguments.length), w(this, $e, e, "f"), this;
		}
		pkgConf(e, t) {
			y("<string> [string]", [e, t], arguments.length);
			let n = null, r = this[pt](t || T(this, D, "f"));
			return r[e] && typeof r[e] == "object" && (n = o(r[e], t || T(this, D, "f"), this[X]()["deep-merge-config"] || !1, T(this, U, "f")), T(this, R, "f").configObjects = (T(this, R, "f").configObjects || []).concat(n)), this;
		}
		positional(e, t) {
			y("<string> <object>", [e, t], arguments.length);
			let n = [
				"default",
				"defaultDescription",
				"implies",
				"normalize",
				"choices",
				"conflicts",
				"coerce",
				"type",
				"describe",
				"desc",
				"description",
				"alias"
			];
			t = be(t, (e, t) => e === "type" && ![
				"string",
				"number",
				"boolean"
			].includes(t) ? !1 : n.includes(e));
			let r = T(this, Ke, "f").fullCommands[T(this, Ke, "f").fullCommands.length - 1], i = r ? T(this, E, "f").cmdToParseOptions(r) : {
				array: [],
				alias: {},
				default: {},
				demand: {}
			};
			return h(i).forEach((n) => {
				let r = i[n];
				Array.isArray(r) ? r.indexOf(e) !== -1 && (t[n] = !0) : r[e] && !(n in t) && (t[n] = r[e]);
			}), this.group(e, T(this, q, "f").getPositionalGroupName()), this.option(e, t);
		}
		recommendCommands(e = !0) {
			return y("[boolean]", [e], arguments.length), w(this, tt, e, "f"), this;
		}
		required(e, t, n) {
			return this.demand(e, t, n);
		}
		require(e, t, n) {
			return this.demand(e, t, n);
		}
		requiresArg(e) {
			return y("<array|string|object> [number]", [e], arguments.length), typeof e == "string" && T(this, R, "f").narg[e] || this[mt](this.requiresArg.bind(this), "narg", e, NaN), this;
		}
		showCompletionScript(e, t) {
			return y("[string] [string]", [e, t], arguments.length), e ||= this.$0, T(this, Ze, "f").log(T(this, O, "f").generateCompletionScript(e, t || T(this, k, "f") || "completion")), this;
		}
		showHelp(e) {
			if (y("[string|function]", [e], arguments.length), w(this, F, !0, "f"), !T(this, q, "f").hasCachedHelpMessage()) {
				if (!this.parsed) {
					let t = this[Mt](T(this, H, "f"), void 0, void 0, 0, !0);
					if (_(t)) return t.then(() => {
						T(this, q, "f").showHelp(e);
					}), this;
				}
				let t = T(this, E, "f").runDefaultBuilderOn(this);
				if (_(t)) return t.then(() => {
					T(this, q, "f").showHelp(e);
				}), this;
			}
			return T(this, q, "f").showHelp(e), this;
		}
		scriptName(e) {
			return this.customScriptName = !0, this.$0 = e, this;
		}
		showHelpOnFail(e, t) {
			return y("[boolean|string] [string]", [e, t], arguments.length), T(this, q, "f").showHelpOnFail(e, t), this;
		}
		showVersion(e) {
			return y("[string|function]", [e], arguments.length), T(this, q, "f").showVersion(e), this;
		}
		skipValidation(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("skipValidation", e), this;
		}
		strict(e) {
			return y("[boolean]", [e], arguments.length), w(this, W, e !== !1, "f"), this;
		}
		strictCommands(e) {
			return y("[boolean]", [e], arguments.length), w(this, G, e !== !1, "f"), this;
		}
		strictOptions(e) {
			return y("[boolean]", [e], arguments.length), w(this, K, e !== !1, "f"), this;
		}
		string(e) {
			return y("<array|string>", [e], arguments.length), this[Z]("string", e), this[$](e), this;
		}
		terminalWidth() {
			return y([], 0), T(this, U, "f").process.stdColumns;
		}
		updateLocale(e) {
			return this.updateStrings(e);
		}
		updateStrings(e) {
			return y("<object>", [e], arguments.length), w(this, j, !1, "f"), T(this, U, "f").y18n.updateLocale(e), this;
		}
		usage(e, t, n, r) {
			if (y("<string|null|undefined> [string|boolean] [function|object] [function]", [
				e,
				t,
				n,
				r
			], arguments.length), t !== void 0) {
				if (p(e, null, T(this, U, "f")), (e || "").match(/^\$0( |$)/)) return this.command(e, t, n, r);
				throw new i(".usage() description must start with $0 if being used as alias for .command()");
			} else return T(this, q, "f").usage(e), this;
		}
		usageConfiguration(e) {
			return y("<object>", [e], arguments.length), w(this, nt, e, "f"), this;
		}
		version(e, t, n) {
			let r = "version";
			if (y("[boolean|string] [string] [string]", [
				e,
				t,
				n
			], arguments.length), T(this, J, "f") && (this[at](T(this, J, "f")), T(this, q, "f").version(void 0), w(this, J, null, "f")), arguments.length === 0) n = this[dt](), e = r;
			else if (arguments.length === 1) {
				if (e === !1) return this;
				n = e, e = r;
			} else arguments.length === 2 && (n = t, t = void 0);
			return w(this, J, typeof e == "string" ? e : r, "f"), t ||= T(this, q, "f").deferY18nLookup("Show version number"), T(this, q, "f").version(n || void 0), this.boolean(T(this, J, "f")), this.describe(T(this, J, "f"), t), this;
		}
		wrap(e) {
			return y("<number|null|undefined>", [e], arguments.length), T(this, q, "f").wrap(e), this;
		}
		[(E = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakMap(), k = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakMap(), A = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), Je = /* @__PURE__ */ new WeakMap(), M = /* @__PURE__ */ new WeakMap(), Ye = /* @__PURE__ */ new WeakMap(), N = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), I = /* @__PURE__ */ new WeakMap(), Xe = /* @__PURE__ */ new WeakMap(), Ze = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakMap(), Qe = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), et = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), q = /* @__PURE__ */ new WeakMap(), nt = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), Y = /* @__PURE__ */ new WeakMap(), rt)](e) {
			if (!e._ || !e["--"]) return e;
			e._.push.apply(e._, e["--"]);
			try {
				delete e["--"];
			} catch {}
			return e;
		}
		[it]() {
			return {
				log: (...e) => {
					this[Ot]() || console.log(...e), w(this, F, !0, "f"), T(this, L, "f").length && w(this, L, T(this, L, "f") + "\n", "f"), w(this, L, T(this, L, "f") + e.join(" "), "f");
				},
				error: (...e) => {
					this[Ot]() || console.error(...e), w(this, F, !0, "f"), T(this, L, "f").length && w(this, L, T(this, L, "f") + "\n", "f"), w(this, L, T(this, L, "f") + e.join(" "), "f");
				}
			};
		}
		[at](e) {
			h(T(this, R, "f")).forEach((t) => {
				if (((e) => e === "configObjects")(t)) return;
				let n = T(this, R, "f")[t];
				Array.isArray(n) ? n.includes(e) && n.splice(n.indexOf(e), 1) : typeof n == "object" && delete n[e];
			}), delete T(this, q, "f").getDescriptions()[e];
		}
		[ot](e, t, n) {
			T(this, Je, "f")[n] || (T(this, U, "f").process.emitWarning(e, t), T(this, Je, "f")[n] = !0);
		}
		[st]() {
			T(this, Ye, "f").push({
				options: T(this, R, "f"),
				configObjects: T(this, R, "f").configObjects.slice(0),
				exitProcess: T(this, M, "f"),
				groups: T(this, P, "f"),
				strict: T(this, W, "f"),
				strictCommands: T(this, G, "f"),
				strictOptions: T(this, K, "f"),
				completionCommand: T(this, k, "f"),
				output: T(this, L, "f"),
				exitError: T(this, A, "f"),
				hasOutput: T(this, F, "f"),
				parsed: this.parsed,
				parseFn: T(this, z, "f"),
				parseContext: T(this, B, "f")
			}), T(this, q, "f").freeze(), T(this, Y, "f").freeze(), T(this, E, "f").freeze(), T(this, N, "f").freeze();
		}
		[ct]() {
			let e = "", t;
			return t = /\b(node|iojs|electron)(\.exe)?$/.test(T(this, U, "f").process.argv()[0]) ? T(this, U, "f").process.argv().slice(1, 2) : T(this, U, "f").process.argv().slice(0, 1), e = t.map((e) => {
				let t = this[At](T(this, D, "f"), e);
				return e.match(/^(\/|([a-zA-Z]:)?\\)/) && t.length < e.length ? t : e;
			}).join(" ").trim(), T(this, U, "f").getEnv("_") && T(this, U, "f").getProcessArgvBin() === T(this, U, "f").getEnv("_") && (e = T(this, U, "f").getEnv("_").replace(`${T(this, U, "f").path.dirname(T(this, U, "f").process.execPath())}/`, "")), e;
		}
		[X]() {
			return T(this, $e, "f");
		}
		[lt]() {
			return T(this, nt, "f");
		}
		[ut]() {
			if (!T(this, j, "f")) return;
			let e = T(this, U, "f").getEnv("LC_ALL") || T(this, U, "f").getEnv("LC_MESSAGES") || T(this, U, "f").getEnv("LANG") || T(this, U, "f").getEnv("LANGUAGE") || "en_US";
			this.locale(e.replace(/[.:].*/, ""));
		}
		[dt]() {
			return this[pt]().version || "unknown";
		}
		[ft](e) {
			let t = e["--"] ? e["--"] : e._;
			for (let e = 0, n; (n = t[e]) !== void 0; e++) T(this, U, "f").Parser.looksLikeNumber(n) && Number.isSafeInteger(Math.floor(parseFloat(`${n}`))) && (t[e] = Number(n));
			return e;
		}
		[pt](e) {
			let t = e || "*";
			if (T(this, et, "f")[t]) return T(this, et, "f")[t];
			let n = {};
			try {
				let t = e || T(this, U, "f").mainFilename;
				!e && T(this, U, "f").path.extname(t) && (t = T(this, U, "f").path.dirname(t));
				let r = T(this, U, "f").findUp(t, (e, t) => {
					if (t.includes("package.json")) return "package.json";
				});
				p(r, void 0, T(this, U, "f")), n = JSON.parse(T(this, U, "f").readFileSync(r, "utf8"));
			} catch {}
			return T(this, et, "f")[t] = n || {}, T(this, et, "f")[t];
		}
		[Z](e, t) {
			t = [].concat(t), t.forEach((t) => {
				t = this[_t](t), T(this, R, "f")[e].push(t);
			});
		}
		[mt](e, t, n, r) {
			this[gt](e, t, n, r, (e, t, n) => {
				T(this, R, "f")[e][t] = n;
			});
		}
		[ht](e, t, n, r) {
			this[gt](e, t, n, r, (e, t, n) => {
				T(this, R, "f")[e][t] = (T(this, R, "f")[e][t] || []).concat(n);
			});
		}
		[gt](e, t, n, r, i) {
			if (Array.isArray(n)) n.forEach((t) => {
				e(t, r);
			});
			else if (((e) => typeof e == "object")(n)) for (let t of h(n)) e(t, n[t]);
			else i(t, this[_t](n), r);
		}
		[_t](e) {
			return e === "__proto__" ? "___proto___" : e;
		}
		[vt](e, t) {
			return this[mt](this[vt].bind(this), "key", e, t), this;
		}
		[yt]() {
			var e, t, n, r, i, a, o, s, c, l, u, d;
			let f = T(this, Ye, "f").pop();
			p(f, void 0, T(this, U, "f"));
			let m;
			e = this, t = this, n = this, r = this, i = this, a = this, o = this, s = this, c = this, l = this, u = this, d = this, {options: { set value(t) {
				w(e, R, t, "f");
			} }.value, configObjects: m, exitProcess: { set value(e) {
				w(t, M, e, "f");
			} }.value, groups: { set value(e) {
				w(n, P, e, "f");
			} }.value, output: { set value(e) {
				w(r, L, e, "f");
			} }.value, exitError: { set value(e) {
				w(i, A, e, "f");
			} }.value, hasOutput: { set value(e) {
				w(a, F, e, "f");
			} }.value, parsed: this.parsed, strict: { set value(e) {
				w(o, W, e, "f");
			} }.value, strictCommands: { set value(e) {
				w(s, G, e, "f");
			} }.value, strictOptions: { set value(e) {
				w(c, K, e, "f");
			} }.value, completionCommand: { set value(e) {
				w(l, k, e, "f");
			} }.value, parseFn: { set value(e) {
				w(u, z, e, "f");
			} }.value, parseContext: { set value(e) {
				w(d, B, e, "f");
			} }.value} = f, T(this, R, "f").configObjects = m, T(this, q, "f").unfreeze(), T(this, Y, "f").unfreeze(), T(this, E, "f").unfreeze(), T(this, N, "f").unfreeze();
		}
		[bt](e, t) {
			return se(t, (t) => (e(t), t));
		}
		getInternalMethods() {
			return {
				getCommandInstance: this[xt].bind(this),
				getContext: this[St].bind(this),
				getHasOutput: this[Ct].bind(this),
				getLoggerInstance: this[wt].bind(this),
				getParseContext: this[Tt].bind(this),
				getParserConfiguration: this[X].bind(this),
				getUsageConfiguration: this[lt].bind(this),
				getUsageInstance: this[Et].bind(this),
				getValidationInstance: this[Dt].bind(this),
				hasParseCallback: this[Ot].bind(this),
				isGlobalContext: this[kt].bind(this),
				postProcess: this[Q].bind(this),
				reset: this[jt].bind(this),
				runValidation: this[Nt].bind(this),
				runYargsParserAndExecuteCommands: this[Mt].bind(this),
				setHasOutput: this[Pt].bind(this)
			};
		}
		[xt]() {
			return T(this, E, "f");
		}
		[St]() {
			return T(this, Ke, "f");
		}
		[Ct]() {
			return T(this, F, "f");
		}
		[wt]() {
			return T(this, Ze, "f");
		}
		[Tt]() {
			return T(this, B, "f") || {};
		}
		[Et]() {
			return T(this, q, "f");
		}
		[Dt]() {
			return T(this, Y, "f");
		}
		[Ot]() {
			return !!T(this, z, "f");
		}
		[kt]() {
			return T(this, Xe, "f");
		}
		[Q](e, t, n, r) {
			return n || _(e) ? e : (t || (e = this[rt](e)), (this[X]()["parse-positional-numbers"] || this[X]()["parse-positional-numbers"] === void 0) && (e = this[ft](e)), r && (e = x(e, this, T(this, N, "f").getMiddleware(), !1)), e);
		}
		[jt](e = {}) {
			w(this, R, T(this, R, "f") || {}, "f");
			let t = {};
			t.local = T(this, R, "f").local || [], t.configObjects = T(this, R, "f").configObjects || [];
			let n = {};
			return t.local.forEach((t) => {
				n[t] = !0, (e[t] || []).forEach((e) => {
					n[e] = !0;
				});
			}), Object.assign(T(this, V, "f"), Object.keys(T(this, P, "f")).reduce((e, t) => {
				let r = T(this, P, "f")[t].filter((e) => !(e in n));
				return r.length > 0 && (e[t] = r), e;
			}, {})), w(this, P, {}, "f"), [
				"array",
				"boolean",
				"string",
				"skipValidation",
				"count",
				"normalize",
				"number",
				"hiddenOptions"
			].forEach((e) => {
				t[e] = (T(this, R, "f")[e] || []).filter((e) => !n[e]);
			}), [
				"narg",
				"key",
				"alias",
				"default",
				"defaultDescription",
				"config",
				"choices",
				"demandedOptions",
				"demandedCommands",
				"deprecatedOptions"
			].forEach((e) => {
				t[e] = be(T(this, R, "f")[e], (e) => !n[e]);
			}), t.envPrefix = T(this, R, "f").envPrefix, w(this, R, t, "f"), w(this, q, T(this, q, "f") ? T(this, q, "f").reset(n) : Te(this, T(this, U, "f")), "f"), w(this, Y, T(this, Y, "f") ? T(this, Y, "f").reset(n) : Ve(this, T(this, q, "f"), T(this, U, "f")), "f"), w(this, E, T(this, E, "f") ? T(this, E, "f").reset() : fe(T(this, q, "f"), T(this, Y, "f"), T(this, N, "f"), T(this, U, "f")), "f"), T(this, O, "f") || w(this, O, Pe(this, T(this, q, "f"), T(this, E, "f"), T(this, U, "f")), "f"), T(this, N, "f").reset(), w(this, k, null, "f"), w(this, L, "", "f"), w(this, A, null, "f"), w(this, F, !1, "f"), this.parsed = !1, this;
		}
		[At](e, t) {
			return T(this, U, "f").path.relative(e, t);
		}
		[Mt](e, t, n, r = 0, a = !1) {
			let o = !!n || a;
			e ||= T(this, H, "f"), T(this, R, "f").__ = T(this, U, "f").y18n.__, T(this, R, "f").configuration = this[X]();
			let s = !!T(this, R, "f").configuration["populate--"], c = Object.assign({}, T(this, R, "f").configuration, { "populate--": !0 }), l = T(this, U, "f").Parser.detailed(e, Object.assign({}, T(this, R, "f"), { configuration: {
				"parse-positional-numbers": !1,
				...c
			} })), u = Object.assign(l.argv, T(this, B, "f")), d, f = l.aliases, p = !1, m = !1;
			Object.keys(u).forEach((e) => {
				e === T(this, I, "f") && u[e] ? p = !0 : e === T(this, J, "f") && u[e] && (m = !0);
			}), u.$0 = this.$0, this.parsed = l, r === 0 && T(this, q, "f").clearCachedHelpMessage();
			try {
				if (this[ut](), t) return this[Q](u, s, !!n, !1);
				T(this, I, "f") && [T(this, I, "f")].concat(f[T(this, I, "f")] || []).filter((e) => e.length > 1).includes("" + u._[u._.length - 1]) && (u._.pop(), p = !0), w(this, Xe, !1, "f");
				let c = T(this, E, "f").getCommands(), h = T(this, O, "f").completionKey in u, g = p || h || a;
				if (u._.length) {
					if (c.length) {
						let e;
						for (let t = r || 0, i; u._[t] !== void 0; t++) if (i = String(u._[t]), c.includes(i) && i !== T(this, k, "f")) {
							let e = T(this, E, "f").runCommand(i, this, l, t + 1, a, p || m || a);
							return this[Q](e, s, !!n, !1);
						} else if (!e && i !== T(this, k, "f")) {
							e = i;
							break;
						}
						!T(this, E, "f").hasDefaultCommand() && T(this, tt, "f") && e && !g && T(this, Y, "f").recommendCommands(e, c);
					}
					T(this, k, "f") && u._.includes(T(this, k, "f")) && !h && (T(this, M, "f") && Se(!0), this.showCompletionScript(), this.exit(0));
				}
				if (T(this, E, "f").hasDefaultCommand() && !g) {
					let e = T(this, E, "f").runCommand(null, this, l, 0, a, p || m || a);
					return this[Q](e, s, !!n, !1);
				}
				if (h) {
					T(this, M, "f") && Se(!0), e = [].concat(e);
					let t = e.slice(e.indexOf(`--${T(this, O, "f").completionKey}`) + 1);
					return T(this, O, "f").getCompletion(t, (e, t) => {
						if (e) throw new i(e.message);
						(t || []).forEach((e) => {
							T(this, Ze, "f").log(e);
						}), this.exit(0);
					}), this[Q](u, !s, !!n, !1);
				}
				if (T(this, F, "f") || (p ? (T(this, M, "f") && Se(!0), o = !0, this.showHelp("log"), this.exit(0)) : m && (T(this, M, "f") && Se(!0), o = !0, T(this, q, "f").showVersion("log"), this.exit(0))), !o && T(this, R, "f").skipValidation.length > 0 && (o = Object.keys(u).some((e) => T(this, R, "f").skipValidation.indexOf(e) >= 0 && u[e] === !0)), !o) {
					if (l.error) throw new i(l.error.message);
					if (!h) {
						let e = this[Nt](f, {}, l.error);
						n || (d = x(u, this, T(this, N, "f").getMiddleware(), !0)), d = this[bt](e, d ?? u), _(d) && !n && (d = d.then(() => x(u, this, T(this, N, "f").getMiddleware(), !1)));
					}
				}
			} catch (e) {
				if (e instanceof i) T(this, q, "f").fail(e.message, e);
				else throw e;
			}
			return this[Q](d ?? u, s, !!n, !0);
		}
		[Nt](e, t, n, r) {
			let a = { ...this.getDemandedOptions() };
			return (o) => {
				if (n) throw new i(n.message);
				T(this, Y, "f").nonOptionCount(o), T(this, Y, "f").requiredArguments(o, a);
				let s = !1;
				T(this, G, "f") && (s = T(this, Y, "f").unknownCommands(o)), T(this, W, "f") && !s ? T(this, Y, "f").unknownArguments(o, e, t, !!r) : T(this, K, "f") && T(this, Y, "f").unknownArguments(o, e, {}, !1, !1), T(this, Y, "f").limitedChoices(o), T(this, Y, "f").implications(o), T(this, Y, "f").conflicting(o);
			};
		}
		[Pt]() {
			w(this, F, !0, "f");
		}
		[$](e) {
			if (typeof e == "string") T(this, R, "f").key[e] = !0;
			else for (let t of e) T(this, R, "f").key[t] = !0;
		}
	};
})), Lt;
//#endregion
t((() => {
	r(), It(), Lt = We(a);
}))();
export { Lt as default };
