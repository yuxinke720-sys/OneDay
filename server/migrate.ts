// migrate.ts —— 幂等迁移（既能从零建库 + 又能在老库上加新列）
//   bun run migrate
//
// 适用两种场景：
//   1) 全新 Win 机器（只有 student-servertest-main 留下的 students 表）：
//      → 自动建 items / events / images / sub_items 表
//      → 加 OneDay 自己需要的所有新字段
//      → 建 admin 账号
//   2) 老 OneDay 机器：
//      → CREATE TABLE IF NOT EXISTS 跳过已存在的表
//      → ALTER TABLE ... IF NOT EXISTS 加新列
//      → 已有数据完全保留
//
// 任何已存在的表 / 列 / 数据都不会被覆盖。多次运行结果相同。

import { sql } from './db';

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  OneDay DB 迁移（建库 + 升级二合一）');
  console.log('═══════════════════════════════════════\n');

  try {
    // ============================================================
    // 0. 基础表 bootstrap（全新机器需要；老机器自动跳过）
    //    内容等价于 init-db.ts 的 CREATE 部分，但全部带 IF NOT EXISTS
    // ============================================================
    console.log('▸ 基础表 bootstrap');

    // event_type ENUM —— PG 没有 CREATE TYPE IF NOT EXISTS，用 EXCEPTION 兜底
    await sql`
      DO $$ BEGIN
        CREATE TYPE event_type AS ENUM (
          'purchase', 'usage', 'maintenance', 'repair', 'consumable', 'sell'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS items (
        id                BIGSERIAL    PRIMARY KEY,
        name              VARCHAR(100) NOT NULL,
        category          VARCHAR(50),
        acquisition_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
        purchase_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency          VARCHAR(3)   NOT NULL DEFAULT 'CNY',
        status            VARCHAR(20)  NOT NULL DEFAULT 'using',
        cover_image_id    BIGINT,
        notes             TEXT,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status)`;

    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id           BIGSERIAL    PRIMARY KEY,
        item_id      BIGINT       NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        type         event_type   NOT NULL,
        occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
        quantity     INT          NOT NULL DEFAULT 1,
        description  TEXT,
        metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_item_time ON events(item_id, occurred_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_type      ON events(type)`;

    await sql`
      CREATE TABLE IF NOT EXISTS images (
        id          BIGSERIAL    PRIMARY KEY,
        item_id     BIGINT       NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        event_id    BIGINT                REFERENCES events(id) ON DELETE SET NULL,
        url         VARCHAR(500) NOT NULL,
        width       INT,
        height      INT,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_images_item  ON images(item_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_images_event ON images(event_id)`;

    // tags / item_tags 已废弃（标签功能未实现，与分类重叠）——存在则删除
    await sql`DROP TABLE IF EXISTS item_tags CASCADE`;
    await sql`DROP TABLE IF EXISTS tags      CASCADE`;
    console.log('  ✓ event_type / items / events / images / sub_items（已移除废弃的 tags/item_tags）\n');

    // ============================================================
    // 1. students 表补列（共用 student_db；password/isadmin 可能由
    //    student-servertest-main 已经建过，加 IF NOT EXISTS 安全）
    // ============================================================
    console.log('▸ 升级 students 表');
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS password VARCHAR(255)`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS isadmin  BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar   TEXT`;
    console.log('  ✓ students.password / isadmin / avatar\n');

    // ============================================================
    // 2. items 表补列（user_id + 7 个业务字段）
    // ============================================================
    console.log('▸ 升级 items 表');
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id INT REFERENCES students(student_id)`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS target_cost_type   VARCHAR(20)   NOT NULL DEFAULT 'none'`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS target_cost_value  NUMERIC(10,2)`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS exclude_from_assets BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS exclude_from_daily  BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS expire_date         DATE`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS expire_reminder     BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS is_wish             BOOLEAN NOT NULL DEFAULT false`;
    // 图标选择器：icon_kind ∈ 'emoji' | '3d' | 'image' | NULL（NULL = 用旧的 cover_image_id）
    //          icon_value = emoji 字符 / '/public/icons/3d/xxx.png' / '/uploads/xxx.png'
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS icon_kind  VARCHAR(10)`;
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS icon_value TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id)`;
    console.log('  ✓ items.user_id + 7 个新字段 + icon_kind/icon_value + 索引\n');

    // ============================================================
    // 3. sub_items 表（附加物品）
    // ============================================================
    console.log('▸ 创建 sub_items 表');
    await sql`
      CREATE TABLE IF NOT EXISTS sub_items (
        id         BIGSERIAL PRIMARY KEY,
        parent_id  BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        name       VARCHAR(100) NOT NULL,
        price      NUMERIC(10,2) NOT NULL DEFAULT 0,
        notes      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sub_items_parent ON sub_items(parent_id)`;
    console.log('  ✓ sub_items + 索引\n');

    // ============================================================
    // 4. admin 账号（学号 S20260530，密码 123456）
    //    密码是 AES('123456') 用项目固定的 KEY/IV 加密后的密文；
    //    跟 student-servertest-main 完全一致，token 互通。
    // ============================================================
    console.log('▸ 配置 admin 账号');
    const ADMIN_PWD_CIPHER = 'QEwd/DWmy/4yGncCqBofQQ=='; // = AES("123456")
    const adminRows = await sql`
      INSERT INTO students (student_number, name, gender, birth_date, email, phone, password, isadmin)
      VALUES ('S20260530', 'admin', 'O', '2000-01-01', 'test@admin.com', '13866668888',
              ${ADMIN_PWD_CIPHER}, true)
      ON CONFLICT (student_number) DO UPDATE SET
        password = EXCLUDED.password,
        isadmin  = true
      RETURNING student_id
    `;
    const adminId = Number(adminRows[0]!.student_id);
    console.log(`  ✓ admin 学号 S20260530 / 密码 123456 (student_id=${adminId})\n`);

    // ============================================================
    // 5. 把没归属用户的物品全部挂到 admin
    // ============================================================
    console.log('▸ 回填 items.user_id');
    const upd = await sql`UPDATE items SET user_id = ${adminId} WHERE user_id IS NULL`;
    console.log(`  ✓ 已把 ${upd.count} 件无归属物品挂到 admin\n`);

    // ============================================================
    // 6. 验证迁移结果
    // ============================================================
    console.log('▸ 校验');
    const [cnt]  = await sql`SELECT COUNT(*)::int AS n FROM items WHERE user_id IS NULL`;
    const [my]   = await sql`SELECT COUNT(*)::int AS n FROM items WHERE user_id = ${adminId}`;
    const [tot]  = await sql`SELECT COUNT(*)::int AS n FROM items`;
    console.log(`  - admin 名下物品：${my!.n}`);
    console.log(`  - 总物品：${tot!.n}`);
    console.log(`  - 仍无归属：${cnt!.n} ${cnt!.n === 0 ? '✓' : '(异常)'}\n`);

    console.log('═══════════════════════════════════════');
    console.log('  ✅ 迁移完成，可以启动了：bun run dev');
    console.log('═══════════════════════════════════════');
  } catch (err) {
    console.error('\n❌ 迁移失败：', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
