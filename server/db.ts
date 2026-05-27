import postgres from 'postgres';
import { config } from 'dotenv';

// 加载 .env（Bun 通常自动加载，但显式调用更可靠）
config();
// 从环境变量读取配置，添加默认值兜底
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_MAX_CONNECTIONS) || 10,
  // 开发环境开启日志，生产环境关闭
  debug: process.env.NODE_ENV === 'development',
};

const sql = postgres(DB_CONFIG);

// 测试数据库连接
async function testDbConnection() {
  try {
    const res = await sql`SELECT 1 as test`;
    console.log('✅ PostgreSQL 连接成功：', res);
    console.log(`🔌 连接信息：${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  } catch (err) {
    console.error('❌ PostgreSQL 连接失败：', err);
    process.exit(1);
  }
}
await testDbConnection();
// 导出功能，给其他代码import用。
export { sql, testDbConnection };