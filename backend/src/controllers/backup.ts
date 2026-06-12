import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const BACKUP_VERSION = '1.0.0';
const BACKUP_DIR = path.join(__dirname, '../../backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const SENSITIVE_FIELDS: Record<string, string[]> = {
    User: ['passwordHash'],
};

const CORE_MODELS = [
    'User',
    'Work',
    'StyleConfig',
    'SystemSetting',
    'Message',
    'SeoConfig',
    'WorkSeo',
    'SensitiveWord',
    'PointRule',
    'LevelConfig',
] as const;

interface BackupData {
    version: string;
    createdAt: string;
    createdBy: number;
    checksum: string;
    recordCount: Record<string, number>;
    data: Record<string, any[]>;
    sensitiveFields: Record<string, string[]>;
    note?: string;
}

function sanitizeData(modelName: string, records: any[]): any[] {
    const sensitiveFields = SENSITIVE_FIELDS[modelName] || [];
    return records.map(record => {
        const sanitized = { ...record };
        for (const field of sensitiveFields) {
            if (sanitized[field] !== undefined) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    });
}

function generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function collectBackupData(): Promise<{ data: Record<string, any[]>; recordCount: Record<string, number> }> {
    const data: Record<string, any[]> = {};
    const recordCount: Record<string, number> = {};

    for (const model of CORE_MODELS) {
        const records = await (prisma as any)[model.toLowerCase()].findMany();
        const sanitizedRecords = sanitizeData(model, records);
        data[model] = sanitizedRecords;
        recordCount[model] = records.length;
    }

    return { data, recordCount };
}

export const createBackup = async (req: AuthRequest, res: Response) => {
    const { note } = req.body;
    const userId = req.user!.userId;

    let backupRecord: any = null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    try {
        backupRecord = await prisma.backup.create({
            data: {
                filename,
                version: BACKUP_VERSION,
                status: 'CREATING',
                fileSize: 0,
                recordCount: 0,
                checksum: '',
                note: note || null,
                createdById: userId,
            },
        });

        const { data, recordCount } = await collectBackupData();
        const totalRecords = Object.values(recordCount).reduce((sum, count) => sum + count, 0);

        const backupData: BackupData = {
            version: BACKUP_VERSION,
            createdAt: new Date().toISOString(),
            createdBy: userId,
            checksum: '',
            recordCount,
            data,
            sensitiveFields: SENSITIVE_FIELDS,
            note: note || undefined,
        };

        const jsonContent = JSON.stringify(backupData, null, 2);
        const checksum = generateChecksum(jsonContent);
        backupData.checksum = checksum;

        const finalContent = JSON.stringify(backupData, null, 2);
        fs.writeFileSync(filePath, finalContent, 'utf8');

        const fileSize = fs.statSync(filePath).size;

        await prisma.backup.update({
            where: { id: backupRecord.id },
            data: {
                status: 'COMPLETED',
                fileSize,
                recordCount: totalRecords,
                checksum,
            },
        });

        const result = await prisma.backup.findUnique({
            where: { id: backupRecord.id },
            include: { createdBy: { select: { username: true } } },
        });

        return apiResponse(res, 201, '备份创建成功', result);
    } catch (error: any) {
        if (backupRecord) {
            await prisma.backup.update({
                where: { id: backupRecord.id },
                data: { status: 'FAILED' },
            });
        }
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error('Backup creation failed:', error);
        return apiResponse(res, 500, `备份创建失败: ${error.message}`);
    }
};

export const getBackupList = async (req: Request, res: Response) => {
    const page = parseInt((req.query as any).page) || 1;
    const pageSize = parseInt((req.query as any).pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [backups, total] = await Promise.all([
        prisma.backup.findMany({
            include: { createdBy: { select: { username: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.backup.count(),
    ]);

    return apiResponse(res, 200, 'Success', {
        list: backups,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
    });
};

export const downloadBackup = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return apiResponse(res, 400, '无效的备份ID');
    }

    const backup = await prisma.backup.findUnique({ where: { id } });

    if (!backup) {
        return apiResponse(res, 404, '备份不存在');
    }

    if (backup.status !== 'COMPLETED') {
        return apiResponse(res, 400, '备份未完成或已失败，无法下载');
    }

    const filePath = path.join(BACKUP_DIR, backup.filename);

    if (!fs.existsSync(filePath)) {
        return apiResponse(res, 404, '备份文件不存在');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Content-Length', backup.fileSize);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
};

export const deleteBackup = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return apiResponse(res, 400, '无效的备份ID');
    }

    const backup = await prisma.backup.findUnique({ where: { id } });

    if (!backup) {
        return apiResponse(res, 404, '备份不存在');
    }

    const filePath = path.join(BACKUP_DIR, backup.filename);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.backup.delete({ where: { id } });

        return apiResponse(res, 200, '备份删除成功');
    } catch (error: any) {
        console.error('Backup deletion failed:', error);
        return apiResponse(res, 500, `删除失败: ${error.message}`);
    }
};

function validateBackupFile(filePath: string, expectedChecksum: string): { valid: boolean; data?: BackupData; error?: string } {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data: BackupData = JSON.parse(content);

        if (data.version !== BACKUP_VERSION) {
            return {
                valid: false,
                error: `版本不匹配：备份版本 ${data.version}，当前系统版本 ${BACKUP_VERSION}`,
            };
        }

        const tempData = { ...data, checksum: '' };
        const computedChecksum = generateChecksum(JSON.stringify(tempData, null, 2));

        if (computedChecksum !== data.checksum || data.checksum !== expectedChecksum) {
            return {
                valid: false,
                error: '文件完整性校验失败：校验和不匹配',
            };
        }

        return { valid: true, data };
    } catch (error: any) {
        return {
            valid: false,
            error: `文件解析失败: ${error.message}`,
        };
    }
}

async function restoreWithTransaction(backupData: BackupData): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
        const restoreOrder = [
            'SystemSetting',
            'LevelConfig',
            'PointRule',
            'StyleConfig',
            'SensitiveWord',
            'SeoConfig',
            'User',
            'Work',
            'WorkSeo',
            'Message',
        ];

        for (const modelName of restoreOrder) {
            const records = backupData.data[modelName];
            if (!records || records.length === 0) continue;

            await tx[modelName.toLowerCase()].deleteMany();

            if (records.length > 0) {
                const cleanedRecords = records.map(record => {
                    const { id, ...data } = record;
                    return data;
                });

                await tx[modelName.toLowerCase()].createMany({
                    data: cleanedRecords,
                    skipDuplicates: true,
                });
            }
        }

        const backupRecord = await tx.backup.findFirst({
            where: { checksum: backupData.checksum },
        });

        if (backupRecord) {
            await tx.operationLog.create({
                data: {
                    userId: backupData.createdBy,
                    action: 'RESTORE_BACKUP',
                    detail: `从备份 ${backupRecord.filename} 恢复数据，共 ${Object.values(backupData.recordCount).reduce((a, b) => a + b, 0)} 条记录`,
                },
            });
        }
    }, {
        timeout: 60000,
    });
}

export const restoreBackup = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { confirm } = req.body;

    if (isNaN(id)) {
        return apiResponse(res, 400, '无效的备份ID');
    }

    if (!confirm || confirm !== 'I_CONFIRM_RESTORE') {
        return apiResponse(res, 400, '请确认恢复操作');
    }

    const backup = await prisma.backup.findUnique({ where: { id } });

    if (!backup) {
        return apiResponse(res, 404, '备份不存在');
    }

    if (backup.status !== 'COMPLETED') {
        return apiResponse(res, 400, '备份未完成或已失败，无法恢复');
    }

    const filePath = path.join(BACKUP_DIR, backup.filename);

    if (!fs.existsSync(filePath)) {
        return apiResponse(res, 404, '备份文件不存在');
    }

    const validation = validateBackupFile(filePath, backup.checksum);

    if (!validation.valid || !validation.data) {
        return apiResponse(res, 400, validation.error || '备份文件校验失败');
    }

    try {
        await restoreWithTransaction(validation.data);

        return apiResponse(res, 200, '数据恢复成功', {
            restoredAt: new Date().toISOString(),
            recordCount: validation.data.recordCount,
        });
    } catch (error: any) {
        console.error('Backup restoration failed:', error);
        return apiResponse(res, 500, `恢复失败，已回滚: ${error.message}`);
    }
};

export const getBackupDetail = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return apiResponse(res, 400, '无效的备份ID');
    }

    const backup = await prisma.backup.findUnique({
        where: { id },
        include: { createdBy: { select: { username: true } } },
    });

    if (!backup) {
        return apiResponse(res, 404, '备份不存在');
    }

    const filePath = path.join(BACKUP_DIR, backup.filename);

    if (!fs.existsSync(filePath)) {
        return apiResponse(res, 200, 'Success', {
            ...backup,
            fileExists: false,
        });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data: BackupData = JSON.parse(content);

        return apiResponse(res, 200, 'Success', {
            ...backup,
            fileExists: true,
            recordCount: data.recordCount,
            sensitiveFields: data.sensitiveFields,
        });
    } catch (error: any) {
        return apiResponse(res, 200, 'Success', {
            ...backup,
            fileExists: true,
            fileError: error.message,
        });
    }
};
