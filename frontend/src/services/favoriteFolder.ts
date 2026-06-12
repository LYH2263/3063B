import api from './api';

export interface FavoriteFolder {
    id: number;
    name: string;
    description: string | null;
    visibility: 'PUBLIC' | 'PRIVATE';
    userId: number;
    workCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface FolderWithWorkStatus extends FavoriteFolder {
    hasWork: boolean;
}

export interface FolderWorksResponse {
    total: number;
    page: number;
    limit: number;
    works: any[];
}

export const getMyFolders = async (): Promise<FavoriteFolder[]> => {
    const res: any = await api.get('/favorite-folders/my/list');
    return res.data || [];
};

export const getFolderDetail = async (id: number): Promise<FavoriteFolder> => {
    const res: any = await api.get(`/favorite-folders/${id}`);
    return res.data;
};

export const createFolder = async (data: {
    name: string;
    description?: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
}): Promise<FavoriteFolder> => {
    const res: any = await api.post('/favorite-folders', data);
    return res.data;
};

export const updateFolder = async (id: number, data: {
    name?: string;
    description?: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
}): Promise<FavoriteFolder> => {
    const res: any = await api.put(`/favorite-folders/${id}`, data);
    return res.data;
};

export const deleteFolder = async (id: number): Promise<void> => {
    await api.delete(`/favorite-folders/${id}`);
};

export const addWorkToFolder = async (folderId: number, workId: number): Promise<{ added: boolean }> => {
    const res: any = await api.post(`/favorite-folders/${folderId}/works/${workId}`);
    return res.data;
};

export const removeWorkFromFolder = async (folderId: number, workId: number): Promise<{ removed: boolean }> => {
    const res: any = await api.delete(`/favorite-folders/${folderId}/works/${workId}`);
    return res.data;
};

export const getFolderWorks = async (folderId: number, page = 1, limit = 12): Promise<FolderWorksResponse> => {
    const res: any = await api.get(`/favorite-folders/${folderId}/works?page=${page}&limit=${limit}`);
    return res.data;
};

export const getUserPublicFolders = async (userId: number): Promise<FavoriteFolder[]> => {
    const res: any = await api.get(`/favorite-folders/user/${userId}/public`);
    return res.data || [];
};

export const getWorkFolderStatus = async (workId: number): Promise<FolderWithWorkStatus[]> => {
    const res: any = await api.get(`/favorite-folders/work/${workId}/status`);
    return res.data || [];
};

export const batchAddWorkToFolders = async (workId: number, folderIds: number[]): Promise<{
    addedCount: number;
    totalInFolders: number;
}> => {
    const res: any = await api.post(`/favorite-folders/work/${workId}/batch`, { folderIds });
    return res.data;
};
