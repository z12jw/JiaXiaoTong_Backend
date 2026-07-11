require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// TODO: 生产环境应将 origin 限制为前端实际域名
app.use(cors());
app.use(bodyParser.json());

// 数据库连接池（密码等敏感信息从环境变量读取）
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || '家校通',
  waitForConnections: true,
  connectionLimit: 10,
});

// 登录/注册接口限流：同一IP 15 分钟内最多 10 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});

// ---------- 登录接口 ----------
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  try {
    const [results] = await pool.promise().query('SELECT * FROM user WHERE username = ?', [username]);

    if (results.length === 0) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const user = results[0];

    // 异步验证密码，避免阻塞事件循环
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    // 检查用户状态
    if (user.status !== 1) {
      return res.status(403).json({ code: 403, message: '账号未激活，请联系班主任审核' });
    }

    res.json({ code: 200, message: '登录成功', data: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('登录接口错误:', err);
    return res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
});

// ---------- 注册接口 ----------
app.post('/api/register', registerLimiter, async (req, res) => {
  const { username, password, role, phone, childName, className } = req.body;
  // 注意：phone 对应数据库 phone 列（DB列名存在拼写偏差，暂保持一致）

  // 后端二次校验
  if (!username || username.length < 3) {
    return res.status(400).json({ code: 400, message: '用户名至少需要3个字符' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码至少需要6个字符' });
  }
  // 校验角色合法值
  const validRoles = ['student', 'teacher', 'parent', 'leader'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ code: 400, message: '请选择有效身份' });
  }
  if (!phone) {
    return res.status(400).json({ code: 400, message: '手机号不能为空' });
  }
  if (!childName) {
    return res.status(400).json({ code: 400, message: '孩子姓名不能为空' });
  }
  if (!className) {
    return res.status(400).json({ code: 400, message: '班级名称不能为空' });
  }

  try {
    // 异步加密密码，避免阻塞事件循环
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO user (username, password, role, phone, child_name, class_name, status)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`;
    const [result] = await pool.promise().query(sql, [username, hashedPassword, role, phone, childName, className]);

    res.json({ code: 200, message: '注册申请已提交，请等待班主任审核' });
  } catch (err) {
    console.error('注册接口错误:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: '用户名已存在' });
    }
    return res.status(500).json({ code: 500, message: '注册失败' });
  }
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;
app.listen(PORT, HOST, () => {
  console.log(`API服务运行在 http://${HOST}:${PORT}`);
});
