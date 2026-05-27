# OneDay Server

基于 [Bun](https://bun.com) + [Elysia](https://elysiajs.com) + PostgreSQL 的「物品生命周期追踪」后端 API。跨平台（macOS / Windows / Linux）。

## 一、环境要求

- [Bun](https://bun.com) ≥ 1.3
  - macOS：`curl -fsSL https://bun.sh/install | bash`
  - Windows（PowerShell）：`irm bun.sh/install.ps1 | iex`
- PostgreSQL ≥ 13

## 二、初始化

```bash
# 1. 安装依赖
bun install

# 2. 修改 .env 里的 DB_* 字段，确保能连上 PostgreSQL

# 3. 一键建表 + 种子数据
bun run init-db
```

## 三、启动

```bash
bun run dev      # 推荐：监听文件变化自动重启
bun run start    # 一次性启动
```

服务跑在 `http://localhost:3000`，验证：

```
http://localhost:3000/health         → {"code":200,"data":"ok"}
http://localhost:3000/api/items      → 返回物品列表
http://localhost:3000/api/dashboard  → 首页看板
```

## 四、目录结构

```
server/
├── .env              # DB / PORT 配置（不入仓）
├── db.ts             # Postgres 连接池
├── index.ts          # 全部 REST API 路由
├── init-db.ts        # 建表 + 种子数据
├── uploads/          # 上传图片的存储目录（按年-月分子目录）
│   └── 2026-05/
│       └── <uuid>.jpg
└── package.json
```

## 五、数据模型概览

```
items（物品）─┬─< events（事件：购入/使用/维修/保养/消耗品/出售）
             ├─< images（图片元信息 → 磁盘 uploads/）
             └─< item_tags >─ tags（标签）
```

- **events 表是统计核心**：日均成本、单次成本都从这里聚合。
- **images 表只存路径**：图片字节本身在 `uploads/<YYYY-MM>/<uuid>.<ext>`。

## 六、API 速查

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET`    | `/health` | 健康检查 |
| `GET`    | `/api/items?q=&category=&status=&page=1&size=20` | 列表 |
| `GET`    | `/api/items/:id` | 详情（含图片）|
| `POST`   | `/api/items` | 新增（自动创建 purchase 事件）|
| `PATCH`  | `/api/items/:id` | 编辑 |
| `DELETE` | `/api/items/:id` | 删除（级联 events/images）|
| `GET`    | `/api/items/:id/events` | 时间轴 |
| `POST`   | `/api/items/:id/events` | 记录事件 |
| `DELETE` | `/api/events/:id` | 删事件 |
| `GET`    | `/api/items/:id/stats` | 单品日均成本 / 单次成本 |
| `GET`    | `/api/dashboard` | 首页看板（最常用 / 最久不用 / 性价比 Top）|
| `POST`   | `/api/images` | multipart 上传图片 |
| `DELETE` | `/api/images/:id` | 删图（同步删磁盘文件）|
| `GET`    | `/api/tags` | 标签列表 |

## 七、跨平台说明

- 文件路径全用 POSIX 风格 (`./uploads/...`)，Bun 自动适配 Windows 反斜杠。
- 项目根 `.gitattributes` 强制 LF 行尾，Mac/Win 切换 diff 不炸。
- `uploads/` 内容不入仓，仅保留 `.gitkeep` 占位。
