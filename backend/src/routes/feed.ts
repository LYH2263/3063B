import { Router } from 'express';
import { generateRssFeed, generateAtomFeed, getCategories } from '../controllers/feed';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/categories', asyncHandler(getCategories));
router.get('/rss', asyncHandler(generateRssFeed));
router.get('/atom', asyncHandler(generateAtomFeed));
router.get('/rss.xml', asyncHandler(generateRssFeed));
router.get('/atom.xml', asyncHandler(generateAtomFeed));

export default router;
