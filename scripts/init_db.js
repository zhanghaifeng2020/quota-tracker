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
const localEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'quota_tracker'
};

async function initDB() {
  console.log('>>> 正在连接 MySQL 初始化数据库与数据表...');
  console.log(`>>> 主机: ${dbConfig.host}:${dbConfig.port}, 用户: ${dbConfig.user}, 数据库: ${dbConfig.database}`);

  let conn;
  try {
    // 1. 先不指定 database 连接，以确保数据库存在
    conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✔ 数据库 [${dbConfig.database}] 创建或确认成功`);

    await conn.query(`USE \`${dbConfig.database}\`;`);

    // 2. 读取 schema.sql 并执行
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // 执行建表语句
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

    for (const stmt of statements) {
      await conn.query(stmt);
    }

    console.log('✔ 数据表 [users] 和 [subscriptions] 创建或确认成功');
    console.log('>>> MySQL 数据库初始化全部完成！');
  } catch (err) {
    console.error('❌ 初始化数据库失败:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

initDB();
