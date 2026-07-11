require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// TODO: 生产环境应将 origin 限制为前端实际域名
app.use(cors());
app.use(bodyParser.json());

// 提供测试页面
app.use(express.static(__dirname));

// 数据库连接池（密码等敏感信息从环境变量读取）
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || '家校通',
  waitForConnections: true,
  connectionLimit: 10,
});

const JWT_SECRET = process.env.JWT_SECRET || 'jiaxiaotong_secret_key';

// ==================== 工具函数 ====================

// JWT 鉴权中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

// 角色校验中间件工厂
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }
    next();
  };
}

// 限流器
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});

// ==================== 公开接口 ====================

// ---------- 登录接口 ----------
app.post('/api/login', limiter, async (req, res) => {
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

// ---------- 注册接口 ----------
app.post('/api/register', limiter, async (req, res) => {
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

// ==================== 以下接口需要登录 ====================
app.use('/api', authMiddleware);

// ---------- 获取当前用户信息 ----------
app.get('/api/me', (req, res) => {
  pool.query('SELECT id, username, role, phone, child_name, class_name, status, created_at FROM user WHERE id = ?',
    [req.user.id], (err, results) => {
      if (err) {
        console.error('获取用户信息错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, data: results[0] });
    });
});

// ==================== 用户管理 ====================

// 用户列表（支持按角色/状态筛选）
app.get('/api/users', requireRole('teacher', 'leader'), (req, res) => {
  const { role, status } = req.query;
  let sql = 'SELECT id, username, role, phone, child_name, class_name, status, created_at FROM user WHERE 1=1';
  const params = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (status !== undefined) { sql += ' AND status = ?'; params.push(Number(status)); }

  sql += ' ORDER BY created_at DESC';

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询用户列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 审核用户（通过/禁用）
app.put('/api/users/:id/status', requireRole('teacher', 'leader'), (req, res) => {
  const { status } = req.body; // 1=激活, 2=禁用
  if (![0, 1, 2].includes(status)) {
    return res.status(400).json({ code: 400, message: '无效的状态值（0/1/2）' });
  }

  pool.query('UPDATE user SET status = ? WHERE id = ?', [status, req.params.id], (err, result) => {
    if (err) {
      console.error('更新用户状态错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 200, message: '状态更新成功' });
  });
});

// ==================== 学校管理 ====================

// 获取学校详情（微网站首页）
app.get('/api/schools/:id', (req, res) => {
  pool.query('SELECT * FROM school WHERE id = ?', [req.params.id], (err, results) => {
    if (err) {
      console.error('查询学校错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (results.length === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }
    res.json({ code: 200, data: results[0] });
  });
});

// 修改学校信息
app.put('/api/schools/:id', requireRole('leader'), (req, res) => {
  const { name, short_name, address, phone, description, logo_url } = req.body;
  pool.query(
    'UPDATE school SET name=?, short_name=?, address=?, phone=?, description=?, logo_url=? WHERE id=?',
    [name, short_name, address, phone, description, logo_url, req.params.id],
    (err) => {
      if (err) {
        console.error('更新学校错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '学校信息更新成功' });
    });
});

// ==================== 班级管理 ====================

// 班级列表
app.get('/api/classes', (req, res) => {
  const { school_id } = req.query;
  let sql = 'SELECT c.*, u.username AS head_teacher_name FROM class c LEFT JOIN user u ON c.head_teacher_id = u.id WHERE 1=1';
  const params = [];
  if (school_id) { sql += ' AND c.school_id = ?'; params.push(Number(school_id)); }
  sql += ' ORDER BY c.grade, c.name';

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询班级列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 创建班级
app.post('/api/classes', requireRole('leader'), (req, res) => {
  const { school_id, name, grade, year, head_teacher_id } = req.body;
  if (!school_id || !name) {
    return res.status(400).json({ code: 400, message: '学校和班级名称不能为空' });
  }
  pool.query(
    'INSERT INTO class (school_id, name, grade, year, head_teacher_id) VALUES (?, ?, ?, ?, ?)',
    [school_id, name, grade || null, year || null, head_teacher_id || null],
    (err, result) => {
      if (err) {
        console.error('创建班级错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '班级创建成功', data: { id: result.insertId } });
    });
});

// 冻结毕业班级
app.put('/api/classes/:id/graduate', requireRole('leader'), (req, res) => {
  pool.query('UPDATE class SET is_graduated = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      console.error('冻结班级错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, message: '班级已冻结' });
  });
});

// ==================== 通知公告 ====================

// 通知列表
app.get('/api/notices', (req, res) => {
  const { school_id, scope, status, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT n.*, u.username AS publisher_name
             FROM notice n
             LEFT JOIN user u ON n.publisher_id = u.id
             WHERE n.status != 0`;
  const params = [];

  if (school_id) { sql += ' AND (n.school_id = ? OR n.school_id IS NULL)'; params.push(Number(school_id)); }
  if (scope) { sql += ' AND n.scope = ?'; params.push(scope); }
  if (status !== undefined) { sql += ' AND n.status = ?'; params.push(Number(status)); }

  sql += ' ORDER BY n.is_top DESC, n.created_at DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询通知列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 通知详情
app.get('/api/notices/:id', (req, res) => {
  pool.query(
    `SELECT n.*, u.username AS publisher_name
     FROM notice n LEFT JOIN user u ON n.publisher_id = u.id
     WHERE n.id = ?`, [req.params.id],
    (err, results) => {
      if (err) {
        console.error('查询通知详情错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (results.length === 0) {
        return res.status(404).json({ code: 404, message: '通知不存在' });
      }
      // 增加浏览次数
      pool.query('UPDATE notice SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
      res.json({ code: 200, data: results[0] });
    });
});

// 发布通知
app.post('/api/notices', requireRole('teacher', 'leader'), (req, res) => {
  const { title, content, school_id, scope, is_top } = req.body;
  if (!title || !content) {
    return res.status(400).json({ code: 400, message: '标题和内容不能为空' });
  }

  pool.query(
    `INSERT INTO notice (title, content, publisher_id, school_id, scope, is_top, status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [title, content, req.user.id, school_id || null, scope || 'all', is_top || 0],
    (err, result) => {
      if (err) {
        console.error('发布通知错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '通知发布成功', data: { id: result.insertId } });
    });
});

// 修改通知
app.put('/api/notices/:id', requireRole('teacher', 'leader'), (req, res) => {
  const { title, content, scope, is_top, status } = req.body;
  pool.query(
    'UPDATE notice SET title=?, content=?, scope=?, is_top=?, status=? WHERE id=? AND publisher_id=?',
    [title, content, scope, is_top, status, req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        console.error('修改通知错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '通知不存在或无权修改' });
      }
      res.json({ code: 200, message: '通知修改成功' });
    });
});

// 删除通知（软删除）
app.delete('/api/notices/:id', requireRole('teacher', 'leader'), (req, res) => {
  pool.query(
    'UPDATE notice SET status = 0 WHERE id = ? AND publisher_id = ?',
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        console.error('删除通知错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '通知不存在或无权删除' });
      }
      res.json({ code: 200, message: '通知已删除' });
    });
});

// ==================== 课后作业 ====================

// 作业列表（家长看子女班级的，老师看自己布置的）
app.get('/api/homeworks', (req, res) => {
  const { class_id, subject, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT h.*, u.username AS teacher_name, c.name AS class_name
             FROM homework h
             LEFT JOIN user u ON h.teacher_id = u.id
             LEFT JOIN class c ON h.class_id = c.id
             WHERE h.status = 1`;
  const params = [];

  if (class_id) { sql += ' AND h.class_id = ?'; params.push(Number(class_id)); }
  if (subject) { sql += ' AND h.subject = ?'; params.push(subject); }

  sql += ' ORDER BY h.created_at DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询作业列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 布置作业
app.post('/api/homeworks', requireRole('teacher'), (req, res) => {
  const { title, content, subject, class_id, deadline } = req.body;
  if (!title || !content || !class_id) {
    return res.status(400).json({ code: 400, message: '标题、内容和班级不能为空' });
  }

  pool.query(
    `INSERT INTO homework (title, content, subject, teacher_id, class_id, deadline, status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [title, content, subject || null, req.user.id, class_id, deadline || null],
    (err, result) => {
      if (err) {
        console.error('布置作业错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '作业布置成功', data: { id: result.insertId } });
    });
});

// ==================== 学生活动 ====================

// 活动列表
app.get('/api/activities', (req, res) => {
  const { class_id, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT a.*, u.username AS organizer_name, c.name AS class_name
             FROM activity a
             LEFT JOIN user u ON a.organizer_id = u.id
             LEFT JOIN class c ON a.class_id = c.id
             WHERE a.status != 0`;
  const params = [];

  if (class_id) { sql += ' AND a.class_id = ?'; params.push(Number(class_id)); }

  sql += ' ORDER BY a.created_at DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询活动列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 发布活动
app.post('/api/activities', requireRole('teacher'), (req, res) => {
  const { title, content, location, start_time, end_time, class_id } = req.body;
  if (!title) {
    return res.status(400).json({ code: 400, message: '活动标题不能为空' });
  }

  pool.query(
    `INSERT INTO activity (title, content, location, start_time, end_time, organizer_id, class_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [title, content || null, location || null, start_time || null, end_time || null, req.user.id, class_id || null],
    (err, result) => {
      if (err) {
        console.error('创建活动错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '活动发布成功', data: { id: result.insertId } });
    });
});

// 活动留言列表
app.get('/api/activities/:id/comments', (req, res) => {
  pool.query(
    `SELECT ac.*, u.username, u.role
     FROM activity_comment ac
     LEFT JOIN user u ON ac.user_id = u.id
     WHERE ac.activity_id = ? AND ac.status = 1
     ORDER BY ac.created_at ASC`,
    [req.params.id],
    (err, results) => {
      if (err) {
        console.error('查询留言错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, data: results });
    });
});

// 发表留言
app.post('/api/activities/:id/comments', (req, res) => {
  const { content, parent_id } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: '留言内容不能为空' });
  }

  pool.query(
    'INSERT INTO activity_comment (activity_id, user_id, content, parent_id, status) VALUES (?, ?, ?, ?, 1)',
    [req.params.id, req.user.id, content, parent_id || null],
    (err, result) => {
      if (err) {
        console.error('发表留言错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '留言成功', data: { id: result.insertId } });
    });
});

// ==================== 学生考勤 ====================

// 查看考勤（家长看子女，老师看班级）
app.get('/api/attendance', (req, res) => {
  const { student_id, class_id, start_date, end_date, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT a.*, s.real_name AS student_name, s.student_no
             FROM attendance a
             LEFT JOIN student s ON a.student_id = s.id
             WHERE 1=1`;
  const params = [];

  if (student_id) { sql += ' AND a.student_id = ?'; params.push(Number(student_id)); }
  if (class_id) { sql += ' AND s.class_id = ?'; params.push(Number(class_id)); }
  if (start_date) { sql += ' AND a.record_time >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND a.record_time <= ?'; params.push(end_date + ' 23:59:59'); }

  sql += ' ORDER BY a.record_time DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询考勤错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 同步考勤记录（来自门禁系统）
app.post('/api/attendance', requireRole('teacher', 'leader'), (req, res) => {
  const { student_id, record_time, direction, method, device_name, source } = req.body;
  if (!student_id || !record_time || !direction) {
    return res.status(400).json({ code: 400, message: '学生ID、时间和方向不能为空' });
  }

  pool.query(
    'INSERT INTO attendance (student_id, record_time, direction, method, device_name, source) VALUES (?, ?, ?, ?, ?, ?)',
    [student_id, record_time, direction, method || 'card', device_name || null, source || 'internal'],
    (err, result) => {
      if (err) {
        console.error('录入考勤错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '考勤记录已保存', data: { id: result.insertId } });
    });
});

// ==================== 学生成绩 ====================

// 查看成绩
app.get('/api/grades', (req, res) => {
  const { student_id, exam_name, subject, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT g.*, s.real_name AS student_name, s.student_no
             FROM grade g
             LEFT JOIN student s ON g.student_id = s.id
             WHERE 1=1`;
  const params = [];

  if (student_id) { sql += ' AND g.student_id = ?'; params.push(Number(student_id)); }
  if (exam_name) { sql += ' AND g.exam_name = ?'; params.push(exam_name); }
  if (subject) { sql += ' AND g.subject = ?'; params.push(subject); }

  sql += ' ORDER BY g.exam_date DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询成绩错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 录入成绩
app.post('/api/grades', requireRole('teacher'), (req, res) => {
  const { records } = req.body; // 数组：[{student_id, subject, score, exam_name, exam_date, ...}]
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ code: 400, message: '请提供成绩记录' });
  }

  const values = records.map(r => [
    r.student_id, r.subject, r.score, r.exam_name || null,
    r.exam_date || null, r.class_rank || null, r.grade_rank || null,
    r.max_score || null, r.avg_score || null
  ]);

  pool.query(
    `INSERT INTO grade (student_id, subject, score, exam_name, exam_date, class_rank, grade_rank, max_score, avg_score)
     VALUES ?`,
    [values],
    (err, result) => {
      if (err) {
        console.error('录入成绩错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: `成功录入 ${result.affectedRows} 条成绩` });
    });
});

// ==================== 奖罚记录 ====================

// 查看奖罚
app.get('/api/rewards-punishments', (req, res) => {
  const { student_id, type, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT rp.*, s.real_name AS student_name, s.student_no, u.username AS issuer_name
             FROM reward_punishment rp
             LEFT JOIN student s ON rp.student_id = s.id
             LEFT JOIN user u ON rp.issuer_id = u.id
             WHERE 1=1`;
  const params = [];

  if (student_id) { sql += ' AND rp.student_id = ?'; params.push(Number(student_id)); }
  if (type) { sql += ' AND rp.type = ?'; params.push(type); }

  sql += ' ORDER BY rp.record_date DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询奖罚记录错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 录入奖罚
app.post('/api/rewards-punishments', requireRole('teacher'), (req, res) => {
  const { student_id, type, title, description, level, record_date } = req.body;
  if (!student_id || !type || !title) {
    return res.status(400).json({ code: 400, message: '学生ID、类型和标题不能为空' });
  }

  pool.query(
    `INSERT INTO reward_punishment (student_id, type, title, description, level, record_date, issuer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student_id, type, title, description || null, level || null, record_date || new Date(), req.user.id],
    (err, result) => {
      if (err) {
        console.error('录入奖罚错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '奖罚记录已保存', data: { id: result.insertId } });
    });
});

// ==================== 教师评语 ====================

// 查看评语
app.get('/api/evaluations', (req, res) => {
  const { student_id, type, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT e.*, s.real_name AS student_name, u.username AS teacher_name
             FROM evaluation e
             LEFT JOIN student s ON e.student_id = s.id
             LEFT JOIN user u ON e.teacher_id = u.id
             WHERE 1=1`;
  const params = [];

  if (student_id) { sql += ' AND e.student_id = ?'; params.push(Number(student_id)); }
  if (type) { sql += ' AND e.type = ?'; params.push(type); }

  sql += ' ORDER BY e.created_at DESC';
  sql += ` LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`;

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询评语错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 写评语
app.post('/api/evaluations', requireRole('teacher'), (req, res) => {
  const { student_id, semester, content, type } = req.body;
  if (!student_id || !content) {
    return res.status(400).json({ code: 400, message: '学生ID和评语内容不能为空' });
  }

  pool.query(
    `INSERT INTO evaluation (student_id, teacher_id, semester, content, type)
     VALUES (?, ?, ?, ?, ?)`,
    [student_id, req.user.id, semester || null, content, type || 'comprehensive'],
    (err, result) => {
      if (err) {
        console.error('写评语错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '评语已保存', data: { id: result.insertId } });
    });
});

// ==================== 启动服务 ====================
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;
app.listen(PORT, HOST, () => {
  console.log(`API服务运行在 http://${HOST}:${PORT}`);
  console.log(`测试页面: http://${HOST}:${PORT}/test.html`);
});
