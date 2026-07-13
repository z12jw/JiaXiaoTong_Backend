// JWT 鉴权中间件 + 角色校验工具函数
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'jiaxiaotong_secret_key';

// JWT 鉴权中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, phone, role }
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

// 角色校验中间件工厂函数
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, JWT_SECRET };
