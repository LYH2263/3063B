import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    ArrowLeft,
    Folder,
    Lock,
    Globe,
    Trash2,
    Eye,
    EyeOff,
    Edit2,
    ChevronLeft,
    ChevronRight,
    FolderOpen,
    X
} from 'lucide-react';
import {
    getFolderDetail,
    getFolderWorks,
    removeWorkFromFolder,
    updateFolder,
    type FavoriteFolder
} from '../../services/favoriteFolder';
import { useSeo } from '../../hooks/useSeo';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

export const FavoriteFolderDetail = () => {
    useSeo({ pageType: 'PROFILE' });
    const { id } = useParams<{ id: string }>();
    const folderId = id ? parseInt(id) : 0;
    const navigate = useNavigate();
    const { user } = useAuth();
    const { success, error } = useToast();

    const [folder, setFolder] = useState<FavoriteFolder | null>(null);
    const [works, setWorks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit] = useState(12);

    const [deleteWorkModalOpen, setDeleteWorkModalOpen] = useState(false);
    const [selectedWork, setSelectedWork] = useState<any>(null);
    const [removing, setRemoving] = useState(false);

    const isOwner = user && folder && user.id === folder.userId;

    useEffect(() => {
        if (!folderId) return;
        fetchFolder();
        fetchWorks(1);
    }, [folderId]);

    const fetchFolder = async () => {
        try {
            const data = await getFolderDetail(folderId);
            setFolder(data);
        } catch (err: any) {
            error(err.message || '获取收藏夹信息失败');
            navigate('/favorite-folders');
        }
    };

    const fetchWorks = async (p: number) => {
        try {
            setLoading(true);
            const data = await getFolderWorks(folderId, p, limit);
            setWorks(data.works);
            setTotal(data.total);
            setPage(data.page);
        } catch (err: any) {
            error(err.message || '获取作品列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveWork = async () => {
        if (!selectedWork) return;

        setRemoving(true);
        try {
            await removeWorkFromFolder(folderId, selectedWork.id);
            success('已移出收藏夹');
            setDeleteWorkModalOpen(false);
            setSelectedWork(null);
            fetchWorks(page);
            fetchFolder();
        } catch (err: any) {
            error(err.message || '操作失败');
        } finally {
            setRemoving(false);
        }
    };

    const handleToggleVisibility = async () => {
        if (!folder || !isOwner) return;

        const newVisibility = folder.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
        try {
            const updated = await updateFolder(folder.id, { visibility: newVisibility });
            setFolder(updated);
            success(`已设为${newVisibility === 'PUBLIC' ? '公开' : '私密'}`);
        } catch (err: any) {
            error(err.message || '操作失败');
        }
    };

    const totalPages = Math.ceil(total / limit);

    if (!folder) {
        return <div className="py-20 text-center text-gray-500">加载中...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-4">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-500 hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> 返回
            </button>

            {/* 收藏夹信息头部 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 mb-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                            <FolderOpen className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {folder.name}
                                {folder.visibility === 'PUBLIC' ? (
                                    <Globe className="w-5 h-5 text-green-500" />
                                ) : (
                                    <Lock className="w-5 h-5 text-gray-400" />
                                )}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {folder.visibility === 'PUBLIC' ? '公开收藏夹' : '私密收藏夹'}
                                <span className="mx-2">·</span>
                                {total} 个作品
                            </p>
                            {folder.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    {folder.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {isOwner && (
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleToggleVisibility}
                                className="flex items-center gap-1"
                            >
                                {folder.visibility === 'PUBLIC' ? (
                                    <><EyeOff className="w-4 h-4" /> 设为私密</>
                                ) : (
                                    <><Eye className="w-4 h-4" /> 设为公开</>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/favorite-folders')}
                                className="flex items-center gap-1"
                            >
                                <Edit2 className="w-4 h-4" /> 管理收藏夹
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* 作品列表 */}
            {loading ? (
                <div className="py-20 text-center text-gray-500">加载中...</div>
            ) : works.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-12 text-center">
                    <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">收藏夹是空的</h3>
                    <p className="text-gray-500">
                        {isOwner ? '去发现好作品，收藏到这个收藏夹吧' : '这个收藏夹还没有作品'}
                    </p>
                    {isOwner && (
                        <Button className="mt-6" onClick={() => navigate('/works')}>
                            浏览作品
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {works.map((work) => (
                            <div
                                key={work.id}
                                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow group relative"
                            >
                                <Link to={`/works/${work.id}`} className="block">
                                    <div className="aspect-square bg-gray-100 dark:bg-slate-800 overflow-hidden">
                                        {work.mediaUrl ? (
                                            <img
                                                src={work.mediaUrl.startsWith('http') ? work.mediaUrl : `${API_ROOT}${work.mediaUrl}`}
                                                alt={work.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <Folder className="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                            {work.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">{work.category}</p>
                                    </div>
                                </Link>

                                {isOwner && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setSelectedWork(work);
                                            setDeleteWorkModalOpen(true);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                        title="移出收藏夹"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fetchWorks(page - 1)}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                上一页
                            </Button>
                            <span className="text-sm text-gray-500">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fetchWorks(page + 1)}
                                disabled={page >= totalPages}
                            >
                                下一页
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* 移出作品确认弹窗 */}
            <Modal
                isOpen={deleteWorkModalOpen}
                onClose={() => { setDeleteWorkModalOpen(false); setSelectedWork(null); }}
                title="移出收藏夹"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setDeleteWorkModalOpen(false); setSelectedWork(null); }}>
                            取消
                        </Button>
                        <Button
                            onClick={handleRemoveWork}
                            disabled={removing}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {removing ? '移出中...' : '确认移出'}
                        </Button>
                    </>
                }
            >
                <div className="py-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        确定要将作品 <span className="font-bold text-gray-900 dark:text-white">「{selectedWork?.title}」</span> 移出此收藏夹吗？
                    </p>
                </div>
            </Modal>
        </div>
    );
};
