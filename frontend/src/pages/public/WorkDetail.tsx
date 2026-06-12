import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Heart, ArrowLeft, Eye, Star, Flag, FolderPlus, Check, Folder, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSeo } from '../../hooks/useSeo';
import { recordBrowse } from '../../services/browseHistory';
import {
    getWorkFolderStatus,
    batchAddWorkToFolders,
    removeWorkFromFolder,
    createFolder,
    type FolderWithWorkStatus
} from '../../services/favoriteFolder';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

export const WorkDetail = () => {
    const { id } = useParams();
    const workIdNum = id ? parseInt(id) : undefined;
    useSeo({ pageType: 'WORK_DETAIL', workId: workIdNum });
    const navigate = useNavigate();
    const [work, setWork] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const { user } = useAuth();
    const { toast, success, error } = useToast();

    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [folders, setFolders] = useState<FolderWithWorkStatus[]>([]);
    const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderDesc, setNewFolderDesc] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);

    const fetchWork = async () => {
        try {
            const res: any = await api.get(`/works/${id}`);
            setWork(res.data);

            if (user && workIdNum) {
                recordBrowse(workIdNum).catch(() => {});
            }
        } catch (err: any) {
            toast('获取作品详情失败', 'error');
            navigate('/works');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWork();
    }, [id]);

    const handleLike = async () => {
        if (!user) {
            toast('请先登录以点赞作品', 'info');
            return;
        }
        try {
            await api.post(`/works/${id}/interact`, { type: 'LIKE' });
            fetchWork();
        } catch (err) {
            toast('操作失败', 'error');
        }
    };

    const openFolderModal = async () => {
        if (!user) {
            toast('请先登录以收藏作品', 'info');
            return;
        }
        if (!workIdNum) return;

        setFolderModalOpen(true);
        setFoldersLoading(true);
        setShowCreateFolder(false);
        setNewFolderName('');
        setNewFolderDesc('');

        try {
            const data = await getWorkFolderStatus(workIdNum);
            setFolders(data);
            setSelectedFolderIds(data.filter(f => f.hasWork).map(f => f.id));
        } catch (err: any) {
            error(err.message || '获取收藏夹状态失败');
        } finally {
            setFoldersLoading(false);
        }
    };

    const toggleFolder = (folderId: number) => {
        setSelectedFolderIds(prev =>
            prev.includes(folderId)
                ? prev.filter(id => id !== folderId)
                : [...prev, folderId]
        );
    };

    const handleSaveFolders = async () => {
        if (!workIdNum) return;

        setSaving(true);
        try {
            const currentHasIds = folders.filter(f => f.hasWork).map(f => f.id);
            const toAdd = selectedFolderIds.filter(id => !currentHasIds.includes(id));
            const toRemove = currentHasIds.filter(id => !selectedFolderIds.includes(id));

            if (toAdd.length > 0) {
                await batchAddWorkToFolders(workIdNum, toAdd);
            }

            for (const folderId of toRemove) {
                await removeWorkFromFolder(folderId, workIdNum);
            }

            success('收藏设置已保存');
            setFolderModalOpen(false);
            fetchWork();
        } catch (err: any) {
            error(err.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            error('请输入收藏夹名称');
            return;
        }

        setCreatingFolder(true);
        try {
            const newFolder = await createFolder({
                name: newFolderName.trim(),
                description: newFolderDesc.trim() || undefined,
                visibility: 'PRIVATE'
            });

            setFolders(prev => [newFolder as FolderWithWorkStatus, ...prev]);
            setSelectedFolderIds(prev => [...prev, newFolder.id]);
            setShowCreateFolder(false);
            setNewFolderName('');
            setNewFolderDesc('');
            success('收藏夹创建成功');
        } catch (err: any) {
            error(err.message || '创建失败');
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleReport = async () => {
        if (!user) {
            toast('请先登录后再举报', 'info');
            return;
        }
        if (!reportType) {
            toast('请选择举报类型', 'warning');
            return;
        }
        if (reportDescription.trim().length < 5) {
            toast('请填写举报说明（至少5个字符）', 'warning');
            return;
        }

        setSubmittingReport(true);
        try {
            await api.post('/reports', {
                workId: id,
                reportType,
                description: reportDescription
            });
            toast('举报提交成功，我们会尽快处理', 'success');
            setReportModalOpen(false);
            setReportType('');
            setReportDescription('');
        } catch (err: any) {
            toast(err.message || '举报提交失败', 'error');
        } finally {
            setSubmittingReport(false);
        }
    };

    if (loading) {
        return <div className="py-20 text-center text-gray-500">加载中...</div>;
    }

    if (!work) return null;

    const isLiked = user && work.interactions?.some((i: any) => i.userId === user.id && i.interactionType === 'LIKE');
    const isFavorited = user && work.interactions?.some((i: any) => i.userId === user.id && i.interactionType === 'FAVORITE');
    const favoriteCount = work.interactions?.filter((i: any) => i.interactionType === 'FAVORITE').length || 0;

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-primary mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> 返回列表
            </button>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                {work.mediaUrl && (
                    <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
                        <img
                            src={work.mediaUrl.startsWith('http') ? work.mediaUrl : `${API_ROOT}${work.mediaUrl}`}
                            alt={work.title}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                )}
                <div className="p-8">
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{work.title}</h1>
                        <div className="flex gap-3">
                            <button onClick={handleLike} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${isLiked ? 'bg-red-50 border-red-200 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} /> {isLiked ? '已赞' : '点赞'}
                            </button>
                            <button
                                onClick={openFolderModal}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${isFavorited ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            >
                                <Star className={`w-4 h-4 ${isFavorited ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                {isFavorited ? '已收藏' : '收藏'}
                            </button>
                            <button onClick={() => setReportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full border transition-colors bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100">
                                <Flag className="w-4 h-4" /> 举报
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 border-b pb-6 dark:border-gray-800">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-full">{work.category}</span>
                        <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {work.viewCount} 浏览</span>
                        <span className="flex items-center gap-1"><Star className="w-4 h-4" /> {favoriteCount} 收藏</span>
                        <span>发布于: {new Date(work.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="prose dark:prose-invert max-w-none">
                        <h3 className="text-xl font-bold mb-4">作品描述</h3>
                        <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                            {work.description}
                        </p>
                    </div>

                    {work.tags && work.tags !== '[]' && (
                        <div className="mt-8 pt-6 border-t dark:border-gray-800">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">标签</h4>
                            <div className="flex flex-wrap gap-2">
                                {work.tags.split(',').map((tag: string, i: number) => (
                                    <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                                        #{tag.trim()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 收藏夹选择弹窗 */}
            <Modal
                isOpen={folderModalOpen}
                onClose={() => setFolderModalOpen(false)}
                title="收藏到收藏夹"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setFolderModalOpen(false)}>
                            取消
                        </Button>
                        <Button onClick={handleSaveFolders} disabled={saving || foldersLoading}>
                            {saving ? '保存中...' : '保存'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {!showCreateFolder ? (
                        <>
                            <button
                                onClick={() => setShowCreateFolder(true)}
                                className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:border-primary hover:text-primary transition-colors"
                            >
                                <FolderPlus className="w-5 h-5" />
                                <span>新建收藏夹</span>
                            </button>

                            {foldersLoading ? (
                                <div className="py-8 text-center text-gray-500">加载中...</div>
                            ) : folders.length === 0 ? (
                                <div className="py-8 text-center text-gray-500">
                                    <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>还没有收藏夹，点击上方按钮创建</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {folders.map((folder) => (
                                        <button
                                            key={folder.id}
                                            onClick={() => toggleFolder(folder.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                                selectedFolderIds.includes(folder.id)
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    selectedFolderIds.includes(folder.id) ? 'bg-primary/20 text-primary' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                                }`}>
                                                    <Folder className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium text-gray-900 dark:text-white">{folder.name}</p>
                                                    <p className="text-xs text-gray-500">{folder.workCount} 个作品</p>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                selectedFolderIds.includes(folder.id)
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-gray-300'
                                            }`}>
                                                {selectedFolderIds.includes(folder.id) && (
                                                    <Check className="w-4 h-4" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowCreateFolder(false)}
                                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180" />
                                返回收藏夹列表
                            </button>

                            <div className="space-y-3">
                                <Input
                                    label="收藏夹名称"
                                    placeholder="请输入收藏夹名称"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    maxLength={50}
                                    autoFocus
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        描述（可选）
                                    </label>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none dark:bg-slate-800 dark:text-white resize-none"
                                        rows={2}
                                        placeholder="简单描述..."
                                        value={newFolderDesc}
                                        onChange={(e) => setNewFolderDesc(e.target.value)}
                                        maxLength={200}
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleCreateFolder}
                                disabled={creatingFolder || !newFolderName.trim()}
                                className="w-full"
                            >
                                {creatingFolder ? '创建中...' : '创建并添加'}
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="举报作品" footer={<><Button variant="ghost" onClick={() => setReportModalOpen(false)}>取消</Button><Button onClick={handleReport} disabled={submittingReport}>{submittingReport ? '提交中...' : '提交举报'}</Button></>}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">举报类型</label>
                        <div className="space-y-2">
                            {[
                                { value: 'INFRINGEMENT', label: '侵权抄袭' },
                                { value: 'INAPPROPRIATE_CONTENT', label: '不当内容' },
                                { value: 'SPAM_AD', label: '垃圾广告' },
                                { value: 'OTHER', label: '其他问题' }
                            ].map(option => (
                                <label key={option.value} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                    <input
                                        type="radio"
                                        name="reportType"
                                        value={option.value}
                                        checked={reportType === option.value}
                                        onChange={e => setReportType(e.target.value)}
                                        className="text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">补充说明</label>
                        <textarea
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none dark:bg-slate-800 dark:text-white"
                            rows={4}
                            placeholder="请详细描述举报理由，以便我们更好地处理..."
                            value={reportDescription}
                            onChange={e => setReportDescription(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-1">至少 5 个字符</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
