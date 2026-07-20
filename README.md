# 家校通后端 API 服务

面向 K12 教育的家校沟通平台后端服务，为学生、家长、教师和学校领导提供全方位的家校互动功能。

## 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Node.js | 运行时环境 | — |
| Express.js | Web 框架 | ^4.21.2 |
| MySQL | 关系型数据库 | — |
| mysql2 | MySQL 数据库驱动（支持 Promise / 连接池） | ^3.12.0 |
| jsonwebtoken | JWT 用户鉴权 | ^9.0.2 |
| bcryptjs | 密码哈希加密 | ^2.4.3 |
| cors | 跨域资源共享 | ^2.8.5 |
| body-parser | HTTP 请求体解析 | ^1.20.3 |
| dotenv | 环境变量加载 | ^16.4.7 |
| express-rate-limit | API 接口限流 | ^7.5.0 |

## 功能特性

### 用户体系（4 种角色）

| 角色 | 标识 | 主要权限 |
|------|------|---------|
| 学生 | `student` | 查看作业、成绩、考勤、通知、活动 |
| 家长 | `parent` | 查看绑定子女的各项信息 |
| 教师 | `teacher` | 发布作业/活动/通知，录入成绩/考勤/奖罚/评语，审核用户 |
| 学校领导 | `leader` | 全部权限 + 学校设置 + 班级管理 + 全校数据 |

### 业务模块（12 个）

- **登录/注册** — 多角色登录（学号/工号/手机号），注册后需审核
- **用户管理** — 用户列表、详情查询、状态审核（通过/禁用）
- **学校管理** — 学校详情查询、信息修改
- **班级管理** — 班级列表、创建班级（含班号）、班号加入班级、毕业冻结
- **通知公告** — 发布/修改/删除（软删除），支持置顶、分范围、浏览量统计
- **课后作业** — 布置（支持多班级同时分发）、修改、删除
- **学生活动** — 发布活动，支持留言/回复
- **考勤管理** — 进校/离校打卡记录，支持刷卡/人脸/手动录入
- **成绩管理** — 支持批量录入、按学生/考试/科目筛选
- **奖罚记录** — 奖励/惩罚记录管理
- **教师评语** — 综合评语/学科评语/期末评语
- **即时消息** — 私聊/群聊会话，文本/语音消息，已读标记

### 安全特性

- 密码使用 **bcrypt** 哈希加密（10 轮盐值）
- **JWT Token** 鉴权（7 天有效期）
- 登录/注册接口 **限流**（同 IP 每分钟最多 5 次）
- SQL 全部使用 **参数化查询**（防 SQL 注入）
- 密码字段在 API 返回中自动去除

## 项目结构

```
JiaXiaoTong_Backend/
├── .claude/skills/            # Claude Code 开发辅助技能
│   ├── add-api.md             #   新增 API 接口规范指引
│   ├── api-doc.md             #   生成 API 文档规范
│   └── db-alter.md            #   数据库结构变更规范
├── config/
│   └── db.js                  # MySQL 连接池配置
├── db/
│   ├── schema.sql             # 完整建表脚本（含默认数据）
│   ├── migration_v3_messages.sql    # V3 迁移：会话与消息系统
│   └── migration_v4_class_code.sql  # V4 迁移：班级表增加班号字段
├── middleware/
│   ├── auth.js                # JWT 鉴权中间件 + 角色校验工具
│   └── rateLimiter.js         # 登录/注册接口限流
├── routes/
│   ├── auth.js                # 登录 + 注册（公开接口）
│   ├── users.js               # 用户管理
│   ├── schools.js             # 学校信息管理
│   ├── classes.js             # 班级管理
│   ├── notices.js             # 通知公告
│   ├── homeworks.js           # 课后作业
│   ├── activities.js          # 学生活动 + 留言
│   ├── attendance.js          # 考勤记录
│   ├── grades.js              # 成绩管理
│   ├── rewards.js             # 奖罚记录
│   ├── evaluations.js         # 教师评语
│   └── messages.js            # 会话 & 消息
├── server.js                  # 应用入口
├── .env                       # 环境变量（不纳入版本控制）
├── .gitignore
├── package.json
├── 接口文档.md                # 完整 API 接口文档
└── README.md
```

## 快速开始

### 环境要求

- **Node.js** >= 18
- **MySQL** >= 5.7（建议 8.0，字符集 utf8mb4）

### 安装与配置

```bash
# 1. 克隆项目
git clone <仓库地址>
cd JiaXiaoTong_Backend

# 2. 安装依赖
npm install

# 3. 创建 .env 文件（参考下方模板）
cp .env .env  # 或手动创建
```

**`.env` 配置模板：**

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=家校通

JWT_SECRET=你的JWT密钥（请修改为随机字符串）
HOST=0.0.0.0
PORT=3001
```

### 初始化数据库

```bash
# 使用 db/schema.sql 创建所有表和默认数据
mysql -u root -p < db/schema.sql
```

如果数据库中已有旧版本结构，请按需执行迁移脚本：

```bash
mysql -u root -p 家校通 < db/migration_v3_messages.sql   # V3：消息系统
mysql -u root -p 家校通 < db/migration_v4_class_code.sql  # V4：班号字段
```

### 启动服务

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式
npm start
```

启动后控制台输出：

```
API服务运行在 http://0.0.0.0:3001
测试页面: http://0.0.0.0:3001/test.html
```

## API 接口概览

- **Base URL**：`http://<服务器IP>:3001/api`
- **统一返回格式**：`{ code: 200, message: "提示信息", data: { ... } }`
- **鉴权方式**：请求头携带 `Authorization: Bearer <token>`

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录（身份 + 账号 + 密码） |
| POST | `/api/register` | 注册（按角色传不同参数） |

### 需鉴权接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/me` | 登录用户 | 当前用户完整信息 |
| GET | `/api/users` | teacher/leader | 用户列表 |
| PUT | `/api/users/:id/status` | teacher/leader | 审核用户 |
| GET | `/api/users/:id` | 登录用户 | 用户详情 |
| GET | `/api/schools/:id` | 登录用户 | 学校详情 |
| PUT | `/api/schools/:id` | leader | 修改学校信息 |
| GET | `/api/classes` | 登录用户 | 班级列表 |
| POST | `/api/classes` | teacher/leader | 创建班级 |
| POST | `/api/classes/join` | 登录用户 | 通过班号加入班级 |
| PUT | `/api/classes/:id/graduate` | leader | 冻结毕业班级 |
| GET | `/api/notices` | 登录用户 | 通知列表（分页） |
| GET/POST/PUT/DELETE | `/api/notices[/:id]` | teacher/leader | 通知增删改查 |
| GET | `/api/homeworks` | 登录用户 | 作业列表（分页） |
| POST/PUT/DELETE | `/api/homeworks[/:id]` | teacher | 作业增删改 |
| GET | `/api/activities` | 登录用户 | 活动列表（分页） |
| POST | `/api/activities` | teacher | 发布活动 |
| GET/POST | `/api/activities/:id/comments` | 登录用户 | 活动留言 |
| GET | `/api/attendance` | 登录用户 | 考勤列表（分页） |
| POST | `/api/attendance` | teacher/leader | 录入考勤 |
| GET | `/api/grades` | 登录用户 | 成绩列表（分页） |
| POST | `/api/grades` | teacher | 批量录入成绩 |
| GET | `/api/rewards-punishments` | 登录用户 | 奖罚列表（分页） |
| POST | `/api/rewards-punishments` | teacher | 录入奖罚 |
| GET | `/api/evaluations` | 登录用户 | 评语列表（分页） |
| POST | `/api/evaluations` | teacher | 写评语 |
| GET | `/api/conversations` | 登录用户 | 我的会话列表 |
| POST | `/api/conversations` | 登录用户 | 创建会话（私聊/群聊） |
| GET | `/api/conversations/:id` | 登录用户 | 会话详情 |
| GET | `/api/messages/:conversation_id` | 登录用户 | 消息列表（分页） |
| POST | `/api/messages` | 登录用户 | 发送消息 |
| PUT | `/api/messages/read/:conversation_id` | 登录用户 | 标记已读 |

> 完整接口参数和返回示例请参阅 [接口文档.md](./接口文档.md)。

## 数据库设计

- **数据库名**：`家校通`
- **字符集**：`utf8mb4`，引擎：`InnoDB`
- **数据表**：共 21 张（含核心用户表 8 张 + 业务表 10 张 + 消息系统表 3 张）

| 表名 | 说明 |
|------|------|
| `user` | 统一用户认证表 |
| `student` | 学生详细信息 |
| `parent_detail` | 家长详细信息 |
| `teacher_detail` | 教师详细信息 |
| `leader_detail` | 领导详细信息 |
| `parent_student` | 家长-学生关联表 |
| `school` | 学校表 |
| `class` | 班级表（含班号） |
| `notice` / `notice_target` | 通知公告及发布范围 |
| `homework` | 课后作业 |
| `activity` / `activity_image` / `activity_comment` | 活动及留言 |
| `grade` | 成绩表 |
| `reward_punishment` | 奖罚记录 |
| `evaluation` | 教师评语 |
| `attendance` | 考勤记录 |
| `conversation` / `conversation_member` / `message` | 会话与消息系统 |

## 前端对接

本项目配套 **鸿蒙 (HarmonyOS) ArkTS** 前端应用。[接口文档.md](./接口文档.md) 中包含完整的：

- TypeScript 类型定义（`types.ets`）
- 统一请求封装（`api.ets`，基于 `@ohos.net.http`）
- Token 持久化方案（`@ohos.data.preferences`）
- 页面调用示例

后续也支持其他前端框架（Vue/React 等）通过标准 HTTP 协议对接。

## 开发规范

本项目配置了 3 个 Claude Code 开发辅助技能（`.claude/skills/`）：

- **add-api** — 新增 API 接口需遵循路由模式、SQL 参数化、统一返回格式
- **api-doc** — 接口文档自动生成规范
- **db-alter** — 数据库结构变更需同步更新 schema.sql 和迁移脚本

代码风格要点：
- SQL 全部使用参数化查询，禁止字符串拼接
- API 返回统一使用 `{ code, message, data }` 格式
- 敏感信息（密码、JWT 密钥）不出现在返回结果中
- 所有变更须更新接口文档和代码说明
