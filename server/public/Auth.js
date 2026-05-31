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

// ===== 主题色（accent）=====
// 9 部电影的色卡（草鱼设计志），每部 5 个颜色；外加一个 OneDay 原生粉
const THEME_PRESETS = [
	{ id: "oneday",      title: "OneDay 原色",  image: null,             colors: ["#ff7f9d","#ffb3c5","#ffe5ec","#ff5f87","#ff7f9d"] },
	{ id: "pride",       title: "《傲慢与偏见》", image: "/public/themes/pride.jpg",       colors: ["#192426","#243C46","#5B7E8A","#929797","#BB9B90"] },
	{ id: "tiger",       title: "《卧虎藏龙》",   image: "/public/themes/tiger.jpg",       colors: ["#082D0B","#01544B","#207030","#D3E0E1","#0B4724"] },
	{ id: "fall",        title: "《坠入》",       image: "/public/themes/fall.jpg",        colors: ["#132C48","#587884","#264565","#9A9B99","#757358"] },
	{ id: "oppenheimer", title: "《奥本海默》",   image: "/public/themes/oppenheimer.jpg", colors: ["#122019","#2B4828","#BAAA93","#7D8987","#342F26"] },
	{ id: "joker",       title: "《小丑》",       image: "/public/themes/joker.jpg",       colors: ["#05201F","#63272F","#AC7414","#593E11","#044342"] },
	{ id: "paddington",  title: "《帕丁顿熊》",   image: "/public/themes/paddington.jpg",  colors: ["#65553B","#B6AEA4","#790E25","#295257","#1F2926"] },
	{ id: "truman",      title: "《楚门的世界》", image: "/public/themes/truman.jpg",      colors: ["#2E292F","#49546E","#7084B1","#D8DEFB","#4B5265"] },
	{ id: "lalaland",    title: "《爱乐之城》",   image: "/public/themes/lalaland.jpg",    colors: ["#8B6377","#AB97AA","#CBBCB8","#68517B","#312D49"] },
	{ id: "forrest",     title: "《阿甘正传》",   image: "/public/themes/forrest.jpg",     colors: ["#4F4B29","#222014","#BE927E","#E8D5C7","#303A49"] },
];
const ACCENT_STORAGE = "oneday_accent";
const DEFAULT_ACCENT = "#ff7f9d";

function hexToRgb(hex) {
	const m = String(hex).trim().replace(/^#/, "");
	const h = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
	const n = parseInt(h, 16);
	return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
function applyAccent(hex) {
	const safe = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : DEFAULT_ACCENT;
	document.documentElement.style.setProperty("--accent", safe);
	document.documentElement.style.setProperty("--accent-rgb", hexToRgb(safe));
}
// 启动时尽早恢复主题色，避免页面闪一下原色
(() => {
	try {
		const saved = localStorage.getItem(ACCENT_STORAGE);
		applyAccent(saved || DEFAULT_ACCENT);
	} catch { applyAccent(DEFAULT_ACCENT); }
})();

