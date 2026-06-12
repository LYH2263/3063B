import api from './api';

export const getCategories = async () => {
    const res = await api.get('/feed/categories');
    return res;
};

export const getFeedUrls = (apiRoot: string, category?: string) => {
    const baseUrl = apiRoot.replace(/\/api$/, '');
    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : '';
    return {
        rss: `${baseUrl}/rss.xml${categoryParam}`,
        atom: `${baseUrl}/atom.xml${categoryParam}`,
    };
};
