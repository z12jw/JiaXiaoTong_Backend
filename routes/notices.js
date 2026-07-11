// 通知公告
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 通知列表
router.get('/notices', (req, res) => {
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
router.get('/notices/:id', (req, res) => {
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
      pool.query('UPDATE notice SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
      res.json({ code: 200, data: results[0] });
    });
});

// 发布通知
router.post('/notices', requireRole('teacher', 'leader'), (req, res) => {
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
router.put('/notices/:id', requireRole('teacher', 'leader'), (req, res) => {
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
router.delete('/notices/:id', requireRole('teacher', 'leader'), (req, res) => {
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

module.exports = router;
