import api from './api';

export type SensitiveWordLevel = 'BAN' | 'REPLACE' | 'REVIEW';

export interface SensitiveWord {
    id: number;
    word: string;
    level: SensitiveWordLevel;
    isActive: boolean;
    category?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SensitiveWordStats {
    total: number;
    banCount: number;
    replaceCount: number;
    reviewCount: number;
    activeCount: number;
    inactiveCount: number;
}

export interface PaginatedResponse<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface BatchImportResult {
    success: number;
    failed: number;
    errors: string[];
}

export interface MatchResult {
    word: string;
    level: SensitiveWordLevel;
}

export interface FilterResponse {
    action: 'ALLOW' | 'BLOCK' | 'REPLACE' | 'REVIEW';
    matchedWords: MatchResult[];
    filterAction?: string;
}

export const sensitiveWordApi = {
    getStats: (): Promise<SensitiveWordStats> => {
        return api.get('/sensitive-words/stats');
    },

    getWords: (params: {
        page?: number;
        pageSize?: number;
        level?: SensitiveWordLevel;
        isActive?: boolean;
        keyword?: string;
    }): Promise<PaginatedResponse<SensitiveWord>> => {
        return api.get('/sensitive-words', { params });
    },

    getWordById: (id: number): Promise<SensitiveWord> => {
        return api.get(`/sensitive-words/${id}`);
    },

    createWord: (data: {
        word: string;
        level: SensitiveWordLevel;
        category?: string;
        isActive?: boolean;
    }): Promise<SensitiveWord> => {
        return api.post('/sensitive-words', data);
    },

    updateWord: (id: number, data: Partial<{
        word: string;
        level: SensitiveWordLevel;
        category?: string;
        isActive?: boolean;
    }>): Promise<SensitiveWord> => {
        return api.put(`/sensitive-words/${id}`, data);
    },

    deleteWord: (id: number): Promise<void> => {
        return api.delete(`/sensitive-words/${id}`);
    },

    toggleStatus: (id: number): Promise<SensitiveWord> => {
        return api.patch(`/sensitive-words/${id}/toggle`);
    },

    batchImport: (words: {
        word: string;
        level: SensitiveWordLevel;
        category?: string;
    }[]): Promise<BatchImportResult> => {
        return api.post('/sensitive-words/batch-import', { words });
    },

    batchDelete: (ids: number[]): Promise<void> => {
        return api.post('/sensitive-words/batch-delete', { ids });
    }
};

export const getLevelLabel = (level: SensitiveWordLevel): string => {
    const labels: Record<SensitiveWordLevel, string> = {
        BAN: '禁止级',
        REPLACE: '替换级',
        REVIEW: '复审级'
    };
    return labels[level];
};

export const getLevelColor = (level: SensitiveWordLevel): string => {
    const colors: Record<SensitiveWordLevel, string> = {
        BAN: 'bg-red-100 text-red-700',
        REPLACE: 'bg-yellow-100 text-yellow-700',
        REVIEW: 'bg-blue-100 text-blue-700'
    };
    return colors[level];
};
