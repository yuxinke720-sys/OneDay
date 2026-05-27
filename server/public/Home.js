// Home.js —— 首页
// 5 层布局：粉色 Header / 数据大盘 / 品类筛选+排序 / 双列物品网格

const Home = {
	template: `
		<div>
			<!-- 层 1：粉色渐变 Header -->
			<div class="gradient-header pa-5 pb-16">
				<div class="d-flex align-center justify-space-between">
					<h1 class="text-h4 font-weight-black">OneDay</h1>
					<div>
						<v-btn :icon="searchVisible ? 'mdi-close' : 'mdi-magnify'" variant="text" @click="toggleSearch"></v-btn>
						<v-btn icon="mdi-diamond-outline" variant="text" color="amber-darken-2"></v-btn>
					</div>
				</div>
				<div class="text-caption text-grey-darken-1" v-if="!searchVisible">记录每一件物品的真实使用成本</div>
				<v-text-field
					v-if="searchVisible"
					v-model="searchKeyword"
					placeholder="搜索物品名"
					prepend-inner-icon="mdi-magnify"
					variant="solo-filled"
					density="compact"
					hide-details
					rounded
					autofocus
					class="mt-2"
				></v-text-field>
			</div>

			<!-- 层 2：数据大盘卡片（悬浮在渐变背景上）-->
			<v-card class="mx-4 mt-n12 pa-4 rounded-xl" elevation="3">
				<div class="d-flex align-center">
					<div class="flex-grow-1">
						<div class="text-caption text-grey">总资产</div>
						<div class="text-h5 font-weight-bold">¥{{ formatNumber(overview.total_assets) }}</div>
					</div>
					<v-divider vertical class="mx-3" style="height: 36px;"></v-divider>
					<div class="flex-grow-1 text-right">
						<div class="text-caption text-grey">日均成本</div>
						<div class="text-h5 cost-accent">
							¥{{ Number(overview.daily_cost).toFixed(2) }}<span class="text-caption text-grey ml-1">/天</span>
						</div>
					</div>
				</div>
				<v-divider class="my-3" style="border-style: dashed;"></v-divider>
				<v-row no-gutters>
					<v-col v-for="p in statusPills" :key="p.label">
						<div class="d-flex align-center mb-1">
							<span class="status-dot mr-1" :style="{ background: p.color }"></span>
							<span class="text-caption text-grey">{{ p.label }}</span>
						</div>
						<div class="text-h6 font-weight-bold">{{ p.count }}</div>
						<v-progress-linear
							:model-value="(p.count / Math.max(1, overview.total_count)) * 100"
							:color="p.color"
							rounded
							height="4"
						></v-progress-linear>
					</v-col>
				</v-row>
			</v-card>

			<!-- 层 3：品类标签 + 排序按钮 -->
			<div class="d-flex align-center px-4 mt-4">
				<v-chip-group v-model="activeCategory" mandatory class="flex-grow-1" show-arrows>
					<v-chip v-for="cat in categories" :key="cat" :value="cat" filter color="pink-lighten-2" variant="tonal">{{ cat }}</v-chip>
				</v-chip-group>
				<v-btn
					variant="outlined"
					size="small"
					rounded="pill"
					class="ml-2"
					@click="sortOpen = true"
				>
					<v-icon icon="mdi-sort" size="16" class="mr-1"></v-icon>
					<span class="text-caption">{{ currentSortLabel }}</span>
					<v-icon icon="mdi-chevron-down" size="14"></v-icon>
				</v-btn>
			</div>

			<!-- 层 4：双列物品网格 -->
			<v-row class="px-3 mt-2" no-gutters>
				<v-col v-for="item in items" :key="item.id" cols="6" class="pa-1">
					<v-card class="item-card rounded-xl" variant="outlined" @click="goItem(item.id)">
						<div style="position: relative;">
							<v-img
								v-if="item.cover_url"
								:src="item.cover_url"
								aspect-ratio="1"
								cover
							></v-img>
							<div v-else class="d-flex align-center justify-center" style="aspect-ratio: 1; background: #f6f6f9;">
								<v-icon icon="mdi-image-outline" size="32" color="grey"></v-icon>
							</div>
							<span class="status-dot" :class="'status-' + item.status" style="position: absolute; top: 8px; right: 8px;"></span>
						</div>
						<v-card-text class="pa-2 pb-3">
							<div class="text-body-2 font-weight-bold text-truncate">{{ item.name }}</div>
							<div class="text-caption text-grey">¥{{ formatNumber(item.purchase_price) }}</div>
							<div class="text-subtitle-1 cost-accent mt-1">
								¥{{ Number(item.daily_cost || 0).toFixed(2) }}<span class="text-caption text-grey ml-1">/天</span>
							</div>
						</v-card-text>
					</v-card>
				</v-col>

				<v-col v-if="!loading && items.length === 0" cols="12" class="text-center py-10 text-grey">
					<v-icon icon="mdi-bag-personal-outline" size="40"></v-icon>
					<div class="mt-2 text-caption">
						<span v-if="searchKeyword">没找到 "{{ searchKeyword }}" 相关的物品</span>
						<span v-else>还没有任何物品，点右下角 + 开始记录</span>
					</div>
				</v-col>
			</v-row>

			<!-- 排序弹窗 -->
			<v-bottom-sheet v-model="sortOpen">
				<v-card>
					<v-card-title>排序方式</v-card-title>
					<v-list>
						<v-list-item
							v-for="opt in sortOptions"
							:key="opt.key"
							:title="opt.label"
							@click="onSortPick(opt.key)"
						>
							<template v-slot:append v-if="sortKey === opt.key">
								<v-icon icon="mdi-check" color="pink-lighten-1"></v-icon>
							</template>
						</v-list-item>
					</v-list>
				</v-card>
			</v-bottom-sheet>
		</div>
	`,
	setup() {
		const router = VueRouter.useRouter();

		const overview = ref({
			total_assets: 0, daily_cost: 0, total_count: 0,
			count_using: 0, count_retired: 0, count_sold: 0,
		});
		const items   = ref([]);
		const loading = ref(false);

		const categories     = ref(["全部"]);
		const activeCategory = ref("全部");

		const searchVisible = ref(false);
		const searchKeyword = ref("");

		const sortOpen = ref(false);
		const sortKey  = ref("updated");
		const sortOptions = [
			{ key: "updated",     label: "最近添加" },
			{ key: "acquisition", label: "最近购入" },
			{ key: "price",       label: "购入价高 → 低" },
			{ key: "daily_cost",  label: "日均成本高 → 低" },
		];
		const currentSortLabel = computed(() =>
			sortOptions.find(o => o.key === sortKey.value)?.label || "排序");

		const statusPills = computed(() => [
			{ label: "服役中", count: overview.value.count_using,   color: "#5cd28a" },
			{ label: "已退役", count: overview.value.count_retired, color: "#f0b860" },
			{ label: "已卖出", count: overview.value.count_sold,    color: "#b4b8c2" },
		]);

		function toggleSearch() {
			searchVisible.value = !searchVisible.value;
			if (!searchVisible.value) searchKeyword.value = "";
		}
		function onSortPick(k) {
			sortKey.value = k;
			sortOpen.value = false;
		}
		function goItem(id) { router.push({ name: "item", params: { id: String(id) } }); }

		function formatNumber(n) {
			return Number(n || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
		}

		async function loadDashboard() {
			try {
				const r = await fetch("/api/dashboard");
				const j = await r.json();
				if (j.code === 200) overview.value = j.data.overview;
			} catch (e) { console.error(e); }
		}

		async function loadItems() {
			loading.value = true;
			try {
				const params = new URLSearchParams({
					q:        searchKeyword.value.trim(),
					category: activeCategory.value === "全部" ? "" : activeCategory.value,
					sort:     sortKey.value,
					size:     100,
				});
				const r = await fetch("/api/items?" + params);
				const j = await r.json();
				if (j.code === 200) {
					items.value = j.data.rows;
					if (!searchKeyword.value) {
						const uniq = new Set(["全部"]);
						j.data.rows.forEach(row => { uniq.add(row.category || "未分类"); });
						categories.value = Array.from(uniq);
					}
				}
			} finally {
				loading.value = false;
			}
		}

		// 搜索防抖
		let searchTimer = null;
		watch(searchKeyword, () => {
			if (searchTimer) clearTimeout(searchTimer);
			searchTimer = setTimeout(loadItems, 300);
		});
		watch([activeCategory, sortKey], loadItems);

		onMounted(() => {
			loadDashboard();
			loadItems();
		});

		return {
			overview, items, loading,
			categories, activeCategory,
			searchVisible, searchKeyword, toggleSearch,
			sortOpen, sortKey, sortOptions, currentSortLabel, onSortPick,
			statusPills, goItem, formatNumber,
		};
	},
};
