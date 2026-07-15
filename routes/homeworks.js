// 课后作业
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 作业列表（学生/家长看所有，教师只看自己布置的）
router.get('/homeworks', (req, res) => {
  const { class_id, subject, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT h.*, u.real_name AS teacher_name, c.name AS class_name
             FROM homework h
             LEFT JOIN user u ON h.teacher_id = u.id
             LEFT JOIN class c ON h.class_id = c.id
             WHERE h.status = 1`;
  const params = [];

  // 教师只看自己布置的作业
  if (req.user.role === 'teacher') {
    sql += ' AND h.teacher_id = ?';
    params.push(req.user.id);
  }

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

// 布置作业（支持多班级）
router.post('/homeworks', requireRole('teacher'), (req, res) => {
  const { title, content, subject, class_ids, deadline } = req.body;
  if (!title || !content) {
    return res.status(400).json({ code: 400, message: '标题和内容不能为空' });
  }
  if (!class_ids || !Array.isArray(class_ids) || class_ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择至少一个班级' });
  }

  // 验证科目（如果有 teacher_detail 则校验匹配，没有则直接使用提交的科目）
  pool.query(
    'SELECT subject FROM teacher_detail WHERE user_id = ?',
    [req.user.id],
    (err, teachers) => {
      if (err) {
        console.error('查询教师信息错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      let finalSubject = subject;
      if (teachers.length > 0 && teachers[0].subject) {
        const teacherSubject = teachers[0].subject;
        if (subject && teacherSubject && subject !== teacherSubject) {
          return res.status(403).json({ code: 403, message: '只能布置自己任教科目的作业' });
        }
        finalSubject = finalSubject || teacherSubject;
      }

      // 为每个班级创建一条作业
      const values = class_ids.map(cid =>
        [title, content, finalSubject || subject || null, req.user.id, cid, deadline || null, 1]
      );

      pool.query(
        `INSERT INTO homework (title, content, subject, teacher_id, class_id, deadline, status) VALUES ?`,
        [values],
        (err, result) => {
          if (err) {
            console.error('布置作业错误:', err);
            return res.status(500).json({ code: 500, message: '服务器内部错误' });
          }
          res.json({
            code: 200,
            message: '作业布置成功，已分发到 ' + class_ids.length + ' 个班级',
            data: { affectedRows: result.affectedRows }
          });
        }
      );
    }
  );
});

// 修改作业（仅本人可编辑）
router.put('/homeworks/:id', requireRole('teacher'), (req, res) => {
  const { title, content, deadline } = req.body;

  pool.query(
    'UPDATE homework SET title=?, content=?, deadline=? WHERE id=? AND teacher_id=? AND status=1',
    [title, content, deadline || null, req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        console.error('修改作业错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '作业不存在或无权修改' });
      }
      res.json({ code: 200, message: '作业修改成功' });
    }
  );
});

// 删除作业（软删除）
router.delete('/homeworks/:id', requireRole('teacher'), (req, res) => {
  pool.query(
    'UPDATE homework SET status=0 WHERE id=? AND teacher_id=?',
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) {
        console.error('删除作业错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '作业不存在或无权删除' });
      }
      res.json({ code: 200, message: '作业已删除' });
    }
  );
});

module.exports = router;
