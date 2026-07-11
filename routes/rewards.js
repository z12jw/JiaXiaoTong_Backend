// 奖罚记录
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 查看奖罚
router.get('/rewards-punishments', (req, res) => {
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
router.post('/rewards-punishments', requireRole('teacher'), (req, res) => {
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

module.exports = router;
