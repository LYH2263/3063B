import { PrismaClient, PointActionType } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_LEVEL_CONFIGS = [
    { level: 1, name: 'V1', minPoints: 0, color: '#9CA3AF' },
    { level: 2, name: 'V2', minPoints: 100, color: '#10B981' },
    { level: 3, name: 'V3', minPoints: 500, color: '#3B82F6' },
    { level: 4, name: 'V4', minPoints: 2000, color: '#8B5CF6' },
    { level: 5, name: 'V5', minPoints: 5000, color: '#F59E0B' },
];

const DEFAULT_POINT_RULES = [
    { actionType: PointActionType.DAILY_LOGIN, points: 5, description: '每日登录', dailyLimit: 1 },
    { actionType: PointActionType.MESSAGE_APPROVED, points: 10, description: '留言被审核通过', dailyLimit: null },
    { actionType: PointActionType.WORK_FAVORITED, points: 3, description: '作品被他人收藏', dailyLimit: null },
    { actionType: PointActionType.WORK_PUBLISHED, points: 20, description: '发布作品', dailyLimit: null },
    { actionType: PointActionType.ADMIN_ADJUST, points: 0, description: '管理员调整', dailyLimit: null },
];

export const initPointSystem = async () => {
    for (const config of DEFAULT_LEVEL_CONFIGS) {
        await prisma.levelConfig.upsert({
            where: { level: config.level },
            update: {},
            create: config,
        });
    }

    for (const rule of DEFAULT_POINT_RULES) {
        await prisma.pointRule.upsert({
            where: { actionType: rule.actionType },
            update: {},
            create: rule,
        });
    }
};

export const getLevelConfig = async () => {
    const configs = await prisma.levelConfig.findMany({
        orderBy: { level: 'asc' },
    });
    if (configs.length === 0) {
        return DEFAULT_LEVEL_CONFIGS;
    }
    return configs;
};

export const calculateLevel = async (points: number) => {
    const configs = await getLevelConfig();
    let currentLevel = configs[0];
    let nextLevel = configs[1] || null;

    for (let i = configs.length - 1; i >= 0; i--) {
        if (points >= configs[i].minPoints) {
            currentLevel = configs[i];
            nextLevel = i < configs.length - 1 ? configs[i + 1] : null;
            break;
        }
    }

    const progress = nextLevel
        ? ((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
        : 100;

    return {
        currentLevel,
        nextLevel,
        progress: Math.min(Math.max(progress, 0), 100),
        pointsToNext: nextLevel ? nextLevel.minPoints - points : 0,
    };
};

export const getPointRule = async (actionType: PointActionType) => {
    let rule = await prisma.pointRule.findUnique({
        where: { actionType },
    });

    if (!rule) {
        const defaultRule = DEFAULT_POINT_RULES.find(r => r.actionType === actionType);
        if (defaultRule) {
            rule = await prisma.pointRule.create({
                data: defaultRule,
            });
        }
    }

    return rule;
};

const generateDailyKey = (date: Date = new Date()): string => {
    return `daily:${date.toISOString().split('T')[0]}`;
};

export const addPoints = async (
    userId: number,
    actionType: PointActionType,
    options: {
        description?: string;
        relatedId?: number;
        dedupKey?: string;
    } = {}
) => {
    const rule = await getPointRule(actionType);
    if (!rule || !rule.isActive || rule.points === 0) {
        return { success: false, reason: 'rule_not_active', points: 0 };
    }

    let dedupKey = options.dedupKey;

    if (rule.dailyLimit && rule.dailyLimit > 0) {
        const todayKey = generateDailyKey();
        const todayCount = await prisma.pointLog.count({
            where: {
                userId,
                actionType,
                dedupKey: { startsWith: 'daily:' },
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        });

        if (todayCount >= rule.dailyLimit) {
            return { success: false, reason: 'daily_limit_reached', points: 0 };
        }

        if (!dedupKey) {
            dedupKey = todayKey;
        }
    }

    if (!dedupKey && options.relatedId !== undefined) {
        dedupKey = `related:${options.relatedId}`;
    }

    if (!dedupKey) {
        dedupKey = `once:${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { points: true, status: true },
            });

            if (!user || user.status !== 'ACTIVE') {
                throw new Error('User not found or banned');
            }

            const newBalance = user.points + rule.points;

            const pointLog = await tx.pointLog.create({
                data: {
                    userId,
                    actionType,
                    points: rule.points,
                    balanceAfter: newBalance,
                    description: options.description || rule.description,
                    relatedId: options.relatedId,
                    dedupKey,
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: { points: newBalance },
            });

            return { pointLog, newBalance, points: rule.points };
        });

        return { success: true, ...result };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, reason: 'duplicate_action', points: 0 };
        }
        throw error;
    }
};

export const getUserPointsAndLevel = async (userId: number) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { points: true, username: true },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const levelInfo = await calculateLevel(user.points);

    return {
        points: user.points,
        username: user.username,
        ...levelInfo,
    };
};

export const getPointLogs = async (
    userId: number,
    page: number = 1,
    pageSize: number = 20
) => {
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
        prisma.pointLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.pointLog.count({ where: { userId } }),
    ]);

    return {
        list: logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
};

export const getAllPointRules = async () => {
    const rules = await prisma.pointRule.findMany({
        orderBy: { id: 'asc' },
    });
    return rules;
};
