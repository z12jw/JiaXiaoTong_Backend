// 用户管理
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 根据角色联查对应扩展表
function getDetailQuery(role) {
  switch (role) {
    case 'student':
      return `SELECT u.*, s.student_no, s.class_id, s.school_id, s.gender, s.birth_date
              FROM user u LEFT JOIN student s ON u.id = s.user_id WHERE u.id = ?`;
    case 'parent':
      return `SELECT u.*, pd.student_id, pd.relation
              FROM user u LEFT JOIN parent_detail pd ON u.id = pd.user_id WHERE u.id = ?`;
    case 'teacher':
      return `SELECT u.*, td.teacher_no, td.subject, td.is_class_teacher, td.managed_classes
              FROM user u LEFT JOIN teacher_detail td ON u.id = td.user_id WHERE u.id = ?`;
    case 'leader':
      return `SELECT u.*, ld.leader_no, ld.title, ld.dept_name
              FROM user u LEFT JOIN leader_detail ld ON u.id = ld.user_id WHERE u.id = ?`;
    default:
      return 'SELECT * FROM user WHERE id = ?';
  }
}

// 获取当前用户完整信息
router.get('/me', (req, res) => {
  const sql = getDetailQuery(req.user.role);

  pool.query(sql, [req.user.id], (err, results) => {
    if (err) {
      console.error('获取用户信息错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (results.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    // 去掉密码字段
    const user = results[0];
    delete user.password;
    res.json({ code: 200, data: user });
  });
});

// 用户列表（支持按角色/状态筛选）
router.get('/users', requireRole('teacher', 'leader'), (req, res) => {
  const { role, status } = req.query;
  let sql = 'SELECT id, phone, real_name, role, status, created_at FROM user WHERE 1=1';
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
router.put('/users/:id/status', requireRole('teacher', 'leader'), (req, res) => {
  const { status } = req.body;
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

module.exports = router;
