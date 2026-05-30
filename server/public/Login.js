// Login.js —— 登录页
// 学号 + 密码（前端 AES 加密后提交），成功后写入 authStore 并跳到首页
const Login = {
	template: `
		<div class="auth-bg d-flex align-center justify-center pa-4">
			<v-card class="auth-card rounded-xl pa-2" elevation="10">
				<div class="text-center pt-6 pb-2">
					<div class="auth-logo mx-auto mb-3">
						<v-icon icon="mdi-clock-check-outline" size="36" color="white"></v-icon>
					</div>
					<div class="text-h5 font-weight-bold">OneDay</div>
					<div class="text-caption text-grey-darken-1">记录每一件物品的真实使用成本</div>
				</div>

				<v-card-text class="pt-4">
					<v-form ref="formRef" v-model="formValid" @submit.prevent="handleLogin">
						<v-text-field
							v-model="form.studentId"
							label="学号"
							placeholder="例如：S20260530"
							prepend-inner-icon="mdi-account-outline"
							variant="outlined"
							density="comfortable"
							:rules="[v => !!v || '学号不能为空']"
							autocomplete="username"
							:disabled="loading"
						></v-text-field>

						<v-text-field
							v-model="form.password"
							label="密码"
							placeholder="请输入密码"
							prepend-inner-icon="mdi-lock-outline"
							:append-inner-icon="showPwd ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
							:type="showPwd ? 'text' : 'password'"
							variant="outlined"
							density="comfortable"
							:rules="[
								v => !!v || '密码不能为空',
								v => (v && v.length >= 6) || '密码至少 6 位',
							]"
							autocomplete="current-password"
							:disabled="loading"
							@click:append-inner="showPwd = !showPwd"
							@keyup.enter="handleLogin"
						></v-text-field>

						<div class="d-flex align-center justify-space-between mb-2">
							<v-checkbox
								v-model="remember"
								label="记住学号"
								density="compact"
								hide-details
								color="pink-lighten-1"
							></v-checkbox>
							<v-btn variant="text" size="small" color="pink-lighten-1" @click="goRegister">
								没有账号？注册
							</v-btn>
						</div>

						<v-btn
							block
							size="large"
							color="pink-lighten-1"
							variant="flat"
							rounded="lg"
							class="auth-cta font-weight-bold mt-2"
							:loading="loading"
							:disabled="!formValid || loading"
							@click="handleLogin"
						>登 录</v-btn>
					</v-form>
				</v-card-text>

				<v-snackbar v-model="snack.show" :color="snack.color" :timeout="2500">
					{{ snack.msg }}
				</v-snackbar>
			</v-card>
		</div>
	`,
	setup() {
		const router = VueRouter.useRouter();
		const auth   = useAuthStore();

		const formRef   = ref(null);
		const formValid = ref(false);
		const loading   = ref(false);
		const showPwd   = ref(false);
		const remember  = ref(true);
		const form      = reactive({ studentId: "", password: "" });
		const snack     = reactive({ show: false, msg: "", color: "success" });

		const STUDENT_KEY = "oneday_remember_student";

		function tip(msg, color = "success") {
			snack.msg = msg;
			snack.color = color;
			snack.show = true;
		}

		function goRegister() {
			router.push({ name: "register" });
		}

		async function handleLogin() {
			const ok = await formRef.value?.validate();
			if (!ok?.valid) return;

			loading.value = true;
			try {
				const encryptedPwd = aesEncrypt(form.password);
				const r = await fetch("/api/Login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						studentId: form.studentId,
						password:  encryptedPwd,
					}),
				});
				const j = await r.json();
				if (j.code !== 200) {
					tip(j.message || "登录失败", "error");
					return;
				}
				auth.setAuth(j.data.token, j.data.expiresIn, j.data.student);
				if (remember.value) {
					localStorage.setItem(STUDENT_KEY, form.studentId);
				} else {
					localStorage.removeItem(STUDENT_KEY);
				}
				tip(`欢迎 ${j.data.student.name}`, "success");
				setTimeout(() => router.replace({ name: "home" }), 400);
			} catch (e) {
				tip(e.message || "网络错误", "error");
			} finally {
				loading.value = false;
			}
		}

		onMounted(() => {
			// 自动填充上次的学号
			const saved = localStorage.getItem(STUDENT_KEY);
			if (saved) form.studentId = saved;
		});

		return { formRef, formValid, loading, showPwd, remember, form, snack, handleLogin, goRegister };
	},
};
