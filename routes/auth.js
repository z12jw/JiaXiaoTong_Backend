// 登录 + 注册（公开接口）
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ---------- 登录（支持手机号/学号/工号 + 密码） ----------
router.post('/login', loginLimiter, async (req, res) => {
  const { account, password } = req.body;
  // account 兼容旧字段名 phone
  const loginId = account || req.body.phone;
  if (!loginId || !password) {
    return res.status(400).json({ code: 400, message: '账号和密码不能为空' });
  }

  try {
    // 同时匹配 user.phone、student.student_no、teacher_detail.teacher_no
    const [results] = await pool.promise().query(
      `SELECT u.* FROM user u
       LEFT JOIN student s ON u.id = s.user_id
       LEFT JOIN teacher_detail td ON u.id = td.user_id
       WHERE u.phone = ? OR s.student_no = ? OR td.teacher_no = ?
       LIMIT 1`,
      [loginId, loginId, loginId]
    );

    if (results.length === 0) {
      return res.status(401).json({ code: 401, message: '账号或密码错误' });
    }

    const user = results[0];

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ code: 401, message: '手机号或密码错误' });
    }

    if (user.status !== 1) {
      return res.status(403).json({ code: 403, message: '账号未激活，请联系班主任审核' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: { id: user.id, phone: user.phone, real_name: user.real_name, role: user.role }
      }
    });
  } catch (err) {
    console.error('登录接口错误:', err);
    return res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
});

// ---------- 注册（按角色分支） ----------
router.post('/register', registerLimiter, async (req, res) => {
  const { phone, password, role } = req.body;

  // 公共校验
  if (!phone || phone.length < 11) {
    return res.status(400).json({ code: 400, message: '请输入正确的手机号' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ code: 400, message: '密码至少需要6个字符' });
  }
  const validRoles = ['student', 'teacher', 'parent', 'leader'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ code: 400, message: '请选择有效身份' });
  }

  // ---- 按角色校验专属字段 ----
  let roleFields;
  switch (role) {
    case 'student': {
      const { real_name, student_no, class_id } = req.body;
      if (!real_name) return res.status(400).json({ code: 400, message: '请输入真实姓名' });
      if (!student_no) return res.status(400).json({ code: 400, message: '请输入学号' });
      if (!class_id) return res.status(400).json({ code: 400, message: '请选择班级' });
      roleFields = { real_name, student_no, class_id };
      break;
    }
    case 'parent': {
      const { real_name, student_id, relation } = req.body;
      if (!real_name) return res.status(400).json({ code: 400, message: '请输入家长姓名' });
      if (!student_id) return res.status(400).json({ code: 400, message: '请输入绑定学生ID' });
      if (!relation) return res.status(400).json({ code: 400, message: '请选择与学生的关系' });
      roleFields = { real_name, student_id, relation };
      break;
    }
    case 'teacher': {
      const { real_name, teacher_no, subject } = req.body;
      if (!real_name) return res.status(400).json({ code: 400, message: '请输入教师姓名' });
      if (!teacher_no) return res.status(400).json({ code: 400, message: '请输入教师工号' });
      if (!subject) return res.status(400).json({ code: 400, message: '请输入任教科目' });
      roleFields = { real_name, teacher_no, subject };
      break;
    }
    case 'leader': {
      const { real_name, leader_no, title } = req.body;
      if (!real_name) return res.status(400).json({ code: 400, message: '请输入领导姓名' });
      if (!leader_no) return res.status(400).json({ code: 400, message: '请输入领导工号' });
      if (!title) return res.status(400).json({ code: 400, message: '请输入职位' });
      roleFields = { real_name, leader_no, title };
      break;
    }
  }

  // 事务写入：user 表 + 角色扩展表
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1) 写入 user 表
    const [userResult] = await conn.query(
      `INSERT INTO user (phone, password, role, real_name, status) VALUES (?, ?, ?, ?, 0)`,
      [phone, hashedPassword, role, roleFields.real_name]
    );
    const userId = userResult.insertId;

    // 2) 写入角色扩展表
    switch (role) {
      case 'student':
        await conn.query(
          `INSERT INTO student (user_id, student_no, real_name, class_id, status)
           VALUES (?, ?, ?, ?, 1)`,
          [userId, roleFields.student_no, roleFields.real_name, roleFields.class_id]
        );
        break;
      case 'parent':
        await conn.query(
          `INSERT INTO parent_detail (user_id, student_id, relation) VALUES (?, ?, ?)`,
          [userId, roleFields.student_id, roleFields.relation]
        );
        break;
      case 'teacher':
        await conn.query(
          `INSERT INTO teacher_detail (user_id, teacher_no, subject) VALUES (?, ?, ?)`,
          [userId, roleFields.teacher_no, roleFields.subject]
        );
        break;
      case 'leader':
        await conn.query(
          `INSERT INTO leader_detail (user_id, leader_no, title) VALUES (?, ?, ?)`,
          [userId, roleFields.leader_no, roleFields.title]
        );
        break;
    }

    await conn.commit();
    res.json({ code: 200, message: '注册申请已提交，请等待班主任审核' });
  } catch (err) {
    await conn.rollback();
    console.error('注册接口错误:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: '手机号已注册' });
    }
    return res.status(500).json({ code: 500, message: '注册失败' });
  } finally {
    conn.release();
  }
});

module.exports = router;
