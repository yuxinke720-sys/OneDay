# OneDay — Claude 指南

物品生命周期记录 app（Bun + Elysia + PostgreSQL + Vue 3 + Vuetify）。
共用 student-servertest-main 的 `students` 表做学生鉴权（共用 `student_db`）。

---

## 🔒 运行环境硬约束（必读）

**作业会在学校特定电脑上运行。运行环境是固定的便携工具链，不能下载/安装任何新东西**：

- bun（位于 `bun-windows-x64\`，双击 `StartBun.bat` 打开控制台）
- PostgreSQL 18 portable（位于 `postgresql-18.1-2-windows-x64-binaries\`，双击 `startPG.bat` 启动）
- 浏览器（任意，备用 `catsxp_portable_x64_release_148_6_5_3`）
- 可选：HBuilderX-5（IDE）、Navicat Premium（DB 前端）、GitHub Desktop（拉代码）

**写代码时必须遵守**：
1. **后端只能用 `server/package.json` 里已列的 5 个依赖** +
   Bun 自带的 Node 标准库（`node:crypto`、`node:fs`、`node:path`、`node:fs/promises` 等）。
   严禁引入新的 npm 包（如 crypto-js、jsonwebtoken、bcrypt 等）—— 学校机器跑不了。
2. **前端 vendor 库全部 vendored 在 `server/public/`**（vue / vuetify / pinia / crypto-js / vue-router / vue-demi / material design icons），
   不走 CDN，不走 npm。新需要的库要么找替代，要么自己实现。
3. **DB schema 变更必须写成幂等迁移**（追加到 `server/migrate.ts`，全部 `IF NOT EXISTS` / `ON CONFLICT`），
   不能让 Windows 端跑 `init-db.ts`（那会 DROP 表丢数据）。

---

## 项目结构

```
server/
├── index.ts            后端 API（Elysia）
├── db.ts               PG 连接（默认 student_db）
├── init-db.ts          ⚠️ 危险：DROP + CREATE，只供首次部署
├── migrate.ts          ✅ 安全：幂等增量迁移，升级老机器用
├── package.json        依赖白名单
└── public/             前端 SPA（单 HTML + 多组件 JS）
    ├── index.html      路由、Pinia、Vuetify 装配；路由守卫；底部 nav
    ├── Auth.js         auth store + AES + authFetch + 401 拦截
    ├── Login.js / Register.js / Home.js / ItemAdd.js / ItemDetail.js / Settings.js / Library.js / Charts.js
    └── vue-* / vuetify-* / pinia-* / crypto-js-* / font-* / vue-demi-* / vue-router-*   ← vendored 库
```

## 启动（Windows 学校机器）

```
1. 双击 postgresql-18.1-2-windows-x64-binaries\startPG.bat（等到日志显示 "listening on ... port 5432"）
2. 双击 bun-windows-x64\StartBun.bat 打开控制台
3. cd "D:\AAAA jhb\Js-Ts-Pg-全栈\bun-windows-x64\OneDay\server"
4. 首次或 schema 有变更：bun run migrate
5. bun run dev
6. 浏览器开 http://localhost:3000，用 S20260530 / 123456 登录
```

## 数据库

- 库名：`student_db`（与 student-servertest-main 共享）
- 关键表：`students`（共享 +  自加列 `password`/`isadmin`/`avatar`）、`items`、`events`、`images`、`sub_items`、`tags`
- admin 账号：学号 `S20260530`，AES 密文 `QEwd/DWmy/4yGncCqBofQQ==`（明文 `123456`），由 `migrate.ts` 创建
- 鉴权：HS256 JWT（`node:crypto` 实现，跨项目共用 KEY `1234567890123456`），所有 `/api/items*` `/api/dashboard` 等按 `user_id` 隔离

## 常用调试

```bash
# 后端冒烟（curl）
TOKEN=$(curl -s -X POST http://localhost:3000/api/Login \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"S20260530","password":"QEwd/DWmy/4yGncCqBofQQ=="}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/items | head -c 200
```

---

## 🗣️ 对话约定（给 Claude）

**每次对话的最后一句，必须以这一行结尾**（一字不差，包含引号）：

> "我完成了 运河儿"
