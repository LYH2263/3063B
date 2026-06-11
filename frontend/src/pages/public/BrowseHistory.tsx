import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    getMyBrowseHistory,
    deleteBrowseHistory,
    clearAllBrowseHistory,
    BrowseHistoryItem
} from '../../services/browseHistory';
import { formatMessageTime } from '../../lib/date';
import { Clock, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Eye } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

export const BrowseHistory = () => {
    const { user } = useAuth();
    const { success, error, confirm } = useToast();
    const navigate = useNavigate();

    const [histories, setHistories] = useState<BrowseHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [clearModalOpen, setClearModalOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchHistory = useCallback(async (currentPage: number) => {
        setLoading(true);
        try {
            const res = await getMyBrowseHistory(currentPage, 10, true);
            if (res.code === 200) {
                setHistories(res.data.list);
                setTotalPages(res.data.totalPages);
                setTotal(res.data.total);
                setPage(res.data.page);
            }
        } catch (err: any) {
            error(err.message || '获取浏览历史失败');
        } finally {
            setLoading(false);
        }
    }, [error]);

    useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await confirm('确定要删除这条浏览记录吗？');
        if (!confirmed) return;

        setDeletingId(id);
        try {
            const res = await deleteBrowseHistory(id);
            if (res.code === 200) {
                success('删除成功');
                setHistories(prev => prev.filter(h => h.id !== id));
                setTotal(prev => prev - 1);
            }
        } catch (err: any) {
            error(err.message || '删除失败');
        } finally {
            setDeletingId(null);
        }
    };

    const handleClearAll = async () => {
        setClearing(true);
        try {
            const res = await clearAllBrowseHistory();
            if (res.code === 200) {
                success('已清空所有浏览历史');
                setHistories([]);
                setTotal(0);
                setTotalPages(0);
                setClearModalOpen(false);
            }
        } catch (err: any) {
            error(err.message || '清空失败');
        } finally {
            setClearing(false);
        }
    };

    const handleCardClick = (item: BrowseHistoryItem) => {
        if (item.work.isAvailable) {
            navigate(`/works/${item.workId}`);
        } else {
            error('该作品已下架或已删除');
        }
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="max-w-5xl mx-auto py-10 px-4">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Clock className="w-8 h-8 text-primary" />
                        最近浏览
                    </h1>
                    <p className="text-gray-500 mt-2">共 {total} 条浏览记录</p>
                </div>
                {histories.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => setClearModalOpen(true)}
                        className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        清空全部
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-500">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    加载中...
                </div>
            ) : histories.length === 0 ? (
                <div className="py-20 text-center">
                    <Eye className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">暂无浏览记录</p>
                    <p className="text-gray-400 text-sm mt-2">去 <Link to="/works" className="text-primary hover:underline">作品集</Link> 看看吧</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {histories.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleCardClick(item)}
                                className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-200 ${
                                    item.work.isAvailable
                                        ? 'hover:shadow-md hover:-translate-y-1 cursor-pointer'
                                        : 'opacity-60 cursor-not-allowed'
                                }`}
                            >
                                <div className="relative">
                                    <div className="aspect-video bg-gray-100 dark:bg-slate-800">
                                        {item.work.mediaUrl ? (
                                            <img
                                                src={item.work.mediaUrl.startsWith('http') ? item.work.mediaUrl : `${API_ROOT}${item.work.mediaUrl}`}
                                                alt={item.work.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <Eye className="w-10 h-10" />
                                            </div>
                                        )}
                                    </div>
                                    {!item.work.isAvailable && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <div className="flex items-center gap-2 text-white text-sm">
                                                <AlertTriangle className="w-4 h-4" />
                                                作品已下架
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-medium truncate ${item.work.isAvailable ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                                {item.work.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1">{item.work.category}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleDelete(item.id, e)}
                                            disabled={deletingId === item.id}
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 h-auto"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3">
                                        浏览于 {formatMessageTime(item.viewedAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fetchHistory(page - 1)}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                上一页
                            </Button>
                            <span className="text-sm text-gray-500">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fetchHistory(page + 1)}
                                disabled={page >= totalPages}
                            >
                                下一页
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={clearModalOpen}
                onClose={() => setClearModalOpen(false)}
                title="清空浏览历史"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setClearModalOpen(false)}>
                            取消
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleClearAll}
                            isLoading={clearing}
                        >
                            确认清空
                        </Button>
                    </>
                }
            >
                <div className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">确定要清空所有浏览历史吗？</p>
                            <p className="text-sm text-gray-500 mt-1">此操作不可恢复，您的所有浏览记录将被永久删除。</p>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default BrowseHistory;
