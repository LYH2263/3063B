-- 创建敏感词级别枚举
CREATE TYPE `SensitiveWordLevel` AS ENUM ('BAN', 'REPLACE', 'REVIEW');

-- 创建敏感词表
CREATE TABLE `SensitiveWord` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `word` VARCHAR(255) NOT NULL,
    `level` `SensitiveWordLevel` NOT NULL DEFAULT 'BAN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `category` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SensitiveWord_word_key`(`word`),
    INDEX `SensitiveWord_level_idx`(`level`),
    INDEX `SensitiveWord_isActive_idx`(`isActive`),
    INDEX `SensitiveWord_word_idx`(`word`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 插入一些默认敏感词作为示例
INSERT INTO `SensitiveWord` (`word`, `level`, `category`, `isActive`) VALUES
('违禁词1', 'BAN', '政治', true),
('违禁词2', 'BAN', '色情', true),
('敏感词1', 'REPLACE', '广告', true),
('敏感词2', 'REPLACE', '垃圾', true),
('审核词1', 'REVIEW', '疑似', true);
