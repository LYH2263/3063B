-- 创建备份状态枚举
CREATE TYPE `BackupStatus` AS ENUM ('CREATING', 'COMPLETED', 'FAILED');

-- 创建备份表
CREATE TABLE `Backup` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(255) NOT NULL,
    `version` VARCHAR(50) NOT NULL,
    `status` `BackupStatus` NOT NULL DEFAULT 'CREATING',
    `fileSize` BIGINT NOT NULL,
    `recordCount` INT NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `note` TEXT NULL,
    `createdById` INT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Backup_filename_key`(`filename`),
    INDEX `Backup_status_idx`(`status`),
    INDEX `Backup_createdAt_idx`(`createdAt`),
    INDEX `Backup_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Backup_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
