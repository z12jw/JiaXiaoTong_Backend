# 新增 API 接口

用户说出需要新增的 API 接口时，按以下流程执行：

## 步骤

1. 确认接口路径、HTTP 方法、需要的字段
2. 在 `routes/` 目录下新建或扩展路由文件，遵循现有模式：
   - 使用 `express.Router()`
   - 引入 `../config/db`（pool）和 `../middleware/auth`（requireRole）
   - GET 接口支持 `page/pageSize` 分页参数
   - POST/PUT 接口做字段非空校验
   - SQL 使用参数化查询（防注入）
   - 返回格式统一为 `{ code, message, data }`
   - 错误用 `console.error` 记录日志
3. 在 `server.js` 中添加 `app.use('/api', require('./routes/xxx'))`
4. 启动服务验证接口可用