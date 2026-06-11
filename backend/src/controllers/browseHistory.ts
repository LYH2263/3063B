import { Request, Response } from 'express';
import { PrismaClient, WorkStatus } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const recordBrowse = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { workId } = req.body;

    if (!workId || isNaN(parseInt(workId))) {
        return apiResponse(res, 400, 'Invalid work ID');
    }

    const workIdNum = parseInt(workId);

    const work = await prisma.work.findUnique({
        where: { id: workIdNum, status: WorkStatus.PUBLISHED }
    });

    if (!work) {
        return apiResponse(res, 404, 'Work not found or not published');
    }

    try {
        await prisma.browseHistory.upsert({
            where: {
                userId_workId: {
                    userId,
                    workId: workIdNum
                }
            },
            create: {
                userId,
                workId: workIdNum,
                viewedAt: new Date()
            },
            update: {
                viewedAt: new Date()
            }
        });

        return apiResponse(res, 200, 'Browse recorded');
    } catch (error) {
        return apiResponse(res, 500, 'Failed to record browse history');
    }
};

export const getMyBrowseHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const includeUnavailable = (req.query.includeUnavailable as string) === 'true';

    const skip = (page - 1) * pageSize;

    const whereCondition: any = { userId };

    if (!includeUnavailable) {
        whereCondition.work = {
            status: WorkStatus.PUBLISHED
        };
    }

    try {
        const [total, histories] = await Promise.all([
            prisma.browseHistory.count({ where: whereCondition }),
            prisma.browseHistory.findMany({
                where: whereCondition,
                include: {
                    work: {
                        select: {
                            id: true,
                            title: true,
                            mediaUrl: true,
                            category: true,
                            status: true
                        }
                    }
                },
                orderBy: { viewedAt: 'desc' },
                skip,
                take: pageSize
            })
        ]);

        const totalPages = Math.ceil(total / pageSize);

        const formattedHistories = histories.map(h => ({
            id: h.id,
            workId: h.workId,
            viewedAt: h.viewedAt,
            work: {
                ...h.work,
                isAvailable: h.work.status === WorkStatus.PUBLISHED
            }
        }));

        return apiResponse(res, 200, 'Success', {
            list: formattedHistories,
            total,
            page,
            pageSize,
            totalPages
        });
    } catch (error) {
        return apiResponse(res, 500, 'Failed to fetch browse history');
    }
};

export const deleteBrowseHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return apiResponse(res, 400, 'Invalid history ID');
    }

    try {
        const history = await prisma.browseHistory.findUnique({
            where: { id }
        });

        if (!history) {
            return apiResponse(res, 404, 'Browse history not found');
        }

        if (history.userId !== userId) {
            return apiResponse(res, 403, 'Forbidden: Cannot delete others history');
        }

        await prisma.browseHistory.delete({ where: { id } });

        return apiResponse(res, 200, 'Browse history deleted');
    } catch (error) {
        return apiResponse(res, 500, 'Failed to delete browse history');
    }
};

export const clearAllBrowseHistory = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    try {
        await prisma.browseHistory.deleteMany({
            where: { userId }
        });

        return apiResponse(res, 200, 'All browse history cleared');
    } catch (error) {
        return apiResponse(res, 500, 'Failed to clear browse history');
    }
};
