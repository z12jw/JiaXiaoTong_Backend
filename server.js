const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 数据库连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'wjz20051227',
  database: '家校通',
  waitForConnections: true,
  connectionLimit: 10,
});

// ---------- 登录接口 ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  pool.query('SELECT * FROM user WHERE username = ?', [username], (err, results) => {
    if (err) return res.status(500).json({ code: 500, message: '数据库错误' });
    if (results.length === 0) {
      return res.json({ code: 401, message: '用户名或密码错误' });
    }

    const user = results[0];
    // 验证密码（假设注册时已加密）
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.json({ code: 401, message: '用户名或密码错误' });
    }

    // 可额外检查用户状态
    if (user.status !== 1) {
      return res.json({ code: 403, message: '账号未激活，请联系班主任审核' });
    }

    res.json({ code: 200, message: '登录成功', data: { id: user.id, username: user.username } });
  });
});

// ---------- 注册接口 ----------
app.post('/api/register', (req, res) => {
  const { username, password, phone, childName, className } = req.body;
  // 前端已做基础校验，后端仍需二次校验
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ code: 400, message: '用户名或密码长度不符合要求' });
  }

  // 加密密码
  const hashedPassword = bcrypt.hashSync(password, 10);

  const sql = `INSERT INTO user (username, password, phone, child_name, class_name, status)
               VALUES (?, ?, ?, ?, ?, 0)`;
  pool.query(sql, [username, hashedPassword, phone, childName, className], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json({ code: 400, message: '用户名已存在' });
      }
      return res.status(500).json({ code: 500, message: '注册失败' });
    }
    res.json({ code: 200, message: '注册申请已提交，请等待班主任审核' });
  });
});

app.listen(3000, () => {
  console.log('API服务运行在 http://localhost:3000');
});