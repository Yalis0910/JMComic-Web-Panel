const API = {
  baseURL: '/api/v1',

  _syncing401: false,

  _handleUnauthorized(detail) {
    if (this._syncing401) return;
    this._syncing401 = true;
    fetch(`${this.baseURL}/user/status`)
      .then(r => r.json())
      .then(d => {
        const s = d && d.data;
        const loggedIn = !!(s && s.is_logged_in);
        if (typeof state !== 'undefined' && state.isLoggedIn !== loggedIn) {
          state.isLoggedIn = loggedIn;
          state.username = (s && s.username) || '';
          if (typeof updateLoginStatus === 'function') updateLoginStatus();
        }
        if (!loggedIn) {
          if (typeof showToast === 'function') showToast('登录已过期，请重新登录', true);
          if (typeof showLoginModal === 'function') showLoginModal();
        }
      })
      .catch(() => {})
      .finally(() => { this._syncing401 = false; });
  },

  async request(url, options = {}) {
    try {
      const resp = await fetch(`${this.baseURL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      let data = null;
      try { data = await resp.json(); } catch (e) { data = null; }
      if (resp.status === 401) {
        this._handleUnauthorized(data && data.detail);
        throw new Error((data && data.detail) || '登录已过期，请重新登录');
      }
      if (!data) throw new Error('请求失败');
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
  removeDownloadTask(taskId) {
    return this.request(`/download/task/${taskId}`, { method: 'DELETE' });
  },
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

  getWebConfig() { return this.request('/config/web'); },
  updateWebConfig(data) {
    return this.request('/config/web', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  clearImageCache() {
    return this.request('/config/web/clear', { method: 'POST' });
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