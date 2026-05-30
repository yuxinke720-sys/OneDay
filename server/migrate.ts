// migrate.ts —— 增量迁移（幂等，不动已有数据）
//   bun run migrate
//
// 用于把"上个 git 版本"的 OneDay DB 升级到当前版本：
//   - students 加 avatar / password / isadmin 列（若已存在则跳过）
//   - items    加 user_id + 7 个新字段
//   - 建 sub_items 表
//   - 建/更新 admin 账号（学号 S20260530 / 密码 123456）
//   - 把没归属用户的 items 全部挂到 admin
//
// 任何已存在的列 / 表 / 数据都不会被覆盖。多次运行结果相同。

import { sql } from './db';

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  OneDay DB 增量迁移');
  console.log('═══════════════════════════════════════\n');

  try {
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
    await sql`CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id)`;
    console.log('  ✓ items.user_id + 7 个新字段 + 索引\n');

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
    console.log(`  - admin 名下物品：${my.n}`);
    console.log(`  - 总物品：${tot.n}`);
    console.log(`  - 仍无归属：${cnt.n} ${cnt.n === 0 ? '✓' : '(异常)'}\n`);

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
