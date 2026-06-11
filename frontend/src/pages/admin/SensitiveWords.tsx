import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Upload, Download, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react';
import {
    sensitiveWordApi,
    SensitiveWord,
    SensitiveWordLevel,
    SensitiveWordStats,
    getLevelLabel,
    getLevelColor,
    BatchImportResult
} from '../../services/sensitiveWord';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const PAGE_SIZE = 20;

export const AdminSensitiveWords = () => {
    const { success, error } = useToast();
    const [words, setWords] = useState<SensitiveWord[]>([]);
    const [stats, setStats] = useState<SensitiveWordStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [keyword, setKeyword] = useState('');
    const [filterLevel, setFilterLevel] = useState<SensitiveWordLevel | ''>('');
    const [filterActive, setFilterActive] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWord, setEditingWord] = useState<SensitiveWord | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importLevel, setImportLevel] = useState<SensitiveWordLevel>('REPLACE');
    const [importResult, setImportResult] = useState<BatchImportResult | null>(null);

    const fetchWords = async () => {
        setLoading(true);
        try {
            const params: any = { page, pageSize: PAGE_SIZE };
            if (keyword) params.keyword = keyword;
            if (filterLevel) params.level = filterLevel;
            if (filterActive !== '') params.isActive = filterActive === 'true';
            const res: any = await sensitiveWordApi.getWords(params);
            setWords(res.data.list);
            setTotal(res.data.total);
        } catch (err: any) {
            error(err.message || '获取敏感词列表失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res: any = await sensitiveWordApi.getStats();
            setStats(res.data);
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
        }
    };

    useEffect(() => {
        fetchWords();
        fetchStats();
    }, [page, filterLevel, filterActive]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchWords();
        }, 300);
        return () => clearTimeout(timer);
    }, [keyword]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleCreate = () => {
        setEditingWord(null);
        setIsModalOpen(true);
    };

    const handleEdit = (word: SensitiveWord) => {
        setEditingWord(word);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('确定要删除此敏感词吗？')) return;
        try {
            await sensitiveWordApi.deleteWord(id);
            success('删除成功');
            fetchWords();
            fetchStats();
        } catch (err: any) {
            error(err.message || '删除失败');
        }
    };

    const handleToggle = async (id: number) => {
        try {
            const res: any = await sensitiveWordApi.toggleStatus(id);
            success(`已${res.data.isActive ? '启用' : '停用'}该敏感词`);
            fetchWords();
            fetchStats();
        } catch (err: any) {
            error(err.message || '操作失败');
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`确定要删除选中的 ${selectedIds.length} 条敏感词吗？`)) return;
        try {
            await sensitiveWordApi.batchDelete(selectedIds);
            success(`已删除 ${selectedIds.length} 条敏感词`);
            setSelectedIds([]);
            fetchWords();
            fetchStats();
        } catch (err: any) {
            error(err.message || '批量删除失败');
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.length === words.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(words.map(w => w.id));
        }
    };

    const handleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleImport = async () => {
        if (!importText.trim()) {
            error('请输入要导入的敏感词');
            return;
        }
        const lines = importText.split('\n').filter(line => line.trim());
        const wordsToImport = lines.map(line => ({
            word: line.trim(),
            level: importLevel
        }));
        try {
            const res: any = await sensitiveWordApi.batchImport(wordsToImport);
            setImportResult(res.data);
            if (res.data.failed === 0) {
                success(`成功导入 ${res.data.success} 条敏感词`);
                setIsImportModalOpen(false);
                setImportText('');
                fetchWords();
                fetchStats();
            }
        } catch (err: any) {
            error(err.message || '导入失败');
        }
    };

    const handleExport = () => {
        const content = words.map(w => `${w.word},${w.level},${w.category || ''}`).join('\n');
        const blob = new Blob([`word,level,category\n${content}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sensitive_words_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const statCards = useMemo(() => {
        if (!stats) return [];
        return [
            { label: '总词数', value: stats.total, icon: CheckCircle, color: 'bg-blue-50 text-blue-600' },
            { label: '禁止级', value: stats.banCount, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: '替换级', value: stats.replaceCount, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-600' },
            { label: '复审级', value: stats.reviewCount, icon: Filter, color: 'bg-purple-50 text-purple-600' },
        ];
    }, [stats]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">敏感词管理</h1>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        导出
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        批量导入
                    </Button>
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        新增敏感词
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {statCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">{card.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                                </div>
                                <div className={`${card.color} p-3 rounded-lg`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-64">
                        <Input
                            placeholder="搜索敏感词..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            prefix={<Search className="w-4 h-4 text-gray-400" />}
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-gray-700"
                        value={filterLevel}
                        onChange={(e) => { setFilterLevel(e.target.value as any); setPage(1); }}
                    >
                        <option value="">全部级别</option>
                        <option value="BAN">禁止级</option>
                        <option value="REPLACE">替换级</option>
                        <option value="REVIEW">复审级</option>
                    </select>
                    <select
                        className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:border-gray-700"
                        value={filterActive}
                        onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
                    >
                        <option value="">全部状态</option>
                        <option value="true">已启用</option>
                        <option value="false">已停用</option>
                    </select>
                    {selectedIds.length > 0 && (
                        <Button variant="danger" onClick={handleBatchDelete}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除选中 ({selectedIds.length})
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
                            <th className="p-4 w-12">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === words.length && words.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded border-gray-300"
                                />
                            </th>
                            <th className="p-4">敏感词</th>
                            <th className="p-4">级别</th>
                            <th className="p-4">分类</th>
                            <th className="p-4">状态</th>
                            <th className="p-4">创建时间</th>
                            <th className="p-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">加载中...</td>
                            </tr>
                        ) : words.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">暂无敏感词</td>
                            </tr>
                        ) : (
                            words.map((word) => (
                                <tr key={word.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(word.id)}
                                            onChange={() => handleSelect(word.id)}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="p-4 font-mono text-gray-900">{word.word}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(word.level)}`}>
                                            {getLevelLabel(word.level)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600">{word.category || '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${word.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {word.isActive ? '已启用' : '已停用'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {new Date(word.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleToggle(word.id)}
                                            className="text-gray-500 hover:text-blue-600 p-1"
                                            title={word.isActive ? '停用' : '启用'}
                                        >
                                            {word.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(word)}
                                            className="text-gray-500 hover:text-blue-600 p-1"
                                            title="编辑"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(word.id)}
                                            className="text-gray-500 hover:text-red-600 p-1"
                                            title="删除"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-sm text-gray-500">
                        共 {total} 条，第 {page} / {totalPages} 页
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            上一页
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let p = page - 2 + i;
                            if (p < 1) p = i + 1;
                            if (p > totalPages) p = totalPages - (4 - i);
                            if (p < 1 || p > totalPages) return null;
                            return (
                                <Button
                                    key={p}
                                    variant={p === page ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPage(p)}
                                >
                                    {p}
                                </Button>
                            );
                        })}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}

            <WordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingWord={editingWord}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchWords();
                    fetchStats();
                }}
            />

            <Modal
                isOpen={isImportModalOpen}
                onClose={() => { setIsImportModalOpen(false); setImportText(''); setImportResult(null); }}
                title="批量导入敏感词"
                maxWidth="max-w-2xl"
                footer={
                    <>
                        <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportText(''); setImportResult(null); }}>
                            取消
                        </Button>
                        <Button onClick={handleImport}>
                            <Upload className="w-4 h-4 mr-2" />
                            导入
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">选择级别</label>
                        <select
                            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                            value={importLevel}
                            onChange={(e) => setImportLevel(e.target.value as any)}
                        >
                            <option value="BAN">禁止级 - 直接拦截</option>
                            <option value="REPLACE">替换级 - 替换为星号</option>
                            <option value="REVIEW">复审级 - 进入待审核</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            敏感词列表（每行一个）
                        </label>
                        <textarea
                            className="w-full h-64 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                            placeholder="敏感词1&#10;敏感词2&#10;敏感词3&#10;..."
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            每行输入一个敏感词，支持批量导入。已存在的词将更新其级别。
                        </p>
                    </div>
                    {importResult && importResult.failed > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-red-700">导入结果：</p>
                            <p className="text-sm text-red-600">成功 {importResult.success} 条，失败 {importResult.failed} 条</p>
                            <ul className="mt-2 text-xs text-red-500 list-disc list-inside">
                                {importResult.errors.slice(0, 10).map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                                {importResult.errors.length > 10 && (
                                    <li>...还有 {importResult.errors.length - 10} 条错误</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

interface WordModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingWord: SensitiveWord | null;
    onSuccess: () => void;
}

const WordModal: React.FC<WordModalProps> = ({ isOpen, onClose, editingWord, onSuccess }) => {
    const { success, error } = useToast();
    const [form, setForm] = useState({
        word: '',
        level: 'REPLACE' as SensitiveWordLevel,
        category: '',
        isActive: true
    });

    useEffect(() => {
        if (editingWord) {
            setForm({
                word: editingWord.word,
                level: editingWord.level,
                category: editingWord.category || '',
                isActive: editingWord.isActive
            });
        } else {
            setForm({ word: '', level: 'REPLACE', category: '', isActive: true });
        }
    }, [editingWord, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.word.trim()) {
            error('请输入敏感词');
            return;
        }
        try {
            if (editingWord) {
                await sensitiveWordApi.updateWord(editingWord.id, form);
                success('更新成功');
            } else {
                await sensitiveWordApi.createWord(form);
                success('创建成功');
            }
            onSuccess();
        } catch (err: any) {
            error(err.message || '操作失败');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingWord ? '编辑敏感词' : '新增敏感词'}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={handleSubmit}>
                        {editingWord ? '保存' : '创建'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">敏感词</label>
                    <Input
                        value={form.word}
                        onChange={(e) => setForm(f => ({ ...f, word: e.target.value }))}
                        placeholder="请输入敏感词"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">级别</label>
                    <select
                        className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                        value={form.level}
                        onChange={(e) => setForm(f => ({ ...f, level: e.target.value as any }))}
                    >
                        <option value="BAN">禁止级 - 直接拦截，不允许提交</option>
                        <option value="REPLACE">替换级 - 将敏感词替换为 *** 后提交</option>
                        <option value="REVIEW">复审级 - 强制进入待审核状态</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">分类（可选）</label>
                    <Input
                        value={form.category}
                        onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                        placeholder="如：政治、色情、暴力等"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={form.isActive}
                        onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                        className="rounded border-gray-300"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">启用此敏感词</label>
                </div>
            </form>
        </Modal>
    );
};
