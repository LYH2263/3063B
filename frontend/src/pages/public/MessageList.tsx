import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, Ban, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getConversations, type Conversation } from '../../services/dm';
import { formatMessageTime } from '../../lib/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import api from '../../services/api';
import { useSeo } from '../../hooks/useSeo';

export const MessageList = () => {
    useSeo({ pageType: 'MESSAGES' });
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
    const [searchUser, setSearchUser] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchingUser, setSearchingUser] = useState(false);
    const { user } = useAuth();
    const { toast, error } = useToast();
    const navigate = useNavigate();

    const fetchConversations = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await getConversations();
            if (res.code === 200) {
                setConversations(res.data);
            }
        } catch (err: any) {
            error(err.message || '获取会话列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchConversations();
    }, [user, navigate]);

    const handleSearchUser = async () => {
        if (!searchUser.trim()) return;
        try {
            setSearchingUser(true);
            const res: any = await api.get(`/auth/users?search=${encodeURIComponent(searchUser.trim())}`);
            if (res.code === 200) {
                setSearchResults(res.data.filter((u: any) => u.id !== user?.id));
            }
        } catch (err: any) {
            error(err.message || '搜索用户失败');
        } finally {
            setSearchingUser(false);
        }
    };

    const handleStartConversation = async (targetUserId: number, targetUsername: string) => {
        try {
            const res: any = await api.post('/dm/conversation', { targetUserId });
            if (res.code === 200) {
                setShowNewMessageDialog(false);
                setSearchUser('');
                setSearchResults([]);
                navigate(`/messages/${res.data.conversationId}`, {
                    state: { username: targetUsername, userId: targetUserId }
                });
            }
        } catch (err: any) {
            error(err.message || '创建会话失败');
        }
    };

    const handleClickConversation = (conv: Conversation) => {
        if (conv.otherUser.status === 'BANNED') {
            toast('该用户已被封禁', 'info');
            return;
        }
        navigate(`/messages/${conv.id}`, {
            state: { username: conv.otherUser.username, userId: conv.otherUser.id }
        });
    };

    const filteredConversations = conversations.filter(conv =>
        conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) return null;

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">我的私信</h1>
                <Button onClick={() => setShowNewMessageDialog(true)} size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    发起私信
                </Button>
            </div>

            <div className="mb-4">
                <Input
                    placeholder="搜索会话..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredConversations.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-gray-800">
                    <MessageSquare className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 mb-2">暂无私信</p>
                    <p className="text-sm text-gray-400">点击右上角发起新的对话</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredConversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => handleClickConversation(conv)}
                            className={`flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                                conv.otherUser.status === 'BANNED' ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                    <User className="w-6 h-6 text-primary" />
                                </div>
                                {conv.otherUser.status === 'BANNED' && (
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                        <Ban className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium truncate">{conv.otherUser.username}</span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {conv.lastMessage ? formatMessageTime(conv.lastMessageAt) : ''}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500 truncate pr-2">
                                        {conv.lastMessage
                                            ? `${conv.lastMessage.isMine ? '你: ' : ''}${conv.lastMessage.content}`
                                            : '暂无消息'}
                                    </p>
                                    {conv.unreadCount > 0 && (
                                        <span className="flex-shrink-0 min-w-5 h-5 px-1.5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showNewMessageDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewMessageDialog(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">发起新私信</h3>
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="搜索用户名..."
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                            />
                            <Button onClick={handleSearchUser} isLoading={searchingUser}>
                                搜索
                            </Button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {searchResults.length === 0 ? (
                                <p className="text-center text-gray-400 py-4">输入用户名搜索</p>
                            ) : (
                                searchResults.map((result) => (
                                    <div
                                        key={result.id}
                                        onClick={() => handleStartConversation(result.id, result.username)}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                            <User className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{result.username}</p>
                                            <p className="text-xs text-gray-400">
                                                {result.status === 'BANNED' ? '已封禁' : '活跃用户'}
                                            </p>
                                        </div>
                                        {result.status === 'BANNED' && (
                                            <Ban className="w-4 h-4 text-red-500" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full mt-4"
                            onClick={() => setShowNewMessageDialog(false)}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
