export const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatChatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (isToday) return timeStr;
    if (isYesterday) return `昨天 ${timeStr}`;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${timeStr}`;
};

export const shouldShowDateDivider = (currentDateStr: string, prevDateStr: string | null): boolean => {
    if (!prevDateStr) return true;
    const current = new Date(currentDateStr);
    const prev = new Date(prevDateStr);
    return current.toDateString() !== prev.toDateString();
};

export const formatDateDivider = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (isToday) return '今天';
    if (isYesterday) return '昨天';
    return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`;
};
