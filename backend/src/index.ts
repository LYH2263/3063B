import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { errorHandler } from './middleware/error';
import authRoutes from './routes/auth';
import styleRoutes from './routes/style';
import workRoutes from './routes/work';
import messageRoutes from './routes/message';
import dmRoutes from './routes/dm';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import settingsRoutes from './routes/settings';
import mediaRoutes from './routes/media';
import reportRoutes from './routes/report';
import pointRoutes from './routes/point';
import seoRoutes from './routes/seo';
import { initPointSystem } from './services/pointService';
import { ensureDefaultSeoConfigs } from './controllers/seo';

dotenv.config();

const app = express();
const port = process.env.PORT || 8063;

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/styles', styleRoutes);
app.use('/api/works', workRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/points', pointRoutes);
app.use('/api/seo', seoRoutes);
app.use('/sitemap.xml', seoRoutes);

app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// Global error handler
app.use(errorHandler as express.ErrorRequestHandler);

app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    try {
        await initPointSystem();
        console.log('Point system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize point system:', error);
    }
    try {
        await ensureDefaultSeoConfigs();
        console.log('SEO default configs initialized successfully');
    } catch (error) {
        console.error('Failed to initialize SEO configs:', error);
    }
});
