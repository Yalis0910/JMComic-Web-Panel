export interface AlbumSummary {
  album_id: string;
  title: string;
  author?: string;
  tags: string[];
  category?: string;
  cover_url: string;
}

export interface AlbumEpisode {
  photo_id: string;
  index: number;
  name: string;
}

export interface AlbumDetail extends AlbumSummary {
  authors: string[];
  actors: string[];
  works: string[];
  description: string;
  page_count: number;
  views: string;
  likes: string;
  comment_count: number;
  pub_date: string;
  update_date: string;
  episodes: AlbumEpisode[];
  related: AlbumSummary[];
  is_favorite: boolean;
  liked?: boolean;
}

export interface PhotoImage {
  index: number;
  filename: string;
  raw_url: string;
  proxy_url: string;
  scramble_id: string;
}

export interface PhotoDetail {
  photo_id: string;
  album_id: string;
  name: string;
  sort: number | string;
  scramble_id: string;
  image_count: number;
  images: PhotoImage[];
}

export interface CommentReply {
  cid: string;
  username: string;
  content: string;
  addtime: string;
  photo?: string;
}

export interface CommentItem {
  cid: string;
  album_id?: string;
  username: string;
  level?: number | null;
  level_name?: string;
  content: string;
  likes: string;
  addtime: string;
  spoiler: boolean;
  replies: CommentReply[];
}

export interface CategoriesMeta {
  categories: Array<Record<string, unknown>>;
  blocks: Array<{ title?: string; content?: unknown[] }>;
  sub_categories?: Record<string, { slug: string; name: string }[]>;
}

export interface DailyDayCell {
  day: number;
  label: string;
  signed: boolean | null;
  bonus: boolean;
}

export interface DailyCheckinInfo {
  daily_id: string;
  event_name: string;
  progress_text: string;
  streak_days: number;
  checked_in_today: boolean;
  rewards: {
    three_days_coin: string;
    three_days_exp: string;
    seven_days_coin: string;
    seven_days_exp: string;
  };
  days: DailyDayCell[];
}

export interface PageResult {
  albums: AlbumSummary[];
  total: number;
  page_count: number;
  page_size: number;
  folders?: { folder_id: string; name: string }[];
}

export interface DownloadTask {
  task_id: string;
  album_id: string;
  photo_id?: string | null;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  download_type: 'folder' | 'zip' | 'pdf' | 'long_img';
  progress: number;
  completed_count: number;
  total_count: number;
  current_chapter_index: number;
  total_chapters: number;
  output_path: string;
  error?: string | null;
  created_at: number;
  updated_at: number;
}

export interface LocalComic {
  album_id: string;
  title: string;
  author: string;
  tags: string[];
  path: string;
  format: 'folder' | 'zip' | 'pdf';
  chapter_count: number;
  page_count: number;
  size_bytes: number;
  scanned_at: number;
}

export interface HistoryItem {
  album_id: string;
  photo_id: string;
  source?: 'online' | 'local';
  title: string;
  chapter_title: string;
  cover_url: string;
  page_index: number;
  total_pages: number;
  updated_at: number;
  deleted?: number | boolean;
}

export interface BookmarkItem {
  bookmark_id: string;
  album_id: string;
  photo_id: string;
  source: 'online' | 'local';
  title: string;
  chapter_title: string;
  cover_url: string;
  page_index: number;
  note: string;
  created_at: number;
  updated_at: number;
  deleted?: number | boolean;
}

export interface LocalShelf {
  shelf_id: string;
  name: string;
  description: string;
  item_count: number;
  created_at: number;
  updated_at: number;
}

export interface LocalShelfItem {
  shelf_id: string;
  album_id: string;
  title: string;
  author: string;
  cover_url: string;
  tags: string[];
  added_at: number;
  updated_at: number;
}

export interface UserStatus {
  is_logged_in: boolean;
  username: string;
  impl: string;
  login_time: number;
  profile: Record<string, unknown>;
}

const TOKEN_KEY = 'jm_panel_token';

export function getPanelToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setPanelToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** 为受 PIN 锁保护的图片或文件 URL（/api/v2/library 与 /api/v2/media）自动附加 token 查询参数。 */
export function withPanelToken(url: string): string {
  if (!url) return url;
  const token = getPanelToken();
  if (!token || (!url.startsWith('/api/v2/library') && !url.startsWith('/api/v2/media'))) {
    return url;
  }
  if (url.includes('token=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPanelToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers['X-Panel-Token'] = token;

  const res = await fetch(`/api/v2${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.detail || `HTTP ${res.status}`, res.status);
  }
  if (!body || body.code !== 0) {
    throw new ApiError(body?.message || '请求失败', res.status);
  }
  return body.data as T;
}

export const api = {
  health: () => request<{ status: string; version: string; pin_enabled: boolean }>('/system/health'),
  unlock: (pin: string) => request<{ token: string }>('/system/unlock', { method: 'POST', body: JSON.stringify({ pin }) }),
  getSettings: () => request<{ panel: Record<string, any>; cache: Record<string, any>; option: Record<string, any> }>('/system/settings'),
  updateSettings: (patch: Record<string, any>) => request<{ panel: Record<string, any>; cache: Record<string, any> }>('/system/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  getOption: () => request<Record<string, any>>('/system/option'),
  updateOption: (patch: Record<string, any>) => request('/system/option', { method: 'PUT', body: JSON.stringify(patch) }),
  testProxy: (payload: { proxy_url: string; proxy_username?: string; proxy_password?: string }) =>
    request<{
      reachable: boolean;
      jm_reachable: boolean;
      latency_ms: number;
      status_code?: number | null;
      target?: string;
      message: string;
    }>('/system/proxy/test', { method: 'POST', body: JSON.stringify(payload) }),
  configurePin: (enabled: boolean, pin?: string) => request('/system/pin', { method: 'POST', body: JSON.stringify({ enabled, pin }) }),
  clearCache: () => request('/system/cache/clear', { method: 'POST' }),
  getDomains: () => request<{ api_domains: string[]; html_domains: string[] }>('/system/domains'),

  getPromote: (page = 1) => request<{ sections: { id: string; title: string; slug: string; type: string; albums: AlbumSummary[] }[] }>(`/discovery/promote?page=${page}`),
  getLatest: (page = 1) => request<{ albums: AlbumSummary[]; page: number }>(`/discovery/latest?page=${page}`),
  getCategoriesMeta: () => request<CategoriesMeta>('/discovery/categories'),
  getWeekMeta: () => request<{ categories: { id: string; title: string; time?: string }[]; types: { id: string; title: string }[] }>('/discovery/week'),
  getWeekFilter: (categoryId: string, typeId = 'manga') => request<{ albums: AlbumSummary[]; total: number }>(`/discovery/week/filter?category_id=${encodeURIComponent(categoryId)}&type_id=${encodeURIComponent(typeId)}`),
  getRanking: (type: 'day' | 'week' | 'month' | 'all' | 'likes' | 'latest', page = 1, category = '0') => request<PageResult>(`/discovery/ranking/${type}?page=${page}&category=${encodeURIComponent(category)}`),
  getForum: (page = 1) => request<{ comments: CommentItem[]; total: number; page: number; page_count: number }>(`/discovery/forum?page=${page}`),
  getCategoryFilter: (params: { page?: number; time?: string; order_by?: string; category?: string; sub_category?: string }) => {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      time: params.time ?? 'a',
      order_by: params.order_by ?? 'mv',
      category: params.category ?? '0',
    });
    if (params.sub_category) qs.set('sub_category', params.sub_category);
    return request<PageResult>(`/discovery/filter?${qs.toString()}`);
  },

  search: (params: { q: string; type?: string; page?: number; order_by?: string; time?: string; category?: string; sub_category?: string }) => {
    const qs = new URLSearchParams({
      q: params.q,
      type: params.type ?? 'all',
      page: String(params.page ?? 1),
      order_by: params.order_by ?? 'mr',
      time: params.time ?? 'a',
      category: params.category ?? '0',
    });
    if (params.sub_category) qs.set('sub_category', params.sub_category);
    return request<PageResult>(`/search?${qs.toString()}`);
  },

  getAlbum: (albumId: string) => request<AlbumDetail>(`/album/${albumId}`),
  getPhoto: (photoId: string) => request<PhotoDetail>(`/photo/${photoId}`),
  getComments: (albumId: string, page = 1) => request<{ comments: CommentItem[]; total: number; page: number }>(`/album/${albumId}/comments?page=${page}`),
  postComment: (albumId: string, comment: string, commentId?: string, spoiler = false) =>
    request(`/album/${albumId}/comments`, { method: 'POST', body: JSON.stringify({ comment, comment_id: commentId, spoiler }) }),

  getUserStatus: () => request<UserStatus>('/user/status'),
  login: (username: string, password: string, impl = 'api') =>
    request<UserStatus>('/user/login', { method: 'POST', body: JSON.stringify({ username, password, impl }) }),
  logout: () => request('/user/logout', { method: 'POST' }),
  getFavorites: (page = 1, folderId = '0', orderBy = 'mr') =>
    request<PageResult>(`/user/favorites?page=${page}&folder_id=${encodeURIComponent(folderId)}&order_by=${orderBy}`),
  addFavorite: (albumId: string, folderId = '0') =>
    request(`/user/favorites/${albumId}`, { method: 'POST', body: JSON.stringify({ folder_id: folderId }) }),
  removeFavorite: (albumId: string) => request(`/user/favorites/${albumId}`, { method: 'DELETE' }),
  getDailyInfo: () => request<DailyCheckinInfo>('/user/daily'),
  dailyCheckin: () => request<{ code: number; msg: string; already_checked_in: boolean }>('/user/checkin', { method: 'POST' }),

  listDownloads: () => request<DownloadTask[]>('/download/tasks'),
  createDownload: (albumId: string, downloadType: DownloadTask['download_type'] = 'folder', photoId?: string) =>
    request<DownloadTask>('/download/tasks', { method: 'POST', body: JSON.stringify({ album_id: albumId, download_type: downloadType, photo_id: photoId }) }),
  cancelDownload: (taskId: string) => request(`/download/tasks/${taskId}/cancel`, { method: 'POST' }),
  retryDownload: (taskId: string) => request<DownloadTask>(`/download/tasks/${taskId}/retry`, { method: 'POST' }),
  deleteDownload: (taskId: string) => request(`/download/tasks/${taskId}`, { method: 'DELETE' }),
  clearFinishedDownloads: () => request('/download/clear-finished', { method: 'POST' }),

  listLibrary: () => request<LocalComic[]>('/library'),
  scanLibrary: () => request<{ count: number; items: LocalComic[] }>('/library/scan', { method: 'POST' }),
  getLibraryDetail: (albumId: string) =>
    request<LocalComic & { chapters: { chapter_id: string; index: number; name: string; page_count: number }[] }>(`/library/${albumId}`),
  getLibraryChapter: (albumId: string, chapterId: string) =>
    request<{ album_id: string; chapter_id: string; pages: { index: number; filename: string; url: string }[] }>(`/library/${albumId}/chapters/${chapterId}`),
  getLibraryExportUrl: (albumId: string, inline = false) =>
    withPanelToken(`/api/v2/library/${encodeURIComponent(albumId)}/export${inline ? '?inline=true' : ''}`),
  deleteLibraryItem: (albumId: string, removeFiles = false) =>
    request(`/library/${albumId}?remove_files=${removeFiles}`, { method: 'DELETE' }),

  listHistory: () => request<HistoryItem[]>('/sync/history'),
  saveHistory: (item: Omit<HistoryItem, 'updated_at'> & { updated_at?: number }) =>
    request<HistoryItem>('/sync/history', { method: 'PUT', body: JSON.stringify(item) }),
  deleteHistory: (albumId: string) => request(`/sync/history/${albumId}`, { method: 'DELETE' }),
  clearHistory: () => request('/sync/history', { method: 'DELETE' }),

  listBookmarks: (albumId?: string) =>
    request<BookmarkItem[]>(albumId ? `/sync/bookmarks?album_id=${encodeURIComponent(albumId)}` : '/sync/bookmarks'),
  saveBookmark: (item: Omit<BookmarkItem, 'bookmark_id' | 'created_at' | 'updated_at'> & { bookmark_id?: string }) =>
    request<BookmarkItem>('/sync/bookmarks', { method: 'PUT', body: JSON.stringify(item) }),
  deleteBookmark: (bookmarkId: string) =>
    request(`/sync/bookmarks/${encodeURIComponent(bookmarkId)}`, { method: 'DELETE' }),

  listShelves: () => request<LocalShelf[]>('/sync/shelves'),
  saveShelf: (payload: { shelf_id?: string; name: string; description?: string }) =>
    request<LocalShelf>('/sync/shelves', { method: 'POST', body: JSON.stringify(payload) }),
  deleteShelf: (shelfId: string) => request(`/sync/shelves/${encodeURIComponent(shelfId)}`, { method: 'DELETE' }),
  listAlbumShelves: (albumId: string) => request<string[]>(`/sync/shelves/by-album/${encodeURIComponent(albumId)}`),
  listShelfItems: (shelfId: string) => request<LocalShelfItem[]>(`/sync/shelves/${encodeURIComponent(shelfId)}/items`),
  addShelfItem: (shelfId: string, item: { album_id: string; title?: string; author?: string; cover_url?: string; tags?: string[] }) =>
    request<LocalShelfItem>(`/sync/shelves/${encodeURIComponent(shelfId)}/items`, { method: 'POST', body: JSON.stringify(item) }),
  removeShelfItem: (shelfId: string, albumId: string) =>
    request(`/sync/shelves/${encodeURIComponent(shelfId)}/items/${encodeURIComponent(albumId)}`, { method: 'DELETE' }),
};
