import { Request, Response } from 'express';
import { PrismaClient, SeoPageType } from '@prisma/client';
import { apiResponse } from '../middleware/error';

const prisma = new PrismaClient();

const DEFAULT_SITE_NAME = '独立站';
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

const DEFAULT_SEO_CONFIGS: Record<SeoPageType, {
    titleTemplate: string;
    keywords: string;
    description: string;
}> = {
    [SeoPageType.HOME]: {
        titleTemplate: `{siteName} - 打造非凡的数字体验`,
        keywords: '作品集,设计师,全栈开发,独立站,创意项目',
        description: '全栈开发工程师与设计师的个人作品集，展示创意实验、开源项目与设计灵感。'
    },
    [SeoPageType.WORKS_LIST]: {
        titleTemplate: `作品列表 - {siteName}`,
        keywords: '作品,项目,作品集,创意,设计,开发',
        description: '浏览所有精选作品与创意项目，涵盖 Web 开发、移动应用、UI 设计等领域。'
    },
    [SeoPageType.WORK_DETAIL]: {
        titleTemplate: `{title} - {siteName}`,
        keywords: '{title},作品,项目,设计,开发',
        description: '{title} - 作品详情展示'
    },
    [SeoPageType.LOGIN]: {
        titleTemplate: `登录 - {siteName}`,
        keywords: '登录,账号,用户',
        description: '登录您的账号，访问更多功能与个性化服务。'
    },
    [SeoPageType.REGISTER]: {
        titleTemplate: `注册 - {siteName}`,
        keywords: '注册,账号,创建用户',
        description: '创建新账号，加入我们的创意社区。'
    },
    [SeoPageType.PROFILE]: {
        titleTemplate: `个人中心 - {siteName}`,
        keywords: '个人中心,用户资料,我的',
        description: '管理您的个人资料、收藏与消息。'
    },
    [SeoPageType.MESSAGES]: {
        titleTemplate: `私信 - {siteName}`,
        keywords: '私信,消息,沟通',
        description: '查看和管理您的站内私信。'
    }
};

export const ensureDefaultSeoConfigs = async () => {
    for (const pageType of Object.values(SeoPageType)) {
        const existing = await prisma.seoConfig.findUnique({ where: { pageType } });
        if (!existing) {
            const defaults = DEFAULT_SEO_CONFIGS[pageType];
            await prisma.seoConfig.create({
                data: {
                    pageType,
                    titleTemplate: defaults.titleTemplate,
                    keywords: defaults.keywords,
                    description: defaults.description
                }
            });
        }
    }
};

const fillTemplate = (template: string, vars: Record<string, string>) => {
    let result = template || '';
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return result;
};

export const getAllSeoConfigs = async (req: Request, res: Response) => {
    await ensureDefaultSeoConfigs();
    const configs = await prisma.seoConfig.findMany({
        orderBy: { pageType: 'asc' }
    });
    return apiResponse(res, 200, 'Success', configs);
};

export const updateSeoConfig = async (req: Request, res: Response) => {
    const { pageType, titleTemplate, keywords, description, ogImage } = req.body;

    if (!pageType || !Object.values(SeoPageType).includes(pageType)) {
        return apiResponse(res, 400, 'Invalid or missing pageType');
    }
    if (titleTemplate !== undefined && !titleTemplate) {
        return apiResponse(res, 400, 'titleTemplate cannot be empty');
    }

    const config = await prisma.seoConfig.upsert({
        where: { pageType },
        create: {
            pageType,
            titleTemplate: titleTemplate || DEFAULT_SEO_CONFIGS[pageType].titleTemplate,
            keywords,
            description,
            ogImage
        },
        update: {
            titleTemplate: titleTemplate ?? undefined,
            keywords: keywords ?? undefined,
            description: description ?? undefined,
            ogImage: ogImage ?? undefined
        }
    });

    return apiResponse(res, 200, 'SEO config updated', config);
};

export const getPublicSeo = async (req: Request, res: Response) => {
    const { pageType, workId } = req.query;

    if (!pageType || !Object.values(SeoPageType).includes(pageType as string)) {
        return apiResponse(res, 400, 'Invalid or missing pageType');
    }

    await ensureDefaultSeoConfigs();
    const globalConfig = await prisma.seoConfig.findUnique({
        where: { pageType: pageType as SeoPageType }
    });
    const settings = await prisma.systemSetting.findFirst();
    const siteName = settings?.siteTitle || DEFAULT_SITE_NAME;

    let result: any = {
        titleTemplate: globalConfig?.titleTemplate || DEFAULT_SEO_CONFIGS[pageType as SeoPageType].titleTemplate,
        keywords: globalConfig?.keywords || DEFAULT_SEO_CONFIGS[pageType as SeoPageType].keywords,
        description: globalConfig?.description || DEFAULT_SEO_CONFIGS[pageType as SeoPageType].description,
        ogImage: globalConfig?.ogImage,
        siteName
    };

    if (pageType === SeoPageType.WORK_DETAIL && workId) {
        const id = parseInt(workId as string);
        if (!isNaN(id)) {
            const workSeo = await prisma.workSeo.findUnique({ where: { workId: id } });
            const work = await prisma.work.findUnique({ where: { id } });

            if (work) {
                const workTitle = workSeo?.customTitle || work.title;
                const workKeywords = workSeo?.keywords || work.tags?.replace(/[\[\]"']/g, '') || '';
                const workDescription = workSeo?.description || work.description?.slice(0, 200) || '';
                const workOgImage = workSeo?.ogImage || work.mediaUrl;

                result = {
                    ...result,
                    title: fillTemplate(result.titleTemplate, { title: workTitle, siteName }),
                    keywords: fillTemplate(workKeywords || result.keywords, { title: workTitle, siteName }),
                    description: fillTemplate(workDescription || result.description, { title: workTitle, siteName }),
                    ogImage: workOgImage || result.ogImage
                };
            }
        }
    } else {
        result.title = fillTemplate(result.titleTemplate, { siteName });
        result.keywords = fillTemplate(result.keywords, { siteName });
        result.description = fillTemplate(result.description, { siteName });
    }

    delete result.titleTemplate;
    return apiResponse(res, 200, 'Success', result);
};

export const getWorkSeo = async (req: Request, res: Response) => {
    const id = parseInt(req.params.workId);
    if (isNaN(id)) return apiResponse(res, 400, 'Invalid work ID');

    let workSeo = await prisma.workSeo.findUnique({ where: { workId: id } });
    if (!workSeo) {
        workSeo = await prisma.workSeo.create({
            data: { workId: id }
        });
    }

    return apiResponse(res, 200, 'Success', workSeo);
};

export const updateWorkSeo = async (req: Request, res: Response) => {
    const workId = parseInt(req.params.workId);
    if (isNaN(workId)) return apiResponse(res, 400, 'Invalid work ID');

    const { customTitle, keywords, description, ogImage } = req.body;

    const workSeo = await prisma.workSeo.upsert({
        where: { workId },
        create: { workId, customTitle, keywords, description, ogImage },
        update: {
            customTitle: customTitle ?? undefined,
            keywords: keywords ?? undefined,
            description: description ?? undefined,
            ogImage: ogImage ?? undefined
        }
    });

    return apiResponse(res, 200, 'Work SEO updated', workSeo);
};

const escapeXml = (text: string): string => {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

const formatW3cDate = (date: Date): string => {
    return date.toISOString();
};

export const generateSitemap = async (req: Request, res: Response) => {
    const baseUrl = SITE_URL.replace(/\/$/, '');

    const staticUrls = [
        { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
        { loc: `${baseUrl}/works`, changefreq: 'daily', priority: '0.9' },
    ];

    const works = await prisma.work.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }
    });

    const workUrls = works.map(work => ({
        loc: `${baseUrl}/works/${work.id}`,
        lastmod: formatW3cDate(work.updatedAt),
        changefreq: 'weekly',
        priority: '0.8'
    }));

    const now = formatW3cDate(new Date());

    const urlset = [
        ...staticUrls.map(u => `
    <url>
      <loc>${escapeXml(u.loc)}</loc>
      <lastmod>${escapeXml(now)}</lastmod>
      <changefreq>${escapeXml(u.changefreq)}</changefreq>
      <priority>${escapeXml(u.priority)}</priority>
    </url>`),
        ...workUrls.map(u => `
    <url>
      <loc>${escapeXml(u.loc)}</loc>
      <lastmod>${escapeXml(u.lastmod)}</lastmod>
      <changefreq>${escapeXml(u.changefreq)}</changefreq>
      <priority>${escapeXml(u.priority)}</priority>
    </url>`)
    ].join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlset}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(xml);
};
