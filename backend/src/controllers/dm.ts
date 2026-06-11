import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const getOtherUser = (userId: number, conversation: any) => {
    if (conversation.participantOneId === userId) {
        return {
            id: conversation.participantTwo.id,
            username: conversation.participantTwo.username,
            status: conversation.participantTwo.status,
        };
    }
    return {
        id: conversation.participantOne.id,
        username: conversation.participantOne.username,
        status: conversation.participantOne.status,
    };
};

const getUnreadCountForConversation = async (conversationId: number, userId: number) => {
    return prisma.privateMessage.count({
        where: {
            conversationId,
            receiverId: userId,
            isRead: false,
        },
    });
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
    const { receiverId, content } = req.body;
    const senderId = req.user!.userId;

    if (!receiverId || !content) {
        return apiResponse(res, 400, 'Receiver ID and content are required');
    }

    if (senderId === receiverId) {
        return apiResponse(res, 400, 'Cannot send messages to yourself');
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
        return apiResponse(res, 400, 'Message content cannot be empty');
    }

    const [sender, receiver] = await Promise.all([
        prisma.user.findUnique({ where: { id: senderId } }),
        prisma.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!sender || !receiver) {
        return apiResponse(res, 404, 'User not found');
    }

    if (sender.status === 'BANNED') {
        return apiResponse(res, 403, 'Your account is banned and cannot send messages');
    }

    if (receiver.status === 'BANNED') {
        return apiResponse(res, 403, 'Cannot send messages to a banned user');
    }

    const [smallerId, largerId] = [Math.min(senderId, receiverId), Math.max(senderId, receiverId)];

    let conversation = await prisma.conversation.findUnique({
        where: {
            participantOneId_participantTwoId: {
                participantOneId: smallerId,
                participantTwoId: largerId,
            },
        },
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                participantOneId: smallerId,
                participantTwoId: largerId,
            },
        });
    }

    const message = await prisma.$transaction(async (tx) => {
        const msg = await tx.privateMessage.create({
            data: {
                conversationId: conversation!.id,
                senderId,
                receiverId,
                content: trimmedContent,
            },
            include: {
                sender: { select: { id: true, username: true } },
                receiver: { select: { id: true, username: true } },
            },
        });

        await tx.conversation.update({
            where: { id: conversation!.id },
            data: { lastMessageAt: new Date() },
        });

        return msg;
    });

    return apiResponse(res, 201, 'Message sent successfully', message);
};

export const getConversations = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return apiResponse(res, 404, 'User not found');
    }

    if (user.status === 'BANNED') {
        return apiResponse(res, 403, 'Your account is banned');
    }

    const conversations = await prisma.conversation.findMany({
        where: {
            OR: [
                { participantOneId: userId },
                { participantTwoId: userId },
            ],
        },
        include: {
            participantOne: { select: { id: true, username: true, status: true } },
            participantTwo: { select: { id: true, username: true, status: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { content: true, createdAt: true, isRead: true, senderId: true },
            },
        },
        orderBy: { lastMessageAt: 'desc' },
    });

    const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
            const otherUser = getOtherUser(userId, conv);
            const lastMessage = conv.messages[0];
            const unreadCount = await getUnreadCountForConversation(conv.id, userId);

            return {
                id: conv.id,
                otherUser,
                lastMessage: lastMessage ? {
                    content: lastMessage.content.length > 50
                        ? lastMessage.content.substring(0, 50) + '...'
                        : lastMessage.content,
                    createdAt: lastMessage.createdAt,
                    isMine: lastMessage.senderId === userId,
                } : null,
                unreadCount,
                lastMessageAt: conv.lastMessageAt,
            };
        })
    );

    return apiResponse(res, 200, 'Success', conversationsWithDetails);
};

export const getConversationMessages = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const conversationId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (isNaN(conversationId)) {
        return apiResponse(res, 400, 'Invalid conversation ID');
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (!conversation) {
        return apiResponse(res, 404, 'Conversation not found');
    }

    if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
        return apiResponse(res, 403, 'You are not authorized to access this conversation');
    }

    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
        prisma.privateMessage.findMany({
            where: { conversationId },
            include: {
                sender: { select: { id: true, username: true } },
                receiver: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: 'asc' },
            skip,
            take: limit,
        }),
        prisma.privateMessage.count({ where: { conversationId } }),
    ]);

    return apiResponse(res, 200, 'Success', {
        messages,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + limit < totalCount,
        },
    });
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
        return apiResponse(res, 400, 'Invalid conversation ID');
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (!conversation) {
        return apiResponse(res, 404, 'Conversation not found');
    }

    if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
        return apiResponse(res, 403, 'You are not authorized to modify this conversation');
    }

    const updated = await prisma.privateMessage.updateMany({
        where: {
            conversationId,
            receiverId: userId,
            isRead: false,
        },
        data: { isRead: true },
    });

    return apiResponse(res, 200, `${updated.count} messages marked as read`, { updated: updated.count });
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return apiResponse(res, 404, 'User not found');
    }

    if (user.status === 'BANNED') {
        return apiResponse(res, 200, 'Success', { count: 0 });
    }

    const count = await prisma.privateMessage.count({
        where: {
            receiverId: userId,
            isRead: false,
            conversation: {
                AND: [
                    { participantOne: { status: 'ACTIVE' } },
                    { participantTwo: { status: 'ACTIVE' } },
                ],
            },
        },
    });

    return apiResponse(res, 200, 'Success', { count });
};

export const startConversation = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
        return apiResponse(res, 400, 'Target user ID is required');
    }

    if (userId === targetUserId) {
        return apiResponse(res, 400, 'Cannot create conversation with yourself');
    }

    const [user, targetUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.user.findUnique({ where: { id: targetUserId } }),
    ]);

    if (!user || !targetUser) {
        return apiResponse(res, 404, 'User not found');
    }

    if (user.status === 'BANNED') {
        return apiResponse(res, 403, 'Your account is banned');
    }

    if (targetUser.status === 'BANNED') {
        return apiResponse(res, 403, 'Cannot start conversation with a banned user');
    }

    const [smallerId, largerId] = [Math.min(userId, targetUserId), Math.max(userId, targetUserId)];

    let conversation = await prisma.conversation.findUnique({
        where: {
            participantOneId_participantTwoId: {
                participantOneId: smallerId,
                participantTwoId: largerId,
            },
        },
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                participantOneId: smallerId,
                participantTwoId: largerId,
            },
        });
    }

    return apiResponse(res, 200, 'Success', { conversationId: conversation.id });
};
