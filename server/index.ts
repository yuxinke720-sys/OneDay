// index.ts —— OneDay 后端 REST API（已接入学生鉴权，共用 student_db）
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
// @ts-ignore — crypto-js 无 .d.ts；按 JS 运行即可
import CryptoJS from 'crypto-js';

config();

const UPLOADS_DIR = './uploads';
const PUBLIC_DIR  = './public';
await mkdir(UPLOADS_DIR, { recursive: true });

// ========== 加密 / JWT 工具（与 student-servertest-main 完全一致，token 跨项目互通）==========

// 后端只需要 KEY 做 JWT 签名；密码以密文形式存库 + 比较，不需要 IV 解密
const KEY = process.env.CRYPTO_KEY || '1234567890123456';
const JWT_SECRET = process.env.JWT_SECRET || KEY;
const JWT_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24h

function base64UrlEncode(wa: any): string {
  return CryptoJS.enc.Base64.stringify(wa)
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecodeToUtf8(s: string): string {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return CryptoJS.enc.Base64.parse(str).toString(CryptoJS.enc.Utf8);
}

function generateJWT(payload: Record<string, unknown>): string {
  const now = Date.now();
  const jwtPayload = { ...payload, iat: now, exp: now + JWT_EXPIRES_MS };
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const encH = base64UrlEncode(CryptoJS.enc.Utf8.parse(header));
  const encP = base64UrlEncode(CryptoJS.enc.Utf8.parse(JSON.stringify(jwtPayload)));
  const sig  = base64UrlEncode(CryptoJS.HmacSHA256(`${encH}.${encP}`, CryptoJS.enc.Utf8.parse(JWT_SECRET)));
  return `${encH}.${encP}.${sig}`;
}

function verifyJWT(token: string): Record<string, any> | null {
  try {
    const [encH, encP, sig] = token.split('.');
    if (!encH || !encP || !sig) return null;
    const expected = base64UrlEncode(
      CryptoJS.HmacSHA256(`${encH}.${encP}`, CryptoJS.enc.Utf8.parse(JWT_SECRET))
    );
    if (expected !== sig) return null;
    const payload = JSON.parse(base64UrlDecodeToUtf8(encP));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// 鉴权快捷返回
const UNAUTHORIZED = { code: 401, message: '未登录或登录已过期' };

// ========== Elysia App ==========

const app = new Elysia()
  .use(cors({ origin: '*' }))
  .use(staticPlugin({ assets: PUBLIC_DIR,  prefix: '/public'  }))
  .use(staticPlugin({ assets: UPLOADS_DIR, prefix: '/uploads' }))
  .get('/', () => Bun.file('./public/index.html'))
  .get('/health', () => ({ code: 200, data: 'ok' }))

  // 解析 token → 注入 userId / isAdmin（routes 自己决定是否强制）
  .derive(({ headers }) => {
    const auth = (headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? verifyJWT(token) : null;
    return {
      userId:  payload?.student_id as number | undefined,
      isAdmin: payload?.isadmin    as boolean | undefined,
      user:    payload as Record<string, any> | null,
    };
  })

  // ========== Auth ==========

  // 登录：学号 + AES 加密后的密码，返回 JWT
  .post('/api/Login', async ({ body }) => {
    const { studentId, password } = body as { studentId: string; password: string };
    if (!studentId || !password) {
      return { code: 400, message: '缺少必要字段' };
    }
    try {
      const rows = await sql`
        SELECT student_id, student_number, name, isadmin, avatar
        FROM students
        WHERE student_number = ${studentId} AND password = ${password}
      `;
      const student = rows[0];
      if (!student) return { code: 401, message: '学号或密码错误' };
      const token = generateJWT(student);
      return {
        code: 200,
        data: {
          student,
          token,
          expiresIn: Math.floor(JWT_EXPIRES_MS / 1000),
        },
      };
    } catch (err: any) {
      console.error(err);
      return { code: 500, message: err.message ?? '服务器错误' };
    }
  })

  // 注册：与 student-servertest-main 兼容的 addStudents
  .post('/api/addStudents', async ({ body }) => {
    const { studentId, name, gender, birthday, email, phone, password, isadmin } = body as any;
    if (!studentId || !name || !password) {
      return { code: 400, message: '学号 / 姓名 / 密码不能为空' };
    }
    try {
      const result = await sql`
        INSERT INTO students (student_number, name, gender, birth_date, email, phone, password, isadmin)
        VALUES (${studentId}, ${name}, ${gender ?? null}, ${birthday ?? null},
                ${email ?? null}, ${phone ?? null}, ${password}, ${isadmin ?? false})
        RETURNING student_id, student_number, name, isadmin
      `;
      return { code: 200, data: result[0] };
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
        return { code: 409, message: '学号或邮箱已存在' };
      }
      return { code: 500, message: err.message ?? '服务器错误' };
    }
  })

  // 当前用户信息（含头像）
  .get('/api/me', async ({ userId }) => {
    if (!userId) return UNAUTHORIZED;
    const [row] = await sql`
      SELECT student_id, student_number, name, gender, birth_date, email, phone, isadmin, avatar
      FROM students WHERE student_id = ${userId}
    `;
    if (!row) return { code: 404, message: '用户不存在' };
    return { code: 200, data: row };
  })

  // 更新头像（接收图片 URL，前端通过 /api/images 上传后再 PATCH 这里）
  .patch('/api/me/avatar', async ({ userId, body }) => {
    if (!userId) return UNAUTHORIZED;
    const { avatar } = body as { avatar: string };
    const [row] = await sql`
      UPDATE students SET avatar = ${avatar} WHERE student_id = ${userId}
      RETURNING student_id, avatar
    `;
    return { code: 200, data: row };
  })

  // ========== Items（全部按 user_id 过滤） ==========

  .get('/api/items', async ({ query, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const q        = (query.q        as string) || '';
    const category = (query.category as string) || '';
    const status   = (query.status   as string) || '';
    const sort     = (query.sort     as string) || 'updated';
    const order    = (query.order    as string) === 'asc' ? 'asc' : 'desc';
    // kind: 'asset'(默认,只看资产) | 'wish'(只看心愿单) | 'all'(全部)
    const kind     = (query.kind     as string) || 'asset';
    const page = Math.max(1, parseInt((query.page as string) || '1'));
    const size = Math.min(100, Math.max(1, parseInt((query.size as string) || '20')));
    const offset = (page - 1) * size;
    const wishFilter =
      kind === 'wish'  ? sql`AND i.is_wish = true`  :
      kind === 'all'   ? sql`` :
                         sql`AND i.is_wish = false`;
    const wishFilterFlat =
      kind === 'wish'  ? sql`AND is_wish = true`  :
      kind === 'all'   ? sql`` :
                         sql`AND is_wish = false`;

    const orderDir = order === 'asc' ? sql`ASC NULLS FIRST` : sql`DESC NULLS LAST`;
    const orderCol =
      sort === 'price'       ? sql`i.purchase_price` :
      sort === 'acquisition' ? sql`i.acquisition_date` :
      sort === 'daily_cost'  ? sql`daily_cost` :
      sort === 'days_owned'  ? sql`days_owned` :
      sort === 'status'      ? sql`(CASE i.status WHEN 'using' THEN 1 WHEN 'retired' THEN 2 WHEN 'sold' THEN 3 ELSE 4 END)` :
                               sql`i.updated_at`;

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
      WHERE i.user_id = ${userId}
        ${wishFilter}
        AND (${q} = '' OR i.name ILIKE ${'%' + q + '%'})
        AND (
          ${category} = ''
          OR (${category} = '未分类' AND (i.category IS NULL OR i.category = ''))
          OR i.category = ${category}
        )
        AND (${status}   = '' OR i.status   = ${status})
      ORDER BY ${orderCol} ${orderDir}
      LIMIT ${size} OFFSET ${offset}
    `;
    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM items
      WHERE user_id = ${userId}
        ${wishFilterFlat}
        AND (${q} = '' OR name ILIKE ${'%' + q + '%'})
        AND (
          ${category} = ''
          OR (${category} = '未分类' AND (category IS NULL OR category = ''))
          OR category = ${category}
        )
        AND (${status}   = '' OR status   = ${status})
    `;
    const total = Number(countRows[0]?.count ?? 0);
    return { code: 200, data: { rows, page, size, total } };
  })

  .get('/api/items/:id', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const [item] = await sql`
      SELECT * FROM items WHERE id = ${id} AND user_id = ${userId}
    `;
    if (!item) return { code: 404, message: 'Item not found' };
    const images = await sql`
      SELECT * FROM images WHERE item_id = ${id} ORDER BY sort_order, id
    `;
    const sub_items = await sql`
      SELECT * FROM sub_items WHERE parent_id = ${id} ORDER BY id
    `;
    return { code: 200, data: { ...item, images, sub_items } };
  })

  .post('/api/items', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const b = body as any;
    const inserted = await sql`
      INSERT INTO items (
        name, category, acquisition_date, purchase_price, currency, status, notes, user_id,
        target_cost_type, target_cost_value, exclude_from_assets, exclude_from_daily,
        expire_date, expire_reminder, is_wish
      )
      VALUES (
        ${b.name},
        ${b.category ?? null},
        ${b.acquisition_date ?? new Date().toISOString().slice(0, 10)},
        ${b.purchase_price ?? 0},
        ${b.currency ?? 'CNY'},
        ${b.status ?? 'using'},
        ${b.notes ?? null},
        ${userId},
        ${b.target_cost_type ?? 'none'},
        ${b.target_cost_value ?? null},
        ${b.exclude_from_assets ?? false},
        ${b.exclude_from_daily ?? false},
        ${b.expire_date ?? null},
        ${b.expire_reminder ?? false},
        ${b.is_wish ?? false}
      )
      RETURNING *
    `;
    const row = inserted[0];
    if (!row) return { code: 500, message: 'Insert returned no row' };
    // 心愿单不生成购入事件（还没买）
    if (!row.is_wish) {
      await sql`
        INSERT INTO events (item_id, type, occurred_at, amount, description)
        VALUES (${row.id}, 'purchase', ${row.acquisition_date}, ${row.purchase_price}, '购入')
      `;
    }
    return { code: 200, data: row };
  })

  .patch('/api/items/:id', async ({ params, body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const b = body as any;
    // 动态字段构造：'key' in b 才更新；传 null 会真的写入 NULL（不再被 COALESCE 跳过）
    const PATCHABLE = [
      'name','category','acquisition_date','purchase_price','currency','status',
      'cover_image_id','notes','target_cost_type','target_cost_value',
      'exclude_from_assets','exclude_from_daily','expire_date','expire_reminder','is_wish',
    ];
    const sets: any[] = [];
    for (const k of PATCHABLE) {
      if (k in b) sets.push(sql`${sql(k)} = ${b[k]}`);
    }
    if (!sets.length) return { code: 400, message: '没有字段需要更新' };
    const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
    const [row] = await sql`
      UPDATE items SET ${setClause}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    if (!row) return { code: 404, message: 'Item not found' };
    return { code: 200, data: row };
  })

  .delete('/api/items/:id', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const rows = await sql`
      DELETE FROM items WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    if (rows.length === 0) return { code: 404, message: 'Item not found' };
    return { code: 200, data: { deleted: rows.length } };
  })

  // ========== Events（通过 item_id 间接校验所属用户）==========

  .get('/api/items/:id/events', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const [owns] = await sql`SELECT 1 FROM items WHERE id = ${id} AND user_id = ${userId}`;
    if (!owns) return { code: 404, message: 'Item not found' };
    const rows = await sql`
      SELECT * FROM events WHERE item_id = ${id} ORDER BY occurred_at DESC, id DESC
    `;
    return { code: 200, data: rows };
  })

  .post('/api/items/:id/events', async ({ params, body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const [owns] = await sql`SELECT 1 FROM items WHERE id = ${id} AND user_id = ${userId}`;
    if (!owns) return { code: 404, message: 'Item not found' };
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

  .delete('/api/events/:id', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const rows = await sql`
      DELETE FROM events
      WHERE id = ${id}
        AND item_id IN (SELECT id FROM items WHERE user_id = ${userId})
      RETURNING id
    `;
    if (rows.length === 0) return { code: 404, message: 'Event not found' };
    return { code: 200, data: { deleted: rows.length } };
  })

  // ========== Stats ==========

  .get('/api/items/:id/stats', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
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
      WHERE i.id = ${id} AND i.user_id = ${userId}
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

  .get('/api/dashboard', async ({ userId }) => {
    if (!userId) return UNAUTHORIZED;
    // 总览 / 计数：只统计资产（非心愿单）；总资产排除 exclude_from_assets
    const overviewRows = await sql`
      SELECT
        COALESCE(SUM(
          CASE WHEN status <> 'sold' AND exclude_from_assets = false
               THEN purchase_price END
        ), 0)::numeric AS total_assets,
        COUNT(*)::int                                                      AS total_count,
        SUM(CASE WHEN status = 'using'   THEN 1 ELSE 0 END)::int           AS count_using,
        SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END)::int           AS count_retired,
        SUM(CASE WHEN status = 'sold'    THEN 1 ELSE 0 END)::int           AS count_sold
      FROM items
      WHERE user_id = ${userId} AND is_wish = false
    `;
    // 日均成本汇总：排除已卖出 + exclude_from_daily + 心愿单
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
      WHERE i.user_id = ${userId}
        AND i.is_wish = false
        AND i.status <> 'sold'
        AND i.exclude_from_daily = false
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
      WHERE i.user_id = ${userId}
      GROUP BY i.id
      ORDER BY use_count DESC, i.id
      LIMIT 5
    `;
    const longestIdle = await sql`
      SELECT i.id, i.name, MAX(e.occurred_at) AS last_used
      FROM items i
      JOIN events e ON e.item_id = i.id AND e.type = 'usage'
      WHERE i.user_id = ${userId}
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
      WHERE i.user_id = ${userId}
      GROUP BY i.id
      HAVING COALESCE(SUM(CASE WHEN e.type = 'usage' THEN e.quantity END), 0) > 0
      ORDER BY (i.purchase_price / SUM(CASE WHEN e.type = 'usage' THEN e.quantity END)) ASC
      LIMIT 5
    `;
    return { code: 200, data: { overview, mostUsed, longestIdle, bestValue } };
  })

  // ========== Images ==========

  // 物品图片上传（必须有 item_id 且属于当前用户）
  .post('/api/images', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const b = body as any;
    const file: File = b.file;
    const item_id = Number(b.item_id);
    const event_id = b.event_id ? Number(b.event_id) : null;
    const width  = b.width  ? Number(b.width)  : null;
    const height = b.height ? Number(b.height) : null;

    if (!file || !item_id) {
      return { code: 400, message: 'file 和 item_id 不能为空' };
    }
    const [owns] = await sql`SELECT 1 FROM items WHERE id = ${item_id} AND user_id = ${userId}`;
    if (!owns) return { code: 404, message: 'Item not found' };

    const yyyymm = new Date().toISOString().slice(0, 7);
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

  // 头像专用上传：不关联物品，落在 uploads/avatars/<userId>/...，返回 url
  .post('/api/avatar/upload', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const b = body as any;
    const file: File = b.file;
    if (!file) return { code: 400, message: 'file 不能为空' };

    const ext = (extname(file.name) || '.jpg').toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const dir = join(UPLOADS_DIR, 'avatars', String(userId));
    await mkdir(dir, { recursive: true });
    await Bun.write(join(dir, filename), file);

    const relUrl = `/uploads/avatars/${userId}/${filename}`;
    return { code: 200, data: { url: relUrl } };
  }, {
    body: t.Object({ file: t.File() }),
  })

  .delete('/api/images/:id', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const rows = await sql`
      DELETE FROM images
      WHERE id = ${id}
        AND item_id IN (SELECT id FROM items WHERE user_id = ${userId})
      RETURNING url
    `;
    const row = rows[0];
    if (!row) return { code: 404, message: 'Image not found' };
    try {
      const path = '.' + String(row.url);
      await Bun.file(path).delete?.();
    } catch (e) { /* ignore */ }
    return { code: 200, data: { deleted: 1 } };
  })

  // ========== Tags（标签字典，跨用户共享）==========
  .get('/api/tags', async () => {
    const rows = await sql`SELECT * FROM tags ORDER BY name`;
    return { code: 200, data: rows };
  })

  // ========== 批量操作（首页批量选择模式）==========

  // 批量改状态 / 批量改分类（body: { ids: number[], status?: string, category?: string|null })
  .patch('/api/items/bulk', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const b = body as any;
    const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return { code: 400, message: 'ids 不能为空' };

    const sets: any[] = [];
    if ('status'   in b) sets.push(sql`status   = ${b.status}`);
    if ('category' in b) sets.push(sql`category = ${b.category}`);
    if (!sets.length) return { code: 400, message: '没有字段需要更新' };
    const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);

    const rows = await sql`
      UPDATE items SET ${setClause}
      WHERE id IN ${sql(ids)} AND user_id = ${userId}
      RETURNING id
    `;
    return { code: 200, data: { updated: rows.length } };
  })

  // 批量删除（body: { ids: number[] })
  .delete('/api/items/bulk', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const b = body as any;
    const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return { code: 400, message: 'ids 不能为空' };
    const rows = await sql`
      DELETE FROM items WHERE id IN ${sql(ids)} AND user_id = ${userId}
      RETURNING id
    `;
    return { code: 200, data: { deleted: rows.length } };
  })

  // ========== Categories（按当前用户聚合）==========

  // 列出当前用户的所有分类（带计数；NULL/空翻译成 '未分类'）
  .get('/api/categories', async ({ userId }) => {
    if (!userId) return UNAUTHORIZED;
    const rows = await sql`
      SELECT
        COALESCE(NULLIF(category, ''), '未分类') AS name,
        COUNT(*)::int AS count
      FROM items
      WHERE user_id = ${userId} AND is_wish = false
      GROUP BY COALESCE(NULLIF(category, ''), '未分类')
      ORDER BY name
    `;
    return { code: 200, data: rows };
  })

  // 重命名：把当前用户名下所有 category=oldName 的物品改成 newName
  .patch('/api/categories', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const { oldName, newName } = body as { oldName: string; newName: string };
    if (!oldName || !newName) return { code: 400, message: 'oldName / newName 不能为空' };
    const matchOld = oldName === '未分类'
      ? sql`(category IS NULL OR category = '')`
      : sql`category = ${oldName}`;
    const finalNew = newName === '未分类' ? null : newName;
    const rows = await sql`
      UPDATE items SET category = ${finalNew}
      WHERE user_id = ${userId} AND ${matchOld}
      RETURNING id
    `;
    return { code: 200, data: { updated: rows.length } };
  })

  // 删除分类：把该分类下所有物品的 category 置为 null（变成"未分类"）
  .delete('/api/categories', async ({ body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const { name } = body as { name: string };
    if (!name) return { code: 400, message: 'name 不能为空' };
    if (name === '未分类') return { code: 400, message: '"未分类"不能删除' };
    const rows = await sql`
      UPDATE items SET category = NULL
      WHERE user_id = ${userId} AND category = ${name}
      RETURNING id
    `;
    return { code: 200, data: { affected: rows.length } };
  })

  // ========== Sub Items（附加物品：依附于主物品的小项目）==========

  .get('/api/items/:id/sub-items', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const [owns] = await sql`SELECT 1 FROM items WHERE id = ${id} AND user_id = ${userId}`;
    if (!owns) return { code: 404, message: 'Item not found' };
    const rows = await sql`SELECT * FROM sub_items WHERE parent_id = ${id} ORDER BY id`;
    return { code: 200, data: rows };
  })

  .post('/api/items/:id/sub-items', async ({ params, body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const [owns] = await sql`SELECT 1 FROM items WHERE id = ${id} AND user_id = ${userId}`;
    if (!owns) return { code: 404, message: 'Item not found' };
    const b = body as any;
    if (!b.name) return { code: 400, message: 'name 不能为空' };
    const [row] = await sql`
      INSERT INTO sub_items (parent_id, name, price, notes)
      VALUES (${id}, ${b.name}, ${b.price ?? 0}, ${b.notes ?? null})
      RETURNING *
    `;
    return { code: 200, data: row };
  })

  .patch('/api/sub-items/:id', async ({ params, body, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const b = body as any;
    const sets: any[] = [];
    if ('name'  in b) sets.push(sql`name  = ${b.name}`);
    if ('price' in b) sets.push(sql`price = ${b.price}`);
    if ('notes' in b) sets.push(sql`notes = ${b.notes}`);
    if (!sets.length) return { code: 400, message: '没有字段需要更新' };
    const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
    const [row] = await sql`
      UPDATE sub_items SET ${setClause}
      WHERE id = ${id}
        AND parent_id IN (SELECT id FROM items WHERE user_id = ${userId})
      RETURNING *
    `;
    if (!row) return { code: 404, message: 'Sub item not found' };
    return { code: 200, data: row };
  })

  .delete('/api/sub-items/:id', async ({ params, userId }) => {
    if (!userId) return UNAUTHORIZED;
    const id = Number(params.id);
    const rows = await sql`
      DELETE FROM sub_items
      WHERE id = ${id}
        AND parent_id IN (SELECT id FROM items WHERE user_id = ${userId})
      RETURNING id
    `;
    if (!rows.length) return { code: 404, message: 'Sub item not found' };
    return { code: 200, data: { deleted: rows.length } };
  })

  .listen(Number(process.env.PORT) || 3000);

console.log(`🦊 OneDay API 启动于 http://localhost:${app.server?.port}`);
console.log(`📂 上传目录：${UPLOADS_DIR}`);

process.on('SIGINT', () => {
  console.log('\n🛑 服务器已优雅关闭');
  process.exit(0);
});
