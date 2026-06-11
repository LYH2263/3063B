import { Response } from 'express';
import { apiResponse, asyncHandler } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import {
    getUserPointsAndLevel,
    getPointLogs,
    getAllPointRules,
    getLevelConfig,
    addPoints,
} from '../services/pointService';
import { PointActionType } from '@prisma/client';

export const getMyPoints = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const result = await getUserPointsAndLevel(userId);

    return apiResponse(res, 200, '获取成功', result);
});

export const getMyPointLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await getPointLogs(userId, page, pageSize);

    return apiResponse(res, 200, '获取成功', result);
});

export const getPointRules = asyncHandler(async (req: AuthRequest, res: Response) => {
    const rules = await getAllPointRules();
    return apiResponse(res, 200, '获取成功', rules);
});

export const getLevelConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const configs = await getLevelConfig();
    return apiResponse(res, 200, '获取成功', configs);
});

export const triggerDailyLogin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const result = await addPoints(userId, PointActionType.DAILY_LOGIN);

    if (!result.success) {
        if (result.reason === 'daily_limit_reached' || result.reason === 'duplicate_action') {
            return apiResponse(res, 200, '今日已领取登录积分', { success: false, reason: 'already_claimed' });
        }
        return apiResponse(res, 400, '领取失败');
    }

    return apiResponse(res, 200, '登录积分领取成功', {
        success: true,
        points: result.points,
        newBalance: result.newBalance,
    });
});
