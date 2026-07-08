import { i as __require, n as __esmMin } from "./rolldown-runtime-CE-6LUnI.js";
import { basename, dirname, extname, normalize, relative, resolve } from "path";
import { readFileSync, readdirSync, statSync, writeFile } from "fs";
import { notStrictEqual, strictEqual } from "assert";
import { format, inspect } from "util";
import { fileURLToPath } from "url";
//#region node_modules/yargs/build/lib/yerror.js
var YError;
var init_yerror = __esmMin((() => {
	YError = class YError extends Error {
		constructor(msg) {
			super(msg || "yargs error");
			this.name = "YError";
			if (Error.captureStackTrace) Error.captureStackTrace(this, YError);
		}
	};
}));
//#endregion
//#region node_modules/yargs/build/lib/utils/process-argv.js
function getProcessArgvBinIndex() {
	if (isBundledElectronApp()) return 0;
	return 1;
}
function isBundledElectronApp() {
	return isElectronApp() && !process.defaultApp;
}
function isElectronApp() {
	return !!process.versions.electron;
}
function hideBin(argv) {
	return argv.slice(getProcessArgvBinIndex() + 1);
}
function getProcessArgvBin() {
	return process.argv[getProcessArgvBinIndex()];
}
var init_process_argv = __esmMin((() => {}));
//#endregion
//#region node_modules/yargs-parser/build/lib/string-utils.js
/**
* @license
* Copyright (c) 2016, Contributors
* SPDX-License-Identifier: ISC
*/
function camelCase(str) {
	if (!(str !== str.toLowerCase() && str !== str.toUpperCase())) str = str.toLowerCase();
	if (str.indexOf("-") === -1 && str.indexOf("_") === -1) return str;
	else {
		let camelcase = "";
		let nextChrUpper = false;
		const leadingHyphens = str.match(/^-+/);
		for (let i = leadingHyphens ? leadingHyphens[0].length : 0; i < str.length; i++) {
			let chr = str.charAt(i);
			if (nextChrUpper) {
				nextChrUpper = false;
				chr = chr.toUpperCase();
			}
			if (i !== 0 && (chr === "-" || chr === "_")) nextChrUpper = true;
			else if (chr !== "-" && chr !== "_") camelcase += chr;
		}
		return camelcase;
	}
}
function decamelize(str, joinString) {
	const lowercase = str.toLowerCase();
	joinString = joinString || "-";
	let notCamelcase = "";
	for (let i = 0; i < str.length; i++) {
		const chrLower = lowercase.charAt(i);
		const chrString = str.charAt(i);
		if (chrLower !== chrString && i > 0) notCamelcase += `${joinString}${lowercase.charAt(i)}`;
		else notCamelcase += chrString;
	}
	return notCamelcase;
}
function looksLikeNumber(x) {
	if (x === null || x === void 0) return false;
	if (typeof x === "number") return true;
	if (/^0x[0-9a-f]+$/i.test(x)) return true;
	if (/^0[^.]/.test(x)) return false;
	return /^[-]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}
var init_string_utils$1 = __esmMin((() => {}));
//#endregion
//#region node_modules/yargs-parser/build/lib/tokenize-arg-string.js
/**
* @license
* Copyright (c) 2016, Contributors
* SPDX-License-Identifier: ISC
*/
function tokenizeArgString(argString) {
	if (Array.isArray(argString)) return argString.map((e) => typeof e !== "string" ? e + "" : e);
	argString = argString.trim();
	let i = 0;
	let prevC = null;
	let c = null;
	let opening = null;
	const args = [];
	for (let ii = 0; ii < argString.length; ii++) {
		prevC = c;
		c = argString.charAt(ii);
		if (c === " " && !opening) {
			if (!(prevC === " ")) i++;
			continue;
		}
		if (c === opening) opening = null;
		else if ((c === "'" || c === "\"") && !opening) opening = c;
		if (!args[i]) args[i] = "";
		args[i] += c;
	}
	return args;
}
var init_tokenize_arg_string = __esmMin((() => {}));
//#endregion
//#region node_modules/yargs-parser/build/lib/yargs-parser-types.js
var DefaultValuesForTypeKey;
var init_yargs_parser_types = __esmMin((() => {
	/**
	* @license
	* Copyright (c) 2016, Contributors
	* SPDX-License-Identifier: ISC
	*/
	(function(DefaultValuesForTypeKey) {
		DefaultValuesForTypeKey["BOOLEAN"] = "boolean";
		DefaultValuesForTypeKey["STRING"] = "string";
		DefaultValuesForTypeKey["NUMBER"] = "number";
		DefaultValuesForTypeKey["ARRAY"] = "array";
	})(DefaultValuesForTypeKey || (DefaultValuesForTypeKey = {}));
}));
//#endregion
//#region node_modules/yargs-parser/build/lib/yargs-parser.js
/**
* @license
* Copyright (c) 2016, Contributors
* SPDX-License-Identifier: ISC
*/
function combineAliases(aliases) {
	const aliasArrays = [];
	const combined = Object.create(null);
	let change = true;
	Object.keys(aliases).forEach(function(key) {
		aliasArrays.push([].concat(aliases[key], key));
	});
	while (change) {
		change = false;
		for (let i = 0; i < aliasArrays.length; i++) for (let ii = i + 1; ii < aliasArrays.length; ii++) if (aliasArrays[i].filter(function(v) {
			return aliasArrays[ii].indexOf(v) !== -1;
		}).length) {
			aliasArrays[i] = aliasArrays[i].concat(aliasArrays[ii]);
			aliasArrays.splice(ii, 1);
			change = true;
			break;
		}
	}
	aliasArrays.forEach(function(aliasArray) {
		aliasArray = aliasArray.filter(function(v, i, self) {
			return self.indexOf(v) === i;
		});
		const lastAlias = aliasArray.pop();
		if (lastAlias !== void 0 && typeof lastAlias === "string") combined[lastAlias] = aliasArray;
	});
	return combined;
}
function increment(orig) {
	return orig !== void 0 ? orig + 1 : 1;
}
function sanitizeKey(key) {
	if (key === "__proto__") return "___proto___";
	return key;
}
function stripQuotes(val) {
	return typeof val === "string" && (val[0] === "'" || val[0] === "\"") && val[val.length - 1] === val[0] ? val.substring(1, val.length - 1) : val;
}
var mixin$1, YargsParser;
var init_yargs_parser = __esmMin((() => {
	init_tokenize_arg_string();
	init_yargs_parser_types();
	init_string_utils$1();
	YargsParser = class {
		constructor(_mixin) {
			mixin$1 = _mixin;
		}
		parse(argsInput, options) {
			const opts = Object.assign({
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
			}, options);
			const args = tokenizeArgString(argsInput);
			const inputIsString = typeof argsInput === "string";
			const aliases = combineAliases(Object.assign(Object.create(null), opts.alias));
			const configuration = Object.assign({
				"boolean-negation": true,
				"camel-case-expansion": true,
				"combine-arrays": false,
				"dot-notation": true,
				"duplicate-arguments-array": true,
				"flatten-duplicate-arrays": true,
				"greedy-arrays": true,
				"halt-at-non-option": false,
				"nargs-eats-options": false,
				"negation-prefix": "no-",
				"parse-numbers": true,
				"parse-positional-numbers": true,
				"populate--": false,
				"set-placeholder-key": false,
				"short-option-groups": true,
				"strip-aliased": false,
				"strip-dashed": false,
				"unknown-options-as-args": false
			}, opts.configuration);
			const defaults = Object.assign(Object.create(null), opts.default);
			const configObjects = opts.configObjects || [];
			const envPrefix = opts.envPrefix;
			const notFlagsOption = configuration["populate--"];
			const notFlagsArgv = notFlagsOption ? "--" : "_";
			const newAliases = Object.create(null);
			const defaulted = Object.create(null);
			const __ = opts.__ || mixin$1.format;
			const flags = {
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
			};
			const negative = /^-([0-9]+(\.[0-9]+)?|\.[0-9]+)$/;
			const negatedBoolean = new RegExp("^--" + configuration["negation-prefix"] + "(.+)");
			[].concat(opts.array || []).filter(Boolean).forEach(function(opt) {
				const key = typeof opt === "object" ? opt.key : opt;
				const assignment = Object.keys(opt).map(function(key) {
					return {
						boolean: "bools",
						string: "strings",
						number: "numbers"
					}[key];
				}).filter(Boolean).pop();
				if (assignment) flags[assignment][key] = true;
				flags.arrays[key] = true;
				flags.keys.push(key);
			});
			[].concat(opts.boolean || []).filter(Boolean).forEach(function(key) {
				flags.bools[key] = true;
				flags.keys.push(key);
			});
			[].concat(opts.string || []).filter(Boolean).forEach(function(key) {
				flags.strings[key] = true;
				flags.keys.push(key);
			});
			[].concat(opts.number || []).filter(Boolean).forEach(function(key) {
				flags.numbers[key] = true;
				flags.keys.push(key);
			});
			[].concat(opts.count || []).filter(Boolean).forEach(function(key) {
				flags.counts[key] = true;
				flags.keys.push(key);
			});
			[].concat(opts.normalize || []).filter(Boolean).forEach(function(key) {
				flags.normalize[key] = true;
				flags.keys.push(key);
			});
			if (typeof opts.narg === "object") Object.entries(opts.narg).forEach(([key, value]) => {
				if (typeof value === "number") {
					flags.nargs[key] = value;
					flags.keys.push(key);
				}
			});
			if (typeof opts.coerce === "object") Object.entries(opts.coerce).forEach(([key, value]) => {
				if (typeof value === "function") {
					flags.coercions[key] = value;
					flags.keys.push(key);
				}
			});
			if (typeof opts.config !== "undefined") {
				if (Array.isArray(opts.config) || typeof opts.config === "string") [].concat(opts.config).filter(Boolean).forEach(function(key) {
					flags.configs[key] = true;
				});
				else if (typeof opts.config === "object") Object.entries(opts.config).forEach(([key, value]) => {
					if (typeof value === "boolean" || typeof value === "function") flags.configs[key] = value;
				});
			}
			extendAliases(opts.key, aliases, opts.default, flags.arrays);
			Object.keys(defaults).forEach(function(key) {
				(flags.aliases[key] || []).forEach(function(alias) {
					defaults[alias] = defaults[key];
				});
			});
			let error = null;
			checkConfiguration();
			let notFlags = [];
			const argv = Object.assign(Object.create(null), { _: [] });
			const argvReturn = {};
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				const truncatedArg = arg.replace(/^-{3,}/, "---");
				let broken;
				let key;
				let letters;
				let m;
				let next;
				let value;
				if (arg !== "--" && /^-/.test(arg) && isUnknownOptionAsArg(arg)) pushPositional(arg);
				else if (truncatedArg.match(/^---+(=|$)/)) {
					pushPositional(arg);
					continue;
				} else if (arg.match(/^--.+=/) || !configuration["short-option-groups"] && arg.match(/^-.+=/)) {
					m = arg.match(/^--?([^=]+)=([\s\S]*)$/);
					if (m !== null && Array.isArray(m) && m.length >= 3) if (checkAllAliases(m[1], flags.arrays)) i = eatArray(i, m[1], args, m[2]);
					else if (checkAllAliases(m[1], flags.nargs) !== false) i = eatNargs(i, m[1], args, m[2]);
					else setArg(m[1], m[2], true);
				} else if (arg.match(negatedBoolean) && configuration["boolean-negation"]) {
					m = arg.match(negatedBoolean);
					if (m !== null && Array.isArray(m) && m.length >= 2) {
						key = m[1];
						setArg(key, checkAllAliases(key, flags.arrays) ? [false] : false);
					}
				} else if (arg.match(/^--.+/) || !configuration["short-option-groups"] && arg.match(/^-[^-]+/)) {
					m = arg.match(/^--?(.+)/);
					if (m !== null && Array.isArray(m) && m.length >= 2) {
						key = m[1];
						if (checkAllAliases(key, flags.arrays)) i = eatArray(i, key, args);
						else if (checkAllAliases(key, flags.nargs) !== false) i = eatNargs(i, key, args);
						else {
							next = args[i + 1];
							if (next !== void 0 && (!next.match(/^-/) || next.match(negative)) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
								setArg(key, next);
								i++;
							} else if (/^(true|false)$/.test(next)) {
								setArg(key, next);
								i++;
							} else setArg(key, defaultValue(key));
						}
					}
				} else if (arg.match(/^-.\..+=/)) {
					m = arg.match(/^-([^=]+)=([\s\S]*)$/);
					if (m !== null && Array.isArray(m) && m.length >= 3) setArg(m[1], m[2]);
				} else if (arg.match(/^-.\..+/) && !arg.match(negative)) {
					next = args[i + 1];
					m = arg.match(/^-(.\..+)/);
					if (m !== null && Array.isArray(m) && m.length >= 2) {
						key = m[1];
						if (next !== void 0 && !next.match(/^-/) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
							setArg(key, next);
							i++;
						} else setArg(key, defaultValue(key));
					}
				} else if (arg.match(/^-[^-]+/) && !arg.match(negative)) {
					letters = arg.slice(1, -1).split("");
					broken = false;
					for (let j = 0; j < letters.length; j++) {
						next = arg.slice(j + 2);
						if (letters[j + 1] && letters[j + 1] === "=") {
							value = arg.slice(j + 3);
							key = letters[j];
							if (checkAllAliases(key, flags.arrays)) i = eatArray(i, key, args, value);
							else if (checkAllAliases(key, flags.nargs) !== false) i = eatNargs(i, key, args, value);
							else setArg(key, value);
							broken = true;
							break;
						}
						if (next === "-") {
							setArg(letters[j], next);
							continue;
						}
						if (/[A-Za-z]/.test(letters[j]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next) && checkAllAliases(next, flags.bools) === false) {
							setArg(letters[j], next);
							broken = true;
							break;
						}
						if (letters[j + 1] && letters[j + 1].match(/\W/)) {
							setArg(letters[j], next);
							broken = true;
							break;
						} else setArg(letters[j], defaultValue(letters[j]));
					}
					key = arg.slice(-1)[0];
					if (!broken && key !== "-") if (checkAllAliases(key, flags.arrays)) i = eatArray(i, key, args);
					else if (checkAllAliases(key, flags.nargs) !== false) i = eatNargs(i, key, args);
					else {
						next = args[i + 1];
						if (next !== void 0 && (!/^(-|--)[^-]/.test(next) || next.match(negative)) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
							setArg(key, next);
							i++;
						} else if (/^(true|false)$/.test(next)) {
							setArg(key, next);
							i++;
						} else setArg(key, defaultValue(key));
					}
				} else if (arg.match(/^-[0-9]$/) && arg.match(negative) && checkAllAliases(arg.slice(1), flags.bools)) {
					key = arg.slice(1);
					setArg(key, defaultValue(key));
				} else if (arg === "--") {
					notFlags = args.slice(i + 1);
					break;
				} else if (configuration["halt-at-non-option"]) {
					notFlags = args.slice(i);
					break;
				} else pushPositional(arg);
			}
			applyEnvVars(argv, true);
			applyEnvVars(argv, false);
			setConfig(argv);
			setConfigObjects();
			applyDefaultsAndAliases(argv, flags.aliases, defaults, true);
			applyCoercions(argv);
			if (configuration["set-placeholder-key"]) setPlaceholderKeys(argv);
			Object.keys(flags.counts).forEach(function(key) {
				if (!hasKey(argv, key.split("."))) setArg(key, 0);
			});
			if (notFlagsOption && notFlags.length) argv[notFlagsArgv] = [];
			notFlags.forEach(function(key) {
				argv[notFlagsArgv].push(key);
			});
			if (configuration["camel-case-expansion"] && configuration["strip-dashed"]) Object.keys(argv).filter((key) => key !== "--" && key.includes("-")).forEach((key) => {
				delete argv[key];
			});
			if (configuration["strip-aliased"]) [].concat(...Object.keys(aliases).map((k) => aliases[k])).forEach((alias) => {
				if (configuration["camel-case-expansion"] && alias.includes("-")) delete argv[alias.split(".").map((prop) => camelCase(prop)).join(".")];
				delete argv[alias];
			});
			function pushPositional(arg) {
				const maybeCoercedNumber = maybeCoerceNumber("_", arg);
				if (typeof maybeCoercedNumber === "string" || typeof maybeCoercedNumber === "number") argv._.push(maybeCoercedNumber);
			}
			function eatNargs(i, key, args, argAfterEqualSign) {
				let ii;
				let toEat = checkAllAliases(key, flags.nargs);
				toEat = typeof toEat !== "number" || isNaN(toEat) ? 1 : toEat;
				if (toEat === 0) {
					if (!isUndefined(argAfterEqualSign)) error = Error(__("Argument unexpected for: %s", key));
					setArg(key, defaultValue(key));
					return i;
				}
				let available = isUndefined(argAfterEqualSign) ? 0 : 1;
				if (configuration["nargs-eats-options"]) {
					if (args.length - (i + 1) + available < toEat) error = Error(__("Not enough arguments following: %s", key));
					available = toEat;
				} else {
					for (ii = i + 1; ii < args.length; ii++) if (!args[ii].match(/^-[^0-9]/) || args[ii].match(negative) || isUnknownOptionAsArg(args[ii])) available++;
					else break;
					if (available < toEat) error = Error(__("Not enough arguments following: %s", key));
				}
				let consumed = Math.min(available, toEat);
				if (!isUndefined(argAfterEqualSign) && consumed > 0) {
					setArg(key, argAfterEqualSign);
					consumed--;
				}
				for (ii = i + 1; ii < consumed + i + 1; ii++) setArg(key, args[ii]);
				return i + consumed;
			}
			function eatArray(i, key, args, argAfterEqualSign) {
				let argsToSet = [];
				let next = argAfterEqualSign || args[i + 1];
				const nargsCount = checkAllAliases(key, flags.nargs);
				if (checkAllAliases(key, flags.bools) && !/^(true|false)$/.test(next)) argsToSet.push(true);
				else if (isUndefined(next) || isUndefined(argAfterEqualSign) && /^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next)) {
					if (defaults[key] !== void 0) {
						const defVal = defaults[key];
						argsToSet = Array.isArray(defVal) ? defVal : [defVal];
					}
				} else {
					if (!isUndefined(argAfterEqualSign)) argsToSet.push(processValue(key, argAfterEqualSign, true));
					for (let ii = i + 1; ii < args.length; ii++) {
						if (!configuration["greedy-arrays"] && argsToSet.length > 0 || nargsCount && typeof nargsCount === "number" && argsToSet.length >= nargsCount) break;
						next = args[ii];
						if (/^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next)) break;
						i = ii;
						argsToSet.push(processValue(key, next, inputIsString));
					}
				}
				if (typeof nargsCount === "number" && (nargsCount && argsToSet.length < nargsCount || isNaN(nargsCount) && argsToSet.length === 0)) error = Error(__("Not enough arguments following: %s", key));
				setArg(key, argsToSet);
				return i;
			}
			function setArg(key, val, shouldStripQuotes = inputIsString) {
				if (/-/.test(key) && configuration["camel-case-expansion"]) addNewAlias(key, key.split(".").map(function(prop) {
					return camelCase(prop);
				}).join("."));
				const value = processValue(key, val, shouldStripQuotes);
				const splitKey = key.split(".");
				setKey(argv, splitKey, value);
				if (flags.aliases[key]) flags.aliases[key].forEach(function(x) {
					const keyProperties = x.split(".");
					setKey(argv, keyProperties, value);
				});
				if (splitKey.length > 1 && configuration["dot-notation"]) (flags.aliases[splitKey[0]] || []).forEach(function(x) {
					let keyProperties = x.split(".");
					const a = [].concat(splitKey);
					a.shift();
					keyProperties = keyProperties.concat(a);
					if (!(flags.aliases[key] || []).includes(keyProperties.join("."))) setKey(argv, keyProperties, value);
				});
				if (checkAllAliases(key, flags.normalize) && !checkAllAliases(key, flags.arrays)) [key].concat(flags.aliases[key] || []).forEach(function(key) {
					Object.defineProperty(argvReturn, key, {
						enumerable: true,
						get() {
							return val;
						},
						set(value) {
							val = typeof value === "string" ? mixin$1.normalize(value) : value;
						}
					});
				});
			}
			function addNewAlias(key, alias) {
				if (!(flags.aliases[key] && flags.aliases[key].length)) {
					flags.aliases[key] = [alias];
					newAliases[alias] = true;
				}
				if (!(flags.aliases[alias] && flags.aliases[alias].length)) addNewAlias(alias, key);
			}
			function processValue(key, val, shouldStripQuotes) {
				if (shouldStripQuotes) val = stripQuotes(val);
				if (checkAllAliases(key, flags.bools) || checkAllAliases(key, flags.counts)) {
					if (typeof val === "string") val = val === "true";
				}
				let value = Array.isArray(val) ? val.map(function(v) {
					return maybeCoerceNumber(key, v);
				}) : maybeCoerceNumber(key, val);
				if (checkAllAliases(key, flags.counts) && (isUndefined(value) || typeof value === "boolean")) value = increment();
				if (checkAllAliases(key, flags.normalize) && checkAllAliases(key, flags.arrays)) if (Array.isArray(val)) value = val.map((val) => {
					return mixin$1.normalize(val);
				});
				else value = mixin$1.normalize(val);
				return value;
			}
			function maybeCoerceNumber(key, value) {
				if (!configuration["parse-positional-numbers"] && key === "_") return value;
				if (!checkAllAliases(key, flags.strings) && !checkAllAliases(key, flags.bools) && !Array.isArray(value)) {
					if (looksLikeNumber(value) && configuration["parse-numbers"] && Number.isSafeInteger(Math.floor(parseFloat(`${value}`))) || !isUndefined(value) && checkAllAliases(key, flags.numbers)) value = Number(value);
				}
				return value;
			}
			function setConfig(argv) {
				const configLookup = Object.create(null);
				applyDefaultsAndAliases(configLookup, flags.aliases, defaults);
				Object.keys(flags.configs).forEach(function(configKey) {
					const configPath = argv[configKey] || configLookup[configKey];
					if (configPath) try {
						let config = null;
						const resolvedConfigPath = mixin$1.resolve(mixin$1.cwd(), configPath);
						const resolveConfig = flags.configs[configKey];
						if (typeof resolveConfig === "function") {
							try {
								config = resolveConfig(resolvedConfigPath);
							} catch (e) {
								config = e;
							}
							if (config instanceof Error) {
								error = config;
								return;
							}
						} else config = mixin$1.require(resolvedConfigPath);
						setConfigObject(config);
					} catch (ex) {
						if (ex.name === "PermissionDenied") error = ex;
						else if (argv[configKey]) error = Error(__("Invalid JSON config file: %s", configPath));
					}
				});
			}
			function setConfigObject(config, prev) {
				Object.keys(config).forEach(function(key) {
					const value = config[key];
					const fullKey = prev ? prev + "." + key : key;
					if (typeof value === "object" && value !== null && !Array.isArray(value) && configuration["dot-notation"]) setConfigObject(value, fullKey);
					else if (!hasKey(argv, fullKey.split(".")) || checkAllAliases(fullKey, flags.arrays) && configuration["combine-arrays"]) setArg(fullKey, value);
				});
			}
			function setConfigObjects() {
				if (typeof configObjects !== "undefined") configObjects.forEach(function(configObject) {
					setConfigObject(configObject);
				});
			}
			function applyEnvVars(argv, configOnly) {
				if (typeof envPrefix === "undefined") return;
				const prefix = typeof envPrefix === "string" ? envPrefix : "";
				const env = mixin$1.env();
				Object.keys(env).forEach(function(envVar) {
					if (prefix === "" || envVar.lastIndexOf(prefix, 0) === 0) {
						const keys = envVar.split("__").map(function(key, i) {
							if (i === 0) key = key.substring(prefix.length);
							return camelCase(key);
						});
						if ((configOnly && flags.configs[keys.join(".")] || !configOnly) && !hasKey(argv, keys)) setArg(keys.join("."), env[envVar]);
					}
				});
			}
			function applyCoercions(argv) {
				let coerce;
				const applied = /* @__PURE__ */ new Set();
				Object.keys(argv).forEach(function(key) {
					if (!applied.has(key)) {
						coerce = checkAllAliases(key, flags.coercions);
						if (typeof coerce === "function") try {
							const value = maybeCoerceNumber(key, coerce(argv[key]));
							[].concat(flags.aliases[key] || [], key).forEach((ali) => {
								applied.add(ali);
								argv[ali] = value;
							});
						} catch (err) {
							error = err;
						}
					}
				});
			}
			function setPlaceholderKeys(argv) {
				flags.keys.forEach((key) => {
					if (~key.indexOf(".")) return;
					if (typeof argv[key] === "undefined") argv[key] = void 0;
				});
				return argv;
			}
			function applyDefaultsAndAliases(obj, aliases, defaults, canLog = false) {
				Object.keys(defaults).forEach(function(key) {
					if (!hasKey(obj, key.split("."))) {
						setKey(obj, key.split("."), defaults[key]);
						if (canLog) defaulted[key] = true;
						(aliases[key] || []).forEach(function(x) {
							if (hasKey(obj, x.split("."))) return;
							setKey(obj, x.split("."), defaults[key]);
						});
					}
				});
			}
			function hasKey(obj, keys) {
				let o = obj;
				if (!configuration["dot-notation"]) keys = [keys.join(".")];
				keys.slice(0, -1).forEach(function(key) {
					o = o[key] || {};
				});
				const key = keys[keys.length - 1];
				if (typeof o !== "object") return false;
				else return key in o;
			}
			function setKey(obj, keys, value) {
				let o = obj;
				if (!configuration["dot-notation"]) keys = [keys.join(".")];
				keys.slice(0, -1).forEach(function(key) {
					key = sanitizeKey(key);
					if (typeof o === "object" && o[key] === void 0) o[key] = {};
					if (typeof o[key] !== "object" || Array.isArray(o[key])) {
						if (Array.isArray(o[key])) o[key].push({});
						else o[key] = [o[key], {}];
						o = o[key][o[key].length - 1];
					} else o = o[key];
				});
				const key = sanitizeKey(keys[keys.length - 1]);
				const isTypeArray = checkAllAliases(keys.join("."), flags.arrays);
				const isValueArray = Array.isArray(value);
				let duplicate = configuration["duplicate-arguments-array"];
				if (!duplicate && checkAllAliases(key, flags.nargs)) {
					duplicate = true;
					if (!isUndefined(o[key]) && flags.nargs[key] === 1 || Array.isArray(o[key]) && o[key].length === flags.nargs[key]) o[key] = void 0;
				}
				if (value === increment()) o[key] = increment(o[key]);
				else if (Array.isArray(o[key])) if (duplicate && isTypeArray && isValueArray) o[key] = configuration["flatten-duplicate-arrays"] ? o[key].concat(value) : (Array.isArray(o[key][0]) ? o[key] : [o[key]]).concat([value]);
				else if (!duplicate && Boolean(isTypeArray) === Boolean(isValueArray)) o[key] = value;
				else o[key] = o[key].concat([value]);
				else if (o[key] === void 0 && isTypeArray) o[key] = isValueArray ? value : [value];
				else if (duplicate && !(o[key] === void 0 || checkAllAliases(key, flags.counts) || checkAllAliases(key, flags.bools))) o[key] = [o[key], value];
				else o[key] = value;
			}
			function extendAliases(...args) {
				args.forEach(function(obj) {
					Object.keys(obj || {}).forEach(function(key) {
						if (flags.aliases[key]) return;
						flags.aliases[key] = [].concat(aliases[key] || []);
						flags.aliases[key].concat(key).forEach(function(x) {
							if (/-/.test(x) && configuration["camel-case-expansion"]) {
								const c = camelCase(x);
								if (c !== key && flags.aliases[key].indexOf(c) === -1) {
									flags.aliases[key].push(c);
									newAliases[c] = true;
								}
							}
						});
						flags.aliases[key].concat(key).forEach(function(x) {
							if (x.length > 1 && /[A-Z]/.test(x) && configuration["camel-case-expansion"]) {
								const c = decamelize(x, "-");
								if (c !== key && flags.aliases[key].indexOf(c) === -1) {
									flags.aliases[key].push(c);
									newAliases[c] = true;
								}
							}
						});
						flags.aliases[key].forEach(function(x) {
							flags.aliases[x] = [key].concat(flags.aliases[key].filter(function(y) {
								return x !== y;
							}));
						});
					});
				});
			}
			function checkAllAliases(key, flag) {
				const toCheck = [].concat(flags.aliases[key] || [], key);
				const keys = Object.keys(flag);
				const setAlias = toCheck.find((key) => keys.includes(key));
				return setAlias ? flag[setAlias] : false;
			}
			function hasAnyFlag(key) {
				const flagsKeys = Object.keys(flags);
				return [].concat(flagsKeys.map((k) => flags[k])).some(function(flag) {
					return Array.isArray(flag) ? flag.includes(key) : flag[key];
				});
			}
			function hasFlagsMatching(arg, ...patterns) {
				return [].concat(...patterns).some(function(pattern) {
					const match = arg.match(pattern);
					return match && hasAnyFlag(match[1]);
				});
			}
			function hasAllShortFlags(arg) {
				if (arg.match(negative) || !arg.match(/^-[^-]+/)) return false;
				let hasAllFlags = true;
				let next;
				const letters = arg.slice(1).split("");
				for (let j = 0; j < letters.length; j++) {
					next = arg.slice(j + 2);
					if (!hasAnyFlag(letters[j])) {
						hasAllFlags = false;
						break;
					}
					if (letters[j + 1] && letters[j + 1] === "=" || next === "-" || /[A-Za-z]/.test(letters[j]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next) || letters[j + 1] && letters[j + 1].match(/\W/)) break;
				}
				return hasAllFlags;
			}
			function isUnknownOptionAsArg(arg) {
				return configuration["unknown-options-as-args"] && isUnknownOption(arg);
			}
			function isUnknownOption(arg) {
				arg = arg.replace(/^-{3,}/, "--");
				if (arg.match(negative)) return false;
				if (hasAllShortFlags(arg)) return false;
				return !hasFlagsMatching(arg, /^-+([^=]+?)=[\s\S]*$/, negatedBoolean, /^-+([^=]+?)$/, /^-+([^=]+?)-$/, /^-+([^=]+?\d+)$/, /^-+([^=]+?)\W+.*$/);
			}
			function defaultValue(key) {
				if (!checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts) && `${key}` in defaults) return defaults[key];
				else return defaultForType(guessType(key));
			}
			function defaultForType(type) {
				return {
					[DefaultValuesForTypeKey.BOOLEAN]: true,
					[DefaultValuesForTypeKey.STRING]: "",
					[DefaultValuesForTypeKey.NUMBER]: void 0,
					[DefaultValuesForTypeKey.ARRAY]: []
				}[type];
			}
			function guessType(key) {
				let type = DefaultValuesForTypeKey.BOOLEAN;
				if (checkAllAliases(key, flags.strings)) type = DefaultValuesForTypeKey.STRING;
				else if (checkAllAliases(key, flags.numbers)) type = DefaultValuesForTypeKey.NUMBER;
				else if (checkAllAliases(key, flags.bools)) type = DefaultValuesForTypeKey.BOOLEAN;
				else if (checkAllAliases(key, flags.arrays)) type = DefaultValuesForTypeKey.ARRAY;
				return type;
			}
			function isUndefined(num) {
				return num === void 0;
			}
			function checkConfiguration() {
				Object.keys(flags.counts).find((key) => {
					if (checkAllAliases(key, flags.arrays)) {
						error = Error(__("Invalid configuration: %s, opts.count excludes opts.array.", key));
						return true;
					} else if (checkAllAliases(key, flags.nargs)) {
						error = Error(__("Invalid configuration: %s, opts.count excludes opts.narg.", key));
						return true;
					}
					return false;
				});
			}
			return {
				aliases: Object.assign({}, flags.aliases),
				argv: Object.assign(argvReturn, argv),
				configuration,
				defaulted: Object.assign({}, defaulted),
				error,
				newAliases: Object.assign({}, newAliases)
			};
		}
	};
}));
//#endregion
//#region node_modules/yargs-parser/build/lib/index.js
var _a, _b, _c, minNodeVersion, nodeVersion, env, parser, yargsParser;
var init_lib$2 = __esmMin((() => {
	init_string_utils$1();
	init_yargs_parser();
	minNodeVersion = process && process.env && process.env.YARGS_MIN_NODE_VERSION ? Number(process.env.YARGS_MIN_NODE_VERSION) : 12;
	nodeVersion = (_b = (_a = process === null || process === void 0 ? void 0 : process.versions) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : (_c = process === null || process === void 0 ? void 0 : process.version) === null || _c === void 0 ? void 0 : _c.slice(1);
	/**
	* @fileoverview Main entrypoint for libraries using yargs-parser in Node.js
	* CJS and ESM environments.
	*
	* @license
	* Copyright (c) 2016, Contributors
	* SPDX-License-Identifier: ISC
	*/
	if (nodeVersion) {
		if (Number(nodeVersion.match(/^([^.]+)/)[1]) < minNodeVersion) throw Error(`yargs parser supports a minimum Node.js version of ${minNodeVersion}. Read our version support policy: https://github.com/yargs/yargs-parser#supported-nodejs-versions`);
	}
	env = process ? process.env : {};
	parser = new YargsParser({
		cwd: process.cwd,
		env: () => {
			return env;
		},
		format,
		normalize,
		resolve,
		require: (path) => {
			if (typeof __require !== "undefined") return __require(path);
			else if (path.match(/\.json$/)) return JSON.parse(readFileSync(path, "utf8"));
			else throw Error("only .json config files are supported in ESM");
		}
	});
	yargsParser = function Parser(args, opts) {
		return parser.parse(args.slice(), opts).argv;
	};
	yargsParser.detailed = function(args, opts) {
		return parser.parse(args.slice(), opts);
	};
	yargsParser.camelCase = camelCase;
	yargsParser.decamelize = decamelize;
	yargsParser.looksLikeNumber = looksLikeNumber;
}));
//#endregion
//#region node_modules/cliui/build/lib/index.js
function addBorder(col, ts, style) {
	if (col.border) {
		if (/[.']-+[.']/.test(ts)) return "";
		if (ts.trim().length !== 0) return style;
		return "  ";
	}
	return "";
}
function _minWidth(col) {
	const padding = col.padding || [];
	const minWidth = 1 + (padding[left] || 0) + (padding[right] || 0);
	if (col.border) return minWidth + 4;
	return minWidth;
}
function getWindowWidth() {
	/* istanbul ignore next: depends on terminal */
	if (typeof process === "object" && process.stdout && process.stdout.columns) return process.stdout.columns;
	return 80;
}
function alignRight(str, width) {
	str = str.trim();
	const strWidth = mixin.stringWidth(str);
	if (strWidth < width) return " ".repeat(width - strWidth) + str;
	return str;
}
function alignCenter(str, width) {
	str = str.trim();
	const strWidth = mixin.stringWidth(str);
	/* istanbul ignore next */
	if (strWidth >= width) return str;
	return " ".repeat(width - strWidth >> 1) + str;
}
function cliui(opts, _mixin) {
	mixin = _mixin;
	return new UI({
		width: (opts === null || opts === void 0 ? void 0 : opts.width) || getWindowWidth(),
		wrap: opts === null || opts === void 0 ? void 0 : opts.wrap
	});
}
var align, top, right, bottom, left, UI, mixin;
var init_lib$1 = __esmMin((() => {
	align = {
		right: alignRight,
		center: alignCenter
	};
	top = 0;
	right = 1;
	bottom = 2;
	left = 3;
	UI = class {
		constructor(opts) {
			var _a;
			this.width = opts.width;
			this.wrap = (_a = opts.wrap) !== null && _a !== void 0 ? _a : true;
			this.rows = [];
		}
		span(...args) {
			const cols = this.div(...args);
			cols.span = true;
		}
		resetOutput() {
			this.rows = [];
		}
		div(...args) {
			if (args.length === 0) this.div("");
			if (this.wrap && this.shouldApplyLayoutDSL(...args) && typeof args[0] === "string") return this.applyLayoutDSL(args[0]);
			const cols = args.map((arg) => {
				if (typeof arg === "string") return this.colFromString(arg);
				return arg;
			});
			this.rows.push(cols);
			return cols;
		}
		shouldApplyLayoutDSL(...args) {
			return args.length === 1 && typeof args[0] === "string" && /[\t\n]/.test(args[0]);
		}
		applyLayoutDSL(str) {
			const rows = str.split("\n").map((row) => row.split("	"));
			let leftColumnWidth = 0;
			rows.forEach((columns) => {
				if (columns.length > 1 && mixin.stringWidth(columns[0]) > leftColumnWidth) leftColumnWidth = Math.min(Math.floor(this.width * .5), mixin.stringWidth(columns[0]));
			});
			rows.forEach((columns) => {
				this.div(...columns.map((r, i) => {
					return {
						text: r.trim(),
						padding: this.measurePadding(r),
						width: i === 0 && columns.length > 1 ? leftColumnWidth : void 0
					};
				}));
			});
			return this.rows[this.rows.length - 1];
		}
		colFromString(text) {
			return {
				text,
				padding: this.measurePadding(text)
			};
		}
		measurePadding(str) {
			const noAnsi = mixin.stripAnsi(str);
			return [
				0,
				noAnsi.match(/\s*$/)[0].length,
				0,
				noAnsi.match(/^\s*/)[0].length
			];
		}
		toString() {
			const lines = [];
			this.rows.forEach((row) => {
				this.rowToString(row, lines);
			});
			return lines.filter((line) => !line.hidden).map((line) => line.text).join("\n");
		}
		rowToString(row, lines) {
			this.rasterize(row).forEach((rrow, r) => {
				let str = "";
				rrow.forEach((col, c) => {
					const { width } = row[c];
					const wrapWidth = this.negatePadding(row[c]);
					let ts = col;
					if (wrapWidth > mixin.stringWidth(col)) ts += " ".repeat(wrapWidth - mixin.stringWidth(col));
					if (row[c].align && row[c].align !== "left" && this.wrap) {
						const fn = align[row[c].align];
						ts = fn(ts, wrapWidth);
						if (mixin.stringWidth(ts) < wrapWidth) ts += " ".repeat((width || 0) - mixin.stringWidth(ts) - 1);
					}
					const padding = row[c].padding || [
						0,
						0,
						0,
						0
					];
					if (padding[left]) str += " ".repeat(padding[left]);
					str += addBorder(row[c], ts, "| ");
					str += ts;
					str += addBorder(row[c], ts, " |");
					if (padding[right]) str += " ".repeat(padding[right]);
					if (r === 0 && lines.length > 0) str = this.renderInline(str, lines[lines.length - 1]);
				});
				lines.push({
					text: str.replace(/ +$/, ""),
					span: row.span
				});
			});
			return lines;
		}
		renderInline(source, previousLine) {
			const match = source.match(/^ */);
			const leadingWhitespace = match ? match[0].length : 0;
			const target = previousLine.text;
			const targetTextWidth = mixin.stringWidth(target.trimRight());
			if (!previousLine.span) return source;
			if (!this.wrap) {
				previousLine.hidden = true;
				return target + source;
			}
			if (leadingWhitespace < targetTextWidth) return source;
			previousLine.hidden = true;
			return target.trimRight() + " ".repeat(leadingWhitespace - targetTextWidth) + source.trimLeft();
		}
		rasterize(row) {
			const rrows = [];
			const widths = this.columnWidths(row);
			let wrapped;
			row.forEach((col, c) => {
				col.width = widths[c];
				if (this.wrap) wrapped = mixin.wrap(col.text, this.negatePadding(col), { hard: true }).split("\n");
				else wrapped = col.text.split("\n");
				if (col.border) {
					wrapped.unshift("." + "-".repeat(this.negatePadding(col) + 2) + ".");
					wrapped.push("'" + "-".repeat(this.negatePadding(col) + 2) + "'");
				}
				if (col.padding) {
					wrapped.unshift(...new Array(col.padding[top] || 0).fill(""));
					wrapped.push(...new Array(col.padding[bottom] || 0).fill(""));
				}
				wrapped.forEach((str, r) => {
					if (!rrows[r]) rrows.push([]);
					const rrow = rrows[r];
					for (let i = 0; i < c; i++) if (rrow[i] === void 0) rrow.push("");
					rrow.push(str);
				});
			});
			return rrows;
		}
		negatePadding(col) {
			let wrapWidth = col.width || 0;
			if (col.padding) wrapWidth -= (col.padding[left] || 0) + (col.padding[right] || 0);
			if (col.border) wrapWidth -= 4;
			return wrapWidth;
		}
		columnWidths(row) {
			if (!this.wrap) return row.map((col) => {
				return col.width || mixin.stringWidth(col.text);
			});
			let unset = row.length;
			let remainingWidth = this.width;
			const widths = row.map((col) => {
				if (col.width) {
					unset--;
					remainingWidth -= col.width;
					return col.width;
				}
			});
			const unsetWidth = unset ? Math.floor(remainingWidth / unset) : 0;
			return widths.map((w, i) => {
				if (w === void 0) return Math.max(unsetWidth, _minWidth(row[i]));
				return w;
			});
		}
	};
}));
//#endregion
//#region node_modules/cliui/build/lib/string-utils.js
function stripAnsi(str) {
	return str.replace(ansi, "");
}
function wrap(str, width) {
	const [start, end] = str.match(ansi) || ["", ""];
	str = stripAnsi(str);
	let wrapped = "";
	for (let i = 0; i < str.length; i++) {
		if (i !== 0 && i % width === 0) wrapped += "\n";
		wrapped += str.charAt(i);
	}
	if (start && end) wrapped = `${start}${wrapped}${end}`;
	return wrapped;
}
var ansi;
var init_string_utils = __esmMin((() => {
	ansi = /* @__PURE__ */ new RegExp("\x1B(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)", "g");
}));
//#endregion
//#region node_modules/cliui/index.mjs
function ui(opts) {
	return cliui(opts, {
		stringWidth: (str) => {
			return [...str].length;
		},
		stripAnsi,
		wrap
	});
}
var init_cliui = __esmMin((() => {
	init_lib$1();
	init_string_utils();
}));
//#endregion
//#region node_modules/escalade/sync/index.mjs
function sync_default(start, callback) {
	let dir = resolve(".", start);
	let tmp;
	if (!statSync(dir).isDirectory()) dir = dirname(dir);
	while (true) {
		tmp = callback(dir, readdirSync(dir));
		if (tmp) return resolve(dir, tmp);
		dir = dirname(tmp = dir);
		if (tmp === dir) break;
	}
}
var init_sync = __esmMin((() => {}));
//#endregion
//#region node_modules/y18n/build/lib/platform-shims/node.js
var node_default;
var init_node = __esmMin((() => {
	node_default = {
		fs: {
			readFileSync,
			writeFile
		},
		format,
		resolve,
		exists: (file) => {
			try {
				return statSync(file).isFile();
			} catch (err) {
				return false;
			}
		}
	};
}));
//#endregion
//#region node_modules/y18n/build/lib/index.js
function y18n$1(opts, _shim) {
	shim = _shim;
	const y18n = new Y18N(opts);
	return {
		__: y18n.__.bind(y18n),
		__n: y18n.__n.bind(y18n),
		setLocale: y18n.setLocale.bind(y18n),
		getLocale: y18n.getLocale.bind(y18n),
		updateLocale: y18n.updateLocale.bind(y18n),
		locale: y18n.locale
	};
}
var shim, Y18N;
var init_lib = __esmMin((() => {
	Y18N = class {
		constructor(opts) {
			opts = opts || {};
			this.directory = opts.directory || "./locales";
			this.updateFiles = typeof opts.updateFiles === "boolean" ? opts.updateFiles : true;
			this.locale = opts.locale || "en";
			this.fallbackToLanguage = typeof opts.fallbackToLanguage === "boolean" ? opts.fallbackToLanguage : true;
			this.cache = Object.create(null);
			this.writeQueue = [];
		}
		__(...args) {
			if (typeof arguments[0] !== "string") return this._taggedLiteral(arguments[0], ...arguments);
			const str = args.shift();
			let cb = function() {};
			if (typeof args[args.length - 1] === "function") cb = args.pop();
			cb = cb || function() {};
			if (!this.cache[this.locale]) this._readLocaleFile();
			if (!this.cache[this.locale][str] && this.updateFiles) {
				this.cache[this.locale][str] = str;
				this._enqueueWrite({
					directory: this.directory,
					locale: this.locale,
					cb
				});
			} else cb();
			return shim.format.apply(shim.format, [this.cache[this.locale][str] || str].concat(args));
		}
		__n() {
			const args = Array.prototype.slice.call(arguments);
			const singular = args.shift();
			const plural = args.shift();
			const quantity = args.shift();
			let cb = function() {};
			if (typeof args[args.length - 1] === "function") cb = args.pop();
			if (!this.cache[this.locale]) this._readLocaleFile();
			let str = quantity === 1 ? singular : plural;
			if (this.cache[this.locale][singular]) str = this.cache[this.locale][singular][quantity === 1 ? "one" : "other"];
			if (!this.cache[this.locale][singular] && this.updateFiles) {
				this.cache[this.locale][singular] = {
					one: singular,
					other: plural
				};
				this._enqueueWrite({
					directory: this.directory,
					locale: this.locale,
					cb
				});
			} else cb();
			const values = [str];
			if (~str.indexOf("%d")) values.push(quantity);
			return shim.format.apply(shim.format, values.concat(args));
		}
		setLocale(locale) {
			this.locale = locale;
		}
		getLocale() {
			return this.locale;
		}
		updateLocale(obj) {
			if (!this.cache[this.locale]) this._readLocaleFile();
			for (const key in obj) if (Object.prototype.hasOwnProperty.call(obj, key)) this.cache[this.locale][key] = obj[key];
		}
		_taggedLiteral(parts, ...args) {
			let str = "";
			parts.forEach(function(part, i) {
				const arg = args[i + 1];
				str += part;
				if (typeof arg !== "undefined") str += "%s";
			});
			return this.__.apply(this, [str].concat([].slice.call(args, 1)));
		}
		_enqueueWrite(work) {
			this.writeQueue.push(work);
			if (this.writeQueue.length === 1) this._processWriteQueue();
		}
		_processWriteQueue() {
			const _this = this;
			const work = this.writeQueue[0];
			const directory = work.directory;
			const locale = work.locale;
			const cb = work.cb;
			const languageFile = this._resolveLocaleFile(directory, locale);
			const serializedLocale = JSON.stringify(this.cache[locale], null, 2);
			shim.fs.writeFile(languageFile, serializedLocale, "utf-8", function(err) {
				_this.writeQueue.shift();
				if (_this.writeQueue.length > 0) _this._processWriteQueue();
				cb(err);
			});
		}
		_readLocaleFile() {
			let localeLookup = {};
			const languageFile = this._resolveLocaleFile(this.directory, this.locale);
			try {
				if (shim.fs.readFileSync) localeLookup = JSON.parse(shim.fs.readFileSync(languageFile, "utf-8"));
			} catch (err) {
				if (err instanceof SyntaxError) err.message = "syntax error in " + languageFile;
				if (err.code === "ENOENT") localeLookup = {};
				else throw err;
			}
			this.cache[this.locale] = localeLookup;
		}
		_resolveLocaleFile(directory, locale) {
			let file = shim.resolve(directory, "./", locale + ".json");
			if (this.fallbackToLanguage && !this._fileExistsSync(file) && ~locale.lastIndexOf("_")) {
				const languageFile = shim.resolve(directory, "./", locale.split("_")[0] + ".json");
				if (this._fileExistsSync(languageFile)) file = languageFile;
			}
			return file;
		}
		_fileExistsSync(file) {
			return shim.exists(file);
		}
	};
}));
//#endregion
//#region node_modules/y18n/index.mjs
var y18n;
var init_y18n = __esmMin((() => {
	init_node();
	init_lib();
	y18n = (opts) => {
		return y18n$1(opts, node_default);
	};
}));
//#endregion
//#region node_modules/yargs/lib/platform-shims/esm.mjs
var REQUIRE_ERROR, REQUIRE_DIRECTORY_ERROR, __dirname, mainFilename, esm_default;
var init_esm = __esmMin((() => {
	init_cliui();
	init_sync();
	init_lib$2();
	init_process_argv();
	init_yerror();
	init_y18n();
	REQUIRE_ERROR = "require is not supported by ESM";
	REQUIRE_DIRECTORY_ERROR = "loading a directory of commands is not supported yet for ESM";
	try {
		__dirname = fileURLToPath(import.meta.url);
	} catch (e) {
		__dirname = process.cwd();
	}
	mainFilename = __dirname.substring(0, __dirname.lastIndexOf("node_modules"));
	esm_default = {
		assert: {
			notStrictEqual,
			strictEqual
		},
		cliui: ui,
		findUp: sync_default,
		getEnv: (key) => {
			return process.env[key];
		},
		inspect,
		getCallerFile: () => {
			throw new YError(REQUIRE_DIRECTORY_ERROR);
		},
		getProcessArgvBin,
		mainFilename: mainFilename || process.cwd(),
		Parser: yargsParser,
		path: {
			basename,
			dirname,
			extname,
			relative,
			resolve
		},
		process: {
			argv: () => process.argv,
			cwd: process.cwd,
			emitWarning: (warning, type) => process.emitWarning(warning, type),
			execPath: () => process.execPath,
			exit: process.exit,
			nextTick: process.nextTick,
			stdColumns: typeof process.stdout.columns !== "undefined" ? process.stdout.columns : null
		},
		readFileSync,
		require: () => {
			throw new YError(REQUIRE_ERROR);
		},
		requireDirectory: () => {
			throw new YError(REQUIRE_DIRECTORY_ERROR);
		},
		stringWidth: (str) => {
			return [...str].length;
		},
		y18n: y18n({
			directory: resolve(__dirname, "../../../locales"),
			updateFiles: false
		})
	};
}));
//#endregion
export { hideBin as a, init_yerror as c, yargsParser as i, init_esm as n, init_process_argv as o, init_lib$2 as r, YError as s, esm_default as t };
