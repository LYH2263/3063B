import express from 'express';
import { authenticate } from '../middleware/auth';
import {
    recordBrowse,
    getMyBrowseHistory,
    deleteBrowseHistory,
    clearAllBrowseHistory
} from '../controllers/browseHistory';

const router = express.Router();

router.post('/', authenticate, recordBrowse);
router.get('/me', authenticate, getMyBrowseHistory);
router.delete('/:id', authenticate, deleteBrowseHistory);
router.delete('/clear/all', authenticate, clearAllBrowseHistory);

export default router;
