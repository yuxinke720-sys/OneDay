// Settings.js —— 设置

const Settings = {
	template: `
		<div>
			<v-app-bar color="transparent" flat>
				<v-app-bar-title>设置</v-app-bar-title>
			</v-app-bar>
			<v-container>
				<v-list class="rounded-xl" lines="one">
					<v-list-item title="主题色"     subtitle="浅粉色"     append-icon="mdi-chevron-right"></v-list-item>
					<v-list-item title="货币"       subtitle="CNY"        append-icon="mdi-chevron-right"></v-list-item>
					<v-list-item title="导出数据"                          append-icon="mdi-chevron-right"></v-list-item>
					<v-list-item title="关于 OneDay" subtitle="v0.0.1"     append-icon="mdi-chevron-right"></v-list-item>
				</v-list>
			</v-container>
		</div>
	`,
};
