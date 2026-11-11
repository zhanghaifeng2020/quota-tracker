import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 优先读取全局工具目录 .env（如 $HOME/Desktop/工具/.env），其次读取项目本地 .env
const globalEnvPath = process.env.GLOBAL_ENV_PATH || path.join(os.homedir(), 'Desktop', '工具', '.env');
if (fs.existsSync(globalEnvPath)) {
  dotenv.config({ path: globalEnvPath });
}
const localEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

export const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'quota_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00',
  charset: 'utf8mb4'
};

// 预设的初始模板数据 (来自 subscriptions-static.txt)
export const DEFAULT_SEED_ITEMS = [
  {
    id: "muse",
    name: "Muse",
    kind: "cycle",
    mode: "interval",
    intervalDays: 7,
    weekday: 2,
    monthDay: 13,
    anchor: "2026-10-13",
    due: "2026-10-13",
    note: "每周循环重置",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 1,
    quotaEpoch: "2026-10-13",
    quotaInitialized: true
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    kind: "once",
    mode: "interval",
    intervalDays: 7,
    weekday: 2,
    monthDay: 13,
    anchor: "2026-10-13",
    due: "2026-11-13",
    note: "记得续费或评估",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 0,
    quotaEpoch: "",
    quotaInitialized: false
  },
  {
    id: "grok",
    name: "Grok.com",
    kind: "cycle",
    mode: "weekday",
    intervalDays: 7,
    weekday: 6,
    monthDay: 10,
    anchor: "2026-10-10",
    due: "2026-10-10",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 100,
    quotaEpoch: "2026-10-10",
    quotaInitialized: true
  },
  {
    id: "grokbot",
    name: "grok bot",
    kind: "cycle",
    mode: "weekday",
    intervalDays: 7,
    weekday: 4,
    monthDay: 15,
    anchor: "2026-10-15",
    due: "2026-10-15",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 70,
    quotaEpoch: "",
    quotaInitialized: true
  },
  {
    id: "curse",
    name: "Curse",
    kind: "cycle",
    mode: "monthday",
    intervalDays: 7,
    weekday: 2,
    monthDay: 27,
    anchor: "2026-10-27",
    due: "2026-10-27",
    note: "按月重置",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 60,
    quotaEpoch: "",
    quotaInitialized: true
  },
  {
    id: "jianying",
    name: "剪映积分",
    kind: "cycle",
    mode: "monthday",
    intervalDays: 7,
    weekday: 0,
    monthDay: 18,
    anchor: "2026-10-18",
    due: "2026-10-18",
    note: "按月重置",
    trackQuota: true,
    quotaLabel: "积分",
    quotaTotal: 100,
    quotaUsed: 0,
    quotaEpoch: "",
    quotaInitialized: true
  },
  {
    id: "google",
    name: "谷歌 AI",
    kind: "cycle",
    mode: "weekday",
    intervalDays: 7,
    weekday: 6,
    monthDay: 30,
    anchor: "2026-10-10",
    due: "2026-10-30",
    note: "按月重置（2月无30日则跳过）",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 49,
    quotaEpoch: "2026-10-10",
    quotaInitialized: true
  },
  {
    id: "claude",
    name: "Claude Code",
    kind: "cycle",
    mode: "weekday",
    intervalDays: 7,
    weekday: 1,
    monthDay: 29,
    anchor: "2026-10-12",
    due: "2026-11-13",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 0,
    quotaEpoch: "2026-10-12",
    quotaInitialized: true
  },
  {
    id: "cloud",
    name: "Cloude",
    kind: "once",
    mode: "interval",
    intervalDays: 7,
    weekday: 3,
    monthDay: 11,
    anchor: "2026-11-11",
    due: "2026-11-13",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 0,
    quotaEpoch: "",
    quotaInitialized: false
  },
  {
    id: "chatgpt2",
    name: "ChatGPT2",
    kind: "once",
    mode: "interval",
    intervalDays: 7,
    weekday: 2,
    monthDay: 13,
    anchor: "2026-10-13",
    due: "2026-11-13",
    note: "记得续费或评估",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 0,
    quotaEpoch: "",
    quotaInitialized: false
  },
  {
    id: "nkx6rct3",
    name: "codex",
    kind: "cycle",
    mode: "weekday",
    intervalDays: 7,
    weekday: 2,
    monthDay: 14,
    anchor: "2026-10-13",
    due: "2026-10-14",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 20,
    quotaEpoch: "2026-10-14",
    quotaInitialized: true
  },
  {
    id: "8qr234kp",
    name: "dmit",
    kind: "cycle",
    mode: "monthday",
    intervalDays: 7,
    weekday: 3,
    monthDay: 28,
    anchor: "2026-09-28",
    due: "2026-10-14",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 79,
    quotaEpoch: "2026-10-14",
    quotaInitialized: true
  },
  {
    id: "mfc39vfi",
    name: "谷歌flow视频",
    kind: "cycle",
    mode: "monthday",
    intervalDays: 7,
    weekday: 3,
    monthDay: 30,
    anchor: "2026-09-30",
    due: "2026-10-14",
    note: "",
    trackQuota: true,
    quotaLabel: "额度",
    quotaTotal: 100,
    quotaUsed: 33,
    quotaEpoch: "2026-10-14",
    quotaInitialized: true
  }
];

// 创建连接池
export const pool = mysql.createPool(dbConfig);

// 自动建库建表（带自动重试等待连接，适配 Docker 启动）
export async function ensureDatabaseAndTables(retries = 15, delay = 2000) {
  let conn;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      conn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password
      });
      break;
    } catch (err) {
      if (attempt === retries) {
        console.error('[DB] 初始化校验失败:', err.message);
        return;
      }
      console.log(`[DB] 等待 MySQL 数据库就绪 (尝试 ${attempt}/${retries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${dbConfig.database}\`;`);

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

      for (const stmt of statements) {
        await conn.query(stmt);
      }
    }
    console.log(`[DB] MySQL 数据库 [${dbConfig.database}] 与数据表结构已就绪`);
  } catch (err) {
    console.error('[DB] 初始化校验失败:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

// 格式转换：数据库行 -> 前端 camelCase 对象
export function rowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    mode: row.mode,
    intervalDays: Number(row.interval_days) || 7,
    weekday: Number(row.weekday) ?? 1,
    monthDay: Number(row.month_day) || 1,
    anchor: row.anchor || '',
    due: row.due || '',
    note: row.note || '',
    trackQuota: Boolean(row.track_quota),
    quotaLabel: row.quota_label || '额度',
    quotaTotal: Number(row.quota_total) || 100,
    quotaUsed: Number(row.quota_used) || 0,
    quotaEpoch: row.quota_epoch || '',
    quotaInitialized: Boolean(row.quota_initialized),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 为新用户生成初始示例表记录
export async function seedUserSubscriptions(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let order = 0;
    for (const item of DEFAULT_SEED_ITEMS) {
      await conn.query(
        `INSERT INTO subscriptions (
          id, user_id, name, kind, mode, interval_days, weekday, month_day,
          anchor, due, note, track_quota, quota_label, quota_total, quota_used,
          quota_epoch, quota_initialized, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [
          item.id,
          userId,
          item.name,
          item.kind,
          item.mode,
          item.intervalDays,
          item.weekday,
          item.monthDay,
          item.anchor,
          item.due,
          item.note,
          item.trackQuota ? 1 : 0,
          item.quotaLabel,
          item.quotaTotal,
          item.quotaUsed,
          item.quotaEpoch,
          item.quotaInitialized ? 1 : 0,
          order++
        ]
      );
    }
    await conn.commit();
    console.log(`[DB] 成功为用户 ID ${userId} 初始化预设订阅与额度表 (13项)`);
  } catch (err) {
    await conn.rollback();
    console.error(`[DB] 为用户 ID ${userId} 初始化示例数据失败:`, err.message);
  } finally {
    conn.release();
  }
}
