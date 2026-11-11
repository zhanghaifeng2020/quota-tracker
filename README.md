# 额度与到期追踪管理系统 (Quota Tracker)

基于 **Node.js + Express + MySQL** 构建的多用户 AI 订阅与额度追踪系统。支持用户注册登录、数据严格隔离、多周期重置计算、交互式额度滑块、只读预览模式以及用户登录与在线时长统计。

---

## ✨ 核心特性

1. **多用户认证与严格数据隔离**：
   - 支持用户名、电子邮箱、密码注册与双模式登录（用户名或邮箱）。
   - 使用 `bcryptjs` 加盐哈希存储密码，基于 JWT（JSON Web Token）进行接口鉴权。
   - 注册时自动初始化 13 项预设额度模板，所有订阅记录通过 `user_id` 与外键约束实现多用户隔离。

2. **直观的工作台与日历交互**：
   - **状态摘要与筛选**：按「用光了」「马上重置」「快到期还没用」「全部」快速筛选与排序。
   - **17 天时间轨道**：可视化展示未来 17 天每日即将重置或到期的订阅分布。
   - **额度滑块实时同步**：拖动卡片滑块调整已用额度，带防抖自动持久化写入 MySQL。
   - **多种循环规则**：支持按固定天数间隔、每周固定星期、每月固定日期循环重置，以及一次性到期。
   - **自动周期归零**：到达重置日时自动归零已用额度并同步数据库。
   - **只读示例预览**：访问 `/?preview=1` 无需登录即可体验工作台界面，预览模式拦截一切后端写操作。

3. **登录与在线时长统计分析**：
   - 记录每次登录会话的开始时间、IP、设备终端、30 秒心跳保活与离线结算（支持正常退出 `sendBeacon` 与 3 分钟超时离线检测）。
   - 提供可视化统计弹窗：累计登录人次、独立用户数、当前在线人数、平均停留时长及 24 小时登录分布直方图。

---

## 🗄️ 数据库结构

数据库名称：`quota_tracker`（`utf8mb4_unicode_ci`），建表脚本位于 [`schema.sql`](./schema.sql)：

- `users`：用户账号信息（ID、用户名、邮箱、密码哈希、时间戳）
- `subscriptions`：订阅与额度条目（复合主键 `(user_id, id)`，外键级联删除）
- `user_login_logs`：登录流水与心跳在线时长统计表

服务启动时会自动检测并初始化数据库与表结构。

---

## ⚙️ 环境配置

复制示例配置文件并填写您的数据库连接信息与 JWT 密钥：

```bash
cp .env.example .env
```

`.env` 参数说明：

```env
PORT=3333
JWT_SECRET=change-this-to-a-long-random-secret
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=quota_tracker
```

> 说明：程序也会自动检查 `$HOME/Desktop/工具/.env`（或 `GLOBAL_ENV_PATH` 环境变量指定路径）以支持全局环境配置管理，本地 `.env` 作为补充配置。

---

## 🚀 本地运行与测试

### 1. 直接运行

```bash
npm install
npm start
```

或使用便捷启动脚本：

```bash
./start.sh
```

启动后在浏览器访问：
- 工作台主页：`http://localhost:3333`
- 只读示例预览：`http://localhost:3333/?preview=1`

### 2. 运行测试

```bash
# 运行前端状态与只读预览单元测试
npm test

# 运行 API 与 MySQL 联调测试（需先启动服务与 MySQL）
node scripts/test_api.js
```

---

## 🐳 Docker Compose 部署

使用 Docker Compose 一键编排 Node.js 应用与 MySQL 8.0（已内置 `Asia/Shanghai` 时区配置）：

```bash
# 确保已在 .env 或环境变量中设置 DB_PASSWORD 与 JWT_SECRET
docker compose up -d --build
```

- Web 服务默认监听 `3333` 端口
- MySQL 容器默认映射本机 `127.0.0.1:3309` 端口，数据持久化在 `quota_mysql_data` 卷中
