-- ============================================================
--  V3：会话 & 消息系统
--  新增表：conversation、conversation_member、message
-- ============================================================

USE `家校通`;

-- 3.1 会话表
CREATE TABLE IF NOT EXISTS `conversation` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '会话ID',
  `conv_type`   VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE' COMMENT '会话类型：PRIVATE(私聊)|GROUP(群聊)',
  `conv_name`   VARCHAR(100) DEFAULT NULL COMMENT '会话名称（私聊为对方姓名，群聊为群名）',
  `conv_avatar` VARCHAR(255) DEFAULT NULL COMMENT '会话头像URL',
  `created_by`  INT          NOT NULL COMMENT '创建者用户ID，关联 user.id',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';

-- 3.2 会话成员表
CREATE TABLE IF NOT EXISTS `conversation_member` (
  `id`              INT       NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `conversation_id` INT       NOT NULL COMMENT '会话ID，关联 conversation.id',
  `user_id`         INT       NOT NULL COMMENT '用户ID，关联 user.id',
  `joined_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_conv_user` (`conversation_id`, `user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_conversation_id` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话成员表';

-- 3.3 消息表
CREATE TABLE IF NOT EXISTS `message` (
  `id`              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '消息ID',
  `conversation_id` INT          NOT NULL COMMENT '所属会话ID，关联 conversation.id',
  `sender_id`       INT          NOT NULL COMMENT '发送者用户ID，关联 user.id',
  `msg_type`        VARCHAR(10)  NOT NULL DEFAULT 'TEXT' COMMENT '消息类型：TEXT(文本)|VOICE(语音)',
  `content`         TEXT         DEFAULT NULL COMMENT '消息内容',
  `voice_url`       VARCHAR(255) DEFAULT NULL COMMENT '语音文件URL',
  `voice_duration`  INT          DEFAULT NULL COMMENT '语音时长(秒)',
  `send_time`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `is_read`         TINYINT      NOT NULL DEFAULT 0 COMMENT '0=未读 1=已读',
  `read_time`       TIMESTAMP    NULL DEFAULT NULL COMMENT '阅读时间',
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_send_time` (`send_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';
