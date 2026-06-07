// ItemAdd.js —— 新建 / 编辑 物品表单（按图 5 布局重做）
// 新建：路由 /item/add       → POST /api/items
// 编辑：路由 /item/:id/edit  → 启动时 GET /api/items/:id 预填，提交时 PATCH

const ItemAdd = {
	template: `
		<div class="iadd-page">
			<!-- 顶部 toolbar：关闭 | 资产/心愿 切换 -->
			<v-app-bar color="transparent" flat>
				<v-btn icon="mdi-close" @click="handleCancel"></v-btn>
				<div class="flex-grow-1 d-flex justify-center align-center">
					<v-btn-toggle
						v-model="form.is_wish"
						mandatory
						color="pink-lighten-1"
						variant="text"
						density="compact"
						class="iadd-kind-toggle"
					>
						<v-btn :value="false" class="iadd-kind-btn">资产</v-btn>
						<v-btn :value="true"  class="iadd-kind-btn">心愿</v-btn>
					</v-btn-toggle>
				</div>
				<div style="width: 48px;"></div>
			</v-app-bar>

			<v-container class="pb-32">
				<!-- 物品图标 + 名称 -->
				<div class="text-center mb-4">
					<div class="iadd-icon-wrap mx-auto" @click="openIconPicker">
						<!-- emoji: 大字符直接渲染 -->
						<div v-if="form.icon_kind === 'emoji'" class="iadd-icon-emoji">{{ form.icon_value }}</div>
						<!-- 3d / image: 图片 -->
						<v-img v-else-if="iconPreview" :src="iconPreview" class="rounded-xl" aspect-ratio="1" cover></v-img>
						<!-- 默认占位 -->
						<div v-else class="d-flex align-center justify-center" style="aspect-ratio: 1; background: #f6f6f9; border-radius: 16px;">
							<v-icon icon="mdi-package-variant" size="42" color="brown-lighten-2"></v-icon>
						</div>
						<div class="iadd-icon-edit">
							<v-icon icon="mdi-pencil" size="13" color="white"></v-icon>
						</div>
					</div>
					<input ref="coverInput" type="file" accept="image/*" style="display:none" @change="onAlbumPick" />

					<input
						v-model="form.name"
						class="iadd-name-input"
						placeholder="请输入物品名称"
					/>
				</div>

				<!-- 卡片 1：价格 / 购买日期 / 类别 / 标签 -->
				<v-card class="rounded-xl mb-4" elevation="0" border>
					<div class="iadd-row">
						<v-icon icon="mdi-currency-cny" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label">{{ form.is_wish ? '想买价格' : '价格' }}</span>
						<input
							v-model.number="form.purchase_price"
							type="number"
							step="0.01"
							class="iadd-input-right"
							placeholder="0"
						/>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row" @click="dateOpen = true">
						<v-icon icon="mdi-calendar-outline" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label">{{ form.is_wish ? '想买日期' : '购买日期' }}</span>
						<span class="iadd-value-right">{{ form.acquisition_date }}</span>
						<v-icon icon="mdi-chevron-right" size="18" class="ml-1 text-grey"></v-icon>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row" @click="openCatPicker">
						<v-icon icon="mdi-tag-outline" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label">类别</span>
						<span class="iadd-value-right" :class="form.category ? '' : 'text-grey'">{{ form.category || '未分类' }}</span>
						<v-icon icon="mdi-chevron-right" size="18" class="ml-1 text-grey"></v-icon>
					</div>
				</v-card>

				<!-- 卡片 3：附加物品（仅资产模式：心愿还没买，谈不上配件/耗材成本）-->
				<v-card v-if="!form.is_wish" class="rounded-xl mb-4 pa-3" elevation="0" border>
					<div class="d-flex align-center mb-1">
						<v-icon icon="mdi-package-variant-closed-plus" size="20" class="mr-2 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">附加物品</span>
						<span v-if="subTotal > 0" class="text-caption text-grey-darken-1">小计 ¥{{ subTotal.toFixed(2) }}</span>
					</div>
					<div class="text-caption text-grey mb-2">配件 / 耗材的花费会计入这件物品的总成本</div>
					<div v-for="(s, idx) in form.sub_items" :key="idx" class="d-flex align-center mb-2" style="gap: 8px;">
						<input v-model="s.name" class="iadd-sub-name" placeholder="配件名" />
						<input v-model.number="s.price" type="number" step="0.01" class="iadd-sub-price" placeholder="¥0" />
						<v-btn icon="mdi-close" variant="text" size="x-small" @click="removeSubItem(idx)"></v-btn>
					</div>
					<v-btn block variant="outlined" rounded="lg" prepend-icon="mdi-plus" @click="addSubItem">添加物品</v-btn>
				</v-card>

				<!-- 卡片 4：备注 + 图片（图片复用 coverInput；这里只展示备注框 + 已选图片） -->
				<v-card class="rounded-xl mb-4 pa-3" elevation="0" border>
					<div class="d-flex align-center mb-2">
						<v-icon icon="mdi-text-box-outline" size="20" class="mr-2 text-grey-darken-1"></v-icon>
						<span class="iadd-label">备注</span>
					</div>
					<v-textarea
						v-model="form.notes"
						placeholder="输入备注，最多 200 字"
						maxlength="200"
						counter
						rows="2"
						auto-grow
						variant="outlined"
						density="comfortable"
						hide-details
					></v-textarea>
				</v-card>

				<!-- 卡片 5：资产开关（仅资产模式：心愿不计资产/日均，也无所谓退役/卖出）-->
				<v-card v-if="!form.is_wish" class="rounded-xl mb-4" elevation="0" border>
					<div class="iadd-row">
						<v-icon icon="mdi-cash-remove" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">不计入总资产</span>
						<v-switch v-model="form.exclude_from_assets" color="pink-lighten-1" hide-details density="compact" inset></v-switch>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row">
						<v-icon icon="mdi-chart-line-variant" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">不计入日均</span>
						<v-switch v-model="form.exclude_from_daily" color="pink-lighten-1" hide-details density="compact" inset></v-switch>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row">
						<v-icon icon="mdi-archive-arrow-down-outline" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">已退役</span>
						<v-switch v-model="retiredSwitch" color="pink-lighten-1" hide-details density="compact" inset></v-switch>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row">
						<v-icon icon="mdi-swap-horizontal" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">已卖出</span>
						<v-switch v-model="soldSwitch" color="pink-lighten-1" hide-details density="compact" inset></v-switch>
					</div>
				</v-card>

				<div class="text-center text-caption text-grey-darken-1 mt-4 mb-2">
					数据存储于本地数据库，建议定时备份数据
				</div>
			</v-container>

			<!-- 底部固定按钮 -->
			<div class="iadd-bottom-bar">
				<div v-if="isEdit" class="d-flex" style="gap: 12px;">
					<v-btn class="flex-grow-1" size="large" variant="outlined" rounded="pill" :disabled="submitting" @click="handleCancel">取消</v-btn>
					<v-btn class="flex-grow-1" size="large" color="black" rounded="pill" :loading="submitting" :disabled="!canSave" @click="handleSubmit">
						<v-icon icon="mdi-content-save-outline" class="mr-1"></v-icon>保存
					</v-btn>
				</div>
				<v-btn v-else block size="large" color="black" rounded="pill" :loading="submitting" :disabled="!canSave" @click="handleSubmit">
					保存
				</v-btn>
			</div>

			<!-- 购买/想买日期 -->
			<v-dialog v-model="dateOpen" max-width="380">
				<v-date-picker
					v-model="dateValue"
					:title="form.is_wish ? '选择想买日期' : '选择购买日期'"
					color="pink-lighten-1"
					@update:model-value="onDateConfirm"
				></v-date-picker>
			</v-dialog>

			<!-- 分类选择器：选已有 / 新建 -->
			<v-dialog v-model="catPickerOpen" max-width="420">
				<v-card class="rounded-xl pa-4">
					<div class="text-subtitle-1 font-weight-bold mb-3">选择分类</div>
					<v-text-field
						v-model="catSearch"
						placeholder="输入以搜索或新建分类"
						variant="outlined"
						density="comfortable"
						prepend-inner-icon="mdi-magnify"
						hide-details
						@keyup.enter="confirmNewCat"
					></v-text-field>
					<v-btn
						v-if="canCreateCat"
						block
						variant="tonal"
						color="pink-lighten-1"
						rounded="lg"
						class="mt-3"
						prepend-icon="mdi-plus"
						@click="confirmNewCat"
					>新建分类「{{ catSearch.trim() }}」</v-btn>
					<div class="d-flex flex-wrap mt-3" style="gap: 8px;">
						<v-chip
							v-for="c in filteredCats"
							:key="c.name"
							:color="form.category === c.name ? 'pink-lighten-1' : undefined"
							:variant="form.category === c.name ? 'flat' : 'outlined'"
							@click="pickCategory(c.name)"
						>{{ c.name }} <span class="text-caption ml-1">({{ c.count }})</span></v-chip>
						<v-chip
							:color="!form.category ? 'pink-lighten-1' : undefined"
							:variant="!form.category ? 'flat' : 'outlined'"
							@click="pickCategory('')"
						>未分类</v-chip>
					</div>
				</v-card>
			</v-dialog>

			<!-- ===== 图标选择器（三 tab）===== -->
			<v-dialog v-model="iconPickerOpen" max-width="520">
				<v-card class="rounded-xl">
					<v-tabs v-model="iconTab" color="pink-lighten-1" align-tabs="center" density="comfortable">
						<v-tab value="album">相册</v-tab>
						<v-tab value="emoji">Emoji</v-tab>
						<v-tab value="3d">3D 图标</v-tab>
					</v-tabs>
					<v-divider></v-divider>
					<v-window v-model="iconTab">
						<!-- 相册：复用上传 -->
						<v-window-item value="album">
							<div class="pa-6 text-center">
								<v-btn size="large" color="black" rounded="pill" @click="triggerAlbum">
									<v-icon icon="mdi-image-plus" class="mr-2"></v-icon>
									从相册选择图片
								</v-btn>
								<div class="text-caption text-grey mt-4">上传后图片会作为物品图标，自动剪裁为方形</div>
								<v-img
									v-if="form.icon_kind === 'image' && iconPreview"
									:src="iconPreview"
									class="rounded-xl mt-4 mx-auto"
									max-width="160"
									aspect-ratio="1"
									cover
								></v-img>
							</div>
						</v-window-item>
						<!-- Emoji：80 个物品 emoji 网格 -->
						<v-window-item value="emoji">
							<div class="icon-grid pa-3">
								<button
									v-for="e in EMOJI_SET"
									:key="e"
									class="icon-tile-emoji"
									:class="{ 'icon-tile-active': form.icon_kind === 'emoji' && form.icon_value === e }"
									@click="pickEmoji(e)"
								>{{ e }}</button>
							</div>
						</v-window-item>
						<!-- 3D 图标：扫 server/public/icons/3d/ -->
						<v-window-item value="3d">
							<div v-if="loading3d" class="pa-6 text-center text-grey">加载中…</div>
							<div v-else-if="!icons3d.length" class="pa-6 text-center text-grey text-caption">
								server/public/icons/3d/ 还没有图标
							</div>
							<div v-else class="icon-grid pa-3">
								<button
									v-for="i in icons3d"
									:key="i.url"
									class="icon-tile-img"
									:class="{ 'icon-tile-active': form.icon_kind === '3d' && form.icon_value === i.url }"
									@click="pick3d(i)"
								>
									<img :src="i.url" :alt="i.name" />
									<div class="icon-tile-label">{{ i.name }}</div>
								</button>
							</div>
						</v-window-item>
					</v-window>
				</v-card>
			</v-dialog>

			<v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2000">
				{{ snackbar.msg }}
			</v-snackbar>
		</div>
	`,
	setup() {
		const route   = VueRouter.useRoute();
		const router  = VueRouter.useRouter();

		const isEdit = computed(() => !!route.params.id && route.name === "item-edit");
		const editId = computed(() => Number(route.params.id));

		const submitting = ref(false);

		const form = reactive({
			name: "",
			category: "",
			notes: "",
			acquisition_date: new Date().toISOString().slice(0, 10),
			purchase_price: "",   // 空串：显示 placeholder「0」，不会顶一个 0 在前面
			status: "using",
			is_wish: false,
			exclude_from_assets: false,
			exclude_from_daily:  false,
			sub_items: [],
			icon_kind:  null,   // 'emoji' | '3d' | 'image' | null
			icon_value: null,   // emoji 字符 / 图标 URL / 上传后填充
		});

		// 退役/卖出 开关 ↔ status 的双向映射（互斥：开了退役自动关卖出，反之亦然）
		const retiredSwitch = computed({
			get: () => form.status === "retired",
			set: (v) => {
				if (v) form.status = "retired";
				else if (form.status === "retired") form.status = "using";
			},
		});
		const soldSwitch = computed({
			get: () => form.status === "sold",
			set: (v) => {
				if (v) form.status = "sold";
				else if (form.status === "sold") form.status = "using";
			},
		});

		// 附加物品小计（实时）
		const subTotal = computed(() =>
			form.sub_items.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
		);

		// ===== 分类选择器 =====
		const catPickerOpen = ref(false);
		const catSearch     = ref("");
		const categories    = ref([]);   // [{name, count}]
		const filteredCats = computed(() => {
			const kw = catSearch.value.trim().toLowerCase();
			return categories.value
				.filter(c => c.name !== "未分类")
				.filter(c => !kw || c.name.toLowerCase().includes(kw));
		});
		// 输入的名字在已有分类里找不到 → 可新建
		const canCreateCat = computed(() => {
			const kw = catSearch.value.trim();
			if (!kw || kw === "未分类") return false;
			return !categories.value.some(c => c.name === kw);
		});
		async function openCatPicker() {
			catPickerOpen.value = true;
			catSearch.value = "";
			try {
				const r = await authFetch("/api/categories");
				const j = await r.json();
				if (j.code === 200) categories.value = j.data;
			} catch { /* ignore */ }
		}
		function pickCategory(name) {
			form.category = name;          // '' 表示未分类
			catPickerOpen.value = false;
		}
		function confirmNewCat() {
			if (!canCreateCat.value) return;
			pickCategory(catSearch.value.trim());
		}

		// ===== 图标选择器 =====
		const coverInput     = ref(null);
		const coverFile      = ref(null);     // album tab 选的本地文件（待 submit 时上传）
		const coverBlobUrl   = ref("");       // 本地文件预览用的 blob URL（建一次，销毁时 revoke）
		// 释放旧 blob URL，避免每次预览都 createObjectURL 造成内存泄漏
		function setCoverFile(f) {
			if (coverBlobUrl.value) { URL.revokeObjectURL(coverBlobUrl.value); coverBlobUrl.value = ""; }
			coverFile.value = f;
			if (f) coverBlobUrl.value = URL.createObjectURL(f);
		}
		const iconPickerOpen = ref(false);
		const iconTab        = ref("3d");     // 默认打开 3D 那 tab
		const icons3d        = ref([]);
		const loading3d      = ref(false);

		// 80 个物品类 emoji
		const EMOJI_SET = [
			"📦","🎒","👜","👝","🛍",
			"📱","💻","⌨️","🖱","🖥","📺","🎮","🕹","🔋","🔌",
			"🎧","🎤","🔊","📻","📷","📹","📼",
			"⌚","🕰","💎","💍","👑","🎀","🕶","👓",
			"👕","👔","👖","👗","🧥","🧣","🧤","🧦","👟","👞","👠","🧢","🎩",
			"🛋","🛏","🪑","🚪","🪟","🛁","🚿","🪞","💡","🕯",
			"💄","💅","🧴","🪒","🧼","🪥",
			"🍎","🍞","🍔","🍕","🍰","☕","🍷","🍺","🥤","🍼",
			"📚","📓","✏️","🖊","🔧","🔨","🪛","🪚","🧰",
			"⚽","🏀","🎾","🏓","🚴","🏋️","🎯",
		];

		// 显示用：把 form.icon_kind/value + 本地新选的文件 + 编辑模式原 cover_url 三合一
		const iconPreview = computed(() => {
			if (form.icon_kind === "image") {
				// 新选的本地文件，用已建好的 blob URL 预览；老物品 (无 coverFile) 用 icon_value 里的 URL
				if (coverFile.value) return coverBlobUrl.value;
				return form.icon_value || "";
			}
			if (form.icon_kind === "3d") return form.icon_value || "";
			// emoji 不走这里（模板里有专门的 <div>）；null 也走兜底
			return "";
		});

		async function openIconPicker() {
			iconPickerOpen.value = true;
			if (!icons3d.value.length && !loading3d.value) {
				loading3d.value = true;
				try {
					const r = await authFetch("/api/icons/3d");
					const j = await r.json();
					if (j.code === 200) icons3d.value = j.data;
				} catch { /* ignore */ }
				finally { loading3d.value = false; }
			}
		}
		function triggerAlbum() { coverInput.value?.click(); }
		function onAlbumPick(e) {
			const f = e.target.files?.[0];
			e.target.value = "";
			if (!f) return;
			if (!f.type.startsWith("image/")) { tip("请选择图片", "error"); return; }
			setCoverFile(f);
			form.icon_kind      = "image";
			form.icon_value     = null;  // 真正的 URL 等上传完才有
			// 选完立即关闭弹窗，让用户看到大图预览
			iconPickerOpen.value = false;
		}
		function pickEmoji(e) {
			form.icon_kind  = "emoji";
			form.icon_value = e;
			setCoverFile(null);
			iconPickerOpen.value = false;
		}
		function pick3d(icon) {
			form.icon_kind  = "3d";
			form.icon_value = icon.url;
			setCoverFile(null);
			iconPickerOpen.value = false;
		}

		// 日期
		const dateOpen  = ref(false);
		const dateValue = ref(new Date());
		function onDateConfirm(d) {
			if (d instanceof Date) {
				form.acquisition_date = d.toISOString().slice(0, 10);
				dateValue.value = d;
			}
			dateOpen.value = false;
		}

		// 附加物品
		function addSubItem() { form.sub_items.push({ name: "", price: "" }); }
		function removeSubItem(idx) {
			// 已存在于后端的子项需要 DELETE
			const s = form.sub_items[idx];
			if (s && s.id) deletedSubIds.value.push(Number(s.id));
			form.sub_items.splice(idx, 1);
		}
		const deletedSubIds = ref([]);

		// Snackbar
		const snackbar = reactive({ show: false, msg: "", color: "success" });
		function tip(msg, color = "success") { snackbar.msg = msg; snackbar.color = color; snackbar.show = true; }

		// 可保存？
		const canSave = computed(() => !!form.name.trim());

		function readImageSize(file) {
			return new Promise((resolve) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload  = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
				img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
				img.src = url;
			});
		}
		async function uploadCover(file, itemId) {
			const size = await readImageSize(file);
			const fd = new FormData();
			fd.append("file", file);
			fd.append("item_id", String(itemId));
			fd.append("width",   String(size.width));
			fd.append("height",  String(size.height));
			const r = await authFetch("/api/images", { method: "POST", body: fd });
			const j = await r.json();
			return j.code === 200 ? j.data : null;
		}

		// 同步 sub_items 到后端（add / patch / delete）—— 各项互不依赖，并发执行
		async function syncSubItems(itemId) {
			const jobs = [];
			// 删除被移除的
			for (const sid of deletedSubIds.value) {
				jobs.push(authFetch("/api/sub-items/" + sid, { method: "DELETE" }));
			}
			deletedSubIds.value = [];
			// 创建或更新
			for (const s of form.sub_items) {
				if (!s.name || !s.name.trim()) continue;
				const json = { name: s.name.trim(), price: Number(s.price) || 0 };
				jobs.push(s.id
					? authFetch("/api/sub-items/" + s.id, { method: "PATCH", json })
					: authFetch("/api/items/" + itemId + "/sub-items", { method: "POST", json })
				);
			}
			await Promise.all(jobs);
		}

		async function loadForEdit() {
			const id = editId.value;
			const r = await authFetch("/api/items/" + id);
			const j = await r.json();
			if (j.code !== 200) { tip(j.message || "加载失败", "error"); return; }
			const it = j.data;
			form.name             = it.name || "";
			form.category         = it.category || "";
			form.notes            = it.notes || "";
			form.acquisition_date = (it.acquisition_date || "").slice(0, 10);
			form.purchase_price   = Number(it.purchase_price ?? 0);
			form.status           = it.status || "using";
			form.is_wish          = !!it.is_wish;
			form.exclude_from_assets = !!it.exclude_from_assets;
			form.exclude_from_daily  = !!it.exclude_from_daily;
			form.sub_items       = (it.sub_items || []).map(s => ({ id: s.id, name: s.name, price: Number(s.price) }));
			if (form.acquisition_date) dateValue.value = new Date(form.acquisition_date);
			// 图标预填：优先用 icon_kind/value（新模型），否则回退到 cover_url（老模型）
			if (it.icon_kind && it.icon_value) {
				form.icon_kind  = it.icon_kind;
				form.icon_value = it.icon_value;
			} else if (it.cover_url || it.images?.[0]?.url) {
				form.icon_kind  = "image";
				form.icon_value = it.cover_url || it.images[0].url;
			}
		}

		function handleCancel() {
			if (isEdit.value) {
				router.replace({ name: "item", params: { id: String(editId.value) } });
			} else {
				router.back();
			}
		}

		async function handleSubmit() {
			if (!canSave.value) { tip("请输入名称", "error"); return; }
			submitting.value = true;
			try {
				const payload = {
					name: form.name.trim(),
					category: form.category.trim() || null,
					acquisition_date: form.acquisition_date,
					purchase_price: Number(form.purchase_price) || 0,
					status: form.status,
					notes: form.notes.trim() || null,
					is_wish: form.is_wish,
					exclude_from_assets: form.exclude_from_assets,
					exclude_from_daily:  form.exclude_from_daily,
					// 图标：emoji / 3d 类型直接进 payload；image 类型在下面上传完才有 url
					icon_kind:  (form.icon_kind === "image" && coverFile.value) ? null : form.icon_kind,
					icon_value: (form.icon_kind === "image" && coverFile.value) ? null : form.icon_value,
				};

				let itemId;
				if (isEdit.value) {
					const r = await authFetch("/api/items/" + editId.value, { method: "PATCH", json: payload });
					const j = await r.json();
					if (j.code !== 200) throw new Error(j.message || "保存失败");
					itemId = editId.value;
				} else {
					const r = await authFetch("/api/items", { method: "POST", json: payload });
					const j = await r.json();
					if (j.code !== 200) throw new Error(j.message || "添加失败");
					itemId = j.data.id;
				}

				// album tab 新选的图：先上传，再 PATCH icon_kind=image + icon_value=img.url
				if (coverFile.value) {
					const img = await uploadCover(coverFile.value, itemId);
					if (img) {
						await authFetch("/api/items/" + itemId, {
							method: "PATCH",
							json: {
								cover_image_id: img.id,        // 老字段保留兼容
								icon_kind:  "image",
								icon_value: img.url,
							},
						});
					}
				}

				// 附加物品同步
				await syncSubItems(itemId);

				tip(isEdit.value ? "已保存" : "添加成功");
				setTimeout(() => router.replace({ name: "item", params: { id: String(itemId) } }), 500);
			} catch (e) {
				tip(e.message || "操作失败", "error");
			} finally {
				submitting.value = false;
			}
		}

		onMounted(() => {
			if (isEdit.value) loadForEdit();
			// 从心愿库点「+」进来：默认开在「心愿」模式
			else if (route.query.wish === "1") form.is_wish = true;
		});
		// 离开页面时释放未提交的 blob 预览 URL
		onUnmounted(() => { if (coverBlobUrl.value) URL.revokeObjectURL(coverBlobUrl.value); });

		return {
			isEdit, submitting, form,
			retiredSwitch, soldSwitch,
			canSave, subTotal,
			catPickerOpen, catSearch, filteredCats, canCreateCat,
			openCatPicker, pickCategory, confirmNewCat,
			coverInput, iconPreview,
			iconPickerOpen, iconTab, EMOJI_SET, icons3d, loading3d,
			openIconPicker, triggerAlbum, onAlbumPick, pickEmoji, pick3d,
			dateOpen, dateValue, onDateConfirm,
			addSubItem, removeSubItem,
			snackbar,
			handleSubmit, handleCancel,
		};
	},
};
