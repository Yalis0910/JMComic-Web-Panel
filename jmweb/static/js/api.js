const API = {
  baseURL: '/api/v1',

  async request(url, options = {}) {
    try {
      const resp = await fetch(`${this.baseURL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await resp.json();
      if (data.code !== 0) throw new Error(data.message || '请求失败');
      return data.data;
    } catch (err) {
      throw err;
    }
  },

  getAlbum(id) { return this.request(`/album/${id}`); },
  getPhoto(id) { return this.request(`/photo/${id}`); },

  search(q, page = 1, orderBy = 'mr', time = 'a', category = '0') {
    return this.request(`/search?q=${encodeURIComponent(q)}&page=${page}&order_by=${orderBy}&time=${time}&category=${category}`);
  },
  searchByAuthor(q, page = 1, orderBy = 'mr', time = 'a', category = '0') {
    return this.request(`/search/author?q=${encodeURIComponent(q)}&page=${page}&order_by=${orderBy}&time=${time}&category=${category}`);
  },
  searchByTag(q, page = 1, orderBy = 'mr', time = 'a', category = '0') {
    return this.request(`/search/tag?q=${encodeURIComponent(q)}&page=${page}&order_by=${orderBy}&time=${time}&category=${category}`);
  },

  getRanking(type, page = 1, category = 'ALL') {
    return this.request(`/ranking/${type}?page=${page}&category=${category}`);
  },

  getCategory(page = 1, time = 'ALL', orderBy = 'view', category = 'ALL') {
    return this.request(`/category?page=${page}&time=${time}&order_by=${orderBy}&category=${category}`);
  },

  startDownloadPhoto(photoId, albumId, optionPath = null, downloadType = 'folder') {
    return this.request('/download/photo', {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId, album_id: albumId, option_path: optionPath, download_type: downloadType }),
    });
  },
  startDownload(albumId, optionPath = null, downloadType = 'folder') {
    return this.request('/download/album', {
      method: 'POST',
      body: JSON.stringify({ album_id: albumId, option_path: optionPath, download_type: downloadType }),
    });
  },
  getDownloadStatus(taskId) { return this.request(`/download/status/${taskId}`); },
  cancelDownload(taskId) {
    return this.request(`/download/cancel/${taskId}`, { method: 'POST' });
  },
  getDownloadTasks() { return this.request('/download/tasks'); },
  clearDownloadHistory() {
    return this.request('/download/clear-history', { method: 'POST' });
  },

  getConfig() { return this.request('/config'); },
  updateConfig(data) {
    return this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  login(username, password, impl = 'html') {
    return this.request('/user/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, impl }),
    });
  },
  logout() {
    return this.request('/user/logout', { method: 'POST' });
  },
  getLoginStatus() { return this.request('/user/status'); },
  getFavorites(page = 1, folderId = '0', orderBy = 'mr') {
    return this.request(`/user/favorites?page=${page}&folder_id=${folderId}&order_by=${orderBy}`);
  },
  exportFavorites() {
    return fetch(`${this.baseURL}/user/favorites/export`).then(resp => {
      if (!resp.ok) return resp.json().then(d => { throw new Error(d.detail || '导出失败'); });
      return resp.blob();
    });
  },

  addFavorite(albumId, folderId = '0') {
    return this.request(`/user/favorites/${albumId}`, {
      method: 'POST',
      body: JSON.stringify({ folder_id: folderId }),
    });
  },

  removeFavorite(albumId) {
    return this.request(`/user/favorites/${albumId}`, { method: 'DELETE' });
  },

  checkFavorite(albumId) {
    return this.request(`/user/favorites/check/${albumId}`);
  },

  getFolders() {
    return this.request('/user/folders');
  },
};