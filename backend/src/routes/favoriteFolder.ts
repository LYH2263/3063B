import { Router } from 'express';
import {
    createFolder,
    getMyFolders,
    getFolderDetail,
    updateFolder,
    deleteFolder,
    addWorkToFolder,
    removeWorkFromFolder,
    getFolderWorks,
    getUserPublicFolders,
    getWorkFolderStatus,
    batchAddWorkToFolders
} from '../controllers/favoriteFolder';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

// Public
router.get('/user/:userId/public', asyncHandler(getUserPublicFolders));
router.get('/:id', asyncHandler(getFolderDetail));
router.get('/:folderId/works', asyncHandler(getFolderWorks));

// User - requires auth
router.post('/', authenticate, asyncHandler(createFolder));
router.get('/my/list', authenticate, asyncHandler(getMyFolders));
router.put('/:id', authenticate, asyncHandler(updateFolder));
router.delete('/:id', authenticate, asyncHandler(deleteFolder));
router.post('/:folderId/works/:workId', authenticate, asyncHandler(addWorkToFolder));
router.delete('/:folderId/works/:workId', authenticate, asyncHandler(removeWorkFromFolder));
router.get('/work/:workId/status', authenticate, asyncHandler(getWorkFolderStatus));
router.post('/work/:workId/batch', authenticate, asyncHandler(batchAddWorkToFolders));

export default router;
