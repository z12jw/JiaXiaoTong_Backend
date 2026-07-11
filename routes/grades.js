// 学生成绩
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 查看成绩
router.get('/grades', (req, res) => {
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
router.post('/grades', requireRole('teacher'), (req, res) => {
  const { records } = req.body;
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

module.exports = router;
