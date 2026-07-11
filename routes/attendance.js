// 学生考勤
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 查看考勤（家长看子女，老师看班级）
router.get('/attendance', (req, res) => {
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
router.post('/attendance', requireRole('teacher', 'leader'), (req, res) => {
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

module.exports = router;
