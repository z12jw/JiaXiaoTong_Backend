# 数据库结构变更

用户描述需要新增的表或字段时：

1. 生成 `ALTER TABLE` 或 `CREATE TABLE` SQL 语句
2. SQL 遵循现有规范：InnoDB 引擎、utf8mb4 字符集、中文 COMMENT
3. 将 SQL 追加写入 `db/schema.sql`（末尾，加上注释说明变更原因和日期）
4. 提醒用户在 Navicat 中执行
5. 如果新增字段影响现有 API，同步修改对应的 `routes/` 文件
