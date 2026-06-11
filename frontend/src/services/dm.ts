import api from './api';

export interface User {
    id: number;
    username: string;
    status: 'ACTIVE' | 'BANNED';
}

export interface Conversation {
    id: number;
    otherUser: User;
    lastMessage: {
        content: string;
        createdAt: string;
        isMine: boolean;
    } | null;
    unreadCount: number;
    lastMessageAt: string;
}

export interface PrivateMessage {
    id: number;
    conversationId: number;
    sender: { id: number; username: string };
    receiver: { id: number; username: string };
    senderId: number;
    receiverId: number;
    content: string;
    isRead: boolean;
    createdAt: string;
}

export interface Pagination {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
}

export const sendMessage = async (receiverId: number, content: string) => {
    return api.post('/dm/send', { receiverId, content });
};

export const getConversations = async (): Promise<{ code: number; message: string; data: Conversation[] }> => {
    return api.get('/dm/conversations');
};

export const getConversationMessages = async (
    conversationId: number,
    page: number = 1,
    limit: number = 20
): Promise<{ code: number; message: string; data: { messages: PrivateMessage[]; pagination: Pagination } }> => {
    return api.get(`/dm/conversations/${conversationId}/messages`, {
        params: { page, limit },
    });
};

export const markAsRead = async (conversationId: number) => {
    return api.put(`/dm/conversations/${conversationId}/read`);
};

export const getUnreadCount = async (): Promise<{ code: number; message: string; data: { count: number } }> => {
    return api.get('/dm/unread-count');
};

export const startConversation = async (targetUserId: number) => {
    return api.post('/dm/conversation', { targetUserId });
};
