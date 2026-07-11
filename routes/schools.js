// 学校管理
const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取学校详情（微网站首页）
router.get('/schools/:id', (req, res) => {
  pool.query('SELECT * FROM school WHERE id = ?', [req.params.id], (err, results) => {
    if (err) {
      console.error('查询学校错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (results.length === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }
    res.json({ code: 200, data: results[0] });
  });
});

// 修改学校信息
router.put('/schools/:id', requireRole('leader'), (req, res) => {
  const { name, short_name, address, phone, description, logo_url } = req.body;
  pool.query(
    'UPDATE school SET name=?, short_name=?, address=?, phone=?, description=?, logo_url=? WHERE id=?',
    [name, short_name, address, phone, description, logo_url, req.params.id],
    (err) => {
      if (err) {
        console.error('更新学校错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '学校信息更新成功' });
    });
});

module.exports = router;
