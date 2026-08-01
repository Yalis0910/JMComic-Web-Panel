let state = { isLoggedIn: false, username: '', searchQuery: '', rankingType: 'day' };
let prevTaskStates = {};
let selectedAlbums = new Set();
let currentFavAlbums = [];
window.dlStats = {};
window._dlSnapshot = {};

/* ===================== 路由导航 ===================== */

function goPage(pageName, pageNum) {
  if (pageName === 'ranking') {
    Router.navigate('ranking', {
      type: state.rankingType,
      page: pageNum,
      category: sel('rankCategory') || 'ALL',
    });
  } else if (pageName === 'category') {
    Router.navigate('category', {
      page: pageNum,
      category: sel('categorySelect'),
      order_by: sel('categoryOrderBy'),
      time: sel('categoryTime'),
    });
  } else if (pageName === 'search') {
    Router.navigate('search', {
      q: state.searchQuery,
      type: sel('searchType'),
      order_by: sel('searchOrderBy'),
      time: sel('searchTime'),
      page: pageNum,
    });
  } else if (pageName === 'favorites') {
    Router.navigate('favorites', {
      page: pageNum,
      folder_id: sel('favFolderSelect') || '0',
      sort: sel('favSortSelect') || 'mr',
    });
  }
}

function sel(id) {
  return document.getElementById(id)?.value || '';
}

function bindNavigation() {
  document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
    item.addEventListener('click', () => {
      Router.navigate(item.dataset.page);
    });
  });
  document.querySelectorAll('.quick-card[data-nav]').forEach(card => {
    card.addEventListener('click', () => {
      Router.navigate(card.dataset.nav);
    });
  });
  document.querySelectorAll('.rank-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Router.navigate('ranking', {
        type: tab.dataset.type,
        page: 1,
        category: sel('rankCategory') || 'ALL',
      });
    });
  });
  document.getElementById('searchBtn').addEventListener('click', doHeaderSearch);
  document.getElementById('searchInput').addEventListener('input', () => {
    if (document.activeElement === document.getElementById('searchInput')) renderSearchSuggest();
  });
  document.getElementById('searchInput').addEventListener('focus', renderSearchSuggest);
  document.getElementById('searchInput').addEventListener('keydown', e => {
    const box = document.getElementById('searchSuggest');
    const items = box.querySelectorAll('.suggest-item');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      suggestActive = (suggestActive + dir + items.length) % items.length;
      box.classList.add('visible');
      items.forEach((it, i) => it.classList.toggle('active', i === suggestActive));
      items[suggestActive].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (suggestActive >= 0 && items[suggestActive]) {
        e.preventDefault();
        document.getElementById('searchInput').value = items[suggestActive].dataset.q;
        suggestActive = -1;
        doHeaderSearch();
      } else {
        doHeaderSearch();
      }
    } else if (e.key === 'Escape') {
      hideSearchSuggest();
      suggestActive = -1;
    } else {
      suggestActive = -1;
    }
  });
}

function doHeaderSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  RecentSearches.add(query);
  hideSearchSuggest();
  const inSearch = Router.parse().page === 'search';
  Router.navigate('search', {
    q: query,
    type: inSearch ? sel('searchType') : 'all',
    order_by: inSearch ? sel('searchOrderBy') : 'mr',
    time: inSearch ? sel('searchTime') : 'a',
    page: 1,
  });
}

document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (['categorySelect', 'categoryOrderBy', 'categoryTime'].includes(id)) {
    goPage('category', 1);
  } else if (id === 'rankCategory') {
    goPage('ranking', 1);
  } else if (['searchType', 'searchOrderBy', 'searchTime'].includes(id) && state.searchQuery) {
    goPage('search', 1);
  } else if (id === 'favFolderSelect' || id === 'favSortSelect') {
    goPage('favorites', 1);
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

/* ===================== 搜索 ===================== */

function doSearch(query, page) {
  state.searchQuery = query;
  const type = sel('searchType') || 'all';
  const orderBy = sel('searchOrderBy') || 'mr';
  const time = sel('searchTime') || 'a';

  const typeLabel = { all: '', author: '作者·', tag: '标签·' }[type] || '';
  const titleEl = document.querySelector('#page-search .page-title');
  if (titleEl) titleEl.textContent = `搜索结果 · ${typeLabel}${query}`;

  const routeKey = Router.currentKey();
  const cached = Router.getCache(routeKey);
  if (cached) {
    Components.renderAlbumGrid(cached.albums, 'searchGrid');
    Components.renderPagination(cached.total, cached.page_count, page, 'searchPagination', 'search');
    Router.afterRender();
    return;
  }

  document.getElementById('searchGrid').innerHTML = Components.gridSpinner();

  let promise;
  if (type === 'author') promise = API.searchByAuthor(query, page, orderBy, time);
  else if (type === 'tag') promise = API.searchByTag(query, page, orderBy, time);
  else promise = API.search(query, page, orderBy, time);

  promise.then(data => {
    Router.setCache(routeKey, data);
    Components.renderAlbumGrid(data.albums, 'searchGrid');
    Components.renderPagination(data.total, data.page_count, page, 'searchPagination', 'search');
  }).catch(err => {
    document.getElementById('searchGrid').innerHTML = `<p class="error-state">搜索失败：${escapeHtml(err.message)}</p>`;
  }).finally(() => Router.afterRender());
}

function searchByAuthor(name) {
  Router.navigate('search', {
    q: name, type: 'author', order_by: sel('searchOrderBy') || 'mr', time: sel('searchTime') || 'a', page: 1,
  });
}

function searchByTag(tag) {
  Router.navigate('search', {
    q: tag, type: 'tag', order_by: sel('searchOrderBy') || 'mr', time: sel('searchTime') || 'a', page: 1,
  });
}

/* ===================== 排行榜 / 分类 ===================== */

function loadRanking(type, page = 1) {
  state.rankingType = type;
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.rank-tab[data-type="${type}"]`)?.classList.add('active');

  const category = sel('rankCategory') || 'ALL';
  const routeKey = Router.currentKey();
  const cached = Router.getCache(routeKey);
  if (cached) {
    Components.renderAlbumGrid(cached.albums, 'rankingGrid');
    Components.renderPagination(cached.total, cached.page_count, page, 'rankingPagination', 'ranking');
    Router.afterRender();
    return;
  }

  document.getElementById('rankingGrid').innerHTML = Components.gridSpinner();

  API.getRanking(type, page, category).then(data => {
    Router.setCache(routeKey, data);
    Components.renderAlbumGrid(data.albums, 'rankingGrid');
    Components.renderPagination(data.total, data.page_count, page, 'rankingPagination', 'ranking');
  }).catch(err => {
    document.getElementById('rankingGrid').innerHTML = `<p class="error-state">加载失败：${escapeHtml(err.message)}</p>`;
  }).finally(() => Router.afterRender());
}

function loadCategory(page = 1) {
  const category = sel('categorySelect') || 'ALL';
  const orderBy = sel('categoryOrderBy') || 'view';
  const time = sel('categoryTime') || 'ALL';

  const routeKey = Router.currentKey();
  const cached = Router.getCache(routeKey);
  if (cached) {
    Components.renderAlbumGrid(cached.albums, 'categoryGrid');
    Components.renderPagination(cached.total, cached.page_count, page, 'categoryPagination', 'category');
    Router.afterRender();
    return;
  }

  document.getElementById('categoryGrid').innerHTML = Components.gridSpinner();

  API.getCategory(page, time, orderBy, category).then(data => {
    Router.setCache(routeKey, data);
    Components.renderAlbumGrid(data.albums, 'categoryGrid');
    Components.renderPagination(data.total, data.page_count, page, 'categoryPagination', 'category');
  }).catch(err => {
    document.getElementById('categoryGrid').innerHTML = `<p class="error-state">加载失败：${escapeHtml(err.message)}</p>`;
  }).finally(() => Router.afterRender());
}

/* ===================== 详情页 ===================== */

function showAlbumDetail(albumId) {
  Router.navigate('album', { id: albumId });
}

function showAlbumDetailById(albumId) {
  _currentAlbumId = albumId;
  const routeKey = Router.currentKey();
  const cached = Router.getCache(routeKey);
  if (cached) {
    Components.renderAlbumDetail(cached);
    Router.afterRender();
    return;
  }
  document.getElementById('albumDetail').innerHTML = '<p class="empty-state">加载中...</p>';
  API.getAlbum(albumId).then(data => {
    Router.setCache(routeKey, data);
    Components.renderAlbumDetail(data);
  }).catch(err => {
    document.getElementById('albumDetail').innerHTML = `<p class="error-state">加载失败：${escapeHtml(err.message)}</p>`;
  }).finally(() => Router.afterRender());
}

let _currentAlbumId = null;

function refreshAlbumDetail() {
  if (!_currentAlbumId) return;
  API.getAlbum(_currentAlbumId).then(data => {
    const key = `album?id=${_currentAlbumId}`;
    Router.cache.set(key, { data, ts: Date.now() });
    Components.renderAlbumDetail(data);
  }).catch(() => {});
}

/* ===================== 阅读器 ===================== */

function openReader(photoId, albumId, title, startIndex = 0, episodes = null) {
  if (!mangaReader) {
    mangaReader = new MangaReader();
  }
  mangaReader.loadImages(photoId, albumId, title, startIndex, episodes);
}

function openEpisode(photoId, albumId, title, index = 0) {
  let episodes = null;
  const cached = Router.getCache(`album?id=${albumId}`);
  if (cached && cached.episodes) {
    episodes = cached.episodes;
  } else {
    API.getAlbum(albumId).then(data => {
      Router.setCache(`album?id=${albumId}`, data);
      openReader(photoId, albumId, title, 0, data.episodes || null);
    }).catch(() => openReader(photoId, albumId, title, 0, null));
    return;
  }
  openReader(photoId, albumId, title, index, episodes);
}

function continueReading(albumId) {
  const item = ReadingHistory.get().find(i => i.albumId === albumId);
  if (!item) return;
  const cached = Router.getCache(`album?id=${albumId}`);
  if (cached && cached.episodes) {
    openReader(item.photoId, item.albumId, item.title, item.pageIndex || 0, cached.episodes);
    return;
  }
  API.getAlbum(albumId).then(data => {
    Router.setCache(`album?id=${albumId}`, data);
    openReader(item.photoId, item.albumId, item.title, item.pageIndex || 0, data.episodes || null);
  }).catch(() => openReader(item.photoId, item.albumId, item.title, item.pageIndex || 0, null));
}

/* ===================== 下载 ===================== */

function downloadAlbum(albumId) {
  API.startDownload(albumId, null, 'folder').then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function downloadAlbumWithFormat(albumId) {
  const fmt = sel('downloadFormatSelect') || 'folder';
  API.startDownload(albumId, null, fmt).then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function downloadPhoto(photoId, albumId) {
  const fmt = sel('downloadFormatSelect') || 'folder';
  API.startDownloadPhoto(photoId, albumId, null, fmt).then(data => {
    showToast(`章节任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function cancelDownload(taskId) {
  API.cancelDownload(taskId).then(() => loadDownloadTasks());
}

function retryDownload(taskId) {
  const task = (window._lastTasks || []).find(t => t.task_id === taskId);
  if (!task) return;
  const done = t => {
    showToast(`任务已重新创建 #${t.task_id}`);
    loadDownloadTasks();
  };
  const fail = err => showToast(`创建失败：${err.message}`, true);
  if (task.photo_id) API.startDownloadPhoto(task.photo_id, task.album_id, null, task.download_type).then(done).catch(fail);
  else API.startDownload(task.album_id, null, task.download_type).then(done).catch(fail);
}

function removeDownloadTask(taskId) {
  showConfirm({ title: '删除任务记录', message: '确定删除该任务记录？', confirmText: '删除', danger: true }, () => {
    API.removeDownloadTask(taskId).then(() => {
      showToast('任务已删除');
      loadDownloadTasks();
    }).catch(err => showToast('删除失败：' + err.message, true));
  });
}

document.getElementById('startDownloadBtn')?.addEventListener('click', () => {
  const albumId = document.getElementById('downloadAlbumId').value.trim();
  if (!albumId) { showToast('请输入漫画 ID', true); return; }
  const fmt = sel('downloadFormatSelectGlobal') || 'folder';
  API.startDownload(albumId, null, fmt).then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
});

document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
  showConfirm({ title: '清除下载历史', message: '确定清除所有下载历史？', confirmText: '清除', danger: true }, () => {
    API.clearDownloadHistory().then(() => {
      showToast('下载历史已清除');
      loadDownloadTasks();
    }).catch(err => showToast('清除失败：' + err.message, true));
  });
});

function _formatEta(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}秒`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}分${Math.ceil(seconds % 60)}秒`;
  return `${Math.floor(m / 60)}时${m % 60}分`;
}

function updateDlStats(tasks) {
  const now = Date.now();
  const prev = window._dlSnapshot;
  tasks.forEach(t => {
    const last = prev[t.task_id];
    if (t.status === 'running' && last && last.completed !== undefined) {
      const dt = (now - last.ts) / 1000;
      if (dt >= 2 && t.completed_count >= last.completed) {
        const speed = (t.completed_count - last.completed) / dt;
        if (speed > 0) {
          const remaining = Math.max(0, (t.total_count - t.completed_count) / speed);
          window.dlStats[t.task_id] = {
            speed: `${speed.toFixed(1)} 张/秒`,
            eta: _formatEta(remaining),
          };
        }
      }
    } else if (t.status !== 'running') {
      delete window.dlStats[t.task_id];
    }
    prev[t.task_id] = { completed: t.completed_count, ts: now };
  });
}

function pollDownloadTasks() {
  API.getDownloadTasks().then(tasks => {
    window._lastTasks = tasks;
    updateDlStats(tasks);
    tasks.forEach(t => {
      const prev = prevTaskStates[t.task_id];
      if (prev && prev !== 'completed' && t.status === 'completed') {
        const fmtLabel = { folder: '', zip: '（ZIP）', pdf: '（PDF）', long_img: '（长图）' };
        showToast(`JM${t.album_id} 下载完成${fmtLabel[t.download_type] || ''}`);
      }
      prevTaskStates[t.task_id] = t.status;
    });
    updateFloatBar(tasks);
    if (Router.parse().page === 'downloads') Components.renderDownloadTasks(tasks);
  }).catch(() => {});
}

function loadDownloadTasks() {
  pollDownloadTasks();
  Router.afterRender();
}

function updateFloatBar(tasks) {
  const running = tasks.filter(t => t.status === 'running');
  const bar = document.getElementById('dlFloatBar');
  if (!bar) return;
  if (running.length === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('dlFloatSummary').textContent = `下载中 (${running.length})`;
  document.getElementById('dlFloatList').innerHTML = running.map(t => `
    <div class="dl-item">
      <span class="dl-id">JM${t.album_id}</span>
      <div class="dl-progress"><div class="dl-progress-fill" style="width:${t.progress}%;background:var(--accent);"></div></div>
      <span class="dl-status" style="color:var(--text-2);">${t.progress}%</span>
    </div>
  `).join('');
}

setInterval(pollDownloadTasks, 3000);

document.getElementById('dlFloatHeader')?.addEventListener('click', () => {
  const body = document.getElementById('dlFloatBody');
  const toggle = document.getElementById('dlFloatToggle');
  body.classList.toggle('hidden');
  toggle.classList.toggle('open');
});

/* ===================== 收藏 ===================== */

function toggleSelect(albumId) {
  if (selectedAlbums.has(albumId)) selectedAlbums.delete(albumId);
  else selectedAlbums.add(albumId);
  updateBatchBar();
  Components.renderAlbumGrid(currentFavAlbums, 'favoriteGrid', {
    selectable: true, selected: selectedAlbums,
  });
}

function selectAll() {
  currentFavAlbums.forEach(a => selectedAlbums.add(a.album_id));
  updateBatchBar();
  Components.renderAlbumGrid(currentFavAlbums, 'favoriteGrid', {
    selectable: true, selected: selectedAlbums,
  });
}

function deselectAll() {
  selectedAlbums.clear();
  updateBatchBar();
  Components.renderAlbumGrid(currentFavAlbums, 'favoriteGrid', {
    selectable: true, selected: selectedAlbums,
  });
}

function updateBatchBar() {
  const count = selectedAlbums.size;
  document.getElementById('selectedCount').textContent = count;
  document.getElementById('batchActions').style.display = count > 0 ? 'flex' : 'none';
}

function batchDownload(format) {
  if (selectedAlbums.size === 0) return;
  const ids = [...selectedAlbums];
  showToast(`正在创建 ${ids.length} 个下载任务...`);
  let success = 0;
  Promise.all(ids.map(aid =>
    API.startDownload(aid, null, format).then(() => { success++; }).catch(() => {})
  )).then(() => {
    showToast(`已完成 ${success}/${ids.length} 个任务创建`);
    selectedAlbums.clear();
    updateBatchBar();
    Components.renderAlbumGrid(currentFavAlbums, 'favoriteGrid', {
      selectable: true, selected: selectedAlbums,
    });
    loadDownloadTasks();
  });
}

function batchAddFav() {
  if (selectedAlbums.size === 0) return;
  const folderId = sel('batchFavFolder') || '0';
  const ids = [...selectedAlbums];
  showToast(`正在添加到文件夹...`);
  let success = 0;
  Promise.all(ids.map(aid =>
    API.addFavorite(aid, folderId).then(() => { success++; }).catch(() => {})
  )).then(() => {
    showToast(`已完成 ${success}/${ids.length} 本添加到文件夹`);
    selectedAlbums.clear();
    updateBatchBar();
    loadFavorites(Router.parse().params.get('page') || 1);
  });
}

function populateBatchFavFolder(folders) {
  const select = document.getElementById('batchFavFolder');
  const btn = document.getElementById('batchFavBtn');
  if (!select || !btn) return;
  if (!folders || folders.length === 0) {
    select.style.display = 'none';
    btn.style.display = 'none';
    return;
  }
  select.innerHTML = folders.map(f =>
    `<option value="${f.folder_id}">${f.name}</option>`
  ).join('');
  select.style.display = '';
  btn.style.display = '';
}

function loadFavorites(page) {
  const statusEl = document.getElementById('favoritesStatus');

  if (!state.isLoggedIn) {
    statusEl.innerHTML = `
      <div class="fav-prompt">
        <span class="fav-prompt-text">请先登录后查看收藏</span>
        <span class="fav-prompt-btn" onclick="showLoginModal()">去登录 →</span>
      </div>`;
    document.getElementById('favFolderBar').style.display = 'none';
    document.getElementById('favoriteGrid').innerHTML = '';
    document.getElementById('favoritePagination').innerHTML = '';
    populateBatchFavFolder([]);
    Router.afterRender();
    return;
  }

  const folderId = sel('favFolderSelect') || '0';
  const sort = sel('favSortSelect') || 'mr';

  statusEl.innerHTML = '';
  selectedAlbums.clear();
  document.getElementById('favoriteGrid').innerHTML = Components.gridSpinner();

  API.getFavorites(page, folderId, sort).then(data => {
    currentFavAlbums = data.albums;
    Components.renderAlbumGrid(data.albums, 'favoriteGrid', {
      selectable: true, selected: selectedAlbums,
    });
    Components.renderPagination(data.total, data.page_count, page, 'favoritePagination', 'favorites');
    updateBatchBar();

    const folderBar = document.getElementById('favFolderBar');
    const folderSelect = document.getElementById('favFolderSelect');
    const sortSelect = document.getElementById('favSortSelect');
    const currentVal = folderSelect.value;
    folderSelect.innerHTML = '<option value="0">全部文件夹</option>';
    if (data.folders && data.folders.length > 0) {
      data.folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.folder_id;
        opt.textContent = f.name;
        folderSelect.appendChild(opt);
      });
      const urlFolder = Router.parse().params.get('folder_id');
      const preferred = (urlFolder && [...folderSelect.options].some(o => o.value === urlFolder)) ? urlFolder : currentVal;
      folderSelect.value = preferred;
      if (preferred && preferred !== '0' && urlFolder !== preferred) {
        const p = Router.parse();
        Router.navigate('favorites', {
          page: p.params.get('page') || 1,
          folder_id: preferred,
          sort: p.params.get('sort') || sel('favSortSelect') || 'mr',
        }, { replace: true });
      }
      folderBar.style.display = '';
    } else {
      folderBar.style.display = 'none';
    }
    sortSelect.value = sort;
    populateBatchFavFolder(data.folders || []);
  }).catch(err => {
    document.getElementById('favoriteGrid').innerHTML = `<p class="error-state">加载失败：${escapeHtml(err.message)}</p>`;
  }).finally(() => Router.afterRender());
}

function updateFavButtons(isFav) {
  const favGroup = document.getElementById('favGroup');
  const removeBtn = document.getElementById('favRemoveBtn');
  if (favGroup) favGroup.style.display = isFav ? 'none' : 'inline-flex';
  if (removeBtn) removeBtn.style.display = isFav ? '' : 'none';
}

function toggleFav(albumId, isFavorited) {
  if (!state.isLoggedIn) {
    showLoginModal();
    return;
  }

  if (isFavorited) {
    showConfirm({ title: '取消收藏', message: '确定取消收藏？', confirmText: '取消收藏', danger: true }, () => {
      API.removeFavorite(albumId)
        .then(() => { updateFavButtons(false); showToast('已取消收藏'); })
        .catch(e => { showToast('取消失败：' + e.message, true); refreshAlbumDetail(); });
    });
  } else {
    const folderSel = document.getElementById('detailFavFolderSelect');
    const folderId = folderSel ? folderSel.value : '0';
    API.addFavorite(albumId, folderId)
      .then(() => { updateFavButtons(true); showToast('已添加到收藏'); })
      .catch(e => { showToast('收藏失败：' + e.message, true); refreshAlbumDetail(); });
  }
}

document.getElementById('exportFavBtn')?.addEventListener('click', () => {
  if (!state.isLoggedIn) { showToast('请先登录', true); return; }
  API.exportFavorites().then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jm_favorites.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  }).catch(err => showToast('导出失败：' + err.message, true));
});

/* ===================== Toast ===================== */

function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-msg' + (isError ? ' error' : '');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ===================== 确认弹窗 ===================== */

let _confirmCallback = null;

function showConfirm({ title = '确认操作', message = '', confirmText = '确认', danger = false }, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.textContent = confirmText;
  okBtn.classList.toggle('btn-danger', !!danger);
  _confirmCallback = onConfirm;
  document.getElementById('confirmModal').style.display = 'flex';
  document.getElementById('confirmCancelBtn').focus();
}

function hideConfirm() {
  document.getElementById('confirmModal').style.display = 'none';
  _confirmCallback = null;
}

document.getElementById('confirmOkBtn')?.addEventListener('click', () => {
  const cb = _confirmCallback;
  hideConfirm();
  if (cb) cb();
});

document.getElementById('confirmModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) hideConfirm();
});

/* ===================== 主题 ===================== */

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  if (!icon) return;
  icon.innerHTML = isDark
    ? '<path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>'
    : '<path d="M12 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM12 17.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V18a.75.75 0 01.75-.75zM20.25 12a.75.75 0 01-.75.75H18a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM6 12a.75.75 0 01-.75.75H3.75a.75.75 0 010-1.5h1.5A.75.75 0 016 12zM17.303 6.697a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM8.818 15.182a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM6.697 6.697a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06a.75.75 0 010-1.06zM15.182 15.182a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"/>';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.add('theme-anim');
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  updateThemeIcon(dark);
  if (mangaReader) mangaReader.theme = dark ? 'dark' : 'light';
  setTimeout(() => root.classList.remove('theme-anim'), 400);
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ui_theme', next);
  applyTheme(next);
});

document.getElementById('settingTheme')?.addEventListener('change', function () {
  localStorage.setItem('ui_theme', this.value);
  applyTheme(this.value);
});

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const saved = localStorage.getItem('ui_theme') || 'system';
    if (saved === 'system') applyTheme('system');
  });
}

/* ===================== 搜索建议 ===================== */

let suggestActive = -1;

function renderSearchSuggest() {
  const box = document.getElementById('searchSuggest');
  const input = document.getElementById('searchInput');
  const q = (input.value || '').trim().toLowerCase();
  const items = RecentSearches.get().filter(s => !q || s.toLowerCase().includes(q));
  if (!items.length) {
    hideSearchSuggest();
    return;
  }
  suggestActive = -1;
  box.innerHTML = `
    <div class="suggest-head"><span>最近搜索</span><span data-clear="1">清空</span></div>
    ${items.map(s => `
      <div class="suggest-item" data-q="${escapeHtml(s)}">
        <span>${escapeHtml(s)}</span>
        <span class="suggest-del" data-del="${escapeHtml(s)}">×</span>
      </div>`).join('')}
  `;
  box.classList.add('visible');
  box.querySelectorAll('.suggest-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const del = e.target.dataset.del;
      if (del) {
        RecentSearches.remove(del);
        renderSearchSuggest();
        return;
      }
      suggestActive = -1;
      document.getElementById('searchInput').value = item.dataset.q;
      doHeaderSearch();
    });
  });
  box.querySelector('[data-clear]').addEventListener('click', () => {
    RecentSearches.clear();
    hideSearchSuggest();
  });
}

function hideSearchSuggest() {
  document.getElementById('searchSuggest').classList.remove('visible');
}

document.addEventListener('click', (e) => {
  const strip = document.querySelector('.search-strip');
  if (strip && !strip.contains(e.target)) hideSearchSuggest();
});

/* ===================== 仪表盘 ===================== */

const DEFAULT_TAGS = ['同人', '單行本', '全彩', '無修正', '中文', '短篇', '韓漫'];

function getTags() {
  try {
    return JSON.parse(localStorage.getItem('dashboard_tags')) || DEFAULT_TAGS;
  } catch { return DEFAULT_TAGS; }
}

function saveTags(tags) {
  localStorage.setItem('dashboard_tags', JSON.stringify(tags));
  renderTagManager();
}

function renderTagManager() {
  const container = document.getElementById('tagManagerList');
  if (!container) return;
  const tags = getTags();
  if (tags.length === 0) {
    container.innerHTML = '<span class="tag-manager-empty">暂无标签</span>';
    return;
  }
  container.innerHTML = tags.map(t =>
    `<span class="tag-manager-item">${escapeHtml(t)}<span class="tag-del" data-tag="${escapeHtml(t)}">×</span></span>`
  ).join('');
  container.querySelectorAll('.tag-del').forEach(el => {
    el.addEventListener('click', function () {
      const tag = this.dataset.tag;
      const current = getTags();
      saveTags(current.filter(t => t !== tag));
    });
  });
}

document.getElementById('tagManagerAddBtn')?.addEventListener('click', function () {
  const input = document.getElementById('tagManagerInput');
  const tag = input.value.trim();
  if (!tag) return;
  const current = getTags();
  if (current.includes(tag)) return;
  current.push(tag);
  saveTags(current);
  input.value = '';
});

function loadDashboard() {
  const tags = getTags();
  if (tags.length === 0) {
    document.getElementById('quickTags').innerHTML = '<span class="tag-manager-empty">暂无标签，请在设置中添加</span>';
  } else {
    document.getElementById('quickTags').innerHTML = tags.map(t =>
      `<span class="tag-item" onclick="document.getElementById('searchInput').value='${escapeHtml(t)}';document.getElementById('searchBtn').click();">${escapeHtml(t)}</span>`
    ).join('');
  }

  const history = ReadingHistory.get().slice(0, 12);
  const block = document.getElementById('continueReadingBlock');
  if (history.length > 0) {
    block.style.display = '';
    Components.renderHistoryGrid(history, 'continueReadingGrid');
  } else {
    block.style.display = 'none';
  }
  Router.afterRender();
}

/* ===================== 历史页 ===================== */

function loadHistoryPage() {
  Components.renderFullHistory(ReadingHistory.get(), 'historyGrid');
  const searches = RecentSearches.get();
  const seBox = document.getElementById('recentSearches');
  if (searches.length === 0) {
    seBox.innerHTML = '<p class="empty-state" style="font-size:12px;">暂无搜索记录</p>';
  } else {
    seBox.innerHTML = searches.map(q => `
      <span class="tag-item search-chip" onclick="useRecentSearch('${escapeHtml(q)}')">
        ${escapeHtml(q)}<span class="chip-del" onclick="event.stopPropagation();removeRecentSearch('${escapeHtml(q)}')">×</span>
      </span>`).join('');
  }
  Router.afterRender();
}

function removeHistoryItem(albumId) {
  ReadingHistory.remove(albumId);
  loadHistoryPage();
}

function removeRecentSearch(q) {
  RecentSearches.remove(q);
  loadHistoryPage();
}

function useRecentSearch(q) {
  document.getElementById('searchInput').value = q;
  doHeaderSearch();
}

document.getElementById('clearReadHistoryBtn')?.addEventListener('click', () => {
  const count = ReadingHistory.get().length;
  if (!count) { showToast('暂无阅读记录'); return; }
  showConfirm({ title: '清空阅读历史', message: `确定清空全部 ${count} 条阅读记录？此操作不可恢复。`, confirmText: '清空', danger: true }, () => {
    ReadingHistory.clear();
    loadHistoryPage();
    showToast('阅读历史已清空');
  });
});

document.getElementById('clearSearchesBtn')?.addEventListener('click', () => {
  const count = RecentSearches.get().length;
  if (!count) { showToast('暂无搜索记录'); return; }
  showConfirm({ title: '清空搜索记录', message: `确定清空全部 ${count} 条搜索记录？此操作不可恢复。`, confirmText: '清空', danger: true }, () => {
    RecentSearches.clear();
    loadHistoryPage();
    showToast('搜索记录已清空');
  });
});

/* ===================== 卡片快捷操作 ===================== */

function quickRead(albumId) {
  API.getAlbum(albumId).then(data => {
    Router.setCache(`album?id=${albumId}`, data);
    const eps = data.episodes || [];
    if (eps.length) {
      openReader(eps[0].photo_id, albumId, data.title, 0, eps);
    } else {
      showAlbumDetail(albumId);
    }
  }).catch(err => showToast('加载失败：' + err.message, true));
}

function quickDownload(albumId) {
  API.startDownload(albumId, null, 'folder').then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function copyAlbumId(albumId) {
  const text = 'JM' + albumId;
  const done = () => showToast('ID 已复制：' + text);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    });
  } else {
    showToast('复制失败', true);
  }
}

/* ===================== 设置 ===================== */

function syncFormToConfig() {
  const configEditor = document.getElementById('configEditor');
  let config;
  try {
    config = JSON.parse(configEditor.value || '{}');
  } catch (e) {
    config = {};
  }

  config.client = config.client || {};
  config.client.impl = sel('settingClientImpl');

  config.dir_rule = config.dir_rule || {};
  config.dir_rule.base_dir = sel('settingBaseDir');
  config.dir_rule.rule = sel('settingDirRule');

  config.download = config.download || {};
  config.download.threading = config.download.threading || {};
  config.download.threading.image = parseInt(sel('settingImageThread')) || 3;

  configEditor.value = JSON.stringify(config, null, 2);
  return config;
}

function syncConfigToForm(config) {
  if (config.client?.impl) document.getElementById('settingClientImpl').value = config.client.impl;
  if (config.dir_rule?.base_dir) document.getElementById('settingBaseDir').value = config.dir_rule.base_dir;
  if (config.dir_rule?.rule) document.getElementById('settingDirRule').value = config.dir_rule.rule;
  if (config.download?.threading?.image) document.getElementById('settingImageThread').value = config.download.threading.image;
}

function loadConfig() {
  API.getConfig().then(config => {
    syncConfigToForm(config);
    document.getElementById('configEditor').value = JSON.stringify(config, null, 2);
  }).catch(() => {});
  renderTagManager();
  document.getElementById('settingTheme').value = localStorage.getItem('ui_theme') || 'system';
  document.getElementById('settingShowListCover').checked = localStorage.getItem('ui_show_list_cover') === 'true';
  document.getElementById('settingShowDetailCover').checked = localStorage.getItem('ui_show_detail_cover') === 'true';
  document.getElementById('settingPreloadMargin').value = localStorage.getItem('reader_rootMargin')?.replace('px', '') || '1500';
  document.getElementById('settingPreloadCount').value = localStorage.getItem('reader_preloadCount') || '8';
  document.getElementById('settingThumbStrip').checked = localStorage.getItem('reader_thumb_strip') === '1';
  loadCacheSettings();
  Router.afterRender();
}

function loadCacheSettings() {
  API.getWebConfig().then(data => {
    document.getElementById('settingCacheDir').value = data.image_cache_dir || '';
    document.getElementById('settingCacheMaxFiles').value = data.image_cache_max_files || 3000;
    document.getElementById('settingCacheMaxSize').value = data.image_cache_max_size_mb || 1024;
    document.getElementById('cacheStats').textContent =
      `${data.image_cache_file_count} 个文件 / ${data.image_cache_size_mb} MB`;
  }).catch(() => {
    document.getElementById('cacheStats').textContent = '获取失败';
  });
}

document.getElementById('saveCacheBtn')?.addEventListener('click', () => {
  const dir = document.getElementById('settingCacheDir').value.trim();
  const maxFiles = parseInt(document.getElementById('settingCacheMaxFiles').value) || 3000;
  const maxSizeMb = parseInt(document.getElementById('settingCacheMaxSize').value) || 1024;
  if (!dir) {
    showToast('缓存目录不能为空', true);
    return;
  }
  API.updateWebConfig({ image_cache_dir: dir, image_cache_max_files: maxFiles, image_cache_max_size_mb: maxSizeMb })
    .then(() => {
      showToast('缓存设置已保存');
      loadCacheSettings();
    })
    .catch(err => showToast('保存失败：' + err.message, true));
});

document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
  const stats = document.getElementById('cacheStats').textContent;
  showConfirm({ title: '清空图片缓存', message: `确定清空图片缓存？\n当前缓存：${stats}\n\n此操作不可恢复。`, confirmText: '清空', danger: true }, () => {
    API.clearImageCache()
      .then(() => {
        showToast('图片缓存已清空');
        loadCacheSettings();
      })
      .catch(err => showToast('清空失败：' + err.message, true));
  });
});

document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
  try {
    const config = syncFormToConfig();
    API.updateConfig(config).then(() => showToast('配置已保存')).catch(err => showToast('保存失败：' + err.message, true));
  } catch (e) {
    showToast('配置格式错误：' + e.message, true);
  }
});

['settingClientImpl', 'settingBaseDir', 'settingDirRule', 'settingImageThread'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', syncFormToConfig);
});

document.getElementById('settingShowListCover')?.addEventListener('change', function () {
  localStorage.setItem('ui_show_list_cover', this.checked);
});
document.getElementById('settingShowDetailCover')?.addEventListener('change', function () {
  localStorage.setItem('ui_show_detail_cover', this.checked);
});
document.getElementById('settingPreloadMargin')?.addEventListener('change', function () {
  localStorage.setItem('reader_rootMargin', this.value + 'px');
});
document.getElementById('settingPreloadCount')?.addEventListener('change', function () {
  localStorage.setItem('reader_preloadCount', this.value);
});
document.getElementById('settingThumbStrip')?.addEventListener('change', function () {
  localStorage.setItem('reader_thumb_strip', this.checked ? '1' : '0');
});

/* ===================== 登录 ===================== */

function showLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginImpl').value = localStorage.getItem('ui_login_impl') || 'html';
}

function hideLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

document.getElementById('loginConfirmBtn').addEventListener('click', () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const impl = document.getElementById('loginImpl').value;

  if (!username || !password) {
    document.getElementById('loginError').textContent = '请输入用户名和密码';
    return;
  }

  const btn = document.getElementById('loginConfirmBtn');
  btn.textContent = '登录中...';
  btn.disabled = true;

  API.login(username, password, impl).then(data => {
    state.isLoggedIn = true;
    state.username = data.username;
    localStorage.setItem('ui_login_impl', impl);
    updateLoginStatus();
    hideLoginModal();
    showToast('登录成功');
  }).catch(err => {
    document.getElementById('loginError').textContent = err.message || '登录失败';
  }).finally(() => {
    btn.textContent = '确认登录';
    btn.disabled = false;
  });
});

document.getElementById('loginStatus')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (state.isLoggedIn) showLogoutConfirm();
    else showLoginModal();
  }
});

document.getElementById('loginModal').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideLoginModal();
});

function updateLoginStatus() {
  const el = document.getElementById('loginStatus');
  if (state.isLoggedIn && state.username) {
    el.className = 'user-badge logged-in';
    el.querySelector('.badge-icon').textContent = '●';
    el.querySelector('.badge-text').textContent = state.username;
    el.onclick = showLogoutConfirm;
  } else {
    el.className = 'user-badge';
    el.querySelector('.badge-icon').textContent = '○';
    el.querySelector('.badge-text').textContent = '登录';
    el.onclick = showLoginModal;
  }
}

function showLogoutConfirm() {
  showConfirm({ title: '登出', message: `当前已登录: ${state.username}\n确定要登出吗？`, confirmText: '登出', danger: true }, () => {
    API.logout().then(() => {
      state.isLoggedIn = false;
      state.username = '';
      updateLoginStatus();
      showToast('已登出');
      if (Router.parse().page === 'favorites') loadFavorites(1);
    }).catch(() => {
      state.isLoggedIn = false;
      state.username = '';
      updateLoginStatus();
    });
  });
}

function checkLoginStatus() {
  API.getLoginStatus().then(data => {
    state.isLoggedIn = data.is_logged_in;
    state.username = data.username || '';
    updateLoginStatus();
  }).catch(() => {});
}

/* ===================== 启动 ===================== */

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  checkLoginStatus();
  applyTheme(localStorage.getItem('ui_theme') || 'system');
  Router.init();
});
