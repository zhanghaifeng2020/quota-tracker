-- 创建数据库与数据表
CREATE DATABASE IF NOT EXISTS `quota_tracker` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `quota_tracker`;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(60) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_users_username` (`username`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订阅与额度表（每个用户隔离自己的表记录）
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` INT NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `kind` ENUM('cycle', 'once') NOT NULL DEFAULT 'cycle',
  `mode` ENUM('interval', 'weekday', 'monthday') NOT NULL DEFAULT 'interval',
  `interval_days` INT NOT NULL DEFAULT 7,
  `weekday` TINYINT NOT NULL DEFAULT 1,
  `month_day` TINYINT NOT NULL DEFAULT 1,
  `anchor` VARCHAR(32) NOT NULL DEFAULT '',
  `due` VARCHAR(32) NOT NULL DEFAULT '',
  `note` VARCHAR(255) NOT NULL DEFAULT '',
  `track_quota` TINYINT(1) NOT NULL DEFAULT 1,
  `quota_label` VARCHAR(64) NOT NULL DEFAULT '额度',
  `quota_total` DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  `quota_used` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `quota_epoch` VARCHAR(32) NOT NULL DEFAULT '',
  `quota_initialized` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `id`),
  KEY `idx_sub_user_id` (`user_id`),
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户登录与在线时长流水表
CREATE TABLE IF NOT EXISTS `user_login_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `session_id` VARCHAR(64) NOT NULL UNIQUE,
  `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_heartbeat` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_time` DATETIME NULL,
  `duration_seconds` INT NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(64) DEFAULT '',
  `user_agent` VARCHAR(255) DEFAULT '',
  `status` ENUM('active', 'logged_out', 'timeout') DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_logs_user_id` (`user_id`),
  KEY `idx_logs_login_time` (`login_time`),
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
