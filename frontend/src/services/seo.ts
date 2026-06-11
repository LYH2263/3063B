import api from './api';

export type SeoPageType = 'HOME' | 'WORKS_LIST' | 'WORK_DETAIL' | 'LOGIN' | 'REGISTER' | 'PROFILE' | 'MESSAGES';

export interface SeoConfigData {
    id?: number;
    pageType: SeoPageType;
    titleTemplate: string;
    keywords?: string;
    description?: string;
    ogImage?: string;
}

export interface SeoData {
    title: string;
    keywords?: string;
    description?: string;
    ogImage?: string;
    siteName?: string;
}

export interface WorkSeoData {
    id?: number;
    workId: number;
    customTitle?: string;
    keywords?: string;
    description?: string;
    ogImage?: string;
}

export const seoApi = {
    getPublicSeo: (pageType: SeoPageType, workId?: number) => {
        const params: any = { pageType };
        if (workId) params.workId = workId;
        return api.get('/seo/public', { params });
    },

    getAllSeoConfigs: () => api.get('/seo/admin/configs'),

    updateSeoConfig: (data: SeoConfigData) => api.put('/seo/admin/configs', data),

    getWorkSeo: (workId: number) => api.get(`/seo/admin/work/${workId}`),

    updateWorkSeo: (workId: number, data: WorkSeoData) => api.put(`/seo/admin/work/${workId}`, data),

    getSitemapUrl: () => {
        const base = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');
        return `${base}/sitemap.xml`;
    }
};
