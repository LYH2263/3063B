import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    Database,
    Download,
    Trash2,
    RotateCcw,
    Plus,
    Clock,
    HardDrive,
    FileText,
    User,
    AlertTriangle,
    Shield,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';

interface Backup {
    id: number;
    filename: string;
    version: string;
    status: 'CREATING' | 'COMPLETED' | 'FAILED';
    fileSize: number;
    recordCount: number;
    checksum: string;
    note: string | null;
    createdById: number;
    createdAt: string;
    createdBy: { username: string };
    fileExists?: boolean;
    sensitiveFields?: Record<string, string[]>;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    CREATING: { label: '创建中', color: 'bg-yellow-100 text-yellow-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    FAILED: { label: '失败', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const AdminBackupManagement = () => {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
    const [backupNote, setBackupNote] = useState('');
    const [restoreStep, setRestoreStep] = useState<'warning' | 'confirm' | 'restoring' | 'success' | 'error'>('warning');
    const [confirmText, setConfirmText] = useState('');
    const [restoreError, setRestoreError] = useState('');
    const { success, error, info } = useToast();

    const fetchBackups = async (page = 1) => {
        setLoading(true);
        try {
            const res: any = await api.get(`/backups?page=${page}&pageSize=${pagination.pageSize}`);
            setBackups(res.data.list);
            setPagination(res.data.pagination);
        } catch (err: any) {
            error(err.message || '加载备份列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        setCreating(true);
        try {
            const res: any = await api.post('/backups', { note: backupNote || undefined });
            success('备份创建成功');
            setShowCreateModal(false);
            setBackupNote('');
            fetchBackups();
        } catch (err: any) {
            error(err.message || '创建备份失败');
        } finally {
            setCreating(false);
        }
    };

    const handleDownloadBackup = async (backup: Backup) => {
        if (backup.status !== 'COMPLETED') {
            error('该备份未完成或已失败，无法下载');
            return;
        }
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8063/api'}/backups/${backup.id}/download`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );
            if (!response.ok) {
                throw new Error('下载失败');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = backup.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            success('备份文件已开始下载');
        } catch (err: any) {
            error(err.message || '下载备份失败');
        }
    };

    const handleDeleteBackup = async () => {
        if (!selectedBackup) return;
        try {
            await api.delete(`/backups/${selectedBackup.id}`);
            success('备份删除成功');
            setShowDeleteModal(false);
            setSelectedBackup(null);
            fetchBackups();
        } catch (err: any) {
            error(err.message || '删除备份失败');
        }
    };

    const handleRestoreBackup = async () => {
        if (!selectedBackup) return;
        setRestoreStep('restoring');
        setRestoreError('');
        try {
            await api.post(`/backups/${selectedBackup.id}/restore`, {
                confirm: 'I_CONFIRM_RESTORE'
            });
            setRestoreStep('success');
            success('数据恢复成功！系统将自动刷新');
            setTimeout(() => {
                setShowRestoreModal(false);
                setRestoreStep('warning');
                setConfirmText('');
                setSelectedBackup(null);
                fetchBackups();
            }, 2000);
        } catch (err: any) {
            setRestoreError(err.message || '恢复备份失败');
            setRestoreStep('error');
        }
    };

    const openRestoreModal = (backup: Backup) => {
        if (backup.status !== 'COMPLETED') {
            error('该备份未完成或已失败，无法恢复');
            return;
        }
        setSelectedBackup(backup);
        setRestoreStep('warning');
        setConfirmText('');
        setRestoreError('');
        setShowRestoreModal(true);
    };

    const proceedToConfirm = () => {
        if (confirmText !== '我已了解风险，确认恢复') {
            info('请准确输入确认文字');
            return;
        }
        setRestoreStep('confirm');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">数据备份与恢复</h1>
                    <p className="text-gray-500 mt-1">管理系统核心数据的备份与恢复操作</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    创建新备份
                </Button>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                        <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">敏感字段保护</h3>
                        <p className="text-sm text-gray-600">
                            备份文件会自动对敏感字段进行脱敏处理。例如：用户密码哈希会被标记为 <code className="bg-white px-1.5 py-0.5 rounded text-red-600">[REDACTED]</code>，
                            确保备份文件即使泄露也不会造成安全风险。恢复时系统会保留现有用户密码，不会覆盖为脱敏数据。
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-gray-500">加载备份列表...</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
                                <th className="p-4">备份ID</th>
                                <th className="p-4">状态</th>
                                <th className="p-4">文件名</th>
                                <th className="p-4">版本</th>
                                <th className="p-4">数据规模</th>
                                <th className="p-4">创建人</th>
                                <th className="p-4">创建时间</th>
                                <th className="p-4">备注</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {backups.map((backup) => {
                                const status = statusMap[backup.status];
                                return (
                                    <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-500">#{backup.id}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                {status.icon}
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                <span className="font-mono text-sm text-gray-700">{backup.filename}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">v{backup.version}</code>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <HardDrive className="w-4 h-4" />
                                                    {formatFileSize(backup.fileSize)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Database className="w-4 h-4" />
                                                    {backup.recordCount.toLocaleString()} 条记录
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-700">{backup.createdBy?.username || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <Clock className="w-4 h-4" />
                                                <span className="text-sm">{new Date(backup.createdAt).toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            <span className="text-sm text-gray-600 truncate block">
                                                {backup.note || '-'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDownloadBackup(backup)}
                                                    disabled={backup.status !== 'COMPLETED'}
                                                    className="gap-1"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    下载
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openRestoreModal(backup)}
                                                    disabled={backup.status !== 'COMPLETED'}
                                                    className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    恢复
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedBackup(backup);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="gap-1 text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    删除
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {backups.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 mb-2">暂无备份记录</p>
                                        <p className="text-gray-400 text-sm">点击右上角"创建新备份"按钮开始</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchBackups(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                            >
                                上一页
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchBackups(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                            >
                                下一页
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="创建新备份"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>取消</Button>
                        <Button onClick={handleCreateBackup} isLoading={creating} className="gap-2">
                            {creating ? '创建中...' : '确认创建'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        系统将导出以下核心数据到结构化备份文件：
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {['用户基本信息', '作品数据', '风格配置', '系统设置', '留言记录', 'SEO配置', '敏感词库', '积分规则', '等级配置'].map((item) => (
                            <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                {item}
                            </div>
                        ))}
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-medium mb-1">安全说明</p>
                                <p>敏感字段（如用户密码哈希）将自动脱敏处理，备份文件不包含真实密码数据。</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">备份备注（可选）</label>
                        <textarea
                            value={backupNote}
                            onChange={(e) => setBackupNote(e.target.value)}
                            placeholder="例如：升级前备份、月度常规备份等"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                            rows={3}
                            maxLength={200}
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setSelectedBackup(null);
                }}
                title="删除备份"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => {
                            setShowDeleteModal(false);
                            setSelectedBackup(null);
                        }}>取消</Button>
                        <Button variant="danger" onClick={handleDeleteBackup}>确认删除</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">确认要删除此备份吗？</p>
                            <p className="text-gray-600 mt-1">
                                备份文件：<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">{selectedBackup?.filename}</code>
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                此操作不可撤销，备份文件将被永久删除。
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showRestoreModal}
                onClose={() => {
                    if (restoreStep !== 'restoring') {
                        setShowRestoreModal(false);
                        setRestoreStep('warning');
                        setConfirmText('');
                        setSelectedBackup(null);
                    }
                }}
                title="数据恢复"
                maxWidth="max-w-xl"
                footer={
                    restoreStep === 'warning' ? (
                        <>
                            <Button variant="ghost" onClick={() => {
                                setShowRestoreModal(false);
                                setRestoreStep('warning');
                                setConfirmText('');
                                setSelectedBackup(null);
                            }}>取消</Button>
                            <Button
                                variant="danger"
                                onClick={proceedToConfirm}
                                disabled={confirmText !== '我已了解风险，确认恢复'}
                            >
                                我已了解，继续
                            </Button>
                        </>
                    ) : restoreStep === 'confirm' ? (
                        <>
                            <Button variant="ghost" onClick={() => setRestoreStep('warning')}>返回</Button>
                            <Button variant="danger" onClick={handleRestoreBackup} className="gap-2">
                                <RotateCcw className="w-4 h-4" />
                                立即恢复
                            </Button>
                        </>
                    ) : null
                }
            >
                <div className="space-y-4">
                    {restoreStep === 'warning' && (
                        <>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-red-800 mb-2">高风险操作警告</h4>
                                        <ul className="text-sm text-red-700 space-y-1.5">
                                            <li>• 恢复操作将<strong>覆盖当前所有数据</strong>，包括用户、作品、配置等</li>
                                            <li>• 操作具有原子性：要么全部恢复成功，要么全部回滚</li>
                                            <li>• 敏感字段（如密码）不会被恢复，现有用户密码保持不变</li>
                                            <li>• 建议恢复前先创建一个新备份以防万一</li>
                                            <li>• 恢复过程中请勿关闭页面或刷新</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">即将恢复的备份信息</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500">文件名：</span>
                                        <code className="bg-white px-1.5 py-0.5 rounded">{selectedBackup?.filename}</code>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">版本：</span>
                                        <code className="bg-white px-1.5 py-0.5 rounded">v{selectedBackup?.version}</code>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">记录数：</span>
                                        <span className="font-medium">{selectedBackup?.recordCount.toLocaleString()} 条</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">创建时间：</span>
                                        <span>{selectedBackup ? new Date(selectedBackup.createdAt).toLocaleString() : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    请输入 <span className="text-red-600">我已了解风险，确认恢复</span> 以继续
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="请输入确认文字"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                        </>
                    )}

                    {restoreStep === 'confirm' && (
                        <>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-orange-800 mb-2">二次确认</h4>
                                        <p className="text-sm text-orange-700">
                                            您确定要从备份 <code className="bg-white px-1.5 py-0.5 rounded">{selectedBackup?.filename}</code> 恢复数据吗？
                                            此操作将覆盖当前系统的所有核心数据，且无法撤销。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {restoreStep === 'restoring' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RotateCcw className="w-8 h-8 text-orange-600 animate-spin" />
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-2">正在恢复数据...</h4>
                            <p className="text-gray-500 text-sm">请勿关闭页面或刷新，恢复过程可能需要几分钟</p>
                        </div>
                    )}

                    {restoreStep === 'success' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-2">恢复成功！</h4>
                            <p className="text-gray-500 text-sm">数据已成功恢复，页面即将刷新...</p>
                        </div>
                    )}

                    {restoreStep === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-2">恢复失败</h4>
                            <p className="text-red-600 text-sm mb-4">{restoreError}</p>
                            <p className="text-gray-500 text-sm">数据已自动回滚，未产生任何变更</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => setRestoreStep('warning')}
                            >
                                重新尝试
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};
