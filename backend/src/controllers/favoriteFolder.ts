import { Request, Response } from 'express';
import { PrismaClient, FavoriteFolderVisibility, PointActionType } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import { addPoints } from '../services/pointService';

const prisma = new PrismaClient();

const updateFolderWorkCount = async (folderId: number) => {
    const count = await prisma.favoriteFolderWork.count({ where: { folderId } });
    await prisma.favoriteFolder.update({
        where: { id: folderId },
        data: { workCount: count }
    });
};

export const createFolder = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { name, description, visibility } = req.body;

    if (!name || !name.trim()) {
        return apiResponse(res, 400, '收藏夹名称不能为空');
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
        return apiResponse(res, 400, '收藏夹名称不能超过50个字符');
    }

    const existing = await prisma.favoriteFolder.findUnique({
        where: { userId_name: { userId, name: trimmedName } }
    });

    if (existing) {
        return apiResponse(res, 400, '已存在同名收藏夹');
    }

    const folder = await prisma.favoriteFolder.create({
        data: {
            name: trimmedName,
            description: description?.trim() || null,
            visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            userId
        }
    });

    return apiResponse(res, 201, '收藏夹创建成功', folder);
};

export const getMyFolders = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const folders = await prisma.favoriteFolder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });

    return apiResponse(res, 200, 'Success', folders);
};

export const getFolderDetail = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const userId = req.user?.userId;

    const folder = await prisma.favoriteFolder.findUnique({
        where: { id },
        include: {
            user: {
                select: { id: true, username: true }
            }
        }
    });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.visibility === 'PRIVATE' && folder.userId !== userId) {
        return apiResponse(res, 403, '无权查看此收藏夹');
    }

    return apiResponse(res, 200, 'Success', folder);
};

export const updateFolder = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const userId = req.user!.userId;
    const { name, description, visibility } = req.body;

    const folder = await prisma.favoriteFolder.findUnique({ where: { id } });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.userId !== userId) {
        return apiResponse(res, 403, '无权修改此收藏夹');
    }

    const data: any = {};

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return apiResponse(res, 400, '收藏夹名称不能为空');
        }
        if (trimmedName.length > 50) {
            return apiResponse(res, 400, '收藏夹名称不能超过50个字符');
        }

        const existing = await prisma.favoriteFolder.findUnique({
            where: { userId_name: { userId, name: trimmedName } }
        });

        if (existing && existing.id !== id) {
            return apiResponse(res, 400, '已存在同名收藏夹');
        }

        data.name = trimmedName;
    }

    if (description !== undefined) {
        data.description = description.trim() || null;
    }

    if (visibility !== undefined) {
        if (!['PUBLIC', 'PRIVATE'].includes(visibility)) {
            return apiResponse(res, 400, '无效的可见性设置');
        }
        data.visibility = visibility;
    }

    const updated = await prisma.favoriteFolder.update({
        where: { id },
        data
    });

    return apiResponse(res, 200, '收藏夹更新成功', updated);
};

export const deleteFolder = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const userId = req.user!.userId;

    const folder = await prisma.favoriteFolder.findUnique({ where: { id } });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.userId !== userId) {
        return apiResponse(res, 403, '无权删除此收藏夹');
    }

    await prisma.favoriteFolder.delete({ where: { id } });

    return apiResponse(res, 200, '收藏夹删除成功');
};

export const addWorkToFolder = async (req: AuthRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const workId = parseInt(req.params.workId);

    if (isNaN(folderId) || isNaN(workId)) {
        return apiResponse(res, 400, 'Invalid ID');
    }

    const userId = req.user!.userId;

    const folder = await prisma.favoriteFolder.findUnique({ where: { id: folderId } });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.userId !== userId) {
        return apiResponse(res, 403, '无权操作此收藏夹');
    }

    const work = await prisma.work.findUnique({ where: { id: workId } });

    if (!work) {
        return apiResponse(res, 404, '作品不存在');
    }

    if (work.status !== 'PUBLISHED') {
        return apiResponse(res, 400, '该作品已下架，无法收藏');
    }

    const existing = await prisma.favoriteFolderWork.findUnique({
        where: { folderId_workId: { folderId, workId } }
    });

    if (existing) {
        return apiResponse(res, 200, '作品已在收藏夹中', { added: false });
    }

    await prisma.favoriteFolderWork.create({
        data: { folderId, workId }
    });

    await updateFolderWorkCount(folderId);

    const hasGlobalFavorite = await prisma.interaction.findUnique({
        where: { userId_workId_interactionType: { userId, workId, interactionType: 'FAVORITE' } }
    });

    if (!hasGlobalFavorite) {
        await prisma.interaction.create({
            data: { userId, workId, interactionType: 'FAVORITE' }
        });

        addPoints(userId, PointActionType.WORK_FAVORITED, {
            dedupKey: `fav:user_${userId}_work_${workId}`,
            relatedId: workId,
            description: `收藏作品`,
        }).catch(console.error);
    }

    return apiResponse(res, 201, '作品已加入收藏夹', { added: true });
};

export const removeWorkFromFolder = async (req: AuthRequest, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    const workId = parseInt(req.params.workId);

    if (isNaN(folderId) || isNaN(workId)) {
        return apiResponse(res, 400, 'Invalid ID');
    }

    const userId = req.user!.userId;

    const folder = await prisma.favoriteFolder.findUnique({ where: { id: folderId } });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.userId !== userId) {
        return apiResponse(res, 403, '无权操作此收藏夹');
    }

    const existing = await prisma.favoriteFolderWork.findUnique({
        where: { folderId_workId: { folderId, workId } }
    });

    if (!existing) {
        return apiResponse(res, 200, '作品不在此收藏夹中', { removed: false });
    }

    await prisma.favoriteFolderWork.delete({
        where: { id: existing.id }
    });

    await updateFolderWorkCount(folderId);

    return apiResponse(res, 200, '作品已移出收藏夹', { removed: true });
};

export const getFolderWorks = async (req: Request, res: Response) => {
    const folderId = parseInt(req.params.folderId);
    if (isNaN(folderId)) return apiResponse(res, 400, 'Invalid ID');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    const authReq = req as AuthRequest;
    const currentUserId = authReq.user?.userId;

    const folder = await prisma.favoriteFolder.findUnique({ where: { id: folderId } });

    if (!folder) {
        return apiResponse(res, 404, '收藏夹不存在');
    }

    if (folder.visibility === 'PRIVATE' && folder.userId !== currentUserId) {
        return apiResponse(res, 403, '无权查看此收藏夹');
    }

    const whereCondition: any = {
        folderId,
        work: { status: 'PUBLISHED' }
    };

    const [total, works] = await Promise.all([
        prisma.favoriteFolderWork.count({ where: whereCondition }),
        prisma.favoriteFolderWork.findMany({
            where: whereCondition,
            include: {
                work: true
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { addedAt: 'desc' }
        })
    ]);

    return apiResponse(res, 200, 'Success', {
        total,
        page,
        limit,
        works: works.map(fw => fw.work)
    });
};

export const getUserPublicFolders = async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return apiResponse(res, 400, 'Invalid user ID');

    const folders = await prisma.favoriteFolder.findMany({
        where: {
            userId,
            visibility: 'PUBLIC'
        },
        orderBy: { createdAt: 'desc' }
    });

    return apiResponse(res, 200, 'Success', folders);
};

export const getWorkFolderStatus = async (req: AuthRequest, res: Response) => {
    const workId = parseInt(req.params.workId);
    if (isNaN(workId)) return apiResponse(res, 400, 'Invalid ID');

    const userId = req.user!.userId;

    const folders = await prisma.favoriteFolder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            works: {
                where: { workId },
                select: { id: true }
            }
        }
    });

    const result = folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        visibility: folder.visibility,
        workCount: folder.workCount,
        hasWork: folder.works.length > 0
    }));

    return apiResponse(res, 200, 'Success', result);
};

export const batchAddWorkToFolders = async (req: AuthRequest, res: Response) => {
    const workId = parseInt(req.params.workId);
    if (isNaN(workId)) return apiResponse(res, 400, 'Invalid work ID');

    const userId = req.user!.userId;
    const { folderIds } = req.body;

    if (!Array.isArray(folderIds)) {
        return apiResponse(res, 400, 'folderIds 必须是数组');
    }

    const work = await prisma.work.findUnique({ where: { id: workId } });

    if (!work) {
        return apiResponse(res, 404, '作品不存在');
    }

    if (work.status !== 'PUBLISHED') {
        return apiResponse(res, 400, '该作品已下架，无法收藏');
    }

    const userFolders = await prisma.favoriteFolder.findMany({
        where: { userId, id: { in: folderIds } }
    });

    if (userFolders.length !== folderIds.length) {
        return apiResponse(res, 403, '部分收藏夹不存在或无权操作');
    }

    const existingRelations = await prisma.favoriteFolderWork.findMany({
        where: {
            folderId: { in: folderIds },
            workId
        },
        select: { folderId: true }
    });

    const existingFolderIds = existingRelations.map(r => r.folderId);
    const newFolderIds = folderIds.filter(id => !existingFolderIds.includes(id));

    if (newFolderIds.length > 0) {
        await prisma.favoriteFolderWork.createMany({
            data: newFolderIds.map(folderId => ({ folderId, workId }))
        });

        for (const fid of newFolderIds) {
            await updateFolderWorkCount(fid);
        }
    }

    const hasGlobalFavorite = await prisma.interaction.findUnique({
        where: { userId_workId_interactionType: { userId, workId, interactionType: 'FAVORITE' } }
    });

    if (!hasGlobalFavorite && folderIds.length > 0) {
        await prisma.interaction.create({
            data: { userId, workId, interactionType: 'FAVORITE' }
        });

        addPoints(userId, PointActionType.WORK_FAVORITED, {
            dedupKey: `fav:user_${userId}_work_${workId}`,
            relatedId: workId,
            description: `收藏作品`,
        }).catch(console.error);
    }

    return apiResponse(res, 200, '操作成功', {
        addedCount: newFolderIds.length,
        totalInFolders: folderIds.length
    });
};
