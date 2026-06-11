import { useEffect, useState, useCallback } from 'react';
import { seoApi, SeoPageType, SeoData } from '../services/seo';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

interface UseSeoOptions {
    pageType: SeoPageType;
    workId?: number;
    overrides?: Partial<SeoData>;
}

const setMetaTag = (name: string, content: string, isProperty: boolean = false) => {
    if (!content) return;
    const attr = isProperty ? 'property' : 'name';
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
};

const setLinkTag = (rel: string, href: string) => {
    if (!href) return;
    let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', rel);
        document.head.appendChild(tag);
    }
    tag.setAttribute('href', href);
};

const normalizeUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_ROOT}${url.startsWith('/') ? url : '/' + url}`;
};

export const useSeo = ({ pageType, workId, overrides }: UseSeoOptions) => {
    const [seoData, setSeoData] = useState<SeoData | null>(null);
    const [loading, setLoading] = useState(true);

    const applySeo = useCallback((data: SeoData) => {
        const merged: SeoData = { ...data, ...overrides };

        document.title = merged.title || document.title;

        if (merged.keywords) setMetaTag('keywords', merged.keywords);
        if (merged.description) {
            setMetaTag('description', merged.description);
            setMetaTag('og:description', merged.description, true);
        }
        if (merged.title) {
            setMetaTag('og:title', merged.title, true);
            setMetaTag('twitter:title', merged.title);
        }
        if (merged.description) {
            setMetaTag('twitter:description', merged.description);
        }
        setMetaTag('og:type', 'website', true);
        setMetaTag('twitter:card', 'summary_large_image');

        const ogImageUrl = normalizeUrl(merged.ogImage);
        if (ogImageUrl) {
            setMetaTag('og:image', ogImageUrl, true);
            setMetaTag('twitter:image', ogImageUrl);
        }

        setLinkTag('canonical', window.location.href);
        setMetaTag('og:url', window.location.href, true);
    }, [overrides]);

    useEffect(() => {
        let cancelled = false;

        const fetchSeo = async () => {
            setLoading(true);
            try {
                const res: any = await seoApi.getPublicSeo(pageType, workId);
                if (!cancelled && res.data) {
                    setSeoData(res.data);
                    applySeo(res.data);
                }
            } catch (err) {
                console.error('Failed to fetch SEO data:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSeo();

        return () => {
            cancelled = true;
        };
    }, [pageType, workId, applySeo]);

    useEffect(() => {
        if (seoData && overrides) {
            applySeo({ ...seoData, ...overrides });
        }
    }, [seoData, overrides, applySeo]);

    return { seoData, loading };
};
