import { Router } from 'express';
import {
    getSensitiveWords,
    getSensitiveWordById,
    createSensitiveWord,
    updateSensitiveWord,
    deleteSensitiveWord,
    toggleSensitiveWordStatus,
    batchImportSensitiveWords,
    batchDeleteSensitiveWords,
    getStatistics
} from '../controllers/sensitiveWord';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/stats', authenticate, requireAdmin, asyncHandler(getStatistics));
router.get('/', authenticate, requireAdmin, asyncHandler(getSensitiveWords));
router.get('/:id', authenticate, requireAdmin, asyncHandler(getSensitiveWordById));
router.post('/', authenticate, requireAdmin, asyncHandler(createSensitiveWord));
router.put('/:id', authenticate, requireAdmin, asyncHandler(updateSensitiveWord));
router.delete('/:id', authenticate, requireAdmin, asyncHandler(deleteSensitiveWord));
router.patch('/:id/toggle', authenticate, requireAdmin, asyncHandler(toggleSensitiveWordStatus));
router.post('/batch-import', authenticate, requireAdmin, asyncHandler(batchImportSensitiveWords));
router.post('/batch-delete', authenticate, requireAdmin, asyncHandler(batchDeleteSensitiveWords));

export default router;
