import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { formatFileSize, formatDateTime } from '../lib/file';
import {
    Search,
    Image as ImageIcon,
    Film,
    Music,
    File,
    Check,
    Loader2,
    Upload,
    X
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
}

interface MediaPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (media: MediaItem) => void;
    selectedUrl?: string;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ isOpen, onClose, onSelect, selectedUrl }) => {
    const [mediaList, setMediaList] = useState<MediaItem[]>([]);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('IMAGE');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const observerRef = useRef<HTMLDivElement>(null);
    const { success, error } = useToast();

    const fetchMedia = async (reset = false) => {
        const currentPage = reset ? 1 : page;
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '24',
                type: filterType,
                ...(search && { search })
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
    };

    useEffect(() => {
        if (isOpen) {
            setMediaList([]);
            setPage(1);
            setSearch('');
            setSelectedMedia(null);
            fetchMedia(true);
        }
    }, [isOpen, filterType]);

    useEffect(() => {
        if (selectedUrl && mediaList.length > 0) {
            const found = mediaList.find(m => m.fileUrl === selectedUrl);
            if (found) setSelectedMedia(found);
        }
    }, [selectedUrl, mediaList]);

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
    }, [loadingMore, page, totalPages]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setMediaList([]);
        setPage(1);
        fetchMedia(true);
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const maxSize = 50 * 1024 * 1024;

        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!validTypes.includes(file.type)) {
                    error(`文件 "${file.name}" 类型不支持，仅支持图片`);
                    continue;
                }
                if (file.size > maxSize) {
                    error(`文件 "${file.name}" 超过 50MB 限制`);
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);
                const res: any = await api.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setSelectedMedia(res.data);
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

    const handleSelect = (media: MediaItem) => {
        setSelectedMedia(media);
    };

    const handleConfirm = () => {
        if (selectedMedia) {
            onSelect(selectedMedia);
            onClose();
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="从图库选择图片"
            maxWidth="max-w-6xl"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>取消</Button>
                    <Button onClick={handleConfirm} disabled={!selectedMedia}>
                        <Check className="w-4 h-4 mr-2" />
                        选择此图
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="flex gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <Input
                            placeholder="搜索文件名..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            prefix={<Search className="w-4 h-4 text-gray-400" />}
                        />
                        <Button type="submit" variant="outline">搜索</Button>
                    </form>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                        <option value="IMAGE">图片</option>
                        <option value="VIDEO">视频</option>
                        <option value="ALL">全部</option>
                    </select>
                    <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        上传
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                </div>

                {selectedMedia && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded overflow-hidden border border-blue-300">
                                <img
                                    src={getPreviewUrl(selectedMedia)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-900">已选择：{selectedMedia.originalName}</p>
                                <p className="text-xs text-blue-600">{formatFileSize(selectedMedia.fileSize)}</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedMedia(null)}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                <div className="text-sm text-gray-500">
                    共 {total} 个资源
                </div>

                {loading && mediaList.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto p-1">
                            {mediaList.map((media) => (
                                <div
                                    key={media.id}
                                    onClick={() => handleSelect(media)}
                                    className={`group relative bg-white rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                        selectedMedia?.id === media.id
                                            ? 'border-primary ring-2 ring-primary/30'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                        {media.mediaType === 'IMAGE' ? (
                                            <img
                                                src={getPreviewUrl(media)}
                                                alt={media.originalName}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : media.mediaType === 'VIDEO' ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                                <Film className="w-8 h-8 text-gray-400" />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                                {getTypeIcon(media.mediaType)}
                                            </div>
                                        )}

                                        {selectedMedia?.id === media.id && (
                                            <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                                <div className="bg-primary text-white rounded-full p-2">
                                                    <Check className="w-6 h-6" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-2">
                                        <p className="text-xs font-medium text-gray-900 truncate" title={media.originalName}>
                                            {media.originalName}
                                        </p>
                                        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                                            <span>{formatFileSize(media.fileSize)}</span>
                                            <span>{formatDateTime(media.createdAt).split(' ')[0]}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {loadingMore && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        )}

                        <div ref={observerRef} className="h-1" />

                        {mediaList.length === 0 && !loading && (
                            <div className="text-center py-12 text-gray-500">
                                <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">暂无图片</p>
                                <p className="text-sm mt-1">点击上传按钮添加图片</p>
                            </div>
                        )}
                    </>
                )}

                {uploading && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                        <div className="bg-white rounded-xl p-6 flex items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span>上传中...</span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
