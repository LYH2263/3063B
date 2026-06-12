import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
    FolderPlus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    ChevronRight,
    Folder,
    Lock,
    Globe,
    ArrowLeft
} from 'lucide-react';
import {
    getMyFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    type FavoriteFolder
} from '../../services/favoriteFolder';
import { Navigate } from 'react-router-dom';
import { useSeo } from '../../hooks/useSeo';

export const FavoriteFolders = () => {
    useSeo({ pageType: 'PROFILE' });
    const { user } = useAuth();
    const { success, error } = useToast();
    const navigate = useNavigate();
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [loading, setLoading] = useState(true);

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<FavoriteFolder | null>(null);

    const [folderName, setFolderName] = useState('');
    const [folderDesc, setFolderDesc] = useState('');
    const [folderVisibility, setFolderVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
    const [submitting, setSubmitting] = useState(false);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const fetchFolders = async () => {
        try {
            setLoading(true);
            const data = await getMyFolders();
            setFolders(data);
        } catch (err: any) {
            error(err.message || '获取收藏夹列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    const handleCreateFolder = async () => {
        if (!folderName.trim()) {
            error('请输入收藏夹名称');
            return;
        }
        if (folderName.trim().length > 50) {
            error('收藏夹名称不能超过50个字符');
            return;
        }

        setSubmitting(true);
        try {
            await createFolder({
                name: folderName.trim(),
                description: folderDesc.trim() || undefined,
                visibility: folderVisibility
            });
            success('收藏夹创建成功');
            setCreateModalOpen(false);
            resetForm();
            fetchFolders();
        } catch (err: any) {
            error(err.message || '创建失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditFolder = async () => {
        if (!selectedFolder) return;
        if (!folderName.trim()) {
            error('请输入收藏夹名称');
            return;
        }
        if (folderName.trim().length > 50) {
            error('收藏夹名称不能超过50个字符');
            return;
        }

        setSubmitting(true);
        try {
            await updateFolder(selectedFolder.id, {
                name: folderName.trim(),
                description: folderDesc.trim() || undefined,
                visibility: folderVisibility
            });
            success('收藏夹更新成功');
            setEditModalOpen(false);
            resetForm();
            fetchFolders();
        } catch (err: any) {
            error(err.message || '更新失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!selectedFolder) return;

        setSubmitting(true);
        try {
            await deleteFolder(selectedFolder.id);
            success('收藏夹删除成功');
            setDeleteModalOpen(false);
            setSelectedFolder(null);
            fetchFolders();
        } catch (err: any) {
            error(err.message || '删除失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleVisibility = async (folder: FavoriteFolder) => {
        const newVisibility = folder.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
        try {
            await updateFolder(folder.id, { visibility: newVisibility });
            success(`已设为${newVisibility === 'PUBLIC' ? '公开' : '私密'}`);
            fetchFolders();
        } catch (err: any) {
            error(err.message || '操作失败');
        }
    };

    const openEditModal = (folder: FavoriteFolder) => {
        setSelectedFolder(folder);
        setFolderName(folder.name);
        setFolderDesc(folder.description || '');
        setFolderVisibility(folder.visibility);
        setEditModalOpen(true);
    };

    const openDeleteModal = (folder: FavoriteFolder) => {
        setSelectedFolder(folder);
        setDeleteModalOpen(true);
    };

    const resetForm = () => {
        setFolderName('');
        setFolderDesc('');
        setFolderVisibility('PRIVATE');
        setSelectedFolder(null);
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <button
                onClick={() => navigate('/profile')}
                className="flex items-center text-gray-500 hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> 返回个人中心
            </button>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Folder className="w-8 h-8 text-primary" />
                    我的收藏夹
                </h1>
                <Button onClick={() => setCreateModalOpen(true)}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    新建收藏夹
                </Button>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-500">加载中...</div>
            ) : folders.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-12 text-center">
                    <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">还没有收藏夹</h3>
                    <p className="text-gray-500 mb-6">创建你的第一个收藏夹，整理收藏的作品</p>
                    <Button onClick={() => setCreateModalOpen(true)}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        新建收藏夹
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {folders.map((folder) => (
                        <div
                            key={folder.id}
                            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => navigate(`/favorite-folders/${folder.id}`)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Folder className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                                            {folder.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            {folder.visibility === 'PUBLIC' ? (
                                                <><Globe className="w-3 h-3" /> 公开</>
                                            ) : (
                                                <><Lock className="w-3 h-3" /> 私密</>
                                            )}
                                            <span className="mx-1">·</span>
                                            {folder.workCount} 个作品
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleToggleVisibility(folder)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title={folder.visibility === 'PUBLIC' ? '设为私密' : '设为公开'}
                                    >
                                        {folder.visibility === 'PUBLIC' ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(folder)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="编辑"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(folder)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="删除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {folder.description && (
                                <p className="text-sm text-gray-500 line-clamp-2">{folder.description}</p>
                            )}
                            <div className="mt-4 flex items-center justify-between text-sm">
                                <span className="text-gray-400">
                                    创建于 {new Date(folder.createdAt).toLocaleDateString('zh-CN')}
                                </span>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 创建收藏夹弹窗 */}
            <Modal
                isOpen={createModalOpen}
                onClose={() => { setCreateModalOpen(false); resetForm(); }}
                title="新建收藏夹"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setCreateModalOpen(false); resetForm(); }}>
                            取消
                        </Button>
                        <Button onClick={handleCreateFolder} disabled={submitting}>
                            {submitting ? '创建中...' : '创建'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="收藏夹名称"
                        placeholder="请输入收藏夹名称（最多50字）"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        maxLength={50}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            描述（可选）
                        </label>
                        <textarea
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none dark:bg-slate-800 dark:text-white resize-none"
                            rows={3}
                            placeholder="简单描述这个收藏夹的用途..."
                            value={folderDesc}
                            onChange={(e) => setFolderDesc(e.target.value)}
                            maxLength={200}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            可见性
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                <input
                                    type="radio"
                                    name="visibility"
                                    value="PRIVATE"
                                    checked={folderVisibility === 'PRIVATE'}
                                    onChange={() => setFolderVisibility('PRIVATE')}
                                    className="text-primary focus:ring-primary"
                                />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        <Lock className="w-4 h-4" /> 私密
                                    </p>
                                    <p className="text-xs text-gray-500">仅你自己可以查看</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                <input
                                    type="radio"
                                    name="visibility"
                                    value="PUBLIC"
                                    checked={folderVisibility === 'PUBLIC'}
                                    onChange={() => setFolderVisibility('PUBLIC')}
                                    className="text-primary focus:ring-primary"
                                />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        <Globe className="w-4 h-4" /> 公开
                                    </p>
                                    <p className="text-xs text-gray-500">所有人都可以查看此收藏夹</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* 编辑收藏夹弹窗 */}
            <Modal
                isOpen={editModalOpen}
                onClose={() => { setEditModalOpen(false); resetForm(); }}
                title="编辑收藏夹"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setEditModalOpen(false); resetForm(); }}>
                            取消
                        </Button>
                        <Button onClick={handleEditFolder} disabled={submitting}>
                            {submitting ? '保存中...' : '保存'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="收藏夹名称"
                        placeholder="请输入收藏夹名称（最多50字）"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        maxLength={50}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            描述（可选）
                        </label>
                        <textarea
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none dark:bg-slate-800 dark:text-white resize-none"
                            rows={3}
                            placeholder="简单描述这个收藏夹的用途..."
                            value={folderDesc}
                            onChange={(e) => setFolderDesc(e.target.value)}
                            maxLength={200}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            可见性
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                <input
                                    type="radio"
                                    name="editVisibility"
                                    value="PRIVATE"
                                    checked={folderVisibility === 'PRIVATE'}
                                    onChange={() => setFolderVisibility('PRIVATE')}
                                    className="text-primary focus:ring-primary"
                                />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        <Lock className="w-4 h-4" /> 私密
                                    </p>
                                    <p className="text-xs text-gray-500">仅你自己可以查看</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                <input
                                    type="radio"
                                    name="editVisibility"
                                    value="PUBLIC"
                                    checked={folderVisibility === 'PUBLIC'}
                                    onChange={() => setFolderVisibility('PUBLIC')}
                                    className="text-primary focus:ring-primary"
                                />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        <Globe className="w-4 h-4" /> 公开
                                    </p>
                                    <p className="text-xs text-gray-500">所有人都可以查看此收藏夹</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* 删除确认弹窗 */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setSelectedFolder(null); }}
                title="删除收藏夹"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setSelectedFolder(null); }}>
                            取消
                        </Button>
                        <Button
                            onClick={handleDeleteFolder}
                            disabled={submitting}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {submitting ? '删除中...' : '确认删除'}
                        </Button>
                    </>
                }
            >
                <div className="py-4">
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        确定要删除收藏夹 <span className="font-bold text-gray-900 dark:text-white">「{selectedFolder?.name}」</span> 吗？
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            ⚠️ 删除后收藏夹内的所有收藏关系将被清除，但作品本身不会被删除。此操作不可撤销。
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
