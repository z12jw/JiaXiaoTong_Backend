// 登录/注册接口限流：同一IP 15 分钟内最多 10 次
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});

module.exports = { loginLimiter, registerLimiter };
