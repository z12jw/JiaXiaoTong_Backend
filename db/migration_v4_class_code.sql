-- V4：班级表添加 class_code（班号），学生通过班号加入班级
USE `家校通`;

ALTER TABLE `class` ADD COLUMN `class_code` VARCHAR(20) DEFAULT NULL COMMENT '班号（唯一，学生凭此加入班级）' AFTER `name`;
ALTER TABLE `class` ADD UNIQUE KEY `uk_class_code` (`class_code`);
