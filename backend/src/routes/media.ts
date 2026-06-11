import { Router } from 'express';
import {
    upload,
    uploadMedia,
    getMediaList,
    deleteMedia,
    batchDeleteMedia,
    getMediaUsage
} from '../controllers/media';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logOperation } from '../middleware/logger';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/', authenticate, requireAdmin, asyncHandler(getMediaList));
router.get('/:id/usage', authenticate, requireAdmin, asyncHandler(getMediaUsage));
router.post('/upload', authenticate, requireAdmin, logOperation('UPLOAD_MEDIA'), upload.single('file'), asyncHandler(uploadMedia));
router.delete('/:id', authenticate, requireAdmin, logOperation('DELETE_MEDIA'), asyncHandler(deleteMedia));
router.post('/batch-delete', authenticate, requireAdmin, logOperation('BATCH_DELETE_MEDIA'), asyncHandler(batchDeleteMedia));

export default router;
