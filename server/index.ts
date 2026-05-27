// index.ts —— OneDay 后端 REST API
//   bun run dev    # 热重载
//   bun run start  # 一次性启动

import { Elysia, t } from 'elysia';
import cors from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { config } from 'dotenv';
import { sql } from './db';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

config();

const UPLOADS_DIR = './uploads';
const PUBLIC_DIR  = './public';
await mkdir(UPLOADS_DIR, { recursive: true });

const app = new Elysia()
  .use(cors({ origin: '*' }))
  // 静态资源：前端页面 + vendor 库（Vue / Vuetify / Pinia 等）
  .use(staticPlugin({ assets: PUBLIC_DIR, prefix: '/public' }))
  // 上传图片
  .use(staticPlugin({ assets: UPLOADS_DIR, prefix: '/uploads' }))
  // 根路径返回首页（前端单页入口）
  .get('/', () => Bun.file('./public/index.html'))
  .get('/health', () => ({ code: 200, data: 'ok' }))

  // ========== Items ==========
  .get('/api/items', async ({ query }) => {
    const q        = (query.q        as string) || '';
    const category = (query.category as string) || '';
    const status   = (query.status   as string) || '';
    const sort     = (query.sort     as string) || 'updated';
    const page = Math.max(1, parseInt((query.page as string) || '1'));
    const size = Math.min(100, Math.max(1, parseInt((query.size as string) || '20')));
    const offset = (page - 1) * size;

    // 排序：按 sort 参数选择 ORDER BY 片段，避免 SQL 注入
    const orderBy =
      sort === 'price'       ? sql`ORDER BY i.purchase_price   DESC` :
      sort === 'acquisition' ? sql`ORDER BY i.acquisition_date DESC` :
      sort === 'daily_cost'  ? sql`ORDER BY daily_cost          DESC NULLS LAST` :
                               sql`ORDER BY i.updated_at        DESC`;

    const rows = await sql`
      SELECT
        i.*,
        img.url AS cover_url,
        GREATEST((CURRENT_DATE - i.acquisition_date)::int, 1) AS days_owned,
        ROUND(
          (i.purchase_price + COALESCE(extra.amount, 0))
          / GREATEST((CURRENT_DATE - i.acquisition_date)::int, 1),
          2
        ) AS daily_cost,
        COALESCE(usage_agg.count, 0)::int AS use_count
      FROM items i
      LEFT JOIN images img ON img.id = i.cover_image_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS amount
        FROM events
        WHERE item_id = i.id
          AND type IN ('repair','maintenance','consumable')
      ) extra ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(quantity) AS count
        FROM events
        WHERE item_id = i.id AND type = 'usage'
      ) usage_agg ON TRUE
      WHERE (${q} = '' OR i.name ILIKE ${'%' + q + '%'})
        AND (${category} = '' OR i.category = ${category})
        AND (${status}   = '' OR i.status   = ${status})
      ${orderBy}
      LIMIT ${size} OFFSET ${offset}
    `;
    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM items
      WHERE (${q} = '' OR name ILIKE ${'%' + q + '%'})
        AND (${category} = '' OR category = ${category})
        AND (${status}   = '' OR status   = ${status})
    `;
    const total = Number(countRows[0]?.count ?? 0);
    return { code: 200, data: { rows, page, size, total } };
  })

  .get('/api/items/:id', async ({ params }) => {
    const id = Number(params.id);
    const [item] = await sql`SELECT * FROM items WHERE id = ${id}`;
    if (!item) return { code: 404, message: 'Item not found' };
    const images = await sql`
      SELECT * FROM images WHERE item_id = ${id} ORDER BY sort_order, id
    `;
    return { code: 200, data: { ...item, images } };
  })

  .post('/api/items', async ({ body }) => {
    const b = body as any;
    const inserted = await sql`
      INSERT INTO items (name, category, acquisition_date, purchase_price, currency, status, notes)
      VALUES (
        ${b.name},
        ${b.category ?? null},
        ${b.acquisition_date ?? new Date().toISOString().slice(0, 10)},
        ${b.purchase_price ?? 0},
        ${b.currency ?? 'CNY'},
        ${b.status ?? 'using'},
        ${b.notes ?? null}
      )
      RETURNING *
    `;
    const row = inserted[0];
    if (!row) return { code: 500, message: 'Insert returned no row' };
    // 自动生成购入事件
    await sql`
      INSERT INTO events (item_id, type, occurred_at, amount, description)
      VALUES (${row.id}, 'purchase', ${row.acquisition_date}, ${row.purchase_price}, '购入')
    `;
    return { code: 200, data: row };
  })

  .patch('/api/items/:id', async ({ params, body }) => {
    const id = Number(params.id);
    const b = body as any;
    const [row] = await sql`
      UPDATE items SET
        name             = COALESCE(${b.name             ?? null}, name),
        category         = COALESCE(${b.category         ?? null}, category),
        acquisition_date = COALESCE(${b.acquisition_date ?? null}, acquisition_date),
        purchase_price   = COALESCE(${b.purchase_price   ?? null}, purchase_price),
        currency         = COALESCE(${b.currency         ?? null}, currency),
        status           = COALESCE(${b.status           ?? null}, status),
        cover_image_id   = COALESCE(${b.cover_image_id   ?? null}, cover_image_id),
        notes            = COALESCE(${b.notes            ?? null}, notes)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return { code: 404, message: 'Item not found' };
    return { code: 200, data: row };
  })

  .delete('/api/items/:id', async ({ params }) => {
    const id = Number(params.id);
    const rows = await sql`DELETE FROM items WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return { code: 404, message: 'Item not found' };
    return { code: 200, data: { deleted: rows.length } };
  })

  // ========== Events ==========
  .get('/api/items/:id/events', async ({ params }) => {
    const id = Number(params.id);
    const rows = await sql`
      SELECT * FROM events WHERE item_id = ${id} ORDER BY occurred_at DESC, id DESC
    `;
    return { code: 200, data: rows };
  })

  .post('/api/items/:id/events', async ({ params, body }) => {
    const id = Number(params.id);
    const b = body as any;
    const [row] = await sql`
      INSERT INTO events (item_id, type, occurred_at, amount, quantity, description, metadata)
      VALUES (
        ${id},
        ${b.type},
        ${b.occurred_at ?? new Date().toISOString()},
        ${b.amount   ?? 0},
        ${b.quantity ?? 1},
        ${b.description ?? null},
        ${sql.json(b.metadata ?? {})}
      )
      RETURNING *
    `;
    return { code: 200, data: row };
  })

  .delete('/api/events/:id', async ({ params }) => {
    const id = Number(params.id);
    const rows = await sql`DELETE FROM events WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return { code: 404, message: 'Event not found' };
    return { code: 200, data: { deleted: rows.length } };
  })

  // ========== Stats ==========
  .get('/api/items/:id/stats', async ({ params }) => {
    const id = Number(params.id);
    const [stats] = await sql`
      SELECT
        i.id, i.name, i.purchase_price, i.acquisition_date,
        GREATEST((CURRENT_DATE - i.acquisition_date)::int, 1) AS days_owned,
        COALESCE(SUM(CASE WHEN e.type IN ('repair','maintenance','consumable')
                          THEN e.amount END), 0) AS extra_cost,
        COALESCE(SUM(CASE WHEN e.type = 'usage' THEN e.quantity END), 0) AS use_count
      FROM items i
      LEFT JOIN events e ON e.item_id = i.id
      WHERE i.id = ${id}
      GROUP BY i.id
    `;
    if (!stats) return { code: 404, message: 'Item not found' };
    const total = Number(stats.purchase_price) + Number(stats.extra_cost);
    const daily_cost   = +(total / Number(stats.days_owned)).toFixed(2);
    const cost_per_use = Number(stats.use_count) > 0
      ? +(total / Number(stats.use_count)).toFixed(2)
      : null;
    return {
      code: 200,
      data: { ...stats, total_cost: total, daily_cost, cost_per_use },
    };
  })

  .get('/api/dashboard', async () => {
    // 总览：总资产（未卖出物品的购入价之和）+ 日均成本汇总 + 三种状态计数
    const overviewRows = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN status <> 'sold' THEN purchase_price END), 0)::numeric AS total_assets,
        COUNT(*)::int                                                      AS total_count,
        SUM(CASE WHEN status = 'using'   THEN 1 ELSE 0 END)::int           AS count_using,
        SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END)::int           AS count_retired,
        SUM(CASE WHEN status = 'sold'    THEN 1 ELSE 0 END)::int           AS count_sold
      FROM items
    `;
    const dailyRows = await sql`
      SELECT
        COALESCE(SUM(
          (i.purchase_price + COALESCE(extra.amount, 0))
          / GREATEST((CURRENT_DATE - i.acquisition_date)::int, 1)
        ), 0)::numeric AS daily_cost_sum
      FROM items i
      LEFT JOIN LATERAL (
        SELECT SUM(e.amount) AS amount
        FROM events e
        WHERE e.item_id = i.id
          AND e.type IN ('repair','maintenance','consumable')
      ) extra ON TRUE
      WHERE i.status <> 'sold'
    `;
    const overview = {
      total_assets:  Number(overviewRows[0]?.total_assets  ?? 0),
      daily_cost:    Number(dailyRows[0]?.daily_cost_sum   ?? 0),
      total_count:   Number(overviewRows[0]?.total_count   ?? 0),
      count_using:   Number(overviewRows[0]?.count_using   ?? 0),
      count_retired: Number(overviewRows[0]?.count_retired ?? 0),
      count_sold:    Number(overviewRows[0]?.count_sold    ?? 0),
    };

    const mostUsed = await sql`
      SELECT i.id, i.name, COUNT(e.id)::int AS use_count
      FROM items i
      LEFT JOIN events e ON e.item_id = i.id AND e.type = 'usage'
      GROUP BY i.id
      ORDER BY use_count DESC, i.id
      LIMIT 5
    `;
    const longestIdle = await sql`
      SELECT i.id, i.name, MAX(e.occurred_at) AS last_used
      FROM items i
      JOIN events e ON e.item_id = i.id AND e.type = 'usage'
      GROUP BY i.id
      ORDER BY last_used ASC
      LIMIT 5
    `;
    const bestValue = await sql`
      SELECT
        i.id, i.name, i.purchase_price,
        COALESCE(SUM(CASE WHEN e.type = 'usage' THEN e.quantity END), 0) AS use_count
      FROM items i
      LEFT JOIN events e ON e.item_id = i.id
      GROUP BY i.id
      HAVING COALESCE(SUM(CASE WHEN e.type = 'usage' THEN e.quantity END), 0) > 0
      ORDER BY (i.purchase_price / SUM(CASE WHEN e.type = 'usage' THEN e.quantity END)) ASC
      LIMIT 5
    `;
    return { code: 200, data: { overview, mostUsed, longestIdle, bestValue } };
  })

  // ========== Images ==========
  .post('/api/images', async ({ body }) => {
    const b = body as any;
    const file: File = b.file;
    const item_id = Number(b.item_id);
    const event_id = b.event_id ? Number(b.event_id) : null;
    const width  = b.width  ? Number(b.width)  : null;
    const height = b.height ? Number(b.height) : null;

    if (!file || !item_id) {
      return { code: 400, message: 'file 和 item_id 不能为空' };
    }

    const yyyymm = new Date().toISOString().slice(0, 7); // 2026-05
    const ext = (extname(file.name) || '.jpg').toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const dir = join(UPLOADS_DIR, yyyymm);
    await mkdir(dir, { recursive: true });

    const absPath = join(dir, filename);
    await Bun.write(absPath, file);

    const relUrl = `/uploads/${yyyymm}/${filename}`;
    const [row] = await sql`
      INSERT INTO images (item_id, event_id, url, width, height)
      VALUES (${item_id}, ${event_id}, ${relUrl}, ${width}, ${height})
      RETURNING *
    `;
    return { code: 200, data: row };
  }, {
    body: t.Object({
      file:     t.File(),
      item_id:  t.String(),
      event_id: t.Optional(t.String()),
      width:    t.Optional(t.String()),
      height:   t.Optional(t.String()),
    }),
  })

  .delete('/api/images/:id', async ({ params }) => {
    const id = Number(params.id);
    const rows = await sql`DELETE FROM images WHERE id = ${id} RETURNING url`;
    const row = rows[0];
    if (!row) return { code: 404, message: 'Image not found' };
    try {
      const path = '.' + String(row.url); // /uploads/... → ./uploads/...
      await Bun.file(path).delete?.();
    } catch (e) { /* ignore */ }
    return { code: 200, data: { deleted: 1 } };
  })

  // ========== Tags ==========
  .get('/api/tags', async () => {
    const rows = await sql`SELECT * FROM tags ORDER BY name`;
    return { code: 200, data: rows };
  })

  .listen(Number(process.env.PORT) || 3000);

console.log(`🦊 OneDay API 启动于 http://localhost:${app.server?.port}`);
console.log(`📂 上传目录：${UPLOADS_DIR}`);

process.on('SIGINT', () => {
  console.log('\n🛑 服务器已优雅关闭');
  process.exit(0);
});
