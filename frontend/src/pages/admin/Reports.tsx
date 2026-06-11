import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Flag, CheckCircle, XCircle, Eye, Trash2, Filter } from 'lucide-react';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8063/api').replace(/\/api$/, '');

export const AdminReports = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [statusStats, setStatusStats] = useState<any>({});
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [handleNote, setHandleNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const { success, error } = useToast();

    const fetchReports = async () => {
        try {
            const params: any = { page, limit };
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.reportType = typeFilter;

            const res: any = await api.get('/reports/admin/list', { params });
            setReports(res.data.reports);
            setStatusStats(res.data.statusStats);
            setTotal(res.data.total);
        } catch (err: any) {
            error(err.message || '加载举报列表失败');
        }
    };

    useEffect(() => {
        fetchReports();
    }, [page, statusFilter, typeFilter]);

    const openDetail = (report: any) => {
        setSelectedReport(report);
        setHandleNote('');
        setDetailModalOpen(true);
    };

    const handleUpdateStatus = async (status: string, takeDown: boolean = false) => {
        if (!selectedReport) return;

        setProcessing(true);
        try {
            await api.put(`/reports/admin/${selectedReport.id}/status`, {
                status,
                handleNote: handleNote || undefined,
                takeDown
            });
            success(status === 'RESOLVED' ? '已标记为已处理' : status === 'REJECTED' ? '已驳回举报' : '状态已更新');
            setDetailModalOpen(false);
            fetchReports();
        } catch (err: any) {
            error(err.message || '操作失败');
        } finally {
            setProcessing(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(reports.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBatchUpdate = async (status: string) => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`确定要批量${status === 'RESOLVED' ? '标记已处理' : '驳回'}选中的 ${selectedIds.length} 条举报吗？`)) return;

        try {
            await api.put('/reports/admin/batch-status', {
                ids: selectedIds,
                status
            });
            success('批量操作成功');
            setSelectedIds([]);
            fetchReports();
        } catch (err: any) {
            error(err.message || '批量操作失败');
        }
    };

    const getReportTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            INFRINGEMENT: '侵权抄袭',
            INAPPROPRIATE_CONTENT: '不当内容',
            SPAM_AD: '垃圾广告',
            OTHER: '其他问题'
        };
        return map[type] || type;
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            PENDING: '待处理',
            RESOLVED: '已处理',
            REJECTED: '已驳回'
        };
        return map[status] || status;
    };

    const getStatusBadgeClass = (status: string) => {
        const map: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-700',
            RESOLVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-gray-100 text-gray-600'
        };
        return map[status] || 'bg-gray-100 text-gray-600';
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">举报处理</h1>
                <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                        <>
                            <Button variant="outline" onClick={() => handleBatchUpdate('RESOLVED')}>
                                批量标记已处理 ({selectedIds.length})
                            </Button>
                            <Button variant="outline" onClick={() => handleBatchUpdate('REJECTED')}>
                                批量驳回 ({selectedIds.length})
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">待处理</div>
                    <div className="text-2xl font-bold text-yellow-600">{statusStats.PENDING || 0}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">已处理</div>
                    <div className="text-2xl font-bold text-green-600">{statusStats.RESOLVED || 0}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">已驳回</div>
                    <div className="text-2xl font-bold text-gray-600">{statusStats.REJECTED || 0}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">举报总数</div>
                    <div className="text-2xl font-bold text-primary">{total}</div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">状态筛选：</span>
                        <select
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">全部状态</option>
                            <option value="PENDING">待处理</option>
                            <option value="RESOLVED">已处理</option>
                            <option value="REJECTED">已驳回</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">类型筛选：</span>
                        <select
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                            value={typeFilter}
                            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">全部类型</option>
                            <option value="INFRINGEMENT">侵权抄袭</option>
                            <option value="INAPPROPRIATE_CONTENT">不当内容</option>
                            <option value="SPAM_AD">垃圾广告</option>
                            <option value="OTHER">其他问题</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
                            <th className="p-4 w-12">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer w-4 h-4"
                                    checked={selectedIds.length === reports.length && reports.length > 0}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="p-4">被举报作品</th>
                            <th className="p-4">举报人</th>
                            <th className="p-4">举报类型</th>
                            <th className="p-4">状态</th>
                            <th className="p-4">处理人</th>
                            <th className="p-4">提交时间</th>
                            <th className="p-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {reports.map((report) => (
                            <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer w-4 h-4"
                                        checked={selectedIds.includes(report.id)}
                                        onChange={() => handleSelect(report.id)}
                                    />
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {report.work?.mediaUrl && (
                                            <img
                                                src={report.work.mediaUrl.startsWith('http') ? report.work.mediaUrl : `${API_ROOT}${report.work.mediaUrl}`}
                                                alt={report.work.title}
                                                className="w-10 h-10 object-cover rounded"
                                            />
                                        )}
                                        <div>
                                            <div className="font-medium text-gray-900">{report.work?.title}</div>
                                            <div className="text-xs text-gray-400">
                                                {report.work?.status === 'PUBLISHED' ? '已发布' : '草稿'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-gray-600">{report.reporter?.username}</td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                                        {getReportTypeLabel(report.reportType)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(report.status)}`}>
                                        {getStatusLabel(report.status)}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500 text-sm">
                                    {report.handler?.username || '-'}
                                </td>
                                <td className="p-4 text-gray-500 text-sm">
                                    {new Date(report.createdAt).toLocaleString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => openDetail(report)}
                                        className="text-primary hover:underline mx-2 text-sm"
                                    >
                                        查看处理
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {reports.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-500">暂无举报记录。</td></tr>
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-sm text-gray-500">共 {total} 条记录，第 {page}/{totalPages} 页</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                上一页
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                下一页
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="举报详情与处理" maxWidth="max-w-2xl">
                {selectedReport && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">被举报作品</div>
                                <div className="font-medium text-gray-900">{selectedReport.work?.title}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">举报人</div>
                                <div className="font-medium text-gray-900">{selectedReport.reporter?.username}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">举报类型</div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedReport.reportType === 'INFRINGEMENT' ? 'bg-red-50 text-red-600' : selectedReport.reportType === 'SPAM_AD' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {getReportTypeLabel(selectedReport.reportType)}
                                </span>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">当前状态</div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedReport.status)}`}>
                                    {getStatusLabel(selectedReport.status)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">举报理由</div>
                            <div className="p-4 bg-gray-50 rounded-lg text-gray-700 text-sm whitespace-pre-wrap">
                                {selectedReport.description}
                            </div>
                        </div>

                        {selectedReport.handler && (
                            <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">处理记录</div>
                                <div className="p-4 bg-green-50 rounded-lg text-sm">
                                    <div className="text-gray-600">处理人：{selectedReport.handler.username}</div>
                                    <div className="text-gray-600">处理时间：{new Date(selectedReport.handledAt).toLocaleString()}</div>
                                    {selectedReport.handleNote && (
                                        <div className="text-gray-700 mt-2">处理备注：{selectedReport.handleNote}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedReport.status === 'PENDING' && (
                            <div className="pt-4 border-t">
                                <div className="text-sm font-medium text-gray-700 mb-2">处理备注（可选）</div>
                                <textarea
                                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                    rows={3}
                                    placeholder="输入处理备注..."
                                    value={handleNote}
                                    onChange={e => setHandleNote(e.target.value)}
                                />

                                <div className="flex gap-3 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleUpdateStatus('REJECTED')}
                                        disabled={processing}
                                    >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        驳回举报
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateStatus('RESOLVED', false)}
                                        disabled={processing}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        标记已处理
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={() => {
                                            if (window.confirm('确定要下架此作品吗？下架后作品将变为草稿状态。')) {
                                                handleUpdateStatus('RESOLVED', true);
                                            }
                                        }}
                                        disabled={processing}
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        下架作品
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};
