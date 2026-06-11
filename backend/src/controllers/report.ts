import { Request, Response } from 'express';
import { PrismaClient, ReportType, ReportStatus } from '@prisma/client';
import { apiResponse } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const REPORT_TYPES: ReportType[] = ['INFRINGEMENT', 'INAPPROPRIATE_CONTENT', 'SPAM_AD', 'OTHER'];
const REPORT_STATUSES: ReportStatus[] = ['PENDING', 'RESOLVED', 'REJECTED'];

export const submitReport = async (req: AuthRequest, res: Response) => {
    const { workId, reportType, description } = req.body;

    const parsedWorkId = parseInt(workId);
    if (isNaN(parsedWorkId)) return apiResponse(res, 400, 'Invalid work ID');
    if (!REPORT_TYPES.includes(reportType)) return apiResponse(res, 400, 'Invalid report type');
    if (!description || description.trim().length < 5) {
        return apiResponse(res, 400, '请填写举报说明（至少5个字符）');
    }

    const userId = req.user!.userId;

    const work = await prisma.work.findUnique({ where: { id: parsedWorkId, status: 'PUBLISHED' } });
    if (!work) return apiResponse(res, 404, '作品不存在');

    const existingReport = await prisma.report.findUnique({
        where: {
            workId_reporterId_reportType: {
                workId: parsedWorkId,
                reporterId: userId,
                reportType
            }
        }
    });

    if (existingReport) {
        return apiResponse(res, 409, '您已对此作品提交过相同类型的举报');
    }

    const report = await prisma.report.create({
        data: {
            workId: parsedWorkId,
            reporterId: userId,
            reportType,
            description: description.trim()
        }
    });

    return apiResponse(res, 201, '举报提交成功', report);
};

export const getMyReports = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const whereCondition = { reporterId: userId };

    const [total, reports] = await Promise.all([
        prisma.report.count({ where: whereCondition }),
        prisma.report.findMany({
            where: whereCondition,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                work: { select: { id: true, title: true, mediaUrl: true, status: true } }
            }
        })
    ]);

    return apiResponse(res, 200, 'Success', { total, page, limit, reports });
};

export const adminGetReports = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const reportType = req.query.reportType as string;

    const whereCondition: any = {};
    if (status && REPORT_STATUSES.includes(status as ReportStatus)) {
        whereCondition.status = status;
    }
    if (reportType && REPORT_TYPES.includes(reportType as ReportType)) {
        whereCondition.reportType = reportType;
    }

    const [total, reports, stats] = await Promise.all([
        prisma.report.count({ where: whereCondition }),
        prisma.report.findMany({
            where: whereCondition,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                work: { select: { id: true, title: true, mediaUrl: true, status: true } },
                reporter: { select: { id: true, username: true, status: true } },
                handler: { select: { id: true, username: true } }
            }
        }),
        prisma.report.groupBy({
            by: ['status'],
            _count: { status: true }
        })
    ]);

    const statusStats: Record<string, number> = {
        PENDING: 0,
        RESOLVED: 0,
        REJECTED: 0
    };
    stats.forEach(s => {
        statusStats[s.status] = s._count.status;
    });

    return apiResponse(res, 200, 'Success', { total, page, limit, reports, statusStats });
};

export const adminGetWorkReportCount = async (req: Request, res: Response) => {
    const workId = parseInt(req.params.workId);
    if (isNaN(workId)) return apiResponse(res, 400, 'Invalid work ID');

    const count = await prisma.report.count({ where: { workId } });
    return apiResponse(res, 200, 'Success', { workId, reportCount: count });
};

export const adminUpdateReportStatus = async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { status, handleNote, takeDown } = req.body;

    if (isNaN(id)) return apiResponse(res, 400, 'Invalid report ID');
    if (!REPORT_STATUSES.includes(status)) return apiResponse(res, 400, 'Invalid status');

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return apiResponse(res, 404, '举报记录不存在');

    const handlerId = req.user!.userId;

    if (takeDown && status === 'RESOLVED') {
        const work = await prisma.work.findUnique({ where: { id: report.workId } });
        if (work && work.status === 'PUBLISHED') {
            await prisma.work.update({
                where: { id: report.workId },
                data: { status: 'DRAFT' }
            });
        }
    }

    const updatedReport = await prisma.report.update({
        where: { id },
        data: {
            status,
            handlerId,
            handledAt: new Date(),
            handleNote: handleNote || null
        },
        include: {
            work: { select: { id: true, title: true, status: true } },
            reporter: { select: { id: true, username: true } },
            handler: { select: { id: true, username: true } }
        }
    });

    return apiResponse(res, 200, '举报状态已更新', updatedReport);
};

export const adminBatchUpdateStatus = async (req: AuthRequest, res: Response) => {
    const { ids, status, handleNote } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return apiResponse(res, 400, '请选择要处理的举报');
    }
    if (!REPORT_STATUSES.includes(status)) {
        return apiResponse(res, 400, 'Invalid status');
    }

    const handlerId = req.user!.userId;

    const result = await prisma.report.updateMany({
        where: { id: { in: ids.map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id)) } },
        data: {
            status,
            handlerId,
            handledAt: new Date(),
            handleNote: handleNote || null
        }
    });

    return apiResponse(res, 200, `已批量处理 ${result.count} 条举报`);
};
