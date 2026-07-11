require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// ==================== 全局中间件 ====================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // 提供 test.html 等静态文件

// ==================== 公开路由（无需登录） ====================
app.use('/api', require('./routes/auth'));

// ==================== 鉴权中间件（以下路由需要登录） ====================
app.use('/api', authMiddleware);

// ==================== 业务路由 ====================
app.use('/api', require('./routes/users'));
app.use('/api', require('./routes/schools'));
app.use('/api', require('./routes/classes'));
app.use('/api', require('./routes/notices'));
app.use('/api', require('./routes/homeworks'));
app.use('/api', require('./routes/activities'));
app.use('/api', require('./routes/attendance'));
app.use('/api', require('./routes/grades'));
app.use('/api', require('./routes/rewards'));
app.use('/api', require('./routes/evaluations'));

// ==================== 启动服务 ====================
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, HOST, () => {
  console.log(`API服务运行在 http://${HOST}:${PORT}`);
  console.log(`测试页面: http://${HOST}:${PORT}/test.html`);
});

// 端口被占用时的友好提示
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请先执行: npx kill-port ${PORT}`);
    process.exit(1);
  } else {
    throw err;
  }
});
