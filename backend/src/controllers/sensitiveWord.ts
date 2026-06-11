import { Request, Response } from 'express';
import { PrismaClient, SensitiveWordLevel } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import { refreshSensitiveWordFilter } from '../services/sensitiveWordService';
import { z } from 'zod';

const prisma = new PrismaClient();

const sensitiveWordSchema = z.object({
    word: z.string().min(1, '敏感词不能为空'),
    level: z.enum(['BAN', 'REPLACE', 'REVIEW'] as const),
    category: z.string().optional(),
    isActive: z.boolean().optional().default(true)
});

const batchImportSchema = z.object({
    words: z.array(
        z.object({
            word: z.string().min(1),
            level: z.enum(['BAN', 'REPLACE', 'REVIEW'] as const),
            category: z.string().optional()
        })
    )
});

const logOperation = async (req: AuthRequest, action: string, detail: string) => {
    try {
        const forwardedFor = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor as string) || req.ip || '';
        await prisma.operationLog.create({
            data: {
                userId: req.user!.userId,
                action,
                detail,
                ip
            }
        });
    } catch (e) {
        console.error('Failed to log operation:', e);
    }
};

export const getSensitiveWords = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const level = req.query.level as SensitiveWordLevel | undefined;
    const isActive = req.query.isActive as string | undefined;
    const keyword = req.query.keyword as string | undefined;

    const where: any = {};
    if (level) where.level = level;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (keyword) where.word = { contains: keyword };

    const [words, total] = await Promise.all([
        prisma.sensitiveWord.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ level: 'asc' }, { word: 'asc' }]
        }),
        prisma.sensitiveWord.count({ where })
    ]);

    return apiResponse(res, 200, 'Success', {
        list: words,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    });
};

export const getSensitiveWordById = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const word = await prisma.sensitiveWord.findUnique({ where: { id } });
    if (!word) return apiResponse(res, 404, 'Sensitive word not found');

    return apiResponse(res, 200, 'Success', word);
};

export const createSensitiveWord = async (req: AuthRequest, res: Response) => {
    const parseResult = sensitiveWordSchema.safeParse(req.body);
    if (!parseResult.success) {
        return apiResponse(res, 400, parseResult.error.issues[0].message);
    }

    const { word, level, category, isActive } = parseResult.data;

    const existing = await prisma.sensitiveWord.findUnique({ where: { word } });
    if (existing) return apiResponse(res, 400, '该敏感词已存在');

    const created = await prisma.sensitiveWord.create({
        data: { word, level, category, isActive }
    });

    await refreshSensitiveWordFilter();
    await logOperation(req, 'CREATE_SENSITIVE_WORD', `创建敏感词: ${word}, 级别: ${level}`);

    return apiResponse(res, 201, 'Sensitive word created successfully', created);
};

export const updateSensitiveWord = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const parseResult = sensitiveWordSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
        return apiResponse(res, 400, parseResult.error.issues[0].message);
    }

    const { word, level, category, isActive } = parseResult.data;

    const existing = await prisma.sensitiveWord.findUnique({ where: { id } });
    if (!existing) return apiResponse(res, 404, 'Sensitive word not found');

    if (word && word !== existing.word) {
        const duplicate = await prisma.sensitiveWord.findUnique({ where: { word } });
        if (duplicate) return apiResponse(res, 400, '该敏感词已存在');
    }

    const updated = await prisma.sensitiveWord.update({
        where: { id },
        data: { word, level, category, isActive }
    });

    await refreshSensitiveWordFilter();
    await logOperation(req, 'UPDATE_SENSITIVE_WORD', `更新敏感词 ID:${id}, 词: ${word || existing.word}`);

    return apiResponse(res, 200, 'Sensitive word updated successfully', updated);
};

export const deleteSensitiveWord = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const existing = await prisma.sensitiveWord.findUnique({ where: { id } });
    if (!existing) return apiResponse(res, 404, 'Sensitive word not found');

    await prisma.sensitiveWord.delete({ where: { id } });

    await refreshSensitiveWordFilter();
    await logOperation(req, 'DELETE_SENSITIVE_WORD', `删除敏感词: ${existing.word}`);

    return apiResponse(res, 200, 'Sensitive word deleted successfully');
};

export const toggleSensitiveWordStatus = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const existing = await prisma.sensitiveWord.findUnique({ where: { id } });
    if (!existing) return apiResponse(res, 404, 'Sensitive word not found');

    const updated = await prisma.sensitiveWord.update({
        where: { id },
        data: { isActive: !existing.isActive }
    });

    await refreshSensitiveWordFilter();
    await logOperation(req, 'TOGGLE_SENSITIVE_WORD', `切换敏感词状态: ${existing.word}, 新状态: ${updated.isActive ? '启用' : '停用'}`);

    return apiResponse(res, 200, `Sensitive word ${updated.isActive ? 'enabled' : 'disabled'}`, updated);
};

export const batchImportSensitiveWords = async (req: AuthRequest, res: Response) => {
    const parseResult = batchImportSchema.safeParse(req.body);
    if (!parseResult.success) {
        return apiResponse(res, 400, parseResult.error.issues[0].message);
    }

    const { words } = parseResult.data;
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const item of words) {
        try {
            await prisma.sensitiveWord.upsert({
                where: { word: item.word },
                update: {
                    level: item.level,
                    category: item.category,
                    isActive: true
                },
                create: {
                    word: item.word,
                    level: item.level,
                    category: item.category,
                    isActive: true
                }
            });
            results.success++;
        } catch (e: any) {
            results.failed++;
            results.errors.push(`词 "${item.word}": ${e.message}`);
        }
    }

    await refreshSensitiveWordFilter();
    await logOperation(req, 'BATCH_IMPORT_SENSITIVE_WORDS', `批量导入敏感词，成功: ${results.success}, 失败: ${results.failed}`);

    return apiResponse(res, 200, 'Batch import completed', results);
};

export const batchDeleteSensitiveWords = async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return apiResponse(res, 400, 'IDs array is required');
    }

    const words = await prisma.sensitiveWord.findMany({
        where: { id: { in: ids } },
        select: { word: true }
    });

    await prisma.sensitiveWord.deleteMany({
        where: { id: { in: ids } }
    });

    await refreshSensitiveWordFilter();
    await logOperation(req, 'BATCH_DELETE_SENSITIVE_WORDS', `批量删除敏感词: ${words.map(w => w.word).join(', ')}`);

    return apiResponse(res, 200, `${words.length} sensitive words deleted`);
};

export const getStatistics = async (req: Request, res: Response) => {
    const [total, banCount, replaceCount, reviewCount, activeCount] = await Promise.all([
        prisma.sensitiveWord.count(),
        prisma.sensitiveWord.count({ where: { level: 'BAN' } }),
        prisma.sensitiveWord.count({ where: { level: 'REPLACE' } }),
        prisma.sensitiveWord.count({ where: { level: 'REVIEW' } }),
        prisma.sensitiveWord.count({ where: { isActive: true } })
    ]);

    return apiResponse(res, 200, 'Success', {
        total,
        banCount,
        replaceCount,
        reviewCount,
        activeCount,
        inactiveCount: total - activeCount
    });
};
