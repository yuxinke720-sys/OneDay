// ItemAdd.js —— 添加物品（Vuetify 表单 + 日历日期 + 图片上传）

const ItemAdd = {
	template: `
		<div>
			<v-app-bar color="transparent" flat>
				<v-btn icon="mdi-arrow-left" @click="$router.back()"></v-btn>
				<v-app-bar-title>添加物品</v-app-bar-title>
			</v-app-bar>

			<v-container class="pb-8">
				<v-form ref="formRef" v-model="isFormValid" @submit.prevent="handleSubmit">
					<!-- 图片上传 -->
					<div class="text-caption text-grey mb-2">物品图片</div>
					<v-card class="pa-3 rounded-xl mb-4" variant="flat">
						<v-file-input
							v-model="files"
							label="选择图片（可多选）"
							accept="image/*"
							multiple
							show-size
							prepend-icon="mdi-camera"
							variant="outlined"
							density="comfortable"
						></v-file-input>
						<div class="text-caption text-grey">第一张作为封面，最多 9 张</div>
					</v-card>

					<!-- 基本信息 -->
					<div class="text-caption text-grey mb-2">基本信息</div>
					<v-card class="pa-3 rounded-xl mb-4" variant="flat">
						<v-text-field
							v-model="form.name"
							label="名字 *"
							placeholder="如：MacBook Pro 14"
							:rules="[v => !!v || '请输入名字']"
							required
							maxlength="100"
							variant="outlined"
							density="comfortable"
						></v-text-field>
						<v-text-field
							v-model="form.category"
							label="分类"
							placeholder="电子 / 服饰 / 美妆 / 家居..."
							variant="outlined"
							density="comfortable"
						></v-text-field>
						<v-textarea
							v-model="form.notes"
							label="备注"
							placeholder="为什么入手？常用场景？"
							rows="2"
							auto-grow
							maxlength="500"
							counter
							variant="outlined"
							density="comfortable"
						></v-textarea>
					</v-card>

					<!-- 入手 -->
					<div class="text-caption text-grey mb-2">入手</div>
					<v-card class="pa-3 rounded-xl mb-4" variant="flat">
						<v-text-field
							:model-value="form.acquisition_date"
							label="入手日期 *"
							readonly
							append-inner-icon="mdi-calendar"
							@click="dateOpen = true"
							:rules="[v => !!v || '请选择日期']"
							required
							variant="outlined"
							density="comfortable"
						></v-text-field>
						<v-text-field
							v-model="form.purchase_price"
							label="购入价 *"
							placeholder="0.00"
							type="number"
							prefix="¥"
							:rules="[
								v => !!v || '请输入金额',
								v => /^\\d+(\\.\\d{1,2})?$/.test(v) || '请输入有效金额',
							]"
							required
							variant="outlined"
							density="comfortable"
						></v-text-field>
					</v-card>

					<!-- 状态 -->
					<div class="text-caption text-grey mb-2">当前状态</div>
					<v-btn-toggle v-model="form.status" mandatory color="primary" class="mb-6 d-flex" rounded="xl">
						<v-btn value="using"   class="flex-grow-1">
							<span class="status-dot status-using mr-2"></span>服役中
						</v-btn>
						<v-btn value="retired" class="flex-grow-1">
							<span class="status-dot status-retired mr-2"></span>已退役
						</v-btn>
						<v-btn value="sold"    class="flex-grow-1">
							<span class="status-dot status-sold mr-2"></span>已卖出
						</v-btn>
					</v-btn-toggle>

					<v-btn
						block
						size="large"
						color="primary"
						rounded="pill"
						type="submit"
						:loading="submitting"
						:disabled="!isFormValid"
					>
						完成添加
					</v-btn>
				</v-form>
			</v-container>

			<!-- 日期选择：Vuetify 日历视图 -->
			<v-dialog v-model="dateOpen" max-width="380">
				<v-date-picker
					v-model="dateValue"
					title="选择入手日期"
					:min="minDateStr"
					:max="maxDateStr"
					color="pink-lighten-1"
					@update:model-value="onDateConfirm"
				></v-date-picker>
			</v-dialog>

			<v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2000">
				{{ snackbar.msg }}
			</v-snackbar>
		</div>
	`,
	setup() {
		const router = VueRouter.useRouter();
		const formRef = ref(null);
		const isFormValid = ref(false);
		const submitting = ref(false);

		const form = reactive({
			name: "",
			category: "",
			notes: "",
			acquisition_date: new Date().toISOString().slice(0, 10),
			purchase_price: "",
			status: "using",
		});

		const files = ref([]);

		// 日期选择
		const dateOpen = ref(false);
		const dateValue = ref(new Date());
		const minDateStr = "1990-01-01";
		const maxDateStr = new Date().toISOString().slice(0, 10);
		function onDateConfirm(d) {
			if (d instanceof Date) {
				form.acquisition_date = d.toISOString().slice(0, 10);
			}
			dateOpen.value = false;
		}

		const snackbar = reactive({ show: false, msg: "", color: "success" });
		function showMsg(msg, color = "success") {
			snackbar.msg = msg; snackbar.color = color; snackbar.show = true;
		}

		// 读图原始宽高
		function readImageSize(file) {
			return new Promise((resolve) => {
				const url = URL.createObjectURL(file);
				const img = new Image();
				img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
				img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
				img.src = url;
			});
		}

		async function uploadOneImage(file, itemId) {
			const size = await readImageSize(file);
			const fd = new FormData();
			fd.append("file", file);
			fd.append("item_id", String(itemId));
			fd.append("width",   String(size.width));
			fd.append("height",  String(size.height));
			const r = await fetch("/api/images", { method: "POST", body: fd });
			const j = await r.json();
			return j.code === 200 ? j.data : null;
		}

		async function handleSubmit() {
			const valid = await formRef.value?.validate();
			if (valid && valid.valid === false) return;
			submitting.value = true;
			try {
				// 1. 创建 item
				const r = await fetch("/api/items", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: form.name.trim(),
						category: form.category.trim() || null,
						acquisition_date: form.acquisition_date,
						purchase_price: Number(form.purchase_price) || 0,
						status: form.status,
						notes: form.notes.trim() || null,
					}),
				});
				const j = await r.json();
				if (j.code !== 200) throw new Error(j.message || "添加失败");
				const item = j.data;

				// 2. 上传图片
				const uploaded = [];
				if (files.value && files.value.length > 0) {
					const list = Array.isArray(files.value) ? files.value : [files.value];
					for (const f of list) {
						if (f instanceof File) {
							const img = await uploadOneImage(f, item.id);
							if (img) uploaded.push(img);
						}
					}
				}
				// 3. 第一张设为封面
				if (uploaded.length > 0) {
					await fetch("/api/items/" + item.id, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ cover_image_id: uploaded[0].id }),
					});
				}

				showMsg("添加成功");
				setTimeout(() => router.replace({ name: "item", params: { id: String(item.id) } }), 600);
			} catch (e) {
				showMsg(e.message || "添加失败", "error");
			} finally {
				submitting.value = false;
			}
		}

		return {
			formRef, isFormValid, submitting,
			form, files,
			dateOpen, dateValue, minDateStr, maxDateStr, onDateConfirm,
			snackbar, handleSubmit,
		};
	},
};
