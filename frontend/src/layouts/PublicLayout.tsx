import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useStyle } from '../context/StyleContext';
import { getUnreadCount } from '../services/dm';

export const PublicLayout = () => {
    const { user, logout, isAdmin } = useAuth();
    const { style } = useStyle();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setUnreadCount(0);
            return;
        }

        const fetchUnreadCount = async () => {
            try {
                const res = await getUnreadCount();
                if (res.code === 200) {
                    setUnreadCount(res.data.count);
                }
            } catch (err) {
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 5000);

        return () => clearInterval(interval);
    }, [user, location.pathname]);

    return (
        <div className={cn("min-h-screen flex flex-col", style?.layoutMode === 'DUAL' ? 'max-w-7xl mx-auto' : '')}>
            <header className="sticky top-0 z-40 w-full backdrop-blur flex-none transition-colors duration-500 lg:z-50 lg:border-b lg:border-slate-900/10 dark:border-slate-50/[0.06] bg-white/95 supports-backdrop-blur:bg-white/60 dark:bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-6">
                            <Link to="/" className="font-bold text-xl text-primary flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
                                    P
                                </div>
                                独立站
                            </Link>
                            <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                                <Link to="/" className={cn("hover:text-primary transition-colors", location.pathname === '/' && 'text-primary')}>首页</Link>
                                <Link to="/works" className={cn("hover:text-primary transition-colors", location.pathname.startsWith('/works') && 'text-primary')}>作品集</Link>
                                {user && (
                                    <>
                                        <Link to="/profile" className={cn("hover:text-primary transition-colors", location.pathname === '/profile' && 'text-primary')}>个人主页</Link>
                                        <Link to="/browse-history" className={cn("hover:text-primary transition-colors", location.pathname === '/browse-history' && 'text-primary')}>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4 inline" />
                                                最近浏览
                                            </span>
                                        </Link>
                                        <Link to="/messages" className={cn("hover:text-primary transition-colors relative", location.pathname.startsWith('/messages') && 'text-primary')}>
                                            <span className="flex items-center gap-1">
                                                私信
                                                {unreadCount > 0 && (
                                                    <span className="min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    </>
                                )}
                            </nav>
                        </div>

                        <div className="flex items-center gap-4 text-sm font-medium">
                            {user ? (
                                <>
                                    <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">你好, {user.username}</span>
                                    <Link to="/messages" className="relative md:hidden">
                                        <MessageSquare className="w-5 h-5 text-gray-600" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                    {isAdmin && (
                                        <Link to="/admin" className="text-primary hover:underline">管理后台</Link>
                                    )}
                                    <button onClick={logout} className="text-gray-600 hover:text-red-500 transition-colors">
                                        退出登录
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="text-gray-600 hover:text-primary transition-colors">登录</Link>
                                    <Link to="/register" className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
                                        注册
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>

            <footer className="w-full border-t border-gray-200 dark:border-gray-800 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                &copy; {new Date().getFullYear()} IndieSite 版权所有
            </footer>
        </div>
    );
};

export default PublicLayout;
