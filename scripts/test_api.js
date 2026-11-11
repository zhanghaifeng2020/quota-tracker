import { pool } from '../db.js';

const BASE_URL = 'http://localhost:3333';

async function runTests() {
  console.log('>>> 开始自动化 API 联调与测试...');

  const testUsername = 'test_user_' + Math.floor(Math.random() * 10000);
  const testEmail = `${testUsername}@example.com`;
  const testPassword = 'Password123!';

  // 1. 注册测试
  console.log(`\n1. 测试注册新用户: ${testUsername} (${testEmail})`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUsername, email: testEmail, password: testPassword })
  });
  const regData = await regRes.json();
  console.log('注册响应:', regData);
  if (!regData.success) throw new Error('注册测试失败: ' + regData.message);
  const token = regData.token;
  const userId = regData.user.id;

  // 2. 登录测试
  console.log('\n2. 测试登录');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: testEmail, password: testPassword })
  });
  const loginData = await loginRes.json();
  console.log('登录成功，获取 Token');
  if (!loginData.success) throw new Error('登录测试失败: ' + loginData.message);

  // 3. 获取个人订阅表
  console.log('\n3. 测试获取个人数据表');
  const listRes = await fetch(`${BASE_URL}/api/subscriptions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log(`成功获取数据，初始项目数: ${listData.data.length} 项 (预期 13 项)`);
  if (listData.data.length !== 13) throw new Error('初始数据项数不符合预期 13');

  // 4. 更新额度滑块
  console.log('\n4. 测试快速更新额度滑块');
  const firstItem = listData.data[0];
  const quotaRes = await fetch(`${BASE_URL}/api/subscriptions/${firstItem.id}/quota`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ quotaUsed: 88 })
  });
  const quotaData = await quotaRes.json();
  console.log('更新额度响应:', quotaData);
  if (quotaData.quotaUsed !== 88) throw new Error('额度更新不符合预期');

  // 5. 添加新订阅
  console.log('\n5. 测试新建自定义订阅项');
  const addRes = await fetch(`${BASE_URL}/api/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'DeepSeek R1 Pro',
      kind: 'cycle',
      mode: 'weekday',
      weekday: 5,
      anchor: '2026-10-24',
      trackQuota: true,
      quotaLabel: 'Tokens',
      quotaUsed: 10
    })
  });
  const addData = await addRes.json();
  console.log('新建项目响应:', addData.data.name, addData.data.id);
  const newId = addData.data.id;

  // 6. 验证已存入 MySQL
  console.log('\n6. 验证 MySQL 数据库直读');
  const [dbRows] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? AND id = ?', [userId, newId]);
  console.log('MySQL 直读命中条数:', dbRows.length, '名称:', dbRows[0]?.name);
  if (dbRows.length === 0 || dbRows[0].name !== 'DeepSeek R1 Pro') {
    throw new Error('MySQL 直读验证失败');
  }

  // 7. 测试删除
  console.log('\n7. 测试删除订阅项');
  const delRes = await fetch(`${BASE_URL}/api/subscriptions/${newId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const delData = await delRes.json();
  console.log('删除响应:', delData);

  // 8. 清理测试用户
  console.log('\n8. 清理测试数据');
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  console.log('✔ 测试用户及其级联订阅数据已清理');

  console.log('\n=============================================');
  console.log('🎉 所有 API 及 MySQL 存储测试全部通过！');
  console.log('=============================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ 测试出错:', err);
  process.exit(1);
});
