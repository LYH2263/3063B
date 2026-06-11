import React, { useEffect, useState } from 'react';
import { seoApi, SeoConfigData, SeoPageType } from '../../services/seo';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Save, ExternalLink, Globe, FileText } from 'lucide-react';

const pageTypeLabels: Record<SeoPageType, { name: string; desc: string; icon: React.ReactNode }> = {
    HOME: { name: '首页', desc: '网站首页 SEO 设置', icon: <Globe className="w-4 h-4" /> },
    WORKS_LIST: { name: '作品列表', desc: '作品集合页面 SEO 设置', icon: <FileText className="w-4 h-4" /> },
    WORK_DETAIL: { name: '作品详情', desc: '作品详情页 SEO 设置（支持 {title} 占位符）', icon: <FileText className="w-4 h-4" /> },
    LOGIN: { name: '登录页', desc: '用户登录页面 SEO 设置', icon: <FileText className="w-4 h-4" /> },
    REGISTER: { name: '注册页', desc: '用户注册页面 SEO 设置', icon: <FileText className="w-4 h-4" /> },
    PROFILE: { name: '个人中心', desc: '用户个人中心页面 SEO 设置', icon: <FileText className="w-4 h-4" /> },
    MESSAGES: { name: '私信页', desc: '用户私信页面 SEO 设置', icon: <FileText className="w-4 h-4" /> },
};

export const AdminSeo = () => {
    const [configs, setConfigs] = useState<SeoConfigData[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingType, setSavingType] = useState<SeoPageType | null>(null);
    const [sitemapUrl, setSitemapUrl] = useState('');
    const { success, error } = useToast();

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const res: any = await seoApi.getAllSeoConfigs();
            setConfigs(res.data || []);
        } catch (err: any) {
            error(err.message || '加载 SEO 配置失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
        setSitemapUrl(seoApi.getSitemapUrl());
    }, []);

    const handleChange = (pageType: SeoPageType, field: keyof SeoConfigData, value: string) => {
        setConfigs(configs.map(c =>
            c.pageType === pageType ? { ...c, [field]: value } : c
        ));
    };

    const handleSave = async (pageType: SeoPageType) => {
        const config = configs.find(c => c.pageType === pageType);
        if (!config) return;
        try {
            setSavingType(pageType);
            await seoApi.updateSeoConfig(config);
            success(`${pageTypeLabels[pageType].name} SEO 配置已保存`);
        } catch (err: any) {
            error(err.message || '保存失败');
        } finally {
            setSavingType(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">加载中...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">SEO 元信息管理</h1>
                    <p className="text-gray-500 mt-1">配置各页面的 SEO 元信息与社交分享设置</p>
                </div>
                <a
                    href={sitemapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    查看 sitemap.xml
                </a>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    站点地图 Sitemap
                </h3>
                <p className="text-sm text-blue-800">
                    Sitemap URL: <code className="bg-white px-2 py-0.5 rounded text-blue-900">{sitemapUrl}</code>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                    包含首页、作品列表页及所有已发布作品详情页，自动随作品更新。
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {configs.map((config) => {
                    const label = pageTypeLabels[config.pageType];
                    return (
                        <div key={config.pageType} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                        {label.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{label.name}</h3>
                                        <p className="text-xs text-gray-500">{label.desc}</p>
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                                    {config.pageType}
                                </span>
                            </div>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="页面标题模板"
                                    value={config.titleTemplate}
                                    onChange={(e) => handleChange(config.pageType, 'titleTemplate', e.target.value)}
                                    placeholder="例如：{siteName} - 首页 或 {title} - {siteName}"
                                />
                                <div className="text-xs text-gray-500 -mt-2">
                                    可用占位符: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{'{siteName}'}</code>
                                    {config.pageType === 'WORK_DETAIL' && (
                                        <> 、<code className="bg-gray-100 px-1.5 py-0.5 rounded">{'{title}'}</code></>
                                    )}
                                </div>
                                <Input
                                    label="关键词 Keywords"
                                    value={config.keywords || ''}
                                    onChange={(e) => handleChange(config.pageType, 'keywords', e.target.value)}
                                    placeholder="用英文逗号分隔，例如：作品,设计,开发"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">页面描述 Description</label>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                        rows={3}
                                        value={config.description || ''}
                                        onChange={(e) => handleChange(config.pageType, 'description', e.target.value)}
                                        placeholder="150 字以内的页面描述，将显示在搜索结果中..."
                                    />
                                </div>
                                <Input
                                    label="Open Graph 分享图 URL (可选)"
                                    value={config.ogImage || ''}
                                    onChange={(e) => handleChange(config.pageType, 'ogImage', e.target.value)}
                                    placeholder="社交分享时的预览图 URL，建议尺寸 1200x630"
                                />
                                <div className="pt-4 border-t border-gray-100 flex justify-end">
                                    <Button
                                        onClick={() => handleSave(config.pageType)}
                                        isLoading={savingType === config.pageType}
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        保存此页面配置
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
