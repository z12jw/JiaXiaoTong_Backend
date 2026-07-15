// 会话 & 消息
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// ==================== 会话 ====================

// 我的会话列表（按最后消息时间倒序）
router.get('/conversations', (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT c.*,
      (SELECT content FROM message WHERE conversation_id = c.id ORDER BY send_time DESC LIMIT 1) AS last_message,
      (SELECT send_time FROM message WHERE conversation_id = c.id ORDER BY send_time DESC LIMIT 1) AS last_msg_time,
      (SELECT COUNT(*) FROM message WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) AS unread_count
    FROM conversation c
    JOIN conversation_member cm ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
    ORDER BY last_msg_time DESC
  `;

  pool.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error('查询会话列表错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    res.json({ code: 200, data: results });
  });
});

// 创建私聊会话（如果两人已有私聊则返回现有会话）
router.post('/conversations', (req, res) => {
  const { conv_type, conv_name, member_ids } = req.body;
  const creatorId = req.user.id;

  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请指定会话成员' });
  }

  // 所有成员（含自己）
  const allMembers = [creatorId, ...member_ids.filter(id => id !== creatorId)];

  if (conv_type === 'PRIVATE' && allMembers.length === 2) {
    // 私聊：查找是否已有两人之间的会话
    const sql = `
      SELECT c.* FROM conversation c
      WHERE c.conv_type = 'PRIVATE'
        AND (SELECT COUNT(*) FROM conversation_member WHERE conversation_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM conversation_member WHERE conversation_id = c.id AND user_id = ?)
        AND EXISTS (SELECT 1 FROM conversation_member WHERE conversation_id = c.id AND user_id = ?)
      LIMIT 1
    `;
    pool.query(sql, [allMembers[0], allMembers[1]], (err, results) => {
      if (err) {
        console.error('查找现有会话错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (results.length > 0) {
        return res.json({ code: 200, data: results[0], message: '已存在会话' });
      }
      createConversation(res, conv_type, conv_name || '', creatorId, allMembers);
    });
  } else {
    createConversation(res, conv_type || 'GROUP', conv_name || '群聊', creatorId, allMembers);
  }
});

function createConversation(res, convType, convName, creatorId, memberIds) {
  const conn = pool.promise();
  conn.getConnection()
    .then(connection => {
      (async () => {
        try {
          await connection.beginTransaction();

          const [convResult] = await connection.query(
            'INSERT INTO conversation (conv_type, conv_name, created_by) VALUES (?, ?, ?)',
            [convType, convName, creatorId]
          );
          const convId = convResult.insertId;

          // 添加所有成员
          const values = memberIds.map(uid => [convId, uid]);
          await connection.query(
            'INSERT INTO conversation_member (conversation_id, user_id) VALUES ?',
            [values]
          );

          await connection.commit();

          // 返回新创建的会话
          const [conv] = await connection.query('SELECT * FROM conversation WHERE id = ?', [convId]);
          res.json({ code: 200, message: '会话创建成功', data: conv[0] });
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      })();
    })
    .catch(err => {
      console.error('创建会话错误:', err);
      res.status(500).json({ code: 500, message: '服务器内部错误' });
    });
}

// 会话详情
router.get('/conversations/:id', (req, res) => {
  const sql = `
    SELECT c.*, GROUP_CONCAT(cm.user_id) AS member_ids
    FROM conversation c
    LEFT JOIN conversation_member cm ON c.id = cm.conversation_id
    WHERE c.id = ?
    GROUP BY c.id
  `;
  pool.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error('查询会话详情错误:', err);
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    if (results.length === 0) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }
    res.json({ code: 200, data: results[0] });
  });
});

// ==================== 消息 ====================

// 消息列表（分页，按 send_time 倒序，返回后前端倒转显示）
router.get('/messages/:conversation_id', (req, res) => {
  const { pageNum = 1, pageSize = 20 } = req.query;
  const convId = req.params.conversation_id;
  const userId = req.user.id;

  // 检查用户是否为会话成员
  pool.query(
    'SELECT 1 FROM conversation_member WHERE conversation_id = ? AND user_id = ?',
    [convId, userId],
    (err, memberCheck) => {
      if (err) {
        console.error('检查会话成员错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (memberCheck.length === 0) {
        return res.status(403).json({ code: 403, message: '无权查看该会话消息' });
      }

      const page = Number(pageNum);
      const size = Number(pageSize);
      const offset = (page - 1) * size;

      // 查询总数
      pool.query(
        'SELECT COUNT(*) AS total FROM message WHERE conversation_id = ?',
        [convId],
        (err, countResult) => {
          if (err) {
            console.error('查询消息总数错误:', err);
            return res.status(500).json({ code: 500, message: '服务器内部错误' });
          }
          const total = countResult[0].total;

          // 查询消息列表（倒序分页，最新的在前）
          pool.query(
            `SELECT * FROM message WHERE conversation_id = ? ORDER BY send_time DESC LIMIT ? OFFSET ?`,
            [convId, size, offset],
            (err, messages) => {
              if (err) {
                console.error('查询消息列表错误:', err);
                return res.status(500).json({ code: 500, message: '服务器内部错误' });
              }
              res.json({
                code: 200,
                data: {
                  records: messages,
                  total: total,
                  size: size,
                  current: page,
                  pages: Math.ceil(total / size)
                }
              });
            }
          );
        }
      );
    }
  );
});

// 发送消息
router.post('/messages', (req, res) => {
  const { conversation_id, msg_type, content, voice_url, voice_duration } = req.body;
  const senderId = req.user.id;

  if (!conversation_id) {
    return res.status(400).json({ code: 400, message: '缺少会话ID' });
  }
  if (!content && !voice_url) {
    return res.status(400).json({ code: 400, message: '消息内容不能为空' });
  }

  // 检查用户是否为会话成员
  pool.query(
    'SELECT 1 FROM conversation_member WHERE conversation_id = ? AND user_id = ?',
    [conversation_id, senderId],
    (err, memberCheck) => {
      if (err) {
        console.error('检查会话成员错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      if (memberCheck.length === 0) {
        return res.status(403).json({ code: 403, message: '您不是该会话成员' });
      }

      pool.query(
        `INSERT INTO message (conversation_id, sender_id, msg_type, content, voice_url, voice_duration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [conversation_id, senderId, msg_type || 'TEXT', content || null, voice_url || null, voice_duration || null],
        (err, result) => {
          if (err) {
            console.error('发送消息错误:', err);
            return res.status(500).json({ code: 500, message: '服务器内部错误' });
          }

          // 更新会话时间
          pool.query(
            'UPDATE conversation SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [conversation_id]
          );

          // 返回新消息
          pool.query(
            'SELECT * FROM message WHERE id = ?',
            [result.insertId],
            (err, msg) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '服务器内部错误' });
              }
              res.json({ code: 200, message: '发送成功', data: msg[0] });
            }
          );
        }
      );
    }
  );
});

// 标记已读
router.put('/messages/read/:conversation_id', (req, res) => {
  const convId = req.params.conversation_id;
  const userId = req.user.id;

  pool.query(
    'UPDATE message SET is_read = 1, read_time = CURRENT_TIMESTAMP WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
    [convId, userId],
    (err, result) => {
      if (err) {
        console.error('标记已读错误:', err);
        return res.status(500).json({ code: 500, message: '服务器内部错误' });
      }
      res.json({ code: 200, message: '已标记已读' });
    }
  );
});

module.exports = router;
