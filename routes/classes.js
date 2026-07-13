// 班级管理
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 班级列表
router.get('/classes', (req, res) => {
  const { school_id } = req.query;
  let sql = 'SELECT c.*, u.real_name AS head_teacher_name FROM class c LEFT JOIN user u ON c.head_teacher_id = u.id WHERE 1=1';
  const params = [];
  if (school_id) { sql += ' AND c.school_id = ?'; params.push(Number(school_id)); }
  sql += ' ORDER BY c.grade, c.name';

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('查询班级列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 创建班级
router.post('/classes', requireRole('leader'), (req, res) => {
  const { school_id, name, grade, year, head_teacher_id } = req.body;
  if (!school_id || !name) {
    return res.status(400).json({ code: 400, message: '学校和班级名称不能为空' });
  }
  pool.query(
    'INSERT INTO class (school_id, name, grade, year, head_teacher_id) VALUES (?, ?, ?, ?, ?)',
    [school_id, name, grade || null, year || null, head_teacher_id || null],
    (err, result) => {
      if (err) {
        console.error('创建班级错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '班级创建成功', data: { id: result.insertId } });
    });
});

// 冻结毕业班级
router.put('/classes/:id/graduate', requireRole('leader'), (req, res) => {
  pool.query('UPDATE class SET is_graduated = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      console.error('冻结班级错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, message: '班级已冻结' });
  });
});

module.exports = router;
