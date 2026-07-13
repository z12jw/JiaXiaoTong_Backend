// 教师评语
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 查看评语
router.get('/evaluations', (req, res) => {
  const { student_id, type, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT e.*, s.real_name AS student_name, u.real_name AS teacher_name
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
router.post('/evaluations', requireRole('teacher'), (req, res) => {
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

module.exports = router;
