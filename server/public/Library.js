// Library.js —— 心愿库（只展示 is_wish=true 的物品：想买但还没买的东西）
//   列表来自 GET /api/items?kind=wish
//   每件可「移入资产」(POST /api/items/:id/acquire) 或删除

const Library = {
	template: `
		<div>
			<v-app-bar color="transparent" flat>
				<v-app-bar-title>心愿库</v-app-bar-title>
				<template v-slot:append>
					<v-btn icon="mdi-plus" @click="goAddWish"></v-btn>
				</template>
			</v-app-bar>

			<v-container>
				<!-- 加载中 -->
				<div v-if="loading" class="text-center py-12">
					<v-progress-circular indeterminate color="pink-lighten-1"></v-progress-circular>
				</div>

				<!-- 空状态 -->
				<v-card v-else-if="!items.length" class="pa-8 text-center rounded-xl" variant="tonal">
					<v-icon icon="mdi-heart-outline" size="48" color="pink-lighten-2"></v-icon>
					<div class="text-h6 mt-2">心愿库还是空的</div>
					<div class="text-body-2 text-grey mb-4">把想买的东西先记下来吧</div>
					<v-btn color="pink-lighten-1" rounded="pill" prepend-icon="mdi-plus" @click="goAddWish">添加心愿</v-btn>
				</v-card>

				<!-- 列表 -->
				<div v-else>
					<div class="text-caption text-grey-darken-1 mb-2">
						共 {{ items.length }} 件心愿 · 合计 ¥{{ totalWish.toFixed(2) }}
					</div>
					<v-card v-for="it in items" :key="it.id" class="mb-3 rounded-xl" elevation="0" border>
						<div class="d-flex align-center pa-3">
							<!-- 图标 -->
							<div style="width:56px;height:56px;flex:none;cursor:pointer;" @click="goEdit(it.id)">
								<div v-if="it.icon_kind==='emoji'" style="font-size:34px;line-height:56px;text-align:center;">{{ it.icon_value }}</div>
								<v-img v-else-if="iconUrl(it)" :src="iconUrl(it)" aspect-ratio="1" cover class="rounded-lg"></v-img>
								<div v-else class="d-flex align-center justify-center rounded-lg" style="height:56px;background:#fbeef2;">
									<v-icon icon="mdi-heart-outline" color="pink-lighten-2"></v-icon>
								</div>
							</div>
							<!-- 名称 + 想买价格 -->
							<div class="flex-grow-1 mx-3" style="cursor:pointer;" @click="goEdit(it.id)">
								<div class="font-weight-bold">{{ it.name }}</div>
								<div class="text-pink font-weight-bold">¥{{ Number(it.purchase_price).toFixed(2) }}</div>
								<div class="text-caption text-grey">想买日期 {{ fmt(it.acquisition_date) }}</div>
							</div>
							<!-- 操作 -->
							<div class="d-flex flex-column" style="gap:6px;">
								<v-btn size="small" color="pink-lighten-1" rounded="pill" :loading="busyId===it.id" @click="acquire(it)">移入资产</v-btn>
								<v-btn size="small" variant="text" color="grey" @click="remove(it)">删除</v-btn>
							</div>
						</div>
					</v-card>
				</div>
			</v-container>

			<v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2000">{{ snackbar.msg }}</v-snackbar>
		</div>
	`,
	setup() {
		const router  = VueRouter.useRouter();
		const items   = ref([]);
		const loading = ref(false);
		const busyId  = ref(0);
		const snackbar = reactive({ show: false, msg: "", color: "success" });
		function tip(msg, color = "success") { snackbar.msg = msg; snackbar.color = color; snackbar.show = true; }

		const totalWish = computed(() =>
			items.value.reduce((s, it) => s + (Number(it.purchase_price) || 0), 0)
		);
		function iconUrl(it) {
			if (it.icon_kind === "3d" || it.icon_kind === "image") return it.icon_value;
			return it.cover_url || "";
		}
		function fmt(s) { return s ? String(s).slice(0, 10) : ""; }

		async function load() {
			loading.value = true;
			try {
				const r = await authFetch("/api/items?kind=wish&size=100");
				const j = await r.json();
				if (j.code === 200) items.value = j.data.rows;
			} catch (e) { console.error(e); }
			finally { loading.value = false; }
		}

		function goAddWish() { router.push({ name: "item-add", query: { wish: "1" } }); }
		function goEdit(id)  { router.push({ name: "item-edit", params: { id: String(id) } }); }

		async function acquire(it) {
			busyId.value = it.id;
			try {
				const r = await authFetch("/api/items/" + it.id + "/acquire", { method: "POST", json: {} });
				const j = await r.json();
				if (j.code === 200) { tip("已移入资产"); await load(); }
				else tip(j.message || "操作失败", "error");
			} catch (e) { tip("操作失败", "error"); }
			finally { busyId.value = 0; }
		}
		async function remove(it) {
			if (!confirm("从心愿库删除「" + it.name + "」？")) return;
			const r = await authFetch("/api/items/" + it.id, { method: "DELETE" });
			const j = await r.json();
			if (j.code === 200) { tip("已删除"); await load(); }
			else tip(j.message || "删除失败", "error");
		}

		onMounted(load);

		return { items, loading, busyId, snackbar, totalWish, iconUrl, fmt, goAddWish, goEdit, acquire, remove };
	},
};
