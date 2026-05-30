// Settings.js —— 设置（用户资料 / 头像 / 退出登录 / 其它偏好）

const Settings = {
	template: `
		<div>
			<v-app-bar color="transparent" flat>
				<v-app-bar-title>设置</v-app-bar-title>
			</v-app-bar>

			<v-container>
				<!-- 用户资料卡 -->
				<v-card class="rounded-xl pa-4 mb-4" elevation="2">
					<div class="d-flex align-center">
						<div class="profile-avatar-wrap mr-4" @click="triggerAvatarPick">
							<v-avatar size="72" color="pink-lighten-4">
								<v-img v-if="auth.avatarUrl" :src="auth.avatarUrl" cover></v-img>
								<span v-else class="text-h5 font-weight-bold text-white">{{ avatarInitial }}</span>
							</v-avatar>
							<div class="profile-avatar-edit">
								<v-icon icon="mdi-camera" size="14" color="white"></v-icon>
							</div>
							<v-progress-circular
								v-if="uploading"
								indeterminate
								color="pink-lighten-1"
								size="72"
								width="3"
								class="profile-avatar-loader"
							></v-progress-circular>
						</div>
						<div class="flex-grow-1">
							<div class="text-h6 font-weight-bold">{{ auth.user?.name || '未登录' }}</div>
							<div class="text-caption text-grey-darken-1">
								学号 {{ auth.user?.student_number || '-' }}
							</div>
							<v-chip
								v-if="auth.user?.isadmin"
								size="x-small"
								color="amber-darken-2"
								variant="tonal"
								class="mt-1"
							>管理员</v-chip>
						</div>
					</div>

					<!-- 隐藏的 file input -->
					<input
						ref="avatarInput"
						type="file"
						accept="image/*"
						style="display: none;"
						@change="onAvatarPick"
					/>
				</v-card>

				<!-- 偏好设置 -->
				<v-list class="rounded-xl mb-4" lines="two">
					<v-list-item
						title="主题色"
						subtitle="浅粉色"
						prepend-icon="mdi-palette-outline"
						append-icon="mdi-chevron-right"
					></v-list-item>
					<v-list-item
						title="货币"
						subtitle="CNY"
						prepend-icon="mdi-currency-cny"
						append-icon="mdi-chevron-right"
					></v-list-item>
					<v-list-item
						title="导出数据"
						subtitle="导出全部物品 JSON"
						prepend-icon="mdi-database-export-outline"
						append-icon="mdi-chevron-right"
					></v-list-item>
					<v-list-item
						title="关于 OneDay"
						subtitle="v0.1.0"
						prepend-icon="mdi-information-outline"
						append-icon="mdi-chevron-right"
					></v-list-item>
				</v-list>

				<!-- 退出登录 -->
				<v-btn
					block
					size="large"
					color="grey-darken-1"
					variant="outlined"
					rounded="lg"
					@click="confirmLogout = true"
				>
					<v-icon icon="mdi-logout" class="mr-2"></v-icon>
					退出登录
				</v-btn>

				<v-dialog v-model="confirmLogout" max-width="320">
					<v-card class="rounded-xl pa-4">
						<div class="text-subtitle-1 font-weight-bold mb-2">确认退出登录？</div>
						<div class="text-caption text-grey-darken-1 mb-4">
							退出后需要重新输入学号和密码
						</div>
						<div class="d-flex justify-end">
							<v-btn variant="text" @click="confirmLogout = false">取消</v-btn>
							<v-btn color="pink-lighten-1" variant="flat" @click="handleLogout">退出</v-btn>
						</div>
					</v-card>
				</v-dialog>

				<v-snackbar v-model="snack.show" :color="snack.color" :timeout="2500">
					{{ snack.msg }}
				</v-snackbar>
			</v-container>
		</div>
	`,
	setup() {
		const router = VueRouter.useRouter();
		const auth   = useAuthStore();

		const avatarInput = ref(null);
		const uploading   = ref(false);
		const confirmLogout = ref(false);
		const snack = reactive({ show: false, msg: "", color: "success" });

		const avatarInitial = computed(() =>
			(auth.user?.name || auth.user?.student_number || "?").trim().slice(0, 1).toUpperCase()
		);

		function tip(msg, color = "success") {
			snack.msg = msg; snack.color = color; snack.show = true;
		}

		function triggerAvatarPick() {
			if (uploading.value) return;
			avatarInput.value?.click();
		}

		async function onAvatarPick(e) {
			const file = e.target.files?.[0];
			e.target.value = ""; // 清空，方便选同一文件
			if (!file) return;
			if (!file.type.startsWith("image/")) { tip("请选择图片文件", "error"); return; }
			if (file.size > 5 * 1024 * 1024) { tip("图片大小不能超过 5MB", "error"); return; }

			uploading.value = true;
			try {
				// 1. 上传到 /api/avatar/upload，拿到 url
				const fd = new FormData();
				fd.append("file", file);
				const r1 = await authFetch("/api/avatar/upload", { method: "POST", body: fd });
				const j1 = await r1.json();
				if (j1.code !== 200) { tip(j1.message || "上传失败", "error"); return; }

				// 2. 把 url 写回 students.avatar
				const r2 = await authFetch("/api/me/avatar", {
					method: "PATCH",
					json: { avatar: j1.data.url },
				});
				const j2 = await r2.json();
				if (j2.code !== 200) { tip(j2.message || "保存失败", "error"); return; }

				// 3. 同步到本地 store（Home 顶部头像立刻更新）
				auth.patchUser({ avatar: j1.data.url });
				tip("头像已更新");
			} catch (e) {
				tip(e.message || "网络错误", "error");
			} finally {
				uploading.value = false;
			}
		}

		function handleLogout() {
			auth.logout();
			confirmLogout.value = false;
			router.replace({ name: "login" });
		}

		return {
			auth, avatarInitial, avatarInput, uploading,
			confirmLogout, snack,
			triggerAvatarPick, onAvatarPick, handleLogout,
		};
	},
};
