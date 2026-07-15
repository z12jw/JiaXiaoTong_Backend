// 班级管理
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 班级列表（返回 class_code）
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

// 创建班级（老师/领导可用，老师自己输入班号）
router.post('/classes', requireRole('teacher', 'leader'), (req, res) => {
  const { school_id, name, class_code, grade, year, head_teacher_id } = req.body;
  if (!school_id || !name) {
    return res.status(400).json({ code: 400, message: '学校和班级名称不能为空' });
  }
  if (!class_code) {
    return res.status(400).json({ code: 400, message: '请输入班号' });
  }
  if (class_code.length < 2 || class_code.length > 20) {
    return res.status(400).json({ code: 400, message: '班号长度应在2-20个字符' });
  }

  // 检查班号是否已存在
  pool.query('SELECT id FROM class WHERE class_code = ?', [class_code], (err, rows) => {
    if (err) {
      console.error('检查班号错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (rows.length > 0) {
      return res.status(409).json({ code: 409, message: '班号已被使用，请换一个' });
    }

    pool.query(
      'INSERT INTO class (school_id, name, class_code, grade, year, head_teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
      [school_id, name, class_code, grade || null, year || null, head_teacher_id || null],
      (err, result) => {
        if (err) {
          console.error('创建班级错误:', err);
          return res.status(500).json({ code: 500, message: '服务器内部错误' });
        }
        res.json({
          code: 200,
          message: '班级创建成功',
          data: { id: result.insertId, class_code: class_code }
        });
      });
  });
});

// 通过班号加入班级（学生注册后调用）
router.post('/classes/join', (req, res) => {
  const { class_code, student_id } = req.body;
  if (!class_code || !student_id) {
    return res.status(400).json({ code: 400, message: '班号和学生ID不能为空' });
  }

  // 查找班号对应的班级
  pool.query('SELECT id, name FROM class WHERE class_code = ?', [class_code], (err, classes) => {
    if (err) {
      console.error('查询班号错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (classes.length === 0) {
      return res.status(404).json({ code: 404, message: '班号不存在，请检查' });
    }

    const classId = classes[0].id;

    // 更新学生的 class_id（student 表通过 user_id 关联）
    pool.query('UPDATE student SET class_id = ? WHERE user_id = ?', [classId, student_id], (err2) => {
      if (err2) {
        console.error('更新学生班级错误:', err2);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({
        code: 200,
        message: '加入班级成功',
        data: { class_id: classId, class_name: classes[0].name }
      });
    });
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
