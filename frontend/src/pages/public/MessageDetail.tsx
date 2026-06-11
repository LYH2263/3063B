import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Ban, Loader2, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
    getConversationMessages,
    sendMessage,
    markAsRead,
    type PrivateMessage,
} from '../../services/dm';
import { formatChatTime, shouldShowDateDivider, formatDateDivider } from '../../lib/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSeo } from '../../hooks/useSeo';

interface LocationState {
    username?: string;
    userId?: number;
}

export const MessageDetail = () => {
    useSeo({ pageType: 'MESSAGES' });
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast, error } = useToast();

    const [messages, setMessages] = useState<PrivateMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [otherUsername, setOtherUsername] = useState('');
    const [otherUserId, setOtherUserId] = useState<number | null>(null);
    const [isOtherUserBanned, setIsOtherUserBanned] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<number | null>(null);
    const isAtBottomRef = useRef(true);
    const initializedRef = useRef(false);

    const conversationId = parseInt(id || '0');

    const scrollToBottom = useCallback((smooth: boolean = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: smooth ? 'smooth' : 'auto',
                block: 'end',
            });
        }
    }, []);

    const handleScroll = useCallback(() => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }, []);

    const fetchMessages = useCallback(async (page: number, append: boolean = false) => {
        if (!conversationId || !user) return;

        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            const res = await getConversationMessages(conversationId, page, 20);
            if (res.code === 200) {
                const newMessages = res.data.messages;
                setHasMore(res.data.pagination.hasMore);
                setCurrentPage(page);

                if (append && messages.length > 0) {
                    const filteredNew = newMessages.filter(
                        (nm) => !messages.some((m) => m.id === nm.id)
                    );
                    setMessages((prev) => [...filteredNew, ...prev]);
                } else {
                    setMessages(newMessages);
                }

                const otherMsg = newMessages.find(
                    (m) => m.senderId !== user.id || m.receiverId !== user.id
                );
                if (otherMsg) {
                    if (otherMsg.senderId === user.id) {
                        setOtherUserId(otherMsg.receiverId);
                        setOtherUsername(otherMsg.receiver.username);
                    } else {
                        setOtherUserId(otherMsg.senderId);
                        setOtherUsername(otherMsg.sender.username);
                    }
                }

                if (!append) {
                    setTimeout(() => scrollToBottom(false), 50);
                }
            }
        } catch (err: any) {
            if (err.code === 403) {
                error('无权访问此会话');
                navigate('/messages');
            } else {
                error(err.message || '获取消息失败');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [conversationId, user, messages, navigate, error, scrollToBottom]);

    const checkNewMessages = useCallback(async () => {
        if (!conversationId || !user || isOtherUserBanned) return;

        try {
            const res = await getConversationMessages(conversationId, 1, 20);
            if (res.code === 200) {
                const latestMessages = res.data.messages;

                if (latestMessages.length > 0) {
                    let hasNewMessages = false;
                    let newMsgs: PrivateMessage[] = [];

                    if (messages.length === 0) {
                        hasNewMessages = latestMessages.length > 0;
                        newMsgs = latestMessages;
                    } else {
                        const latestId = latestMessages[latestMessages.length - 1].id;
                        const currentLatestId = messages[messages.length - 1].id;

                        if (latestId > currentLatestId) {
                            hasNewMessages = true;
                            newMsgs = latestMessages.filter((m) => m.id > currentLatestId);
                        }
                    }

                    if (hasNewMessages && newMsgs.length > 0) {
                        setMessages((prev) => [...prev, ...newMsgs]);
                        markAsRead(conversationId).catch(() => {});

                        if (isAtBottomRef.current) {
                            setTimeout(() => scrollToBottom(true), 50);
                        }
                    }
                }
            }
        } catch (err) {
        }
    }, [conversationId, user, messages, isOtherUserBanned, scrollToBottom]);

    useEffect(() => {
        const state = location.state as LocationState;
        if (state?.username) setOtherUsername(state.username);
        if (state?.userId) setOtherUserId(state.userId);
    }, [location.state]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (conversationId) {
            fetchMessages(1);
            markAsRead(conversationId).catch(() => {});
            initializedRef.current = true;
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [conversationId, user, navigate, fetchMessages]);

    useEffect(() => {
        if (initializedRef.current && messages.length > 0) {
            pollingRef.current = setInterval(checkNewMessages, 3000);
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [checkNewMessages, messages.length]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [handleScroll]);

    const handleLoadMore = async () => {
        if (!hasMore || loadingMore) return;
        await fetchMessages(currentPage + 1, true);
    };

    const handleSend = async () => {
        const trimmedContent = newMessage.trim();
        if (!trimmedContent || sending || !otherUserId || isOtherUserBanned) return;

        try {
            setSending(true);
            const res: any = await sendMessage(otherUserId, trimmedContent);
            if (res.code === 201) {
                setMessages((prev) => [...prev, res.data]);
                setNewMessage('');
                setTimeout(() => scrollToBottom(true), 50);
            }
        } catch (err: any) {
            if (err.message?.includes('banned')) {
                setIsOtherUserBanned(true);
            }
            error(err.message || '发送失败');
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleBack = () => {
        navigate('/messages');
    };

    if (!user) return null;

    return (
        <div className="max-w-2xl mx-auto py-4 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-t-xl border border-b-0 border-gray-100 dark:border-gray-800">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                        </div>
                        {isOtherUserBanned && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <Ban className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="font-medium">{otherUsername || '用户'}</p>
                        {isOtherUserBanned && (
                            <p className="text-xs text-red-500">该用户已被封禁</p>
                        )}
                    </div>
                </div>
            </div>

            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-950 border border-b-0 border-gray-100 dark:border-gray-800 px-4 py-6"
            >
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <User className="w-16 h-16 mb-4 opacity-30" />
                        <p>还没有消息</p>
                        <p className="text-sm">开始你们的对话吧</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {hasMore && (
                            <div className="text-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadMore}
                                    isLoading={loadingMore}
                                >
                                    加载更多
                                </Button>
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isMine = msg.senderId === user.id;
                            const prevMsg = index > 0 ? messages[index - 1] : null;
                            const showDate = shouldShowDateDivider(
                                msg.createdAt,
                                prevMsg?.createdAt || null
                            );

                            return (
                                <React.Fragment key={msg.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-4">
                                            <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                                                {formatDateDivider(msg.createdAt)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex items-end gap-2 max-w-[75%] ${isMine ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                                                isMine
                                                    ? 'bg-gradient-to-br from-primary/30 to-primary/10'
                                                    : 'bg-gradient-to-br from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700'
                                            }`}>
                                                <User className={`w-4 h-4 ${isMine ? 'text-primary' : 'text-gray-500 dark:text-gray-300'}`} />
                                            </div>
                                            <div className={`px-4 py-2.5 rounded-2xl ${
                                                isMine
                                                    ? 'bg-primary text-white rounded-br-md'
                                                    : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm'
                                            }`}>
                                                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                    <span className={`text-xs ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
                                                        {formatChatTime(msg.createdAt)}
                                                    </span>
                                                    {isMine && (
                                                        <span className={isMine ? 'text-white/60' : 'text-gray-400'}>
                                                            {msg.isRead ? (
                                                                <CheckCheck className="w-4 h-4" />
                                                            ) : (
                                                                <Check className="w-4 h-4" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-b-xl border border-gray-100 dark:border-gray-800">
                {isOtherUserBanned ? (
                    <div className="text-center py-2 text-red-500 text-sm">
                        对方已被封禁，无法发送消息
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            placeholder="输入消息..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={sending}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!newMessage.trim() || sending}
                            isLoading={sending}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
