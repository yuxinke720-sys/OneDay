# OneDay · 物品生命周期追踪

记录你拥有的每一件物品，从买入到日常使用、保养、维修、出售的完整生命周期。
基于 Bun + Elysia + PostgreSQL + Vue3 + Vant4，跨平台（macOS / Windows / Linux）。

## 目录结构

```
OneDay/
├── server/    后端 API（端口 3000）
└── web/       前端 H5（端口 5173）
```

## 一、环境准备（Mac + Windows 都用同一个项目）

### 装 Bun

| 平台 | 命令 |
|---|---|
| macOS / Linux | `curl -fsSL https://bun.sh/install \| bash` |
| Windows (PowerShell) | `irm bun.sh/install.ps1 \| iex` |

### 装 PostgreSQL

| 平台 | 方式 |
|---|---|
| macOS | [Postgres.app](https://postgresapp.com)（一拖即装，自动启动）|
| Windows | [官方安装包](https://www.postgresql.org/download/windows/)（装时记住密码）|

装完后**新建一个空数据库**（DBeaver 里右键 Databases → Create New Database 也行）：

```sql
CREATE DATABASE oneday;
```

## 日常启动（已经搭好环境后）

**Windows**（3 个动作）：
1. 双击 `postgresql-.../startPG.bat` 启动 PG
2. 双击 `bun-windows-x64/StartBun.bat` → 进 server → `bun start`
3. 再双击 `StartBun.bat` → 进 web → `bun run dev`
4. 浏览器 http://localhost:5173

**macOS**（PG 已自启）：
```bash
# 终端 1
cd server && bun run dev
# 终端 2
cd web && bun run dev
```

## 二、首次运行

```bash
# 1. clone 项目
git clone <你的仓库地址>
cd OneDay

# 2. 后端
cd server
bun install --ignore-scripts     # ⚠️ Windows 必须加 --ignore-scripts
cp .env.example .env             # mac/linux
# Copy-Item .env.example .env    # windows powershell
# 编辑 .env，填上 DB_PASSWORD 和 DB_NAME=oneday

bun run init-db                  # 建表 + 5 件种子数据
bun run dev                      # 启动 :3000

# 3. 前端（开新终端）
cd ../web
bun install --ignore-scripts     # ⚠️ Windows 必须加 --ignore-scripts
bun run dev                      # 启动 :5173
```

### 为什么 `--ignore-scripts`？

某些 npm 包（esbuild、vue-demi 等）会在安装时跑 `node xxx.js` 的 postinstall
脚本——而 Windows 课程环境只装了 Bun、没装 Node.js。`--ignore-scripts`
让 Bun 跳过这些脚本，二进制依赖照样能正确安装。Mac 上加不加都不影响。

浏览器打开 [http://localhost:5173](http://localhost:5173) ✨

## 三、跨机注意

- **数据库不会自动同步**：每台机器的 PostgreSQL 是独立的，你在 Mac 上加的物品 Windows 看不到（这是当前选择的方案 A，省事但要分别 init）
- **代码同步走 Git**：改完任一边 → `git push` → 另一边 `git pull`
- **.env 不会入仓**：每台机器首次都要从 `.env.example` 复制一份再填密码
- **上传图片不会入仓**：`server/uploads/` 已 gitignore，所以加过的图片不会跟着 git 一起跑到另一台机器（如果要带过去，看 `pg_dump` 同步方案或后续上云）

## 四、可选：以后想真同步

升级到方案 C（云数据库）只需要 3 步：
1. 去 [Supabase](https://supabase.com) 或 [Neon](https://neon.tech) 申请免费 PostgreSQL，拿到一段 `DATABASE_URL`
2. 改 [server/.env](server/.env) 把 `DB_HOST/PORT/USER/PASSWORD/NAME` 删掉，换成单行 `DATABASE_URL=...`
3. 改 [server/db.ts](server/db.ts) 优先读 `DATABASE_URL`

Mac 和 Windows 此时指向同一个云库，数据真同步。

## 五、目录里更详细的说明

- [server/README.md](server/README.md) — 后端 API 速查
- [web/README.md](web/README.md) — 前端目录结构 + 未来 Capacitor 多端
