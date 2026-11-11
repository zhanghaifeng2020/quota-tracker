import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool, ensureDatabaseAndTables, rowToItem, seedUserSubscriptions, DEFAULT_SEED_ITEMS } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_in_production';

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 辅助：获取访客真实 IP
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim().replace(/^.*:/, '');
  }
  return (req.headers['x-real-ip'] || req.socket.remoteAddress || req.ip || '').replace(/^.*:/, '');
}

// 辅助：创建一条用户登录/会话流水记录
async function createLoginSession(userId, req) {
  const sessionId = 'sess_' + randomUUID().replace(/-/g, '');
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] || '').slice(0, 250);

  await pool.query(
    `INSERT INTO user_login_logs (user_id, session_id, login_time, last_heartbeat, duration_seconds, ip_address, user_agent, status)
     VALUES (?, ?, NOW(), NOW(), 0, ?, ?, 'active')`,
    [userId, sessionId, ip, ua]
  );

  return sessionId;
}

// 定期将超过 3 分钟无心跳的在线会话标记为超时结束
setInterval(async () => {
  try {
    await pool.query(
      `UPDATE user_login_logs 
       SET status = 'timeout',
           logout_time = last_heartbeat,
           duration_seconds = TIMESTAMPDIFF(SECOND, login_time, last_heartbeat)
       WHERE status = 'active' AND TIMESTAMPDIFF(MINUTE, last_heartbeat, NOW()) >= 3`
    );
  } catch (err) {
    // 静默忽略定时扫描异常
  }
}, 60000);

// 鉴权中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录以访问您的数据表' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '登录凭证已失效，请重新登录' });
    }
    req.user = user; // { id, username, email }
    next();
  });
}

// ==========================================
// 1. 用户认证 API
// ==========================================

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: '用户名、邮箱和密码均为必填项' });
  }

  const cleanUsername = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (cleanUsername.length < 2) {
    return res.status(400).json({ success: false, message: '用户名至少需要 2 个字符' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: '请输入有效的邮箱地址' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: '密码长度至少为 6 位' });
  }

  try {
    // 检查是否已被注册
    const [existing] = await pool.query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [cleanUsername, cleanEmail]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(409).json({ success: false, message: '该用户名已被占用，请换一个' });
      }
      if (match.email.toLowerCase() === cleanEmail) {
        return res.status(409).json({ success: false, message: '该邮箱已被注册，可直接登录' });
      }
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash]
    );

    const userId = result.insertId;

    // 为该新用户初始化一张包含 13 个预设订阅/额度的个人表
    await seedUserSubscriptions(userId);

    // 生成 JWT Token
    const userPayload = { id: userId, username: cleanUsername, email: cleanEmail };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    // 记录登录流水与会话
    const sessionId = await createLoginSession(userId, req);

    res.status(201).json({
      success: true,
      message: '注册成功，已为您初始化个人额度表！',
      token,
      sessionId,
      user: userPayload
    });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误：' + err.message });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { account, password } = req.body;

  if (!account || !password) {
    return res.status(400).json({ success: false, message: '请输入账号（邮箱或用户名）及密码' });
  }

  const cleanAccount = String(account).trim();

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [cleanAccount, cleanAccount.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: '账号或密码不正确' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '账号或密码不正确' });
    }

    const userPayload = { id: user.id, username: user.username, email: user.email };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    // 记录本次登录流水与会话
    const sessionId = await createLoginSession(user.id, req);

    res.json({
      success: true,
      message: '登录成功！',
      token,
      sessionId,
      user: userPayload
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误：' + err.message });
  }
});

// 开启新会话 (例如刷新网页或本地已有 token 重新进入)
app.post('/api/auth/session-start', authenticateToken, async (req, res) => {
  try {
    const sessionId = await createLoginSession(req.user.id, req);
    res.json({ success: true, sessionId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 维持在线心跳与计算在屏时长 (前端每 30 秒触发一次)
app.post('/api/auth/heartbeat', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: '缺少 sessionId' });
  }

  try {
    await pool.query(
      `UPDATE user_login_logs 
       SET last_heartbeat = NOW(),
           duration_seconds = TIMESTAMPDIFF(SECOND, login_time, NOW()),
           status = 'active'
       WHERE session_id = ? AND user_id = ?`,
      [sessionId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 会话主动结束 (退出登录或关闭网页时调用)
app.post('/api/auth/session-end', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.json({ success: true });
  }

  try {
    await pool.query(
      `UPDATE user_login_logs 
       SET logout_time = NOW(),
           last_heartbeat = NOW(),
           duration_seconds = TIMESTAMPDIFF(SECOND, login_time, NOW()),
           status = 'logged_out'
       WHERE session_id = ?`,
      [sessionId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 查询用户登录与在线时长流水统计
app.get('/api/stats/logins', async (req, res) => {
  try {
    // 1. 总体概况统计
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) AS total_logins,
        COUNT(DISTINCT user_id) AS total_users,
        SUM(duration_seconds) AS total_duration,
        ROUND(AVG(duration_seconds)) AS avg_duration,
        COUNT(CASE WHEN status = 'active' AND TIMESTAMPDIFF(MINUTE, last_heartbeat, NOW()) < 3 THEN 1 END) AS online_now
      FROM user_login_logs
    `);

    // 2. 按小时时间段统计分布 (0点 - 23点)
    const [hourly] = await pool.query(`
      SELECT 
        HOUR(login_time) AS hour_of_day,
        COUNT(*) AS count
      FROM user_login_logs
      GROUP BY HOUR(login_time)
      ORDER BY hour_of_day ASC
    `);

    // 3. 最近 100 条登录与时长流水明细
    const [recent] = await pool.query(`
      SELECT 
        l.id,
        l.session_id,
        l.user_id,
        u.username,
        u.email,
        DATE_FORMAT(l.login_time, '%Y-%m-%d %H:%i:%s') AS login_time,
        DATE_FORMAT(l.last_heartbeat, '%Y-%m-%d %H:%i:%s') AS last_heartbeat,
        DATE_FORMAT(l.logout_time, '%Y-%m-%d %H:%i:%s') AS logout_time,
        l.duration_seconds,
        l.ip_address,
        l.user_agent,
        CASE 
          WHEN l.status = 'active' AND TIMESTAMPDIFF(MINUTE, l.last_heartbeat, NOW()) < 3 THEN 'active'
          WHEN l.status = 'logged_out' THEN 'logged_out'
          ELSE 'timeout'
        END AS status
      FROM user_login_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.login_time DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      summary: summary[0],
      hourlyDistribution: hourly,
      recentLogs: recent
    });
  } catch (err) {
    console.error('统计查询错误:', err);
    res.status(500).json({ success: false, message: '查询统计失败：' + err.message });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. 订阅与额度数据表 API（用户数据严格隔离）
// ==========================================

// 获取当前用户的所有表格数据
app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
      [req.user.id]
    );

    const items = rows.map(rowToItem);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('获取订阅错误:', err);
    res.status(500).json({ success: false, message: '获取数据失败：' + err.message });
  }
});

// 添加一项
app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  const item = req.body;
  const id = item.id || Math.random().toString(36).slice(2, 10);

  const name = item.name || '未命名';
  const kind = item.kind === 'once' ? 'once' : 'cycle';
  const mode = item.mode === 'weekday' || item.mode === 'monthday' ? item.mode : 'interval';
  const intervalDays = Number(item.intervalDays) >= 1 ? Math.round(Number(item.intervalDays)) : 7;
  const weekday = Number.isInteger(Number(item.weekday)) ? Number(item.weekday) : 1;
  const monthDay = Number.isInteger(Number(item.monthDay)) ? Number(item.monthDay) : 1;
  const anchor = item.anchor || item.due || '';
  const due = item.due || item.anchor || '';
  const note = item.note || '';
  const trackQuota = item.trackQuota !== false ? 1 : 0;
  const quotaLabel = item.quotaLabel || '额度';
  const quotaTotal = Number(item.quotaTotal) || 100;
  const quotaUsed = Math.max(0, Number(item.quotaUsed) || 0);
  const quotaEpoch = item.quotaEpoch || '';
  const quotaInitialized = item.quotaInitialized ? 1 : 0;

  try {
    // 获取当前最大的 sort_order
    const [maxOrder] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM subscriptions WHERE user_id = ?',
      [req.user.id]
    );
    const sortOrder = maxOrder[0].next_order;

    await pool.query(
      `INSERT INTO subscriptions (
        id, user_id, name, kind, mode, interval_days, weekday, month_day,
        anchor, due, note, track_quota, quota_label, quota_total, quota_used,
        quota_epoch, quota_initialized, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        name,
        kind,
        mode,
        intervalDays,
        weekday,
        monthDay,
        anchor,
        due,
        note,
        trackQuota,
        quotaLabel,
        quotaTotal,
        quotaUsed,
        quotaEpoch,
        quotaInitialized,
        sortOrder
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    res.status(201).json({ success: true, data: rowToItem(rows[0]) });
  } catch (err) {
    console.error('新建订阅项失败:', err);
    res.status(500).json({ success: false, message: '新建失败：' + err.message });
  }
});

// 更新一项（修改规则、名称、周期等）
app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const item = req.body;

  try {
    const [existing] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '未找到该项' });
    }

    const name = item.name !== undefined ? item.name : existing[0].name;
    const kind = item.kind !== undefined ? (item.kind === 'once' ? 'once' : 'cycle') : existing[0].kind;
    const mode = item.mode !== undefined ? item.mode : existing[0].mode;
    const intervalDays = item.intervalDays !== undefined ? Number(item.intervalDays) : existing[0].interval_days;
    const weekday = item.weekday !== undefined ? Number(item.weekday) : existing[0].weekday;
    const monthDay = item.monthDay !== undefined ? Number(item.monthDay) : existing[0].month_day;
    const anchor = item.anchor !== undefined ? item.anchor : existing[0].anchor;
    const due = item.due !== undefined ? item.due : existing[0].due;
    const note = item.note !== undefined ? item.note : existing[0].note;
    const trackQuota = item.trackQuota !== undefined ? (item.trackQuota ? 1 : 0) : existing[0].track_quota;
    const quotaLabel = item.quotaLabel !== undefined ? item.quotaLabel : existing[0].quota_label;
    const quotaTotal = item.quotaTotal !== undefined ? Number(item.quotaTotal) : existing[0].quota_total;
    const quotaUsed = item.quotaUsed !== undefined ? Number(item.quotaUsed) : existing[0].quota_used;
    const quotaEpoch = item.quotaEpoch !== undefined ? item.quotaEpoch : existing[0].quota_epoch;
    const quotaInitialized = item.quotaInitialized !== undefined ? (item.quotaInitialized ? 1 : 0) : existing[0].quota_initialized;

    await pool.query(
      `UPDATE subscriptions SET
        name = ?, kind = ?, mode = ?, interval_days = ?, weekday = ?, month_day = ?,
        anchor = ?, due = ?, note = ?, track_quota = ?, quota_label = ?,
        quota_total = ?, quota_used = ?, quota_epoch = ?, quota_initialized = ?
      WHERE user_id = ? AND id = ?`,
      [
        name,
        kind,
        mode,
        intervalDays,
        weekday,
        monthDay,
        anchor,
        due,
        note,
        trackQuota,
        quotaLabel,
        quotaTotal,
        quotaUsed,
        quotaEpoch,
        quotaInitialized,
        req.user.id,
        id
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    res.json({ success: true, data: rowToItem(rows[0]) });
  } catch (err) {
    console.error('更新订阅失败:', err);
    res.status(500).json({ success: false, message: '更新失败：' + err.message });
  }
});

// 快速更新滑块额度 (轻量化高频调用)
app.patch('/api/subscriptions/:id/quota', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { quotaUsed } = req.body;

  if (quotaUsed === undefined || isNaN(Number(quotaUsed))) {
    return res.status(400).json({ success: false, message: 'quotaUsed 参数缺失或无效' });
  }

  const numUsed = Math.max(0, Math.min(100, Number(quotaUsed)));

  try {
    const [result] = await pool.query(
      'UPDATE subscriptions SET quota_used = ? WHERE user_id = ? AND id = ?',
      [numUsed, req.user.id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '未找到对应条目' });
    }

    res.json({ success: true, id, quotaUsed: numUsed });
  } catch (err) {
    console.error('更新额度失败:', err);
    res.status(500).json({ success: false, message: '更新额度失败：' + err.message });
  }
});

// 快速更新日期 (点击卡片上的日期输入框时触发)
app.patch('/api/subscriptions/:id/date', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { dateStr } = req.body;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ success: false, message: '日期格式不正确' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '条目不存在' });
    }

    const item = rows[0];
    const d = new Date(dateStr);

    if (item.kind === 'once') {
      await pool.query(
        'UPDATE subscriptions SET due = ? WHERE user_id = ? AND id = ?',
        [dateStr, req.user.id, id]
      );
    } else {
      let weekday = item.weekday;
      let monthDay = item.month_day;
      if (item.mode === 'weekday') weekday = d.getDay();
      if (item.mode === 'monthday') monthDay = d.getDate();

      await pool.query(
        'UPDATE subscriptions SET anchor = ?, weekday = ?, month_day = ? WHERE user_id = ? AND id = ?',
        [dateStr, weekday, monthDay, req.user.id, id]
      );
    }

    const [updated] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    res.json({ success: true, data: rowToItem(updated[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除一项
app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM subscriptions WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '条目不存在或已被删除' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除失败：' + err.message });
  }
});

// 批量同步周期重置（前端检测到周期重置时批量回写）
app.post('/api/subscriptions/batch-reset', authenticateToken, async (req, res) => {
  const { resets } = req.body; // array of { id, quotaEpoch, quotaUsed, quotaInitialized }
  if (!Array.isArray(resets) || resets.length === 0) {
    return res.json({ success: true, message: '无需更新' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of resets) {
      await conn.query(
        'UPDATE subscriptions SET quota_used = ?, quota_epoch = ?, quota_initialized = 1 WHERE user_id = ? AND id = ?',
        [r.quotaUsed ?? 0, r.quotaEpoch || '', req.user.id, r.id]
      );
    }
    await conn.commit();
    res.json({ success: true, updatedCount: resets.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// 恢复重置为初始 13 项示例
app.post('/api/subscriptions/reset-default', authenticateToken, async (req, res) => {
  try {
    // 先清空该用户当前的所有订阅
    await pool.query('DELETE FROM subscriptions WHERE user_id = ?', [req.user.id]);
    // 重新填充默认数据
    await seedUserSubscriptions(req.user.id);

    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
      [req.user.id]
    );

    res.json({ success: true, message: '已重置恢复初始示例数据', data: rows.map(rowToItem) });
  } catch (err) {
    res.status(500).json({ success: false, message: '重置失败：' + err.message });
  }
});

// 兜底页面路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
async function startServer() {
  await ensureDatabaseAndTables();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 额度记录查看与管理系统 (MySQL版) 已启动！`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`📦 数据库: ${process.env.MYSQL_DATABASE || process.env.DB_NAME || 'quota_tracker'}`);
    console.log(`=======================================================`);
  });
}

startServer();
