import { Router } from 'express';
import {
    submitReport,
    getMyReports,
    adminGetReports,
    adminGetWorkReportCount,
    adminUpdateReportStatus,
    adminBatchUpdateStatus
} from '../controllers/report';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logOperation } from '../middleware/logger';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.post('/', authenticate, asyncHandler(submitReport));
router.get('/my', authenticate, asyncHandler(getMyReports));

router.get('/admin/list', authenticate, requireAdmin, asyncHandler(adminGetReports));
router.get('/admin/works/:workId/count', authenticate, requireAdmin, asyncHandler(adminGetWorkReportCount));
router.put('/admin/:id/status', authenticate, requireAdmin, logOperation('UPDATE_REPORT_STATUS'), asyncHandler(adminUpdateReportStatus));
router.put('/admin/batch-status', authenticate, requireAdmin, logOperation('BATCH_UPDATE_REPORT_STATUS'), asyncHandler(adminBatchUpdateStatus));

export default router;
