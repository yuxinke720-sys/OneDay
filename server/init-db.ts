// init-db.ts —— 数据库初始化（一次性运行）
//   bun run init-db
//
// 注意：会先 DROP 旧表再 CREATE，仅供开发期使用。

import { sql } from './db';

async function initDatabase() {
  try {
    // ===== 1. 清理旧表（按依赖反序）=====
    await sql`DROP TABLE IF EXISTS item_tags CASCADE`;
    await sql`DROP TABLE IF EXISTS tags      CASCADE`;
    await sql`DROP TABLE IF EXISTS images    CASCADE`;
    await sql`DROP TABLE IF EXISTS events    CASCADE`;
    await sql`DROP TABLE IF EXISTS items     CASCADE`;
    await sql`DROP TYPE  IF EXISTS event_type`;

    // ===== 2. 事件类型枚举 =====
    await sql`
      CREATE TYPE event_type AS ENUM (
        'purchase', 'usage', 'maintenance', 'repair', 'consumable', 'sell'
      )
    `;

    // ===== 3. items（物品主表）=====
    await sql`
      CREATE TABLE items (
        id                BIGSERIAL    PRIMARY KEY,
        name              VARCHAR(100) NOT NULL,
        category          VARCHAR(50),
        acquisition_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
        purchase_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency          VARCHAR(3)   NOT NULL DEFAULT 'CNY',
        status            VARCHAR(20)  NOT NULL DEFAULT 'using',
                          -- using（服役中） / retired（已退役） / sold（已卖出）
        cover_image_id    BIGINT,
        notes             TEXT,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX idx_items_category ON items(category)`;
    await sql`CREATE INDEX idx_items_status   ON items(status)`;

    // ===== 4. events（事件表，统计核心）=====
    await sql`
      CREATE TABLE events (
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
    await sql`CREATE INDEX idx_events_item_time ON events(item_id, occurred_at DESC)`;
    await sql`CREATE INDEX idx_events_type      ON events(type)`;

    // ===== 5. images（图片元信息，文件存磁盘）=====
    await sql`
      CREATE TABLE images (
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
    await sql`CREATE INDEX idx_images_item  ON images(item_id)`;
    await sql`CREATE INDEX idx_images_event ON images(event_id)`;

    // cover_image_id 反向外键
    await sql`
      ALTER TABLE items
        ADD CONSTRAINT fk_items_cover_image
        FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
    `;

    // ===== updated_at 自动触发器 =====
    await sql`
      CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `;
    await sql`
      CREATE TRIGGER items_updated_at
        BEFORE UPDATE ON items
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()
    `;

    // ===== 8. 种子数据（可选，演示用）=====
    // 小工具：INSERT ... RETURNING 必然有一行，断言后取 id
    const insertItem = async (
      name: string, category: string, date: string,
      price: number, status: string, notes: string,
    ): Promise<number> => {
      const rows = await sql`
        INSERT INTO items (name, category, acquisition_date, purchase_price, status, notes)
        VALUES (${name}, ${category}, ${date}, ${price}, ${status}, ${notes})
        RETURNING id
      `;
      const row = rows[0];
      if (!row) throw new Error(`insert item failed: ${name}`);
      return Number(row.id);
    };

    const macbookId = await insertItem('MacBook Pro 14', '电子',     '2024-01-15', 14999, 'using',   '日常工作主力机');
    const airpodsId = await insertItem('AirPods Pro 2',  '电子',     '2024-03-10', 1999,  'using',   '通勤听歌');
    const cameraId  = await insertItem('Sony A7M4',      '电子',     '2024-06-01', 18999, 'retired', '近期没怎么拍了');
    const lensId    = await insertItem('索尼 24-70 GM2',  '电子',     '2023-10-01', 14999, 'sold',    '换头出掉了');
    const perfumeId = await insertItem('Le Labo Santal 33', '美妆',  '2025-01-08', 1850,  'using',   '日常香水');

    await sql`
      INSERT INTO events (item_id, type, occurred_at, amount, description) VALUES
        (${macbookId}, 'purchase',    '2024-01-15', 14999, '苹果官网购入'),
        (${macbookId}, 'usage',       '2024-04-20', 0,     '日常使用'),
        (${macbookId}, 'maintenance', '2024-09-12', 199,   '清灰 + 换硅脂'),
        (${airpodsId}, 'purchase',    '2024-03-10', 1999,  ''),
        (${airpodsId}, 'usage',       '2024-04-22', 0,     ''),
        (${cameraId},  'purchase',    '2024-06-01', 18999, ''),
        (${cameraId},  'usage',       '2024-06-15', 0,     '试机拍了 200 张'),
        (${lensId},    'purchase',    '2023-10-01', 14999, ''),
        (${lensId},    'sell',        '2025-02-20', 11500, '出二手'),
        (${perfumeId}, 'purchase',    '2025-01-08', 1850,  ''),
        (${perfumeId}, 'usage',       '2025-05-01', 0,     '日常喷')
    `;
    await sql`
      UPDATE events SET quantity = 200
       WHERE item_id = ${cameraId} AND type = 'usage'
    `;
    await sql`
      UPDATE events SET quantity = 80
       WHERE item_id = ${perfumeId} AND type = 'usage'
    `;

    console.log('✅ 数据库初始化成功！');
    console.log(`   - items 表：5 条种子数据（含使用中/已退役/已卖出）`);
    console.log(`   - events 表：11 条事件`);
  } catch (err) {
    console.error('❌ 初始化失败：', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

initDatabase();
