import { Request, Response } from 'express';
import { PrismaClient, MediaType } from '@prisma/client';
import { apiResponse, asyncHandler } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const sanitizeFilename = (filename: string): string => {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext)
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
        .substring(0, 100);
    return `${name}_${Date.now()}${ext}`;
};

const getMediaType = (mimeType: string): MediaType => {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return MediaType.IMAGE;
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return MediaType.VIDEO;
    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return MediaType.AUDIO;
    return MediaType.OTHER;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeFilename = sanitizeFilename(file.originalname);
        cb(null, safeFilename);
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES];
    if (!allowedTypes.includes(file.mimetype)) {
        cb(new Error(`不支持的文件类型: ${file.mimetype}。仅支持图片、视频和音频文件。`));
        return;
    }
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

export const uploadMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
        return apiResponse(res, 400, '没有上传文件');
    }

    const mediaType = getMediaType(req.file.mimetype);
    const fileUrl = `/uploads/${req.file.filename}`;

    const media = await prisma.media.create({
        data: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileUrl,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            mediaType,
            uploadedById: req.user?.userId
        }
    });

    return apiResponse(res, 201, '上传成功', media);
});

export const getMediaList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const mediaType = req.query.type as string;

    const whereCondition: any = {};
    if (search) {
        whereCondition.OR = [
            { originalName: { contains: search } },
            { filename: { contains: search } }
        ];
    }
    if (mediaType && mediaType !== 'ALL') {
        whereCondition.mediaType = mediaType;
    }

    const [total, mediaList] = await Promise.all([
        prisma.media.count({ where: whereCondition }),
        prisma.media.findMany({
            where: whereCondition,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                uploadedBy: {
                    select: { username: true }
                }
            }
        })
    ]);

    const mediaWithReferences = await Promise.all(
        mediaList.map(async (media) => {
            const referenceCount = await prisma.work.count({
                where: { mediaUrl: media.fileUrl }
            });
            return {
                ...media,
                referenceCount
            };
        })
    );

    return apiResponse(res, 200, '获取成功', {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        list: mediaWithReferences
    });
});

export const deleteMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, '无效的ID');

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return apiResponse(res, 404, '媒体资源不存在');

    const referenceCount = await prisma.work.count({
        where: { mediaUrl: media.fileUrl }
    });

    if (referenceCount > 0) {
        return apiResponse(res, 400, `该资源仍被 ${referenceCount} 个作品引用，无法删除。请先修改相关作品的媒体地址。`);
    }

    const filePath = path.join(uploadDir, media.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await prisma.media.delete({ where: { id } });

    return apiResponse(res, 200, '删除成功');
});

export const batchDeleteMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return apiResponse(res, 400, '请提供要删除的ID列表');
    }

    const mediaList = await prisma.media.findMany({
        where: { id: { in: ids.map(Number) } }
    });

    if (mediaList.length === 0) {
        return apiResponse(res, 404, '未找到指定的媒体资源');
    }

    const referencedMedia: string[] = [];
    for (const media of mediaList) {
        const referenceCount = await prisma.work.count({
            where: { mediaUrl: media.fileUrl }
        });
        if (referenceCount > 0) {
            referencedMedia.push(`"${media.originalName}" (被 ${referenceCount} 个作品引用)`);
        }
    }

    if (referencedMedia.length > 0) {
        return apiResponse(res, 400, `以下资源仍被引用，无法删除：${referencedMedia.join('、')}`);
    }

    for (const media of mediaList) {
        const filePath = path.join(uploadDir, media.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    await prisma.media.deleteMany({
        where: { id: { in: ids.map(Number) } }
    });

    return apiResponse(res, 200, `成功删除 ${mediaList.length} 个媒体资源`);
});

export const getMediaUsage = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return apiResponse(res, 400, '无效的ID');

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return apiResponse(res, 404, '媒体资源不存在');

    const referencingWorks = await prisma.work.findMany({
        where: { mediaUrl: media.fileUrl },
        select: { id: true, title: true }
    });

    return apiResponse(res, 200, '获取成功', {
        media,
        referencingWorks,
        referenceCount: referencingWorks.length
    });
});
