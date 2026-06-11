import { Router } from 'express';
import {
    sendMessage,
    getConversations,
    getConversationMessages,
    markAsRead,
    getUnreadCount,
    startConversation,
} from '../controllers/dm';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/unread-count', authenticate, asyncHandler(getUnreadCount));
router.get('/conversations', authenticate, asyncHandler(getConversations));
router.get('/conversations/:id/messages', authenticate, asyncHandler(getConversationMessages));
router.put('/conversations/:id/read', authenticate, asyncHandler(markAsRead));
router.post('/send', authenticate, asyncHandler(sendMessage));
router.post('/conversation', authenticate, asyncHandler(startConversation));

export default router;
