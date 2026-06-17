# OneDay · 物品生命周期追踪

记录你拥有的每一件物品，从买入到日常使用、保养、维修、出售的完整生命周期。
基于 **Bun + Elysia + PostgreSQL + Vue 3 + Vuetify**，跨平台（macOS / Windows / Linux）。

与 `student-servertest-main`（学生信息管理系统）**共用同一个数据库 `student_db` 与 `students` 表**做学生鉴权。

## 目录结构

```
OneDay/
└── server/                后端 API + 前端（同一个服务，端口 3000）
    ├── index.ts           Elysia 后端 API
    ├── db.ts              PostgreSQL 连接（读 .env）
    ├── migrate.ts         ✅ 安全：幂等迁移（建库 + 升级二合一）
    ├── init-db.ts         ⚠️ 危险：DROP + 重建，仅首次部署用，会清空数据
    └── public/            前端 SPA（Vue/Vuetify/Pinia 等库已 vendored 在此，不走 CDN/npm）
```

> 前端不再是独立的 `web/` 目录，已整合进后端的 `public/`，由 :3000 一并提供。

## 一、环境要求

- **Bun ≥ 1.3**
  - macOS / Linux：`curl -fsSL https://bun.sh/install | bash`
  - Windows (PowerShell)：`irm bun.sh/install.ps1 | iex`
  - 学校机房：用便携版 `bun-windows-x64`，双击 `StartBun.bat` 开控制台
- **PostgreSQL ≥ 13**
  - macOS：[Postgres.app](https://postgresapp.com)
  - Windows：官方安装包，或便携版 `postgresql-...-windows-x64-binaries`，双击 `startPG.bat` 启动

## 二、配置 .env

进入 `server/`，从模板复制一份再填写：

```bash
cp .env.example .env            # macOS / Linux
copy .env.example .env          # Windows cmd
Copy-Item .env.example .env     # Windows PowerShell
```

打开 `.env`，填两处关键配置：

```
DB_PASSWORD=你的postgres密码
DB_NAME=student_db
```

> 作用：后端 `db.ts` 靠这两项连上本机数据库。密码每台机器不同、且属敏感信息，所以抽到
> `.env` 里（不入 git），换机器只改这一个文件。填错会报「password authentication failed」
> 或「database does not exist」。

## 三、准备数据库（二选一）

### 方式 A：导入现成数据（推荐，含结构 + 数据）

适用于「我这边已经有数据，想让新机器/老师拿到一模一样的库」。用 PostgreSQL 自带的
`pg_dump` / `psql`（便携版在 `...\pgsql\bin` 目录里，先 `cd` 进去再执行）。

**① 导出（在你自己机器上，交作业前做一次）**

```bat
cd /d 你的\postgresql...\pgsql\bin
pg_dump -U postgres -f student_db_backup.sql student_db
```

会提示 `Password:`，输入 postgres 密码（输入时不显示）。生成的 `student_db_backup.sql`
复制到项目文件夹，随代码一并交付。

**② 导入（新机器 / 老师那边做）**

```bat
cd /d 新机器\postgresql...\pgsql\bin
createdb -U postgres student_db
psql -U postgres -d student_db < 路径\student_db_backup.sql
```

`createdb` 若提示「already exists」忽略即可，直接跑下一条。

**导入方式 A 的优点**：开箱即用（含 admin 账号和真实数据，无需造数据）、结构+数据一次到位、
可复现、不依赖迁移脚本跑通、纯文本跨机器跨版本、本身也是一份备份。

> ⚠️ 导入后**不要**再执行 `bun run init-db`，否则会 DROP 清空刚导入的数据。

### 方式 B：脚本建库（全新机器、不需要现成数据）

```bash
cd server
bun run migrate        # 幂等：建缺的表 + 补缺的列 + 建 admin 账号，不删数据
```

`migrate` 既能在全新机器从零建表，也能在老库上安全升级。**升级请始终用它，不要用 init-db。**

## 四、启动

```bash
cd server
bun install            # 首次安装依赖
bun run dev            # 启动 :3000
```

浏览器打开 [http://localhost:3000](http://localhost:3000) ✨

## 五、登录

- 管理员账号：学号 **`S20260530`**，密码 **`123456`**
- 登录页有一个 **「演示登录（管理员）」** 按钮，点一下自动填入上述账号并登录，
  换环境演示或老师检查时无需手动输入。

## 六、跨机注意

- **数据库不自动同步**：每台机器的 PostgreSQL 各自独立。要把数据带到另一台，用上面的
  方式 A（`pg_dump` 导出 → `psql` 导入）。
- **代码同步走 Git**：改完 `git push`，另一边 `git pull`。
- **`.env` 不入仓**：每台机器首次都要从 `.env.example` 复制一份再填密码。
- **上传图片不入仓**：`server/uploads/` 已 gitignore，需要带走的话走 `pg_dump` 方案。

## 七、更详细的说明

- [server/README.md](server/README.md) — 后端 API 速查
