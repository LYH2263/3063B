import { Request, Response } from 'express';
import { PrismaClient, PointActionType } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import { addPoints } from '../services/pointService';
import { filterContent } from '../services/sensitiveWordService';

const prisma = new PrismaClient();

// Public: Get all approved messages
export const getMessages = async (req: Request, res: Response) => {
    const messages = await prisma.message.findMany({
        where: { status: 'APPROVED' },
        include: {
            user: { select: { username: true, roleType: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    return apiResponse(res, 200, 'Success', messages);
};

// User: Post a message
export const postMessage = async (req: AuthRequest, res: Response) => {
    const { content } = req.body;
    if (!content) return apiResponse(res, 400, 'Content is required');

    const filterResult = filterContent(content);

    if (!filterResult.allowed) {
        const matchedWords = filterResult.matchedWords.map(m => m.word).join(', ');
        return apiResponse(res, 403, `留言包含违规内容：${matchedWords}，无法提交`, {
            action: 'BLOCK',
            matchedWords: filterResult.matchedWords
        });
    }

    const finalContent = filterResult.filteredContent;
    const status = filterResult.reviewRequired ? 'PENDING' : 'PENDING';

    const message = await prisma.message.create({
        data: {
            userId: req.user!.userId,
            content: finalContent,
            status
        }
    });

    const responseData = {
        ...message,
        filterAction: filterResult.action,
        matchedWords: filterResult.matchedWords
    };

    if (filterResult.action === 'REPLACE' && filterResult.matchedWords.length > 0) {
        return apiResponse(res, 201, '留言提交成功，部分内容已被替换', responseData);
    }

    if (filterResult.reviewRequired) {
        return apiResponse(res, 201, '留言提交成功，正在审核中', responseData);
    }

    return apiResponse(res, 201, 'Message submitted and pending approval', responseData);
};

// Admin: Get all messages
export const adminGetMessages = async (req: Request, res: Response) => {
    const messages = await prisma.message.findMany({
        include: {
            user: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    return apiResponse(res, 200, 'Success', messages);
};

// Admin: Update message status
export const adminUpdateMessageStatus = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    const existingMessage = await prisma.message.findUnique({ where: { id } });
    if (!existingMessage) return apiResponse(res, 404, 'Message not found');

    const wasApproved = existingMessage.status === 'APPROVED';

    const message = await prisma.message.update({
        where: { id },
        data: { status }
    });

    if (status === 'APPROVED' && !wasApproved) {
        addPoints(existingMessage.userId, PointActionType.MESSAGE_APPROVED, {
            relatedId: id,
            description: `留言被审核通过`,
        }).catch(console.error);
    }

    return apiResponse(res, 200, `Message ${status.toLowerCase()}`, message);
};

// Admin: Delete a message
export const adminDeleteMessage = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid ID');

    await prisma.message.delete({ where: { id } });
    return apiResponse(res, 200, 'Message deleted');
};
