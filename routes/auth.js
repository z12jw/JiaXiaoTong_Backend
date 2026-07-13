// 登录 + 注册（公开接口）
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ---------- 登录（身份 + 账号 + 密码 三者匹配，细分错误返回） ----------
router.post('/login', loginLimiter, async (req, res) => {
  const { role, account, password } = req.body;
  const loginId = account || req.body.phone;
  const validRoles = ['student', 'teacher', 'parent', 'leader'];

  // ────────── 1. 参数校验 ──────────
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ code: 40001, message: '请选择有效的身份类型' });
  }
  if (!loginId) {
    return res.status(400).json({ code: 40002, message: '请输入账号' });
  }
  if (!password) {
    return res.status(400).json({ code: 40003, message: '请输入密码' });
  }

  try {
    // ────────── 2. 全域查找：确认该账号是否存在于系统 ──────────
    const [anyMatch] = await pool.promise().query(
      `SELECT u.* FROM user u
       LEFT JOIN student s ON u.id = s.user_id
       LEFT JOIN teacher_detail td ON u.id = td.user_id
       LEFT JOIN leader_detail ld ON u.id = ld.user_id
       WHERE u.phone = ? OR s.student_no = ? OR td.teacher_no = ? OR ld.leader_no = ?
       LIMIT 1`,
      [loginId, loginId, loginId, loginId]
    );

    if (anyMatch.length === 0) {
      return res.status(404).json({ code: 40401, message: '该账号尚未注册，请检查账号是否正确' });
    }

    const user = anyMatch[0];

    // ────────── 3. 身份匹配校验 ──────────
    if (user.role !== role) {
      return res.status(401).json({ code: 40101, message: '账号身份不匹配，请核对您选择的身份类型' });
    }

    // ────────── 4. 密码校验 ──────────
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ code: 40102, message: '密码错误，请重新输入' });
    }

    // ────────── 5. 账号状态校验 ──────────
    switch (user.status) {
      case 0:
        return res.status(403).json({ code: 40301, message: '账号正在审核中，请耐心等待管理员审核' });
      case 2:
        return res.status(403).json({ code: 40302, message: '审核未通过，请联系管理员' });
      default:
        if (user.status !== 1) {
          return res.status(403).json({ code: 40303, message: '账号状态异常，请联系管理员处理' });
        }
    }

    // ────────── 6. 签发 Token ──────────
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
    return res.status(500).json({ code: 50000, message: '服务器繁忙，请稍后再试' });
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
