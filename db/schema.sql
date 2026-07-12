-- ============================================================
--  家校通 数据库完整建表脚本
--  数据库名：家校通
--  字符集：utf8mb4
--  引擎：InnoDB
-- ============================================================

USE `家校通`;

-- ============================================================
--  一、用户体系
-- ============================================================

-- 1.1 统一用户认证表
CREATE TABLE IF NOT EXISTS `user` (
  `id`          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  `username`    VARCHAR(50)   NOT NULL COMMENT '登录名（学号/工号/手机号）',
  `password`    VARCHAR(255)  NOT NULL COMMENT 'bcrypt 加密后的密码',
  `role`        VARCHAR(20)   NOT NULL DEFAULT 'student' COMMENT '角色：student|teacher|parent|leader',
  `phone`       VARCHAR(20)   DEFAULT NULL COMMENT '手机号',
  `child_name`  VARCHAR(50)   DEFAULT NULL COMMENT '子女姓名（家长注册时填写）',
  `class_name`  VARCHAR(50)   DEFAULT NULL COMMENT '班级名称（家长注册时填写）',
  `status`      TINYINT       NOT NULL DEFAULT 0 COMMENT '0=待审核 1=已激活 2=已禁用',
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统一用户认证表';

-- 1.2 学校表
CREATE TABLE IF NOT EXISTS `school` (
  `id`          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '学校ID',
  `name`        VARCHAR(100)  NOT NULL COMMENT '学校全称',
  `short_name`  VARCHAR(50)   DEFAULT NULL COMMENT '学校简称',
  `address`     VARCHAR(255)  DEFAULT NULL COMMENT '学校地址',
  `phone`       VARCHAR(20)   DEFAULT NULL COMMENT '学校联系电话',
  `description` TEXT          DEFAULT NULL COMMENT '学校简介',
  `logo_url`    VARCHAR(255)  DEFAULT NULL COMMENT '校徽图片URL',
  `status`      TINYINT       NOT NULL DEFAULT 1 COMMENT '0=停用 1=启用',
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_school_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学校表';

-- 1.3 班级表
CREATE TABLE IF NOT EXISTS `class` (
  `id`              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '班级ID',
  `school_id`       INT           NOT NULL COMMENT '所属学校ID',
  `name`            VARCHAR(50)   NOT NULL COMMENT '班级名称（如：三年级一班）',
  `grade`           VARCHAR(20)   DEFAULT NULL COMMENT '年级（如：三年级）',
  `year`            INT           DEFAULT NULL COMMENT '入学年份',
  `head_teacher_id` INT           DEFAULT NULL COMMENT '班主任用户ID，关联 user.id',
  `is_graduated`    TINYINT       NOT NULL DEFAULT 0 COMMENT '0=在读 1=已毕业（冻结）',
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_school_id` (`school_id`),
  KEY `idx_head_teacher` (`head_teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级表';

-- 1.4 学生详细信息表
CREATE TABLE IF NOT EXISTS `student` (
  `id`             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `user_id`        INT           NOT NULL COMMENT '关联 user.id（学生登录账号）',
  `student_no`     VARCHAR(30)   DEFAULT NULL COMMENT '学号',
  `real_name`      VARCHAR(50)   NOT NULL COMMENT '学生真实姓名',
  `gender`         VARCHAR(5)    DEFAULT NULL COMMENT '性别：男/女',
  `birth_date`     DATE          DEFAULT NULL COMMENT '出生日期',
  `school_id`      INT           DEFAULT NULL COMMENT '所属学校ID',
  `class_id`       INT           DEFAULT NULL COMMENT '所属班级ID',
  `address`        VARCHAR(255)  DEFAULT NULL COMMENT '家庭住址',
  `guardian_phone` VARCHAR(20)   DEFAULT NULL COMMENT '监护人电话',
  `status`         TINYINT       NOT NULL DEFAULT 1 COMMENT '0=离校 1=在读',
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_student_no` (`student_no`),
  KEY `idx_class_id` (`class_id`),
  KEY `idx_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生详细信息表';

-- 1.5 家长-学生关联表（多对多）
CREATE TABLE IF NOT EXISTS `parent_student` (
  `id`          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `parent_id`   INT         NOT NULL COMMENT '家长用户ID，关联 user.id',
  `student_id`  INT         NOT NULL COMMENT '学生记录ID，关联 student.id',
  `relation`    VARCHAR(20) NOT NULL DEFAULT 'father' COMMENT '关系：father|mother|grandfather|grandmother|other',
  `is_primary`  TINYINT     NOT NULL DEFAULT 0 COMMENT '0=普通联系人 1=主联系人',
  `created_at`  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_parent_student` (`parent_id`, `student_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长-学生关联表';

-- ============================================================
--  二、业务数据
-- ============================================================

-- 2.1 通知公告表
CREATE TABLE IF NOT EXISTS `notice` (
  `id`           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '通知ID',
  `title`        VARCHAR(200) NOT NULL COMMENT '通知标题',
  `content`      TEXT         NOT NULL COMMENT '通知正文',
  `publisher_id` INT          NOT NULL COMMENT '发布者用户ID，关联 user.id',
  `school_id`    INT          DEFAULT NULL COMMENT '所属学校ID，NULL 表示全平台',
  `scope`        VARCHAR(20)  NOT NULL DEFAULT 'all' COMMENT '发布范围：all|school|class|role',
  `is_top`       TINYINT      NOT NULL DEFAULT 0 COMMENT '0=普通 1=置顶',
  `view_count`   INT          NOT NULL DEFAULT 0 COMMENT '浏览次数',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '0=已删除 1=正常 2=草稿',
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_publisher` (`publisher_id`),
  KEY `idx_school_id` (`school_id`),
  KEY `idx_is_top` (`is_top`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知公告表';

-- 2.2 通知目标表（通知发给哪些角色/班级/用户）
CREATE TABLE IF NOT EXISTS `notice_target` (
  `id`           INT         NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `notice_id`    INT         NOT NULL COMMENT '通知ID',
  `target_type`  VARCHAR(20) NOT NULL COMMENT '目标类型：role|class|user',
  `target_value` VARCHAR(50) NOT NULL COMMENT '目标值（角色名/班级ID/用户ID）',
  KEY `idx_notice_id` (`notice_id`),
  KEY `idx_target` (`target_type`, `target_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知目标表';

-- 2.3 课后作业表
CREATE TABLE IF NOT EXISTS `homework` (
  `id`             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '作业ID',
  `title`          VARCHAR(200) NOT NULL COMMENT '作业标题',
  `content`        TEXT         NOT NULL COMMENT '作业内容',
  `subject`        VARCHAR(30)  DEFAULT NULL COMMENT '科目：语文|数学|英语|科学|其他',
  `teacher_id`     INT          NOT NULL COMMENT '布置教师用户ID，关联 user.id',
  `class_id`       INT          NOT NULL COMMENT '目标班级ID，关联 class.id',
  `deadline`       DATETIME     DEFAULT NULL COMMENT '截止时间',
  `attachment_url` VARCHAR(255) DEFAULT NULL COMMENT '附件链接',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '0=已删除 1=正常',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_teacher_id` (`teacher_id`),
  KEY `idx_class_id` (`class_id`),
  KEY `idx_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课后作业表';

-- 2.4 学生活动表
CREATE TABLE IF NOT EXISTS `activity` (
  `id`           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '活动ID',
  `title`        VARCHAR(200) NOT NULL COMMENT '活动标题',
  `content`      TEXT         DEFAULT NULL COMMENT '活动内容描述',
  `location`     VARCHAR(200) DEFAULT NULL COMMENT '活动地点',
  `start_time`   DATETIME     DEFAULT NULL COMMENT '开始时间',
  `end_time`     DATETIME     DEFAULT NULL COMMENT '结束时间',
  `organizer_id` INT          NOT NULL COMMENT '组织者用户ID，关联 user.id',
  `class_id`     INT          DEFAULT NULL COMMENT '关联班级ID，NULL 表示全校活动',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '0=已取消 1=正常 2=已结束',
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_organizer` (`organizer_id`),
  KEY `idx_class_id` (`class_id`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生活动表';

-- 2.5 活动图片表
CREATE TABLE IF NOT EXISTS `activity_image` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '图片ID',
  `activity_id` INT          NOT NULL COMMENT '活动ID',
  `image_url`   VARCHAR(255) NOT NULL COMMENT '图片URL',
  `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT '排序序号',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_activity_id` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动图片表';

-- 2.6 活动留言表
CREATE TABLE IF NOT EXISTS `activity_comment` (
  `id`          INT       NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '留言ID',
  `activity_id` INT       NOT NULL COMMENT '活动ID',
  `user_id`     INT       NOT NULL COMMENT '留言用户ID',
  `content`     TEXT      NOT NULL COMMENT '留言内容',
  `parent_id`   INT       DEFAULT NULL COMMENT '父留言ID（用于回复）',
  `status`      TINYINT   NOT NULL DEFAULT 1 COMMENT '0=已删除 1=正常',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动留言表';

-- 2.7 成绩表
CREATE TABLE IF NOT EXISTS `grade` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '成绩ID',
  `student_id`  INT          NOT NULL COMMENT '学生记录ID，关联 student.id',
  `subject`     VARCHAR(30)  NOT NULL COMMENT '科目',
  `score`       DECIMAL(5,1) NOT NULL COMMENT '分数',
  `exam_name`   VARCHAR(100) DEFAULT NULL COMMENT '考试名称（如：期中考试）',
  `exam_date`   DATE         DEFAULT NULL COMMENT '考试日期',
  `class_rank`  INT          DEFAULT NULL COMMENT '班级排名',
  `grade_rank`  INT          DEFAULT NULL COMMENT '年级排名',
  `max_score`   DECIMAL(5,1) DEFAULT NULL COMMENT '满分',
  `avg_score`   DECIMAL(5,1) DEFAULT NULL COMMENT '班级平均分',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_student_id` (`student_id`),
  KEY `idx_exam_name` (`exam_name`),
  KEY `idx_subject` (`subject`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩表';

-- 2.8 奖罚记录表
CREATE TABLE IF NOT EXISTS `reward_punishment` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `student_id`  INT          NOT NULL COMMENT '学生记录ID，关联 student.id',
  `type`        VARCHAR(10)  NOT NULL COMMENT '类型：reward（奖励）|punishment（惩罚）',
  `title`       VARCHAR(200) NOT NULL COMMENT '标题',
  `description` TEXT         DEFAULT NULL COMMENT '详细描述',
  `level`       VARCHAR(20)  DEFAULT NULL COMMENT '级别：校级|年级|班级',
  `record_date` DATE         NOT NULL COMMENT '记录日期',
  `issuer_id`   INT          DEFAULT NULL COMMENT '颁发者用户ID，关联 user.id',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_student_id` (`student_id`),
  KEY `idx_type` (`type`),
  KEY `idx_record_date` (`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='奖罚记录表';

-- 2.9 教师评语表
CREATE TABLE IF NOT EXISTS `evaluation` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '评语ID',
  `student_id`  INT          NOT NULL COMMENT '学生记录ID，关联 student.id',
  `teacher_id`  INT          NOT NULL COMMENT '评语教师用户ID，关联 user.id',
  `semester`    VARCHAR(30)  DEFAULT NULL COMMENT '学期（如：2026年上学期）',
  `content`     TEXT         NOT NULL COMMENT '评语内容',
  `type`        VARCHAR(20)  NOT NULL DEFAULT 'comprehensive' COMMENT '类型：comprehensive(综合)|subject(学科)|term(期末)',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_student_id` (`student_id`),
  KEY `idx_teacher_id` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师评语表';

-- 2.10 考勤记录表
CREATE TABLE IF NOT EXISTS `attendance` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '考勤ID',
  `student_id`  INT          NOT NULL COMMENT '学生记录ID，关联 student.id',
  `record_time` DATETIME     NOT NULL COMMENT '刷卡/记录时间',
  `direction`   VARCHAR(10)  NOT NULL COMMENT '方向：in（进校）|out（离校）',
  `method`      VARCHAR(20)  DEFAULT 'card' COMMENT '方式：card(刷卡)|face(人脸)|manual(手动)',
  `device_name` VARCHAR(50)  DEFAULT NULL COMMENT '设备名称',
  `source`      VARCHAR(20)  DEFAULT 'internal' COMMENT '数据来源：internal(内部)|external(门禁系统同步)',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_student_id` (`student_id`),
  KEY `idx_record_time` (`record_time`),
  KEY `idx_direction` (`direction`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤记录表';

-- ============================================================
--  三、基础数据（可选，按需执行）
-- ============================================================

-- 插入默认学校
INSERT IGNORE INTO `school` (`id`, `name`, `short_name`, `status`) VALUES
(1, '示例第一小学', '一小', 1);

-- 插入默认班级
INSERT IGNORE INTO `class` (`id`, `school_id`, `name`, `grade`, `year`) VALUES
(1, 1, '一年级一班', '一年级', 2026),
(2, 1, '二年级一班', '二年级', 2025),
(3, 1, '三年级一班', '三年级', 2024);

-- ============================================================
--  附录：已有 user 表升级语句
-- ============================================================

-- V2: 将登录标识从 username 改为 phone，去掉家长专属字段，加真实姓名
-- 执行前请确保 user 表中 phone 列无重复值，否则 uk_phone 会失败
-- ALTER TABLE `user`
--   DROP COLUMN `child_name`,
--   DROP COLUMN `class_name`,
--   ADD COLUMN `real_name` VARCHAR(50) DEFAULT NULL COMMENT '真实姓名' AFTER `phone`,
--   DROP INDEX `uk_username`,
--   MODIFY `username` VARCHAR(50) DEFAULT NULL COMMENT '登录名（已废弃，改用 phone 登录）',
--   ADD UNIQUE KEY `uk_phone` (`phone`);

-- ============================================================
--  四、角色扩展表（V2 新增）
-- ============================================================

-- 4.1 家长详细信息表
CREATE TABLE IF NOT EXISTS `parent_detail` (
  `id`         INT         NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `user_id`    INT         NOT NULL COMMENT '家长用户ID，关联 user.id',
  `student_id` INT         NOT NULL COMMENT '绑定的学生ID，关联 student.id',
  `relation`   VARCHAR(20) NOT NULL DEFAULT 'father' COMMENT '关系：father|mother|grandfather|grandmother|other',
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长详细信息表';

-- 4.2 教师详细信息表
CREATE TABLE IF NOT EXISTS `teacher_detail` (
  `id`               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `user_id`          INT          NOT NULL COMMENT '教师用户ID，关联 user.id',
  `teacher_no`       VARCHAR(30)  NOT NULL COMMENT '教师工号',
  `subject`          VARCHAR(50)  DEFAULT NULL COMMENT '任教科目（如：语文、数学）',
  `is_class_teacher` TINYINT      NOT NULL DEFAULT 0 COMMENT '0=科任老师 1=班主任',
  `managed_classes`  VARCHAR(200) DEFAULT NULL COMMENT '管理班级ID列表（JSON数组，如：[1,2]）',
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_teacher_no` (`teacher_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师详细信息表';

-- 4.3 领导详细信息表
CREATE TABLE IF NOT EXISTS `leader_detail` (
  `id`         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `user_id`    INT          NOT NULL COMMENT '领导用户ID，关联 user.id',
  `title`      VARCHAR(50)  NOT NULL COMMENT '职位（如：校长、教务主任）',
  `dept_name`  VARCHAR(50)  DEFAULT NULL COMMENT '所属部门（如：教务处、校长室）',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='领导详细信息表';
