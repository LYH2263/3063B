import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatFileSize, formatDateTime } from '../../lib/file';
import {
    Upload,
    Search,
    Trash2,
    Image as ImageIcon,
    Film,
    Music,
    File,
    X,
    Check,
    Loader2,
    AlertTriangle,
    Info
} from 'lucide-react';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

interface MediaItem {
    id: number;
    filename: string;
    originalName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
    createdAt: string;
    referenceCount: number;
    uploadedBy?: { username: string };
}

export const AdminMediaLibrary = () => {
    const [mediaList, setMediaList] = useState<MediaItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'batch'; id?: number; ids?: number[] } | null>(null);
    const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const observerRef = useRef<HTMLDivElement>(null);
    const { success, error } = useToast();

    const fetchMedia = useCallback(async (reset = false) => {
        const currentPage = reset ? 1 : page;
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20',
                ...(search && { search }),
                ...(filterType && filterType !== 'ALL' && { type: filterType })
            });
            const res: any = await api.get(`/media?${params.toString()}`);
            if (reset) {
                setMediaList(res.data.list);
            } else {
                setMediaList(prev => [...prev, ...res.data.list]);
            }
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
            if (reset) setPage(2);
            else setPage(prev => prev + 1);
        } catch (err: any) {
            error(err.message || '加载媒体资源失败');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [page, search, filterType, error]);

    useEffect(() => {
        setMediaList([]);
        setPage(1);
        fetchMedia(true);
    }, [search, filterType]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loadingMore && page <= totalPages) {
                    fetchMedia();
                }
            },
            { threshold: 0.1 }
        );
        if (observerRef.current) {
            observer.observe(observerRef.current);
        }
        return () => observer.disconnect();
    }, [loadingMore, page, totalPages, fetchMedia]);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'audio/mpeg'];
        const maxSize = 50 * 1024 * 1024;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!validTypes.includes(file.type)) {
                error(`文件 "${file.name}" 类型不支持`);
                continue;
            }
            if (file.size > maxSize) {
                error(`文件 "${file.name}" 超过 50MB 限制`);
                continue;
            }
        }

        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!validTypes.includes(file.type) || file.size > maxSize) continue;

                const formData = new FormData();
                formData.append('file', file);
                await api.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            success('上传成功');
            setMediaList([]);
            setPage(1);
            fetchMedia(true);
        } catch (err: any) {
            error(err.message || '上传失败');
        } finally {
            setUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const handleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.length === mediaList.length && mediaList.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(mediaList.map(m => m.id));
        }
    };

    const handleDeleteClick = (id?: number) => {
        if (id !== undefined) {
            setDeleteTarget({ type: 'single', id });
        } else {
            setDeleteTarget({ type: 'batch', ids: selectedIds });
        }
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            if (deleteTarget.type === 'single' && deleteTarget.id !== undefined) {
                await api.delete(`/media/${deleteTarget.id}`);
                success('删除成功');
            } else if (deleteTarget.type === 'batch' && deleteTarget.ids) {
                await api.post('/media/batch-delete', { ids: deleteTarget.ids });
                success(`成功删除 ${deleteTarget.ids.length} 个资源`);
            }
            setDeleteConfirmOpen(false);
            setDeleteTarget(null);
            setSelectedIds([]);
            setMediaList([]);
            setPage(1);
            fetchMedia(true);
        } catch (err: any) {
            error(err.message || '删除失败');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'IMAGE': return <ImageIcon className="w-4 h-4" />;
            case 'VIDEO': return <Film className="w-4 h-4" />;
            case 'AUDIO': return <Music className="w-4 h-4" />;
            default: return <File className="w-4 h-4" />;
        }
    };

    const getPreviewUrl = (media: MediaItem) => {
        return media.fileUrl.startsWith('http') ? media.fileUrl : `${API_ROOT}${media.fileUrl}`;
    };

    return (
        <div className="min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">媒体资源管理</h1>
                <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                        <Button variant="danger" onClick={() => handleDeleteClick()}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除选中 ({selectedIds.length})
                        </Button>
                    )}
                    <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        上传资源
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="flex-1">
                    <Input
                        placeholder="搜索文件名..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        prefix={<Search className="w-4 h-4 text-gray-400" />}
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="ALL">全部类型</option>
                    <option value="IMAGE">图片</option>
                    <option value="VIDEO">视频</option>
                    <option value="AUDIO">音频</option>
                </select>
            </div>

            <div
                className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors ${
                    isDragOver
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span>上传中...</span>
                    </div>
                ) : (
                    <>
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">拖拽文件到此处上传</p>
                        <p className="text-gray-400 text-sm mt-1">或点击选择文件，支持图片、视频、音频（最大 50MB）</p>
                    </>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {mediaList.length > 0 && (
                        <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                            <span>共 {total} 个资源</span>
                            <button
                                onClick={handleSelectAll}
                                className="text-primary hover:underline flex items-center gap-1"
                            >
                                {selectedIds.length === mediaList.length && mediaList.length > 0 ? (
                                    <><Check className="w-4 h-4" /> 取消全选</>
                                ) : (
                                    <>全选</>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {mediaList.map((media) => (
                            <div
                                key={media.id}
                                className={`group relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all cursor-pointer ${
                                    selectedIds.includes(media.id)
                                        ? 'border-primary ring-2 ring-primary/30'
                                        : 'border-transparent hover:border-gray-200'
                                }`}
                            >
                                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(media.id)}
                                        onChange={() => handleSelect(media.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                </div>

                                {media.referenceCount > 0 && (
                                    <div className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {media.referenceCount}
                                    </div>
                                )}

                                <div
                                    className="aspect-square bg-gray-100 relative overflow-hidden"
                                    onClick={() => setPreviewMedia(media)}
                                >
                                    {media.mediaType === 'IMAGE' ? (
                                        <img
                                            src={getPreviewUrl(media)}
                                            alt={media.originalName}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : media.mediaType === 'VIDEO' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <Film className="w-12 h-12 text-gray-400" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            {getTypeIcon(media.mediaType)}
                                        </div>
                                    )}
                                </div>

                                <div className="p-3">
                                    <p className="text-sm font-medium text-gray-900 truncate" title={media.originalName}>
                                        {media.originalName}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        {getTypeIcon(media.mediaType)}
                                        <span>{formatFileSize(media.fileSize)}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {formatDateTime(media.createdAt)}
                                    </p>
                                </div>

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewMedia(media);
                                        }}
                                    >
                                        预览
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        className="bg-red-500 hover:bg-red-600 text-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(media.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {loadingMore && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    <div ref={observerRef} className="h-1" />

                    {mediaList.length === 0 && !loading && (
                        <div className="text-center py-16 text-gray-500">
                            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">暂无媒体资源</p>
                            <p className="text-sm mt-1">点击上方上传按钮添加资源</p>
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={deleteConfirmOpen}
                onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}
                title="确认删除"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
                            取消
                        </Button>
                        <Button variant="danger" onClick={handleConfirmDelete}>
                            确认删除
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-gray-600">
                        {deleteTarget?.type === 'single'
                            ? '您确定要删除此媒体资源吗？'
                            : `您确定要删除选中的 ${deleteTarget?.ids?.length || 0} 个媒体资源吗？`}
                        }
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-700">
                            <p className="font-medium">注意事项</p>
                            <p>如果资源被作品引用，删除操作会被阻止。请先修改相关作品的媒体地址。</p>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!previewMedia}
                onClose={() => setPreviewMedia(null)}
                title={previewMedia?.originalName || ''}
                maxWidth="max-w-4xl"
            >
                {previewMedia && (
                    <div className="space-y-4">
                        <div className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                            {previewMedia.mediaType === 'IMAGE' ? (
                                <img
                                    src={getPreviewUrl(previewMedia)}
                                    alt={previewMedia.originalName}
                                    className="max-w-full max-h-[500px] object-contain"
                                />
                            ) : previewMedia.mediaType === 'VIDEO' ? (
                                <video
                                    src={getPreviewUrl(previewMedia)}
                                    controls
                                    className="max-w-full max-h-[500px]"
                                />
                            ) : (
                                <div className="text-center py-12">
                                    {getTypeIcon(previewMedia.mediaType)}
                                    <p className="mt-2 text-gray-500">此类型文件暂不支持预览</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">文件名</p>
                                <p className="font-medium text-gray-900 truncate" title={previewMedia.originalName}>
                                    {previewMedia.originalName}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500">文件大小</p>
                                <p className="font-medium text-gray-900">{formatFileSize(previewMedia.fileSize)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">MIME 类型</p>
                                <p className="font-medium text-gray-900">{previewMedia.mimeType}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">上传时间</p>
                                <p className="font-medium text-gray-900">{formatDateTime(previewMedia.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">资源地址</p>
                                <p className="font-medium text-gray-900 truncate" title={previewMedia.fileUrl}>
                                    {previewMedia.fileUrl}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500">引用状态</p>
                                <p className={`font-medium ${previewMedia.referenceCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {previewMedia.referenceCount > 0
                                        ? `被 ${previewMedia.referenceCount} 个作品引用`
                                        : '未被引用'}
                                </p>
                            </div>
                            {previewMedia.uploadedBy && (
                                <div>
                                    <p className="text-gray-500">上传者</p>
                                    <p className="font-medium text-gray-900">{previewMedia.uploadedBy.username}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(previewMedia.fileUrl);
                                    success('地址已复制到剪贴板');
                                }}
                            >
                                复制地址
                            </Button>
                            {previewMedia.referenceCount === 0 && (
                                <Button
                                    variant="danger"
                                    onClick={() => {
                                        setPreviewMedia(null);
                                        handleDeleteClick(previewMedia.id);
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    删除
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
