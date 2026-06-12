import api from './api';

export interface BrowseHistoryWork {
    id: number;
    title: string;
    mediaUrl: string;
    category: string;
    status: string;
    isAvailable: boolean;
}

export interface BrowseHistoryItem {
    id: number;
    workId: number;
    viewedAt: string;
    work: BrowseHistoryWork;
}

export interface BrowseHistoryResponse {
    list: BrowseHistoryItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const recordBrowse = async (workId: number) => {
    return api.post('/browse-history', { workId });
};

export const getMyBrowseHistory = async (
    page: number = 1,
    pageSize: number = 10,
    includeUnavailable: boolean = false
): Promise<{ code: number; message: string; data: BrowseHistoryResponse }> => {
    return api.get('/browse-history/me', {
        params: { page, pageSize, includeUnavailable }
    });
};

export const deleteBrowseHistory = async (id: number): Promise<{ code: number; message: string; data: any }> => {
    return api.delete(`/browse-history/${id}`);
};

export const clearAllBrowseHistory = async (): Promise<{ code: number; message: string; data: any }> => {
    return api.delete('/browse-history/clear/all');
};
