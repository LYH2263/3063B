import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_MAX_ITEMS = 20;
const MAX_MAX_ITEMS = 100;

const escapeXml = (str: string): string => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

const formatRfc822 = (date: Date): string => {
    return date.toUTCString();
};

const formatRfc3339 = (date: Date): string => {
    return date.toISOString();
};

const getBaseUrl = (req: Request): string => {
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost';
    return `${protocol}://${host}`;
};

const getSiteSettings = async () => {
    const settings = await prisma.systemSetting.findFirst();
    return settings || {
        siteTitle: 'My Website',
        logoUrl: null,
        contactInfo: null,
    };
};

const getWorks = async (category?: string, limit: number = DEFAULT_MAX_ITEMS) => {
    const whereCondition: any = { status: 'PUBLISHED' };
    if (category) {
        whereCondition.category = category;
    }

    const take = Math.min(Math.max(limit, 1), MAX_MAX_ITEMS);

    return prisma.work.findMany({
        where: whereCondition,
        take,
        orderBy: { createdAt: 'desc' },
    });
};

export const getCategories = async (req: Request, res: Response) => {
    const categories = await prisma.work.findMany({
        where: { status: 'PUBLISHED' },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
    });

    const categoryList = categories.map(c => c.category).filter(Boolean);
    return res.json({
        code: 200,
        message: 'Success',
        data: { categories: categoryList },
    });
};

export const generateRssFeed = async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || DEFAULT_MAX_ITEMS;
    const baseUrl = getBaseUrl(req);
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;

    const [settings, works] = await Promise.all([
        getSiteSettings(),
        getWorks(category, limit),
    ]);

    const feedTitle = category
        ? `${settings.siteTitle} - ${category} 分类`
        : settings.siteTitle;
    const feedLink = category
        ? `${frontendUrl}/works?category=${encodeURIComponent(category)}`
        : `${frontendUrl}/works`;
    const feedDescription = category
        ? `${settings.siteTitle} ${category} 分类的最新作品`
        : `${settings.siteTitle} 的最新作品`;

    const itemsXml = works.map(work => {
        const workUrl = `${frontendUrl}/works/${work.id}`;
        const pubDate = formatRfc822(new Date(work.createdAt));
        const description = escapeXml(work.description);
        const title = escapeXml(work.title);
        const categoryXml = work.category
            ? `<category>${escapeXml(work.category)}</category>`
            : '';
        const guid = `<guid isPermaLink="true">${workUrl}</guid>`;

        return `
    <item>
      <title>${title}</title>
      <link>${workUrl}</link>
      ${guid}
      <pubDate>${pubDate}</pubDate>
      ${categoryXml}
      <description>${description}</description>
    </item>`;
    }).join('');

    const lastBuildDate = works.length > 0
        ? formatRfc822(new Date(works[0].createdAt))
        : formatRfc822(new Date());

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${feedLink}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>IndieSite RSS Generator</generator>
    <atom:link href="${baseUrl}${req.originalUrl}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.send(xml);
};

export const generateAtomFeed = async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const limit = parseInt(req.query.limit as string) || DEFAULT_MAX_ITEMS;
    const baseUrl = getBaseUrl(req);
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;

    const [settings, works] = await Promise.all([
        getSiteSettings(),
        getWorks(category, limit),
    ]);

    const feedTitle = category
        ? `${settings.siteTitle} - ${category} 分类`
        : settings.siteTitle;
    const feedLink = category
        ? `${frontendUrl}/works?category=${encodeURIComponent(category)}`
        : `${frontendUrl}/works`;
    const feedId = `${baseUrl}${req.originalUrl}`;

    const entriesXml = works.map(work => {
        const workUrl = `${frontendUrl}/works/${work.id}`;
        const updated = formatRfc3339(new Date(work.updatedAt || work.createdAt));
        const published = formatRfc3339(new Date(work.createdAt));
        const summary = escapeXml(work.description);
        const title = escapeXml(work.title);
        const categoryXml = work.category
            ? `<category term="${escapeXml(work.category)}" />`
            : '';

        return `
    <entry>
      <title>${title}</title>
      <link href="${workUrl}" />
      <id>${workUrl}</id>
      <updated>${updated}</updated>
      <published>${published}</published>
      ${categoryXml}
      <summary>${summary}</summary>
    </entry>`;
    }).join('');

    const updated = works.length > 0
        ? formatRfc3339(new Date(works[0].updatedAt || works[0].createdAt))
        : formatRfc3339(new Date());

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(feedTitle)}</title>
  <link href="${feedLink}" />
  <link href="${baseUrl}${req.originalUrl}" rel="self" type="application/atom+xml" />
  <id>${feedId}</id>
  <updated>${updated}</updated>
  <generator uri="${baseUrl}" version="1.0">IndieSite Atom Generator</generator>
  ${entriesXml}
</feed>`;

    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.send(xml);
};
