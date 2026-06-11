import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import LevelBadge from '../../components/LevelBadge';
import api from '../../services/api';
import { Heart, MessageSquare, User, Gift, Clock, ChevronLeft, ChevronRight, Coins, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useSeo } from '../../hooks/useSeo';
import type { FilterResponse, MatchResult } from '../../services/sensitiveWord';
import { getLevelLabel, getLevelColor } from '../../services/sensitiveWord';

interface PointInfo {
    points: number;
    username: string;
    currentLevel: {
        level: number;
        name: string;
        minPoints: number;
        color: string;
    };
    nextLevel: {
        level: number;
        name: string;
        minPoints: number;
        color: string;
    } | null;
    progress: number;
    pointsToNext: number;
}

interface PointLog {
    id: number;
    actionType: string;
    points: number;
    balanceAfter: number;
    description: string;
    relatedId: number | null;
    createdAt: string;
}

interface PointLogsResponse {
    list: PointLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

const actionTypeLabels: Record<string, string> = {
    DAILY_LOGIN: '每日登录',
    MESSAGE_APPROVED: '留言通过',
    WORK_FAVORITED: '收藏作品',
    WORK_PUBLISHED: '发布作品',
    ADMIN_ADJUST: '管理员调整',
};

export const Profile = () => {
    useSeo({ pageType: 'PROFILE' });
    const { user } = useAuth();
    const { success, error } = useToast();
    const [favorites, setFavorites] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [pointInfo, setPointInfo] = useState<PointInfo | null>(null);
    const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsTotalPages, setLogsTotalPages] = useState(0);
    const [isClaiming, setIsClaiming] = useState(false);
    const [hasClaimedToday, setHasClaimedToday] = useState(false);
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [filterResult, setFilterResult] = useState<FilterResponse | null>(null);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    useEffect(() => {
        fetchPointInfo();
        fetchPointLogs(1);
    }, []);

    useEffect(() => {
        api.get('/works/user/favorites')
            .then((res: any) => setFavorites(res.data || []))
            .catch(console.error);
    }, []);

    const fetchPointInfo = async () => {
        try {
            const res: any = await api.get('/points/me');
            setPointInfo(res.data);
        } catch (err: any) {
            console.error('Failed to fetch point info:', err);
        }
    };

    const fetchPointLogs = async (page: number) => {
        try {
            const res: any = await api.get(`/points/logs?page=${page}&pageSize=10`);
            const data = res.data as PointLogsResponse;
            setPointLogs(data.list);
            setLogsTotal(data.total);
            setLogsTotalPages(data.totalPages);
            setLogsPage(data.page);
        } catch (err: any) {
            console.error('Failed to fetch point logs:', err);
        }
    };

    const handleDailyLogin = async () => {
        if (isClaiming) return;
        setIsClaiming(true);
        try {
            const res: any = await api.post('/points/daily-login');
            if (res.data?.success) {
                success(`获得 ${res.data.points} 积分！`);
                setHasClaimedToday(true);
                fetchPointInfo();
                fetchPointLogs(1);
            } else {
                setHasClaimedToday(true);
                success('今日已领取过登录积分');
            }
        } catch (err: any) {
            error(err.message || '领取失败');
        } finally {
            setIsClaiming(false);
        }
    };

    const handleLeaveMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        try {
            const res: any = await api.post('/messages', { content: message });
            const data = res.data || {};
            if (data.filterAction) {
                setFilterResult({
                    action: data.filterAction,
                    matchedWords: data.matchedWords || []
                });
                setFilterModalOpen(true);
            }
            if (data.filterAction === 'REPLACE') {
                success('留言提交成功，部分内容已被替换');
            } else if (data.filterAction === 'REVIEW') {
                success('留言提交成功，正在审核中');
            } else {
                success('留言已提交，等待管理员审核。');
            }
            setMessage('');
        } catch (err: any) {
            if (err.code === 403 && err.data?.action === 'BLOCK') {
                setFilterResult({
                    action: 'BLOCK',
                    matchedWords: err.data.matchedWords || []
                });
                setFilterModalOpen(true);
            } else {
                error(err.message || '留言提交失败');
            }
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== passwordConfirm) {
            error('两次输入的密码不一致');
            return;
        }
        if (password.length > 0 && password.length < 6) {
            error('密码长度至少需要 6 个字符');
            return;
        }
        if (!password) {
            error('请输入新密码');
            return;
        }
        try {
            await api.put('/auth/profile', { password });
            success('密码修改成功');
            setPassword('');
            setPasswordConfirm('');
        } catch (err: any) {
            error(err.message || '资料修改失败');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-10 space-y-8">

            {/* 用户信息卡片 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-6">
                <div className="w-24 h-24 bg-gradient-to-tr from-primary to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">{user.username}</h1>
                        {pointInfo && <LevelBadge level={pointInfo.currentLevel} size="lg" />}
                    </div>
                    <p className="text-gray-500 mt-1 capitalize">{user.roleType.toLowerCase()} 账号</p>
                </div>
            </div>

            {/* 积分与等级卡片 */}
            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-2xl border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Coins className="w-6 h-6 text-yellow-500" />
                        我的积分
                    </h2>
                    <Button
                        onClick={handleDailyLogin}
                        disabled={isClaiming || hasClaimedToday}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                    >
                        <Gift className="w-4 h-4 mr-2" />
                        {hasClaimedToday ? '今日已签到' : '每日签到'}
                    </Button>
                </div>

                {pointInfo ? (
                    <div className="space-y-4">
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-primary">{pointInfo.points}</span>
                            <span className="text-gray-500 mb-1">积分</span>
                        </div>

                        {/* 等级进度条 */}
                        <div className="bg-white/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <LevelBadge level={pointInfo.currentLevel} size="sm" />
                                    <span className="text-sm text-gray-600">{pointInfo.currentLevel.name}</span>
                                </div>
                                {pointInfo.nextLevel ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">{pointInfo.nextLevel.name}</span>
                                        <LevelBadge level={pointInfo.nextLevel} size="sm" />
                                    </div>
                                ) : (
                                    <span className="text-sm text-yellow-600 font-medium">已满级</span>
                                )}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${pointInfo.progress}%`,
                                        backgroundColor: pointInfo.currentLevel.color,
                                    }}
                                />
                            </div>
                            {pointInfo.nextLevel && (
                                <p className="text-sm text-gray-500 mt-2 text-right">
                                    距离 {pointInfo.nextLevel.name} 还需 <span className="font-medium text-primary">{pointInfo.pointsToNext}</span> 积分
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="animate-pulse">
                        <div className="h-10 bg-gray-200 rounded w-32 mb-4"></div>
                        <div className="h-24 bg-gray-200 rounded-xl"></div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 积分明细 */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-blue-500" /> 积分明细
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {pointLogs.length > 0 ? (
                            <>
                                <div className="divide-y divide-gray-100">
                                    {pointLogs.map((log) => (
                                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {actionTypeLabels[log.actionType] || log.actionType}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{formatDate(log.createdAt)}</p>
                                            </div>
                                            <span className={`font-bold ${log.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {log.points > 0 ? '+' : ''}{log.points}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* 分页 */}
                                {logsTotalPages > 1 && (
                                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => fetchPointLogs(logsPage - 1)}
                                            disabled={logsPage <= 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            上一页
                                        </Button>
                                        <span className="text-sm text-gray-500">
                                            {logsPage} / {logsTotalPages}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => fetchPointLogs(logsPage + 1)}
                                            disabled={logsPage >= logsTotalPages}
                                        >
                                            下一页
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                <p>暂无积分记录</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧区域 */}
                <div className="space-y-8">
                    {/* 我的收藏 */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Heart className="w-6 h-6 text-red-500 fill-red-500" /> 我的收藏
                        </h2>
                        <div className="space-y-3">
                            {favorites.slice(0, 3).map((f: any) => (
                                <div key={f.id} className="flex gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 items-center">
                                    <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        {f.mediaUrl && <img src={f.mediaUrl} className="w-full h-full object-cover" alt="thumb" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate">{f.title}</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">{f.category}</p>
                                    </div>
                                </div>
                            ))}
                            {favorites.length === 0 && <p className="text-gray-500 italic text-sm">暂无收藏。</p>}
                            {favorites.length > 3 && (
                                <p className="text-sm text-gray-400 text-center">共 {favorites.length} 个收藏</p>
                            )}
                        </div>
                    </div>

                    {/* 修改资料 */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <User className="w-6 h-6 text-blue-500" /> 修改资料
                        </h2>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <form onSubmit={handleUpdateProfile} className="space-y-3">
                                <Input
                                    type="password"
                                    label="新密码"
                                    placeholder="输入新密码 (最少6个字符)"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <Input
                                    type="password"
                                    label="确认新密码"
                                    placeholder="再次输入新密码"
                                    value={passwordConfirm}
                                    onChange={e => setPasswordConfirm(e.target.value)}
                                />
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">更新密码</Button>
                            </form>
                        </div>
                    </div>

                    {/* 留言板 */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-primary" /> 留言板
                        </h2>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <form onSubmit={handleLeaveMessage} className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">写点什么给管理员...</label>
                                    <textarea
                                        className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none resize-none text-sm"
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder="您的留言..."
                                    />
                                </div>
                                <Button type="submit" className="w-full">提交留言</Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <FilterResultModal
                isOpen={filterModalOpen}
                onClose={() => setFilterModalOpen(false)}
                result={filterResult}
            />
        </div>
    );
};

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: FilterResponse | null;
}

const FilterResultModal: React.FC<FilterModalProps> = ({ isOpen, onClose, result }) => {
    if (!result) return null;

    const getModalConfig = () => {
        switch (result.action) {
            case 'BLOCK':
                return {
                    icon: AlertTriangle,
                    iconColor: 'text-red-500',
                    bgColor: 'bg-red-50',
                    borderColor: 'border-red-200',
                    title: '留言包含违规内容',
                    description: '您的留言包含以下违规内容，无法提交：'
                };
            case 'REPLACE':
                return {
                    icon: AlertTriangle,
                    iconColor: 'text-yellow-500',
                    bgColor: 'bg-yellow-50',
                    borderColor: 'border-yellow-200',
                    title: '部分内容已被替换',
                    description: '您的留言包含以下敏感词，已自动替换为 *** 后提交：'
                };
            case 'REVIEW':
                return {
                    icon: Info,
                    iconColor: 'text-blue-500',
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200',
                    title: '留言正在审核中',
                    description: '您的留言包含以下内容，需要管理员审核后才能显示：'
                };
            default:
                return {
                    icon: CheckCircle,
                    iconColor: 'text-green-500',
                    bgColor: 'bg-green-50',
                    borderColor: 'border-green-200',
                    title: '提交成功',
                    description: '您的留言已成功提交。'
                };
        }
    };

    const config = getModalConfig();
    const Icon = config.icon;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            footer={
                <Button onClick={onClose}>
                    我知道了
                </Button>
            }
        >
            <div className="text-center py-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bgColor} mb-4`}>
                    <Icon className={`w-8 h-8 ${config.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{config.title}</h3>
                <p className="text-gray-600 mb-6">{config.description}</p>

                {result.matchedWords && result.matchedWords.length > 0 && (
                    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 text-left`}>
                        <ul className="space-y-2">
                            {result.matchedWords.map((match, idx) => (
                                <li key={idx} className="flex items-center justify-between">
                                    <span className="font-mono text-gray-800">{match.word}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(match.level)}`}>
                                        {getLevelLabel(match.level)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {result.action === 'BLOCK' && (
                    <p className="mt-4 text-sm text-gray-500">
                        请修改内容后重新提交。如有疑问，请联系管理员。
                    </p>
                )}

                {result.action === 'REPLACE' && (
                    <p className="mt-4 text-sm text-gray-500">
                        敏感词已被替换，留言已提交并等待审核。
                    </p>
                )}

                {result.action === 'REVIEW' && (
                    <p className="mt-4 text-sm text-gray-500">
                        留言已提交，管理员将在审核后决定是否展示。感谢您的理解与配合。
                    </p>
                )}
            </div>
        </Modal>
    );
};
