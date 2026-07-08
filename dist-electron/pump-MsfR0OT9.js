import { i as e, t } from "./rolldown-runtime-C6GIJ8is.js";
//#region node_modules/wrappy/wrappy.js
var n = /* @__PURE__ */ t(((e, t) => {
	t.exports = n;
	function n(e, t) {
		if (e && t) return n(e)(t);
		if (typeof e != "function") throw TypeError("need wrapper function");
		return Object.keys(e).forEach(function(t) {
			r[t] = e[t];
		}), r;
		function r() {
			for (var t = Array(arguments.length), n = 0; n < t.length; n++) t[n] = arguments[n];
			var r = e.apply(this, t), i = t[t.length - 1];
			return typeof r == "function" && r !== i && Object.keys(i).forEach(function(e) {
				r[e] = i[e];
			}), r;
		}
	}
})), r = /* @__PURE__ */ t(((e, t) => {
	var r = n();
	t.exports = r(i), t.exports.strict = r(a), i.proto = i(function() {
		Object.defineProperty(Function.prototype, "once", {
			value: function() {
				return i(this);
			},
			configurable: !0
		}), Object.defineProperty(Function.prototype, "onceStrict", {
			value: function() {
				return a(this);
			},
			configurable: !0
		});
	});
	function i(e) {
		var t = function() {
			return t.called ? t.value : (t.called = !0, t.value = e.apply(this, arguments));
		};
		return t.called = !1, t;
	}
	function a(e) {
		var t = function() {
			if (t.called) throw Error(t.onceError);
			return t.called = !0, t.value = e.apply(this, arguments);
		};
		return t.onceError = (e.name || "Function wrapped with `once`") + " shouldn't be called more than once", t.called = !1, t;
	}
})), i = /* @__PURE__ */ t(((e, t) => {
	var n = r(), i = function() {}, a = global.Bare ? queueMicrotask : process.nextTick.bind(process), o = function(e) {
		return e.setHeader && typeof e.abort == "function";
	}, s = function(e) {
		return e.stdio && Array.isArray(e.stdio) && e.stdio.length === 3;
	}, c = function(e, t, r) {
		if (typeof t == "function") return c(e, null, t);
		t ||= {}, r = n(r || i);
		var l = e._writableState, u = e._readableState, d = t.readable || t.readable !== !1 && e.readable, f = t.writable || t.writable !== !1 && e.writable, p = !1, m = function() {
			e.writable || h();
		}, h = function() {
			f = !1, d || r.call(e);
		}, g = function() {
			d = !1, f || r.call(e);
		}, _ = function(t) {
			r.call(e, t ? /* @__PURE__ */ Error("exited with error code: " + t) : null);
		}, v = function(t) {
			r.call(e, t);
		}, y = function() {
			a(b);
		}, b = function() {
			if (!p && (d && !(u && u.ended && !u.destroyed) || f && !(l && l.ended && !l.destroyed))) return r.call(e, /* @__PURE__ */ Error("premature close"));
		}, x = function() {
			e.req.on("finish", h);
		};
		return o(e) ? (e.on("complete", h), e.on("abort", y), e.req ? x() : e.on("request", x)) : f && !l && (e.on("end", m), e.on("close", m)), s(e) && e.on("exit", _), e.on("end", g), e.on("finish", h), t.error !== !1 && e.on("error", v), e.on("close", y), function() {
			p = !0, e.removeListener("complete", h), e.removeListener("abort", y), e.removeListener("request", x), e.req && e.req.removeListener("finish", h), e.removeListener("end", m), e.removeListener("close", m), e.removeListener("finish", h), e.removeListener("exit", _), e.removeListener("end", g), e.removeListener("error", v), e.removeListener("close", y);
		};
	};
	t.exports = c;
})), a = /* @__PURE__ */ t(((t, n) => {
	var a = r(), o = i(), s;
	try {
		s = e("fs");
	} catch {}
	var c = function() {}, l = typeof process > "u" ? !1 : /^v?\.0/.test(process.version), u = function(e) {
		return typeof e == "function";
	}, d = function(e) {
		return !l || !s ? !1 : (e instanceof (s.ReadStream || c) || e instanceof (s.WriteStream || c)) && u(e.close);
	}, f = function(e) {
		return e.setHeader && u(e.abort);
	}, p = function(e, t, n, r) {
		r = a(r);
		var i = !1;
		e.on("close", function() {
			i = !0;
		}), o(e, {
			readable: t,
			writable: n
		}, function(e) {
			if (e) return r(e);
			i = !0, r();
		});
		var s = !1;
		return function(t) {
			if (!i && !s) {
				if (s = !0, d(e)) return e.close(c);
				if (f(e)) return e.abort();
				if (u(e.destroy)) return e.destroy();
				r(t || /* @__PURE__ */ Error("stream was destroyed"));
			}
		};
	}, m = function(e) {
		e();
	}, h = function(e, t) {
		return e.pipe(t);
	};
	n.exports = function() {
		var e = Array.prototype.slice.call(arguments), t = u(e[e.length - 1] || c) && e.pop() || c;
		if (Array.isArray(e[0]) && (e = e[0]), e.length < 2) throw Error("pump requires two streams per minimum");
		var n, r = e.map(function(i, a) {
			var o = a < e.length - 1;
			return p(i, o, a > 0, function(e) {
				n ||= e, e && r.forEach(m), !o && (r.forEach(m), t(n));
			});
		});
		return e.reduce(h);
	};
}));
//#endregion
export { a as t };
