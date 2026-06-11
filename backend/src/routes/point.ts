import express from 'express';
import { authenticate } from '../middleware/auth';
import {
    getMyPoints,
    getMyPointLogs,
    getPointRules,
    getLevelConfigs,
    triggerDailyLogin,
} from '../controllers/point';

const router = express.Router();

router.get('/me', authenticate, getMyPoints);
router.get('/logs', authenticate, getMyPointLogs);
router.get('/rules', authenticate, getPointRules);
router.get('/levels', authenticate, getLevelConfigs);
router.post('/daily-login', authenticate, triggerDailyLogin);

export default router;
