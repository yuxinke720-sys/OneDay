// Home.js —— 首页
// 差分滚动布局：固定渐变背景 + 吸顶 app bar + 自然滚动的大盘 + 吸顶筛选条 + 物品网格
// 批量模式：顶部 toolbar 覆盖 + 卡片左上角选中圈 + 底部 3 个动作（分类 / 删除 / 状态）

const Home = {
	template: `
		<div class="home-page">
			<!-- ============ 普通模式 ============ -->
			<template v-if="!ui.batchMode">
				<!-- A 区：吸顶 app bar；滚下去切毛玻璃 -->
				<div class="home-appbar" :class="{ 'home-appbar-floating': scrolled }">
					<div class="d-flex align-center justify-space-between">
						<h1 class="text-h4 font-weight-black">OneDay</h1>
						<div>
							<v-btn :icon="searchVisible ? 'mdi-close' : 'mdi-magnify'" variant="text" @click="toggleSearch"></v-btn>
							<v-btn variant="text" @click="goSettings" class="pa-0">
								<v-avatar size="36" color="pink-lighten-4">
									<v-img v-if="auth.avatarUrl" :src="auth.avatarUrl" cover></v-img>
									<span v-else class="text-body-2 font-weight-bold text-white">{{ avatarInitial }}</span>
								</v-avatar>
							</v-btn>
						</div>
					</div>
					<div class="text-caption text-grey-darken-1" v-if="!searchVisible && !scrolled">记录每一件物品的真实使用成本</div>
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

				<!-- B 区：大盘卡，自然流；mt-n4 让卡片轻微叠到 app bar 下沿 -->
				<v-card ref="dashRef" class="dashboard-card mx-4 pa-4 rounded-xl" elevation="3">
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

				<!-- C 区：吸顶筛选条 -->
				<div class="home-filters" :class="{ 'home-filters-sticky': scrolled }">
					<!-- 分类 + 排序 + 批量入口 -->
					<div class="d-flex align-center px-4 pt-2">
						<div class="chip-fade-mask flex-grow-1" style="min-width: 0; overflow: hidden;">
							<v-chip-group v-model="activeCategory" mandatory>
								<v-chip v-for="cat in categories" :key="cat" :value="cat" variant="text" class="category-chip">{{ cat }}</v-chip>
							</v-chip-group>
						</div>
						<v-btn
							variant="outlined"
							size="small"
							rounded="pill"
							class="ml-2"
							@click="openSort"
						>
							<v-icon icon="mdi-sort" size="16" class="mr-1"></v-icon>
							<span class="text-caption">{{ currentSortLabel }}</span>
							<v-icon icon="mdi-chevron-down" size="14"></v-icon>
						</v-btn>
						<v-btn icon="mdi-checkbox-multiple-outline" variant="text" size="small" class="ml-1" @click="enterBatch"></v-btn>
					</div>

					<!-- 状态筛选（右侧渐隐遮罩，提示横向有更多）-->
					<div class="d-flex align-center px-4 pb-1">
						<div class="chip-fade-mask flex-grow-1" style="min-width: 0; overflow: hidden;">
							<v-chip-group v-model="activeStatus" mandatory>
								<v-chip
									v-for="s in statusOptions"
									:key="s.key"
									:value="s.key"
									filter
									:color="s.color"
									variant="tonal"
									size="small"
								>{{ s.label }}</v-chip>
							</v-chip-group>
						</div>
					</div>
				</div>
			</template>

			<!-- ============ 批量模式：顶部 toolbar 覆盖 ============ -->
			<template v-else>
				<div class="batch-header d-flex align-center justify-space-between px-4">
					<v-btn variant="text" @click="toggleSelectAll">
						{{ allSelected ? '取消全选' : '全选' }}
					</v-btn>
					<span class="text-subtitle-1 font-weight-bold">已选：{{ selectedIds.length }}</span>
					<v-btn variant="text" @click="exitBatch">取消</v-btn>
				</div>
			</template>

			<!-- ============ 层 4：物品网格（普通+批量共用，卡片表现略不同） ============ -->
			<v-row class="px-3 mt-2" no-gutters>
				<v-col v-for="item in items" :key="item.id" cols="6" class="pa-1">
					<v-card
						class="item-card rounded-xl"
						:class="{ 'item-card-selected': isSelected(item.id) }"
						variant="outlined"
						@click="onCardClick(item)"
					>
						<div style="position: relative;">
							<v-img v-if="item.cover_url" :src="item.cover_url" aspect-ratio="1" cover></v-img>
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
							<!-- 批量模式：底部选中圈 -->
							<div v-if="ui.batchMode" class="d-flex justify-center mt-1">
								<v-icon
									:icon="isSelected(item.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"
									:color="isSelected(item.id) ? 'black' : 'grey-lighten-1'"
									size="22"
								></v-icon>
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

			<!-- ============ 批量模式：底部 3 个动作 ============ -->
			<div v-if="ui.batchMode" class="batch-action-bar">
				<v-card class="rounded-pill d-flex align-center justify-space-around px-2 py-1" elevation="6">
					<v-btn variant="text" class="batch-action-btn" :disabled="!selectedIds.length" @click="openCategoryDialog">
						<v-icon icon="mdi-folder-outline" size="20"></v-icon>
						<span class="text-caption">分类</span>
					</v-btn>
					<v-btn variant="text" class="batch-action-btn" :disabled="!selectedIds.length" @click="confirmBulkDelete">
						<v-icon icon="mdi-trash-can-outline" size="20"></v-icon>
						<span class="text-caption">删除</span>
					</v-btn>
					<v-btn variant="text" class="batch-action-btn" :disabled="!selectedIds.length" @click="openStatusDialog">
						<v-icon icon="mdi-toggle-switch-outline" size="20"></v-icon>
						<span class="text-caption">状态</span>
					</v-btn>
				</v-card>
			</div>

			<!-- ============ 排序弹窗（不变） ============ -->
			<v-bottom-sheet v-model="sortOpen">
				<v-card class="rounded-t-xl pb-2">
					<div class="sort-header d-flex align-center justify-space-between px-3">
						<v-btn variant="text" size="default" class="sort-cancel-btn text-grey-darken-1" @click="cancelSort">取消</v-btn>
						<span class="text-subtitle-1 font-weight-bold">排序方式</span>
						<v-btn color="pink-lighten-1" variant="flat" size="default" rounded="pill" class="sort-confirm-btn" @click="confirmSort">
							<v-icon icon="mdi-check" size="18" class="mr-1"></v-icon>确定
						</v-btn>
					</div>
					<div class="sort-header-divider"></div>
					<div class="px-5 pt-2">
						<div v-for="opt in sortKeyOptions" :key="opt.key" class="sort-row d-flex align-center justify-space-between" @click="draftSortKey = opt.key">
							<span class="text-body-1" :class="draftSortKey === opt.key ? 'text-pink-lighten-1 font-weight-medium' : ''">{{ opt.label }}</span>
							<v-icon v-if="draftSortKey === opt.key" icon="mdi-check" color="pink-lighten-1" size="20"></v-icon>
						</div>
					</div>
					<div class="sort-section-divider"></div>
					<div class="px-5">
						<div v-for="opt in sortOrderOptions" :key="opt.key" class="sort-row d-flex align-center justify-space-between" @click="draftSortOrder = opt.key">
							<span class="text-body-1" :class="draftSortOrder === opt.key ? 'text-pink-lighten-1 font-weight-medium' : ''">{{ opt.label }}</span>
							<v-icon v-if="draftSortOrder === opt.key" icon="mdi-check" color="pink-lighten-1" size="20"></v-icon>
						</div>
					</div>
				</v-card>
			</v-bottom-sheet>

			<!-- ============ 批量：选择分类 弹窗（图3）============ -->
			<v-bottom-sheet v-model="categoryDialogOpen">
				<v-card class="rounded-t-xl pb-4">
					<div class="d-flex align-center justify-space-between px-4 py-3">
						<v-btn icon="mdi-close" variant="text" size="small" @click="categoryDialogOpen = false"></v-btn>
						<span class="text-subtitle-1 font-weight-bold">选择分类</span>
						<v-btn variant="text" size="small" :color="manageCategoryMode ? 'pink-lighten-1' : ''" @click="manageCategoryMode = !manageCategoryMode">
							{{ manageCategoryMode ? '完成' : '管理' }}
						</v-btn>
					</div>
					<div class="sort-header-divider"></div>
					<div class="px-4 pt-2">
						<!-- 系统选项："未分类" 永远在第一个 -->
						<div class="category-row d-flex align-center justify-space-between" @click="!manageCategoryMode && assignCategory(null)">
							<span class="text-body-1">未分类</span>
							<v-icon v-if="!manageCategoryMode" icon="mdi-chevron-right" size="18" color="grey"></v-icon>
						</div>
						<!-- 用户自定义分类 -->
						<div
							v-for="cat in customCategories"
							:key="cat.name"
							class="category-row d-flex align-center justify-space-between"
							@click="!manageCategoryMode && assignCategory(cat.name)"
						>
							<span class="text-body-1">{{ cat.name }} <span class="text-caption text-grey ml-1">({{ cat.count }})</span></span>
							<div v-if="manageCategoryMode" class="d-flex" style="gap: 4px;">
								<v-btn icon="mdi-pencil" variant="text" size="x-small" @click.stop="renameCategory(cat.name)"></v-btn>
								<v-btn icon="mdi-delete-outline" variant="text" size="x-small" color="error" @click.stop="deleteCategoryPrompt(cat.name)"></v-btn>
							</div>
							<v-icon v-else icon="mdi-chevron-right" size="18" color="grey"></v-icon>
						</div>
						<!-- 新建分类 -->
						<v-btn
							block
							variant="outlined"
							rounded="lg"
							class="mt-3"
							prepend-icon="mdi-plus"
							@click="promptNewCategory"
						>新建分类</v-btn>
					</div>
				</v-card>
			</v-bottom-sheet>

			<!-- ============ 批量：状态切换 弹窗（图4）============ -->
			<v-bottom-sheet v-model="statusDialogOpen">
				<v-card class="pb-2">
					<div
						v-for="s in bulkStatusOptions"
						:key="s.key"
						class="status-action-row"
						@click="bulkChangeStatus(s.key)"
					>
						<span class="status-dot mr-3" :style="{ background: s.dot }"></span>
						<span class="text-body-1">{{ s.label }}</span>
					</div>
				</v-card>
			</v-bottom-sheet>

			<v-snackbar v-model="snack.show" :color="snack.color" :timeout="2000">
				{{ snack.msg }}
			</v-snackbar>
		</div>
	`,
	setup() {
		const router = VueRouter.useRouter();
		const auth   = useAuthStore();
		const ui     = useAppStore();
		const avatarInitial = computed(() =>
			(auth.user?.name || auth.user?.student_number || "?").trim().slice(0, 1).toUpperCase()
		);
		function goSettings() { router.push({ name: "settings" }); }

		// 差分滚动：监听大盘卡是否完全滚出 app bar 下沿
		// 触发后 app bar 切毛玻璃、筛选条吸顶
		const dashRef  = ref(null);
		const scrolled = ref(false);
		let io = null;
		onMounted(() => {
			const el = dashRef.value?.$el || dashRef.value;
			if (!el) return;
			io = new IntersectionObserver(
				([entry]) => { scrolled.value = !entry.isIntersecting; },
				{ rootMargin: "-56px 0px 0px 0px", threshold: 0 },
			);
			io.observe(el);
		});
		onUnmounted(() => io?.disconnect());

		const overview = ref({
			total_assets: 0, daily_cost: 0, total_count: 0,
			count_using: 0, count_retired: 0, count_sold: 0,
		});
		const items   = ref([]);
		const loading = ref(false);

		const categories     = ref(["全部"]);
		const activeCategory = ref("全部");

		const activeStatus = ref("all");
		const statusOptions = [
			{ key: "all",     label: "全部",   color: "grey" },
			{ key: "using",   label: "服役中", color: "green-lighten-1" },
			{ key: "retired", label: "已退役", color: "amber-darken-1" },
			{ key: "sold",    label: "已卖出", color: "grey-lighten-1" },
		];

		const searchVisible = ref(false);
		const searchKeyword = ref("");

		// 排序持久化
		const SORT_STORAGE = "oneday_home_sort";
		const savedSort = (() => {
			try { return JSON.parse(localStorage.getItem(SORT_STORAGE) || "null"); } catch { return null; }
		})();
		const sortOpen   = ref(false);
		const sortKey    = ref(savedSort?.key   || "updated");
		const sortOrder  = ref(savedSort?.order || "desc");
		watch([sortKey, sortOrder], ([k, o]) => {
			localStorage.setItem(SORT_STORAGE, JSON.stringify({ key: k, order: o }));
		});
		const draftSortKey   = ref(sortKey.value);
		const draftSortOrder = ref(sortOrder.value);

		function openSort() {
			draftSortKey.value   = sortKey.value;
			draftSortOrder.value = sortOrder.value;
			sortOpen.value = true;
		}
		function confirmSort() {
			sortKey.value   = draftSortKey.value;
			sortOrder.value = draftSortOrder.value;
			sortOpen.value = false;
		}
		function cancelSort() { sortOpen.value = false; }

		const sortKeyOptions = [
			{ key: "custom",      label: "自定义" },
			{ key: "updated",     label: "添加时间" },
			{ key: "acquisition", label: "购买时间" },
			{ key: "daily_cost",  label: "按日均成本" },
			{ key: "status",      label: "物品状态" },
			{ key: "days_owned",  label: "服役时长" },
			{ key: "price",       label: "物品价值" },
		];
		const sortOrderOptions = [
			{ key: "asc",  label: "正序" },
			{ key: "desc", label: "倒序" },
		];
		const currentSortLabel = computed(() => {
			const keyLabel = sortKeyOptions.find(o => o.key === sortKey.value)?.label || "排序";
			const arrow = sortOrder.value === "asc" ? " ↑" : " ↓";
			return keyLabel + arrow;
		});

		const statusPills = computed(() => [
			{ label: "服役中", count: overview.value.count_using,   color: "#5cd28a" },
			{ label: "已退役", count: overview.value.count_retired, color: "#f0b860" },
			{ label: "已卖出", count: overview.value.count_sold,    color: "#b4b8c2" },
		]);

		// ===== 批量模式 =====
		const selectedIds = ref([]);
		function isSelected(id) { return selectedIds.value.includes(id); }
		function enterBatch() {
			ui.batchMode = true;
			selectedIds.value = [];
		}
		function exitBatch() {
			ui.batchMode = false;
			selectedIds.value = [];
		}
		const allSelected = computed(() =>
			items.value.length > 0 && selectedIds.value.length === items.value.length
		);
		function toggleSelectAll() {
			if (allSelected.value) selectedIds.value = [];
			else selectedIds.value = items.value.map(it => Number(it.id));
		}
		function onCardClick(item) {
			if (ui.batchMode) {
				const id = Number(item.id);
				const i = selectedIds.value.indexOf(id);
				if (i >= 0) selectedIds.value.splice(i, 1);
				else selectedIds.value.push(id);
			} else {
				goItem(item.id);
			}
		}

		// 路由离开自动退出批量模式，避免别处看到导航被吞
		onUnmounted(() => { ui.batchMode = false; });

		// ===== 分类弹窗（批量改分类 + 分类管理）=====
		const categoryDialogOpen = ref(false);
		const manageCategoryMode = ref(false);
		const customCategories = ref([]);   // [{name,count}, ...]，已排除"未分类"

		async function loadCategoryList() {
			const r = await authFetch("/api/categories");
			const j = await r.json();
			if (j.code === 200) {
				customCategories.value = (j.data || []).filter(c => c.name !== "未分类");
			}
		}
		function openCategoryDialog() {
			manageCategoryMode.value = false;
			loadCategoryList();
			categoryDialogOpen.value = true;
		}
		async function assignCategory(name) {
			if (!selectedIds.value.length) return;
			const r = await authFetch("/api/items/bulk", {
				method: "PATCH",
				json: { ids: selectedIds.value, category: name },
			});
			const j = await r.json();
			if (j.code === 200) {
				tip(`已分类到 ${name || "未分类"}：${j.data.updated} 件`);
				categoryDialogOpen.value = false;
				exitBatch();
				await loadItems();
			} else { tip(j.message || "失败", "error"); }
		}
		async function promptNewCategory() {
			const name = (prompt("新分类名称") || "").trim();
			if (!name) return;
			if (name === "未分类") { tip("不能用'未分类'这个名称", "error"); return; }
			// 直接把当前选中的物品移到这个新分类（若有选中），否则只刷分类列表
			if (selectedIds.value.length) {
				await assignCategory(name);
			} else {
				await loadCategoryList();
			}
		}
		async function renameCategory(oldName) {
			const newName = (prompt(`将分类「${oldName}」重命名为：`, oldName) || "").trim();
			if (!newName || newName === oldName) return;
			const r = await authFetch("/api/categories", {
				method: "PATCH",
				json: { oldName, newName },
			});
			const j = await r.json();
			if (j.code === 200) {
				tip(`已重命名：${j.data.updated} 件`);
				await loadCategoryList();
				await loadItems();
			} else { tip(j.message || "失败", "error"); }
		}
		async function deleteCategoryPrompt(name) {
			if (!confirm(`删除分类「${name}」？该分类下所有物品会变成"未分类"`)) return;
			const r = await authFetch("/api/categories", {
				method: "DELETE",
				json: { name },
			});
			const j = await r.json();
			if (j.code === 200) {
				tip(`已删除分类，${j.data.affected} 件物品变为未分类`);
				await loadCategoryList();
				await loadItems();
			} else { tip(j.message || "失败", "error"); }
		}

		// ===== 状态弹窗（批量切状态）=====
		const statusDialogOpen = ref(false);
		const bulkStatusOptions = [
			{ key: "using",   label: "转为服役", dot: "#5cd28a" },
			{ key: "retired", label: "转为退役", dot: "#f0b860" },
			{ key: "sold",    label: "转为卖出", dot: "#b4b8c2" },
		];
		function openStatusDialog() { statusDialogOpen.value = true; }
		async function bulkChangeStatus(status) {
			const r = await authFetch("/api/items/bulk", {
				method: "PATCH",
				json: { ids: selectedIds.value, status },
			});
			const j = await r.json();
			if (j.code === 200) {
				tip(`已更新 ${j.data.updated} 件物品状态`);
				statusDialogOpen.value = false;
				exitBatch();
				await loadItems();
				await loadDashboard();
			} else { tip(j.message || "失败", "error"); }
		}

		// ===== 批量删除 =====
		async function confirmBulkDelete() {
			if (!selectedIds.value.length) return;
			if (!confirm(`删除选中的 ${selectedIds.value.length} 件物品？所有事件和图片都会一起删除`)) return;
			const r = await authFetch("/api/items/bulk", {
				method: "DELETE",
				json: { ids: selectedIds.value },
			});
			const j = await r.json();
			if (j.code === 200) {
				tip(`已删除 ${j.data.deleted} 件`);
				exitBatch();
				await loadItems();
				await loadDashboard();
			} else { tip(j.message || "失败", "error"); }
		}

		// ===== 数据加载 =====
		function toggleSearch() {
			searchVisible.value = !searchVisible.value;
			if (!searchVisible.value) searchKeyword.value = "";
		}
		function goItem(id) { router.push({ name: "item", params: { id: String(id) } }); }
		function formatNumber(n) {
			return Number(n || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
		}

		async function loadDashboard() {
			try {
				const r = await authFetch("/api/dashboard");
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
					status:   activeStatus.value === "all" ? "" : activeStatus.value,
					sort:     sortKey.value,
					order:    sortOrder.value,
					size:     100,
				});
				const r = await authFetch("/api/items?" + params);
				const j = await r.json();
				if (j.code === 200) {
					items.value = j.data.rows;
					if (!searchKeyword.value) {
						const uniq = new Set(["全部"]);
						j.data.rows.forEach(row => { uniq.add(row.category || "未分类"); });
						categories.value = Array.from(uniq);
					}
				}
			} finally { loading.value = false; }
		}

		// ===== Snackbar =====
		const snack = reactive({ show: false, msg: "", color: "success" });
		function tip(msg, color = "success") { snack.msg = msg; snack.color = color; snack.show = true; }

		// 搜索防抖
		let searchTimer = null;
		watch(searchKeyword, () => {
			if (searchTimer) clearTimeout(searchTimer);
			searchTimer = setTimeout(loadItems, 300);
		});
		watch([activeCategory, activeStatus, sortKey, sortOrder], loadItems);

		onMounted(() => {
			loadDashboard();
			loadItems();
		});

		return {
			ui, auth, avatarInitial, goSettings,
			dashRef, scrolled,
			overview, items, loading,
			categories, activeCategory,
			activeStatus, statusOptions,
			searchVisible, searchKeyword, toggleSearch,
			sortOpen, sortKey, sortOrder, sortKeyOptions, sortOrderOptions, currentSortLabel,
			draftSortKey, draftSortOrder, openSort, confirmSort, cancelSort,
			statusPills, goItem, formatNumber,
			// 批量
			selectedIds, isSelected, enterBatch, exitBatch, allSelected, toggleSelectAll, onCardClick,
			// 分类弹窗
			categoryDialogOpen, manageCategoryMode, customCategories,
			openCategoryDialog, assignCategory, promptNewCategory, renameCategory, deleteCategoryPrompt,
			// 状态弹窗
			statusDialogOpen, bulkStatusOptions, openStatusDialog, bulkChangeStatus,
			// 删除
			confirmBulkDelete,
			snack,
		};
	},
};
