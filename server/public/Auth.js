// Auth.js —— 登录态全局 store + AES 加密 + 带 token 的 fetch 包装
// 依赖：Pinia、CryptoJS 已经在 index.html 里加载

// 与后端 / student-servertest-main 完全一致的密钥（token 跨项目互通的前提）
const AUTH_KEY = "1234567890123456";
const AUTH_IV  = "1234567890123456";
const AUTH_STORAGE = "oneday_auth";

// AES-CBC + ZeroPadding，前端加密密码后传给后端
function aesEncrypt(plain) {
	const enc = CryptoJS.AES.encrypt(
		CryptoJS.enc.Utf8.parse(plain),
		CryptoJS.enc.Utf8.parse(AUTH_KEY),
		{
			iv: CryptoJS.enc.Utf8.parse(AUTH_IV),
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.ZeroPadding,
		},
	);
	return enc.toString();
}

// 解析 JWT payload（不验签，只为读出 student 信息显示用）
function jwtDecodePayload(token) {
	try {
		const seg = token.split(".")[1];
		let str = seg.replace(/-/g, "+").replace(/_/g, "/");
		while (str.length % 4) str += "=";
		return JSON.parse(decodeURIComponent(escape(atob(str))));
	} catch {
		return null;
	}
}

// ===== Pinia store =====
const useAuthStore = Pinia.defineStore("auth", {
	state: () => ({
		token: null,
		user:  null,   // {student_id, student_number, name, isadmin, avatar, ...}
		expiresAt: 0,
	}),
	getters: {
		isLoggedIn(state) {
			return !!state.token && state.expiresAt > Date.now();
		},
		displayName(state) {
			return state.user?.name || state.user?.student_number || "未登录";
		},
		avatarUrl(state) {
			return state.user?.avatar || "";
		},
	},
	actions: {
		hydrate() {
			try {
				const raw = localStorage.getItem(AUTH_STORAGE);
				if (!raw) return;
				const saved = JSON.parse(raw);
				if (saved.expiresAt && saved.expiresAt > Date.now()) {
					this.token = saved.token;
					this.user  = saved.user;
					this.expiresAt = saved.expiresAt;
				} else {
					localStorage.removeItem(AUTH_STORAGE);
				}
			} catch { /* ignore */ }
		},
		setAuth(token, expiresInSec, user) {
			this.token = token;
			this.user  = user;
			this.expiresAt = Date.now() + (expiresInSec * 1000);
			localStorage.setItem(AUTH_STORAGE, JSON.stringify({
				token: this.token,
				user:  this.user,
				expiresAt: this.expiresAt,
			}));
		},
		patchUser(partial) {
			this.user = { ...(this.user || {}), ...partial };
			if (this.token) {
				localStorage.setItem(AUTH_STORAGE, JSON.stringify({
					token: this.token, user: this.user, expiresAt: this.expiresAt,
				}));
			}
		},
		logout() {
			this.token = null;
			this.user  = null;
			this.expiresAt = 0;
			localStorage.removeItem(AUTH_STORAGE);
		},
	},
});

// ===== 带 token 的 fetch 包装 =====
// 用法：authFetch("/api/items?...") 或 authFetch("/api/items", {method:"POST", json:{...}})
async function authFetch(url, opts = {}) {
	const store = useAuthStore();
	const headers = new Headers(opts.headers || {});
	if (store.token) headers.set("Authorization", "Bearer " + store.token);

	let body = opts.body;
	// 便捷：json:{} 自动序列化 + Content-Type
	if (opts.json !== undefined) {
		body = JSON.stringify(opts.json);
		if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
	}

	const resp = await fetch(url, { ...opts, headers, body });

	if (resp.status === 401) {
		store.logout();
		// 用 hash 跳转，避开 Vue Router 在没有 router 上下文时的限制
		if (location.hash !== "#/login") location.hash = "#/login";
		throw new Error("登录已过期，请重新登录");
	}
	return resp;
}

// 便捷：直接返回 JSON
async function authFetchJSON(url, opts) {
	const r = await authFetch(url, opts);
	return await r.json();
}
