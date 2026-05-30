// Register.js —— 注册页（学号 + 姓名 + 密码 + 可选邮箱/手机）
// 与 student-servertest-main /api/addStudents 完全兼容
const Register = {
	template: `
		<div class="auth-bg d-flex align-center justify-center pa-4">
			<v-card class="auth-card rounded-xl pa-2" elevation="10">
				<div class="text-center pt-6 pb-2">
					<div class="auth-logo mx-auto mb-3" style="background: linear-gradient(135deg, #ff9eb5, #ff7f9d);">
						<v-icon icon="mdi-account-plus-outline" size="36" color="white"></v-icon>
					</div>
					<div class="text-h5 font-weight-bold">注册新账号</div>
					<div class="text-caption text-grey-darken-1">用学号注册，两个项目都能登录</div>
				</div>

				<v-card-text class="pt-4">
					<v-form ref="formRef" v-model="formValid">
						<v-text-field
							v-model="form.studentId"
							label="学号"
							placeholder="例如：S20260601"
							prepend-inner-icon="mdi-card-account-details-outline"
							variant="outlined"
							density="comfortable"
							:rules="[
								v => !!v || '学号不能为空',
								v => /^S\\d+$/.test(v) || '学号需以 S 开头后跟数字',
							]"
							:disabled="loading"
						></v-text-field>

						<v-text-field
							v-model="form.name"
							label="姓名"
							prepend-inner-icon="mdi-account-outline"
							variant="outlined"
							density="comfortable"
							:rules="[v => !!v || '姓名不能为空']"
							:disabled="loading"
						></v-text-field>

						<v-text-field
							v-model="form.password"
							label="密码"
							placeholder="6-20 位"
							prepend-inner-icon="mdi-lock-outline"
							:append-inner-icon="showPwd ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
							:type="showPwd ? 'text' : 'password'"
							variant="outlined"
							density="comfortable"
							:rules="[
								v => !!v || '密码不能为空',
								v => (v && v.length >= 6) || '至少 6 位',
								v => (v && v.length <= 20) || '不超过 20 位',
							]"
							:disabled="loading"
							@click:append-inner="showPwd = !showPwd"
						></v-text-field>

						<v-text-field
							v-model="form.password2"
							label="确认密码"
							prepend-inner-icon="mdi-lock-check-outline"
							:type="showPwd ? 'text' : 'password'"
							variant="outlined"
							density="comfortable"
							:rules="[v => v === form.password || '两次输入不一致']"
							:disabled="loading"
						></v-text-field>

						<v-text-field
							v-model="form.email"
							label="邮箱（可选）"
							prepend-inner-icon="mdi-email-outline"
							variant="outlined"
							density="comfortable"
							:disabled="loading"
						></v-text-field>

						<v-text-field
							v-model="form.phone"
							label="手机（可选）"
							prepend-inner-icon="mdi-phone-outline"
							variant="outlined"
							density="comfortable"
							:disabled="loading"
						></v-text-field>

						<v-btn
							block
							size="large"
							color="pink-lighten-1"
							variant="flat"
							rounded="lg"
							class="auth-cta font-weight-bold mt-2"
							:loading="loading"
							:disabled="!formValid || loading"
							@click="handleRegister"
						>注 册</v-btn>

						<div class="text-center mt-3">
							<v-btn variant="text" size="small" color="grey-darken-1" @click="goLogin">
								已有账号？返回登录
							</v-btn>
						</div>
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

		const formRef   = ref(null);
		const formValid = ref(false);
		const loading   = ref(false);
		const showPwd   = ref(false);
		const form = reactive({
			studentId: "", name: "", password: "", password2: "", email: "", phone: "",
		});
		const snack = reactive({ show: false, msg: "", color: "success" });

		function tip(msg, color = "success") {
			snack.msg = msg;
			snack.color = color;
			snack.show = true;
		}
		function goLogin() { router.push({ name: "login" }); }

		async function handleRegister() {
			const ok = await formRef.value?.validate();
			if (!ok?.valid) return;

			loading.value = true;
			try {
				const encryptedPwd = aesEncrypt(form.password);
				const r = await fetch("/api/addStudents", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						studentId: form.studentId,
						name:      form.name,
						gender:    "O",
						birthday:  null,
						email:     form.email || null,
						phone:     form.phone || null,
						password:  encryptedPwd,
						isadmin:   false,
					}),
				});
				const j = await r.json();
				if (j.code === 409) { tip("学号或邮箱已被占用", "error"); return; }
				if (j.code !== 200) { tip(j.message || "注册失败", "error"); return; }
				tip("注册成功，正在登录…", "success");
				setTimeout(() => router.replace({ name: "login" }), 800);
			} catch (e) {
				tip(e.message || "网络错误", "error");
			} finally {
				loading.value = false;
			}
		}

		return { formRef, formValid, loading, showPwd, form, snack, handleRegister, goLogin };
	},
};
