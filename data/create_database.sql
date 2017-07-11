CREATE DATABASE `nodejs_chat` CHARACTER SET utf8 COLLATE utf8_unicode_ci;

CREATE TABLE `messages` (
  `m_id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `m_body` TEXT,
  `m_date` INT UNSIGNED,
  `author` VARCHAR(255)
);