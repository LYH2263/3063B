import { Router } from 'express';
import { getAllSeoConfigs, updateSeoConfig, getPublicSeo, getWorkSeo, updateWorkSeo, generateSitemap } from '../controllers/seo';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/sitemap.xml', asyncHandler(generateSitemap));

router.get('/public', asyncHandler(getPublicSeo));

router.get('/admin/configs', authenticate, requireAdmin, asyncHandler(getAllSeoConfigs));
router.put('/admin/configs', authenticate, requireAdmin, asyncHandler(updateSeoConfig));

router.get('/admin/work/:workId', authenticate, requireAdmin, asyncHandler(getWorkSeo));
router.put('/admin/work/:workId', authenticate, requireAdmin, asyncHandler(updateWorkSeo));

export default router;
