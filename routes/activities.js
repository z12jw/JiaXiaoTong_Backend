// 学生活动 + 留言
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 活动列表
router.get('/activities', (req, res) => {
  const { class_id, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT a.*, u.real_name AS organizer_name, c.name AS class_name
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
router.post('/activities', requireRole('teacher'), (req, res) => {
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
router.get('/activities/:id/comments', (req, res) => {
  pool.query(
    `SELECT ac.*, u.real_name, u.role
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
router.post('/activities/:id/comments', (req, res) => {
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

module.exports = router;
