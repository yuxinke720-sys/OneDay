// ItemDetail.js —— 物品详情 + 时间轴 + 添加事件

const ItemDetail = {
	template: `
		<div v-if="item">
			<!-- Hero 大图 -->
			<div style="position: relative; aspect-ratio: 4 / 3; background: #ececf0;">
				<v-img
					v-if="cover"
					:src="cover"
					aspect-ratio="4/3"
					cover
				></v-img>
				<div v-else class="d-flex align-center justify-center" style="height: 100%;">
					<v-icon icon="mdi-image-outline" size="48" color="grey"></v-icon>
				</div>
				<div style="position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between;">
					<v-btn icon="mdi-arrow-left" size="small" color="white" @click="$router.back()"></v-btn>
					<v-btn icon="mdi-pencil-outline" size="small" color="white" @click="onEditItem"></v-btn>
				</div>
				<v-chip
					:color="statusColor"
					size="small"
					style="position: absolute; bottom: 12px; left: 16px;"
				>{{ statusLabel }}</v-chip>
			</div>

			<v-container>
				<!-- 名字 + 分类 -->
				<h2 class="text-h5 font-weight-black">{{ item.name }}</h2>
				<div class="mt-2 d-flex flex-wrap" style="gap: 6px;">
					<v-chip v-if="item.category" size="x-small" color="pink-lighten-3">{{ item.category }}</v-chip>
					<v-chip size="x-small" color="grey-lighten-2">{{ formatDate(item.acquisition_date) }} 入手</v-chip>
				</div>
				<p v-if="item.notes" class="text-body-2 text-grey-darken-1 mt-3">{{ item.notes }}</p>

				<!-- 统计卡片 -->
				<v-card v-if="stats" class="pa-4 mt-4 rounded-xl" elevation="2">
					<div class="d-flex">
						<div class="flex-grow-1">
							<div class="text-caption text-grey">日均成本</div>
							<div class="text-h5 cost-accent">
								¥{{ Number(stats.daily_cost).toFixed(2) }}<span class="text-caption text-grey ml-1">/天</span>
							</div>
							<div class="text-caption text-grey mt-1">已拥有 {{ stats.days_owned }} 天</div>
						</div>
						<v-divider vertical class="mx-3"></v-divider>
						<div class="flex-grow-1">
							<div class="text-caption text-grey">单次成本</div>
							<div class="text-h5 cost-accent">
								<span v-if="stats.cost_per_use === null">—</span>
								<span v-else>¥{{ Number(stats.cost_per_use).toFixed(2) }}<span class="text-caption text-grey ml-1">/次</span></span>
							</div>
							<div class="text-caption text-grey mt-1">使用 {{ stats.use_count }} 次</div>
						</div>
					</div>
				</v-card>

				<!-- 今天用了 一键按钮 -->
				<v-btn
					v-if="item.status === 'using'"
					block
					size="large"
					color="primary"
					class="mt-4"
					rounded="pill"
					:loading="quickUsing"
					@click="quickUse"
				>
					<v-icon icon="mdi-check-circle-outline" class="mr-2"></v-icon>
					今天用了
				</v-btn>

				<!-- 时间轴 -->
				<div class="d-flex align-center justify-space-between mt-6 mb-2">
					<div class="text-subtitle-1 font-weight-bold">时间轴</div>
					<v-btn
						size="small"
						color="black"
						rounded="pill"
						@click="eventModalOpen = true"
					>
						<v-icon icon="mdi-plus" size="14"></v-icon>
						添加
					</v-btn>
				</div>

				<v-timeline side="end" align="start" density="compact" truncate-line="both">
					<v-timeline-item
						v-for="ev in events"
						:key="ev.id"
						:dot-color="eventMeta(ev.type).color"
						size="small"
					>
						<template v-slot:icon>
							<v-icon :icon="eventMeta(ev.type).icon" color="white" size="14"></v-icon>
						</template>
						<div class="d-flex align-center justify-space-between">
							<div>
								<div class="text-caption font-weight-bold">{{ eventMeta(ev.type).label }}</div>
								<div class="text-caption text-grey">{{ formatDate(ev.occurred_at) }}</div>
							</div>
							<v-btn icon="mdi-close" size="x-small" variant="text" @click="onDeleteEvent(ev.id)"></v-btn>
						</div>
						<div class="text-body-2 mt-1">
							<span v-if="ev.amount > 0" class="font-weight-bold">¥{{ Number(ev.amount).toLocaleString('zh-CN') }}</span>
							<span v-if="ev.quantity > 1" class="text-grey ml-2">×{{ ev.quantity }}</span>
							<span v-if="ev.description" class="text-grey ml-2">{{ ev.description }}</span>
						</div>
					</v-timeline-item>
				</v-timeline>
			</v-container>

			<!-- 添加事件弹窗 -->
			<v-bottom-sheet v-model="eventModalOpen" inset>
				<v-card class="pa-4">
					<v-card-title>添加事件</v-card-title>
					<v-row no-gutters class="mb-3">
						<v-col v-for="t in addableTypes" :key="t" cols="2" class="pa-1">
							<v-btn
								block
								size="small"
								:color="newEvent.type === t ? eventMeta(t).color : ''"
								:variant="newEvent.type === t ? 'flat' : 'outlined'"
								@click="newEvent.type = t"
								class="d-flex flex-column"
								style="height: 60px;"
							>
								<v-icon :icon="eventMeta(t).icon" size="18"></v-icon>
								<span class="text-caption" style="margin-top: 2px;">{{ eventMeta(t).label }}</span>
							</v-btn>
						</v-col>
					</v-row>
					<v-text-field v-model="newEvent.amount"   label="金额" type="number" prefix="¥" variant="outlined" density="comfortable"></v-text-field>
					<v-text-field v-model="newEvent.quantity" label="数量" type="number"               variant="outlined" density="comfortable"></v-text-field>
					<v-textarea     v-model="newEvent.description" label="描述" rows="2" auto-grow variant="outlined" density="comfortable"></v-textarea>
					<v-btn block color="primary" rounded="pill" size="large" :loading="adding" @click="submitEvent">添加</v-btn>
				</v-card>
			</v-bottom-sheet>

			<v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2000">
				{{ snackbar.msg }}
			</v-snackbar>
		</div>
		<div v-else class="d-flex justify-center align-center" style="height: 60vh;">
			<v-progress-circular indeterminate color="primary"></v-progress-circular>
		</div>
	`,
	setup() {
		const route  = VueRouter.useRoute();
		const router = VueRouter.useRouter();
		const itemId = computed(() => Number(route.params.id));

		const item   = ref(null);
		const events = ref([]);
		const stats  = ref(null);

		const cover = computed(() => {
			if (!item.value) return "";
			return item.value.cover_url || item.value.images?.[0]?.url || "";
		});

		const statusColor = computed(() => {
			const s = item.value?.status;
			return s === "using" ? "green-lighten-1"
				: s === "retired" ? "amber-darken-2"
				: "grey";
		});
		const statusLabel = computed(() => {
			return ({ using: "服役中", retired: "已退役", sold: "已卖出" })[item.value?.status] || "";
		});

		// 事件类型元信息
		const EVENT_META = {
			purchase:    { label: "购入", icon: "mdi-cart-outline",     color: "#7b8cde" },
			usage:       { label: "使用", icon: "mdi-check-circle",      color: "#5cd28a" },
			maintenance: { label: "保养", icon: "mdi-tools",              color: "#f0b860" },
			repair:      { label: "维修", icon: "mdi-alert-circle",       color: "#ed6f6f" },
			consumable:  { label: "消耗", icon: "mdi-gift-outline",       color: "#b07fd6" },
			sell:        { label: "出售", icon: "mdi-swap-horizontal",    color: "#b4b8c2" },
		};
		function eventMeta(t) { return EVENT_META[t] || EVENT_META.purchase; }

		function formatDate(s) {
			if (!s) return "";
			const d = new Date(s);
			return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
		}

		const snackbar = reactive({ show: false, msg: "", color: "success" });
		function showMsg(msg, color = "success") { snackbar.msg = msg; snackbar.color = color; snackbar.show = true; }

		async function loadAll() {
			const id = itemId.value;
			try {
				const [r1, r2, r3] = await Promise.all([
					authFetch("/api/items/" + id).then(r => r.json()),
					authFetch("/api/items/" + id + "/events").then(r => r.json()),
					authFetch("/api/items/" + id + "/stats").then(r => r.json()),
				]);
				if (r1.code === 200) item.value   = r1.data;
				if (r2.code === 200) events.value = r2.data;
				if (r3.code === 200) stats.value  = r3.data;
			} catch (e) { console.error(e); }
		}

		// 一键今天用了
		const quickUsing = ref(false);
		async function quickUse() {
			quickUsing.value = true;
			try {
				const r = await authFetch("/api/items/" + itemId.value + "/events", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ type: "usage", occurred_at: new Date().toISOString() }),
				});
				const j = await r.json();
				if (j.code === 200) {
					showMsg("已记录");
					await loadAll();
				}
			} finally { quickUsing.value = false; }
		}

		// 删事件
		async function onDeleteEvent(eid) {
			if (!confirm("删除这条事件？统计会随之更新")) return;
			const r = await authFetch("/api/events/" + eid, { method: "DELETE" });
			const j = await r.json();
			if (j.code === 200) await loadAll();
		}

		// 添加事件弹窗
		const eventModalOpen = ref(false);
		const adding = ref(false);
		const addableTypes = ["usage", "maintenance", "repair", "consumable", "sell"];
		const newEvent = reactive({ type: "maintenance", amount: "", quantity: "", description: "" });

		async function submitEvent() {
			adding.value = true;
			try {
				const r = await authFetch("/api/items/" + itemId.value + "/events", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: newEvent.type,
						amount:   Number(newEvent.amount)   || 0,
						quantity: Number(newEvent.quantity) || 1,
						description: newEvent.description.trim() || undefined,
					}),
				});
				const j = await r.json();
				if (j.code === 200) {
					eventModalOpen.value = false;
					Object.assign(newEvent, { type: "maintenance", amount: "", quantity: "", description: "" });
					await loadAll();
					showMsg("已添加");
				}
			} finally { adding.value = false; }
		}

		// 跳到编辑页（复用 ItemAdd 组件的编辑模式）
		function onEditItem() {
			router.push({ name: "item-edit", params: { id: String(itemId.value) } });
		}

		onMounted(loadAll);

		return {
			item, events, stats, cover, statusColor, statusLabel,
			eventMeta, formatDate, snackbar,
			quickUsing, quickUse, onDeleteEvent,
			eventModalOpen, adding, addableTypes, newEvent, submitEvent,
			onEditItem,
		};
	},
};
