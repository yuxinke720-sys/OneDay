# OneDay Web

OneDay 前端（H5 移动端）。Vue3 + Vant4 + Pinia + Vite。

## 环境

- [Bun](https://bun.com) ≥ 1.3（macOS/Win/Linux 一致命令）

## 启动

```bash
# 1. 安装依赖
bun install

# 2. 启动开发服务
bun run dev
```

默认监听 `http://localhost:5173`，会自动反向代理 `/api`、`/uploads`、`/health` 到 `http://localhost:3000`（后端）。

**真机调试**：终端启动后会显示 `Network: http://192.168.x.x:5173`，手机连同一 Wi-Fi 用 Safari 打开即可。

## 目录

```
web/
├── index.html
├── vite.config.ts       # 反代 /api、/uploads
├── src/
│   ├── main.ts          # 注册 Vue, Pinia, Router, Vant Lazyload
│   ├── App.vue          # 套 AppLayout
│   ├── api/             # axios 封装 + 接口
│   │   ├── client.ts
│   │   ├── dashboard.ts
│   │   └── items.ts
│   ├── router/index.ts
│   ├── components/
│   │   └── AppLayout.vue   # 悬浮胶囊导航 + 黑色 FAB
│   ├── views/
│   │   ├── Home.vue         # 5 层结构的首页
│   │   ├── _HomeStatusPill.vue
│   │   ├── Library.vue      # 物品库（stub）
│   │   ├── Charts.vue       # 图表（stub，后续接 ECharts）
│   │   ├── Settings.vue     # 设置
│   │   ├── ItemAdd.vue      # 添加物品（stub）
│   │   └── ItemDetail.vue   # 详情（stub）
│   └── styles/main.css      # 全局重置 + 主题色 CSS 变量
└── package.json
```

## 主题

主题色全部走 [src/styles/main.css](src/styles/main.css) 的 CSS 变量定义，未来在「设置」页可以接入主题切换，只需要动态改 `:root` 的几个 token：

- `--bg-grad-start/mid/end`：顶部氛围层渐变
- `--accent-pink`：高亮强调色
- `--status-using/retired/sold`：三种生命周期状态色

## 未来多端

H5 跑通后，加 Capacitor 即可包出 iOS / Android：

```bash
bun add -D @capacitor/cli @capacitor/core
bunx cap init
bunx cap add ios
bunx cap add android
```

所有 Vue / Vant 代码无需改动。
