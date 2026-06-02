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
						<span class="iadd-label">价格</span>
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
					<div class="iadd-row">
						<v-icon icon="mdi-tag-outline" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label">类别</span>
						<input
							v-model="form.category"
							class="iadd-input-right"
							placeholder="未分类"
						/>
						<v-icon icon="mdi-chevron-right" size="18" class="ml-1 text-grey"></v-icon>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row">
						<v-icon icon="mdi-bookmark-outline" size="20" class="mr-3 text-grey-darken-1"></v-icon>
						<span class="iadd-label">标签</span>
						<span class="iadd-value-right text-grey">{{ form.tags || '可选' }}</span>
						<v-icon icon="mdi-chevron-right" size="18" class="ml-1 text-grey"></v-icon>
					</div>
				</v-card>

				<!-- 卡片 2：目标成本 -->
				<v-card class="rounded-xl mb-4 pa-3" elevation="0" border>
					<div class="d-flex align-center mb-2">
						<v-icon icon="mdi-target" size="20" class="mr-2 text-grey-darken-1"></v-icon>
						<span class="iadd-label flex-grow-1">目标成本</span>
					</div>
					<v-btn-toggle
						v-model="form.target_cost_type"
						mandatory
						color="black"
						density="compact"
						class="d-flex iadd-target-toggle"
						rounded="pill"
					>
						<v-btn value="none"   class="flex-grow-1">不设定</v-btn>
						<v-btn value="price"  class="flex-grow-1">按价格</v-btn>
						<v-btn value="period" class="flex-grow-1">按周期</v-btn>
						<v-btn value="custom" class="flex-grow-1">自定义</v-btn>
					</v-btn-toggle>
					<v-text-field
						v-if="form.target_cost_type !== 'none'"
						v-model.number="form.target_cost_value"
						type="number"
						step="0.01"
						:label="targetCostLabel"
						prefix="¥"
						variant="outlined"
						density="comfortable"
						class="mt-3"
						hide-details
					></v-text-field>
				</v-card>

				<!-- 卡片 3：附加物品 -->
				<v-card class="rounded-xl mb-4 pa-3" elevation="0" border>
					<div class="d-flex align-center mb-2">
						<v-icon icon="mdi-package-variant-closed-plus" size="20" class="mr-2 text-grey-darken-1"></v-icon>
						<span class="iadd-label">附加物品</span>
					</div>
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

				<!-- 卡片 5：4 个开关 -->
				<v-card class="rounded-xl mb-4" elevation="0" border>
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

				<!-- 卡片 6：到期设置 -->
				<v-card class="rounded-xl mb-4" elevation="0" border>
					<div class="d-flex align-center px-4 pt-3 pb-1">
						<v-icon icon="mdi-clock-outline" size="20" class="mr-2 text-grey-darken-1"></v-icon>
						<span class="iadd-label">到期设置</span>
					</div>
					<div class="iadd-row" @click="expireDateOpen = true">
						<span class="iadd-label flex-grow-1" style="margin-left: 32px;">到期时间</span>
						<span class="iadd-value-right text-grey">{{ form.expire_date || '未设置' }}</span>
						<v-icon icon="mdi-chevron-right" size="18" class="ml-1 text-grey"></v-icon>
					</div>
					<v-divider class="iadd-divider"></v-divider>
					<div class="iadd-row">
						<span class="iadd-label flex-grow-1" style="margin-left: 32px;">到期提醒</span>
						<v-switch v-model="form.expire_reminder" color="pink-lighten-1" hide-details density="compact" inset :disabled="!form.expire_date"></v-switch>
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

			<!-- 到期日期 -->
			<v-dialog v-model="expireDateOpen" max-width="380">
				<v-date-picker
					v-model="expireDateValue"
					title="选择到期日期"
					color="pink-lighten-1"
					@update:model-value="onExpireDateConfirm"
				></v-date-picker>
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
			tags: "",                  // 预留字段，标签弹窗以后做
			notes: "",
			acquisition_date: new Date().toISOString().slice(0, 10),
			purchase_price: 0,
			status: "using",
			is_wish: false,
			target_cost_type: "none",
			target_cost_value: null,
			exclude_from_assets: false,
			exclude_from_daily:  false,
			expire_date:     null,
			expire_reminder: false,
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

		const targetCostLabel = computed(() => {
			return form.target_cost_type === "price"  ? "目标总价" :
			       form.target_cost_type === "period" ? "目标周期天数" :
			       form.target_cost_type === "custom" ? "目标值" : "";
		});

		// ===== 图标选择器 =====
		const coverInput     = ref(null);
		const coverFile      = ref(null);     // album tab 选的本地文件（待 submit 时上传）
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
				// 新选的本地文件，用 blob URL 预览；老物品 (无 coverFile) 用 icon_value 里的 URL
				if (coverFile.value) return URL.createObjectURL(coverFile.value);
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
			coverFile.value     = f;
			form.icon_kind      = "image";
			form.icon_value     = null;  // 真正的 URL 等上传完才有
			// 选完立即关闭弹窗，让用户看到大图预览
			iconPickerOpen.value = false;
		}
		function pickEmoji(e) {
			form.icon_kind  = "emoji";
			form.icon_value = e;
			coverFile.value = null;
			iconPickerOpen.value = false;
		}
		function pick3d(icon) {
			form.icon_kind  = "3d";
			form.icon_value = icon.url;
			coverFile.value = null;
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
		const expireDateOpen  = ref(false);
		const expireDateValue = ref(new Date());
		function onExpireDateConfirm(d) {
			if (d instanceof Date) {
				form.expire_date = d.toISOString().slice(0, 10);
				expireDateValue.value = d;
			}
			expireDateOpen.value = false;
		}

		// 附加物品
		function addSubItem() { form.sub_items.push({ name: "", price: 0 }); }
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

		// 同步 sub_items 到后端（add / patch / delete）
		async function syncSubItems(itemId) {
			// 删除被移除的
			for (const sid of deletedSubIds.value) {
				await authFetch("/api/sub-items/" + sid, { method: "DELETE" });
			}
			deletedSubIds.value = [];
			// 创建或更新
			for (const s of form.sub_items) {
				if (!s.name || !s.name.trim()) continue;
				if (s.id) {
					await authFetch("/api/sub-items/" + s.id, {
						method: "PATCH",
						json: { name: s.name.trim(), price: Number(s.price) || 0 },
					});
				} else {
					await authFetch("/api/items/" + itemId + "/sub-items", {
						method: "POST",
						json: { name: s.name.trim(), price: Number(s.price) || 0 },
					});
				}
			}
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
			form.target_cost_type   = it.target_cost_type   || "none";
			form.target_cost_value  = it.target_cost_value !== null && it.target_cost_value !== undefined ? Number(it.target_cost_value) : null;
			form.exclude_from_assets = !!it.exclude_from_assets;
			form.exclude_from_daily  = !!it.exclude_from_daily;
			form.expire_date     = it.expire_date ? String(it.expire_date).slice(0, 10) : null;
			form.expire_reminder = !!it.expire_reminder;
			form.sub_items       = (it.sub_items || []).map(s => ({ id: s.id, name: s.name, price: Number(s.price) }));
			if (form.acquisition_date) dateValue.value = new Date(form.acquisition_date);
			if (form.expire_date)      expireDateValue.value = new Date(form.expire_date);
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
					target_cost_type:  form.target_cost_type,
					target_cost_value: form.target_cost_type === "none" ? null : (Number(form.target_cost_value) || 0),
					exclude_from_assets: form.exclude_from_assets,
					exclude_from_daily:  form.exclude_from_daily,
					expire_date:     form.expire_date,
					expire_reminder: !!form.expire_date && form.expire_reminder,
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
		});

		return {
			isEdit, submitting, form,
			retiredSwitch, soldSwitch,
			targetCostLabel, canSave,
			coverInput, iconPreview,
			iconPickerOpen, iconTab, EMOJI_SET, icons3d, loading3d,
			openIconPicker, triggerAlbum, onAlbumPick, pickEmoji, pick3d,
			dateOpen, dateValue, onDateConfirm,
			expireDateOpen, expireDateValue, onExpireDateConfirm,
			addSubItem, removeSubItem,
			snackbar,
			handleSubmit, handleCancel,
		};
	},
};
