import { Router } from 'express';
import {
    createBackup,
    getBackupList,
    getBackupDetail,
    downloadBackup,
    deleteBackup,
    restoreBackup,
} from '../controllers/backup';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logOperation } from '../middleware/logger';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.use(authenticate, requireAdmin);

router.post('/', logOperation('CREATE_BACKUP'), asyncHandler(createBackup));
router.get('/', asyncHandler(getBackupList));
router.get('/:id', asyncHandler(getBackupDetail));
router.get('/:id/download', logOperation('DOWNLOAD_BACKUP'), asyncHandler(downloadBackup));
router.delete('/:id', logOperation('DELETE_BACKUP'), asyncHandler(deleteBackup));
router.post('/:id/restore', logOperation('RESTORE_BACKUP'), asyncHandler(restoreBackup));

export default router;
