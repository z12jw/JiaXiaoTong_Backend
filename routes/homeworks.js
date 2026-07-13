// 课后作业
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 作业列表（家长看子女班级的，老师看自己布置的）
router.get('/homeworks', (req, res) => {
  const { class_id, subject, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT h.*, u.real_name AS teacher_name, c.name AS class_name
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
router.post('/homeworks', requireRole('teacher'), (req, res) => {
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

module.exports = router;
