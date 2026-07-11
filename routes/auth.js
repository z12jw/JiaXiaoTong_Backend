// 登录 + 注册（公开接口）
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ---------- 登录 ----------
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM user WHERE username = ?', [username]
    );

    if (results.length === 0) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const user = results[0];

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    if (user.status !== 1) {
      return res.status(403).json({ code: 403, message: '账号未激活，请联系班主任审核' });
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: { token, user: { id: user.id, username: user.username, role: user.role } }
    });
  } catch (err) {
    console.error('登录接口错误:', err);
    return res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
});

// ---------- 注册 ----------
router.post('/register', registerLimiter, async (req, res) => {
  const { username, password, role, phone, childName, className } = req.body;

  if (!username || username.length < 3) {
    return res.status(400).json({ code: 400, message: '用户名至少需要3个字符' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码至少需要6个字符' });
  }
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
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO user (username, password, role, phone, child_name, class_name, status)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`;
    await pool.promise().query(sql, [username, hashedPassword, role, phone, childName, className]);

    res.json({ code: 200, message: '注册申请已提交，请等待班主任审核' });
  } catch (err) {
    console.error('注册接口错误:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: '用户名已存在' });
    }
    return res.status(500).json({ code: 500, message: '注册失败' });
  }
});

module.exports = router;
