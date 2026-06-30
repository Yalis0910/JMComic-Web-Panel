let currentPage = 'dashboard';
let state = { isLoggedIn: false, username: '', searchPage: 1, rankingPage: 1, rankingType: 'day', favPage: 1, categoryPage: 1 };
let prevTaskStates = {};
let selectedAlbums = new Set();
let currentFavAlbums = [];
let pageStack = [];
let _currentAlbumId = null;

function navigateTo(page) {
  const readerScreen = document.getElementById('page-reader');
  const mainWrapper = document.querySelector('.wrapper');

  if (page === 'reader') {
    if (readerScreen) {
      readerScreen.classList.remove('hidden');
      readerScreen.classList.add('active');
    }
    if (mainWrapper) mainWrapper.style.display = 'none';
    currentPage = 'reader';
    return;
  }

  if (currentPage === 'reader' && readerScreen) {
    readerScreen.classList.add('hidden');
    readerScreen.classList.remove('active');
    if (mainWrapper) mainWrapper.style.display = '';
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  currentPage = page;
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
}

function collectPageState() {
  switch (currentPage) {
    case 'search':
      return {
        query: state.searchQuery,
        type: document.getElementById('searchType')?.value,
        orderBy: document.getElementById('searchOrderBy')?.value,
        time: document.getElementById('searchTime')?.value,
      };
    case 'ranking':
      return {
        type: document.querySelector('.rank-tab.active')?.dataset?.type || 'day',
      };
    case 'category':
      return {
        category: document.getElementById('categorySelect')?.value,
        orderBy: document.getElementById('categoryOrderBy')?.value,
        time: document.getElementById('categoryTime')?.value,
      };
    case 'favorites':
      return { folderId: currentFavFolderId, sort: currentFavSort };
    default:
      return {};
  }
}

function restorePageState(page, extra, pageNum) {
  switch (page) {
    case 'search':
      if (!state.searchQuery) {
        document.getElementById('searchGrid').innerHTML = '<p class="empty-state">输入关键词开始搜索</p>';
        break;
      }
      if (extra?.type) document.getElementById('searchType').value = extra.type;
      if (extra?.orderBy) document.getElementById('searchOrderBy').value = extra.orderBy;
      if (extra?.time) document.getElementById('searchTime').value = extra.time;
      doSearch(extra?.query || state.searchQuery, pageNum || 1);
      break;
    case 'ranking':
      state.rankingType = extra?.type || 'day';
      state.rankingPage = pageNum || 1;
      loadRanking(state.rankingType, state.rankingPage);
      break;
    case 'category':
      loadCategory(pageNum || 1);
      break;
    case 'favorites':
      if (extra?.folderId) currentFavFolderId = extra.folderId;
      if (extra?.sort) currentFavSort = extra.sort;
      state.favPage = pageNum || 1;
      loadFavorites(state.favPage);
      break;
    case 'downloads':
      loadDownloadTasks();
      break;
    case 'settings':
      loadConfig();
      break;
    case 'dashboard':
      loadDashboard();
      break;
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.page;
    if (target === currentPage) return;
    pageStack = [];
    navigateTo(target);
    restorePageState(target, {}, 1);
  });
});

document.getElementById('searchBtn').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  pageStack.push({ page: currentPage, extra: collectPageState(), pageNum: state.searchPage });
  navigateTo('search');
  doSearch(query, 1);
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

function doSearch(query, page) {
  state.searchQuery = query;
  state.searchPage = page;
  const type = document.getElementById('searchType')?.value || 'all';
  const orderBy = document.getElementById('searchOrderBy')?.value || 'mr';
  const time = document.getElementById('searchTime')?.value || 'a';

  const typeLabel = { all: '', author: '作者·', tag: '标签·' }[type] || '';
  const titleEl = document.querySelector('#page-search .page-title');
  if (titleEl) titleEl.textContent = `搜索结果 · ${typeLabel}${query}`;

  document.getElementById('searchGrid').innerHTML = Components.gridSpinner();

  let promise;
  if (type === 'author') promise = API.searchByAuthor(query, page, orderBy, time);
  else if (type === 'tag') promise = API.searchByTag(query, page, orderBy, time);
  else promise = API.search(query, page, orderBy, time);

  promise.then(data => {
    Components.renderAlbumGrid(data.albums, 'searchGrid');
    Components.renderPagination(data.total, data.page_count, page, 'searchPagination',
      `doSearch('${query}',`);
  }).catch(err => {
    document.getElementById('searchGrid').innerHTML = `<p class="error-state">搜索失败：${err.message}</p>`;
  });
}

function searchByAuthor(name) {
  pageStack.push({ page: currentPage, extra: collectPageState(), pageNum: state.searchPage });
  document.getElementById('searchType').value = 'author';
  navigateTo('search');
  doSearch(name, 1);
}

function searchByTag(tag) {
  pageStack.push({ page: currentPage, extra: collectPageState(), pageNum: state.searchPage });
  document.getElementById('searchType').value = 'tag';
  navigateTo('search');
  doSearch(tag, 1);
}

document.addEventListener('change', (e) => {
  const catIds = ['categorySelect', 'categoryOrderBy', 'categoryTime'];
  if (catIds.includes(e.target.id)) {
    loadCategory(1);
  } else if (e.target.id === 'rankCategory') {
    loadRanking(state.rankingType, 1);
  } else if ((e.target.id === 'searchType' || e.target.id === 'searchOrderBy' || e.target.id === 'searchTime') && state.searchQuery) {
    state.searchPage = 1;
    doSearch(state.searchQuery, 1);
  }
});

function loadRanking(type, page = 1) {
  state.rankingType = type;
  state.rankingPage = page;
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.rank-tab[data-type="${type}"]`)?.classList.add('active');

  const category = document.getElementById('rankCategory')?.value || 'ALL';

  document.getElementById('rankingGrid').innerHTML = Components.gridSpinner();

  API.getRanking(type, page, category).then(data => {
    Components.renderAlbumGrid(data.albums, 'rankingGrid');
    Components.renderPagination(data.total, data.page_count, page, 'rankingPagination',
      `loadRanking('${type}',`);
  }).catch(err => {
    document.getElementById('rankingGrid').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

document.querySelectorAll('.rank-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.rankingType = tab.dataset.type;
    state.rankingPage = 1;
    loadRanking(state.rankingType, 1);
  });
});

function loadCategory(page = 1) {
  state.categoryPage = page;
  const category = document.getElementById('categorySelect')?.value || 'ALL';
  const orderBy = document.getElementById('categoryOrderBy')?.value || 'view';
  const time = document.getElementById('categoryTime')?.value || 'ALL';

  document.getElementById('categoryGrid').innerHTML = Components.gridSpinner();

  API.getCategory(page, time, orderBy, category).then(data => {
    Components.renderAlbumGrid(data.albums, 'categoryGrid');
    Components.renderPagination(data.total, data.page_count, page, 'categoryPagination',
      'loadCategory(');
  }).catch(err => {
    document.getElementById('categoryGrid').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

function showAlbumDetail(albumId) {
  const pageNum = currentPage === 'search' ? state.searchPage
    : currentPage === 'ranking' ? state.rankingPage
    : currentPage === 'category' ? state.categoryPage
    : currentPage === 'favorites' ? state.favPage
    : 1;
  pageStack.push({ page: currentPage, extra: collectPageState(), pageNum });
  navigateTo('detail');
  _currentAlbumId = albumId;
  document.getElementById('albumDetail').innerHTML = '<p class="empty-state">加载中...</p>';

  API.getAlbum(albumId).then(data => {
    Components.renderAlbumDetail(data);
  }).catch(err => {
    document.getElementById('albumDetail').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

function refreshAlbumDetail() {
  if (!_currentAlbumId) return;
  API.getAlbum(_currentAlbumId).then(data => {
    Components.renderAlbumDetail(data);
  }).catch(() => {});
}

function openReader(photoId, albumId, title) {
  if (!mangaReader) {
    mangaReader = new MangaReader();
  }
  if (currentPage !== 'reader') {
    const pn = currentPage === 'search' ? state.searchPage
              : currentPage === 'favorites' ? state.favPage
              : currentPage === 'ranking' ? state.rankingPage
              : 1;
    pageStack.push({ page: currentPage, extra: collectPageState(), pageNum: pn });
  }
  mangaReader.loadImages(photoId, albumId, title);
}

function downloadAlbum(albumId) {
  API.startDownload(albumId, null, 'folder').then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function downloadAlbumWithFormat(albumId) {
  const fmt = document.getElementById('downloadFormatSelect')?.value || 'folder';
  API.startDownload(albumId, null, fmt).then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function downloadPhoto(photoId, albumId) {
  const fmt = document.getElementById('downloadFormatSelect')?.value || 'folder';
  API.startDownloadPhoto(photoId, albumId, null, fmt).then(data => {
    showToast(`章节任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
}

function cancelDownload(taskId) {
  API.cancelDownload(taskId).then(() => loadDownloadTasks());
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
    if (!confirm('确定取消收藏？')) return;
    API.removeFavorite(albumId)
      .then(() => { updateFavButtons(false); showToast('已取消收藏'); })
      .catch(e => { showToast('取消失败：' + e.message, true); refreshAlbumDetail(); });
  } else {
    const folderSel = document.getElementById('favFolderSelect');
    const folderId = folderSel ? folderSel.value : '0';
    API.addFavorite(albumId, folderId)
      .then(() => { updateFavButtons(true); showToast('已添加到收藏'); })
      .catch(e => { showToast('收藏失败：' + e.message, true); refreshAlbumDetail(); });
  }
}

function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;background:${isError ? 'var(--error)' : 'var(--ink)'};color:var(--cream);border-radius:8px;font-size:14px;z-index:2000;animation:fadeIn 0.3s;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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

document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
  if (!confirm('确定清除所有下载历史？')) return;
  API.clearDownloadHistory().then(() => {
    showToast('下载历史已清除');
    loadDownloadTasks();
  }).catch(err => showToast('清除失败：' + err.message, true));
});

document.getElementById('startDownloadBtn')?.addEventListener('click', () => {
  const albumId = document.getElementById('downloadAlbumId').value.trim();
  if (!albumId) { showToast('请输入漫画 ID', true); return; }
  const fmt = document.getElementById('downloadFormatSelectGlobal')?.value || 'folder';
  API.startDownload(albumId, null, fmt).then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
});

function pollDownloadTasks() {
  API.getDownloadTasks().then(tasks => {
    tasks.forEach(t => {
      const prev = prevTaskStates[t.task_id];
      if (prev && prev !== 'completed' && t.status === 'completed') {
        const fmtLabel = { folder: '', zip: '（ZIP）', pdf: '（PDF）', long_img: '（长图）' };
        showToast(`JM${t.album_id} 下载完成${fmtLabel[t.download_type] || ''}`);
      }
      prevTaskStates[t.task_id] = t.status;
    });
    updateFloatBar(tasks);
    if (currentPage === 'downloads') Components.renderDownloadTasks(tasks);
  });
}

function loadDownloadTasks() {
  pollDownloadTasks();
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
      <div class="dl-progress"><div class="dl-progress-fill" style="width:${t.progress}%;background:var(--slate);"></div></div>
      <span class="dl-status" style="color:var(--slate);">${t.progress}%</span>
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

function toggleSelect(albumId) {
  if (selectedAlbums.has(albumId)) {
    selectedAlbums.delete(albumId);
  } else {
    selectedAlbums.add(albumId);
  }
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
  const folderId = document.getElementById('batchFavFolder')?.value || '0';
  const ids = [...selectedAlbums];
  showToast(`正在添加到文件夹...`);
  let success = 0;
  Promise.all(ids.map(aid =>
    API.addFavorite(aid, folderId).then(() => { success++; }).catch(() => {})
  )).then(() => {
    showToast(`已完成 ${success}/${ids.length} 本添加到文件夹`);
    selectedAlbums.clear();
    updateBatchBar();
    loadFavorites(state.favPage);
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

let currentFavFolderId = '0';
let currentFavSort = 'mr';

function loadFavorites(page) {
  state.favPage = page;
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
    return;
  }

  statusEl.innerHTML = '';
  selectedAlbums.clear();
  document.getElementById('favoriteGrid').innerHTML = Components.gridSpinner();
  API.getFavorites(page, currentFavFolderId, currentFavSort).then(data => {
    currentFavAlbums = data.albums;
    Components.renderAlbumGrid(data.albums, 'favoriteGrid', {
      selectable: true, selected: selectedAlbums,
    });
    Components.renderPagination(data.total, data.page_count, page, 'favoritePagination',
      'loadFavorites(');
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
      folderSelect.value = currentVal && [...folderSelect.options].some(o => o.value === currentVal) ? currentVal : '0';
      currentFavFolderId = folderSelect.value;
      folderBar.style.display = '';
    } else {
      folderBar.style.display = 'none';
    }
    sortSelect.value = currentFavSort;
    populateBatchFavFolder(data.folders || []);
  }).catch(err => {
    document.getElementById('favoriteGrid').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'favFolderSelect') {
    currentFavFolderId = e.target.value;
    loadFavorites(1);
  }
  if (e.target.id === 'favSortSelect') {
    currentFavSort = e.target.value;
    loadFavorites(1);
  }
});

function syncFormToConfig() {
  const configEditor = document.getElementById('configEditor');
  let config;
  try {
    config = JSON.parse(configEditor.value || '{}');
  } catch (e) {
    config = {};
  }
  
  config.client = config.client || {};
  config.client.impl = document.getElementById('settingClientImpl').value;
  
  config.dir_rule = config.dir_rule || {};
  config.dir_rule.base_dir = document.getElementById('settingBaseDir').value;
  config.dir_rule.rule = document.getElementById('settingDirRule').value;
  
  config.download = config.download || {};
  config.download.threading = config.download.threading || {};
  config.download.threading.image = parseInt(document.getElementById('settingImageThread').value) || 3;
  
  configEditor.value = JSON.stringify(config, null, 2);
  return config;
}

function syncConfigToForm(config) {
  if (config.client?.impl) {
    document.getElementById('settingClientImpl').value = config.client.impl;
  }
  if (config.dir_rule?.base_dir) {
    document.getElementById('settingBaseDir').value = config.dir_rule.base_dir;
  }
  if (config.dir_rule?.rule) {
    document.getElementById('settingDirRule').value = config.dir_rule.rule;
  }
  if (config.download?.threading?.image) {
    document.getElementById('settingImageThread').value = config.download.threading.image;
  }
}

function loadConfig() {
  API.getConfig().then(config => {
    syncConfigToForm(config);
    document.getElementById('configEditor').value = JSON.stringify(config, null, 2);
  });
  renderTagManager();
  const listCb = document.getElementById('settingShowListCover');
  if (listCb) listCb.checked = localStorage.getItem('ui_show_list_cover') === 'true';
  const detailCb = document.getElementById('settingShowDetailCover');
  if (detailCb) detailCb.checked = localStorage.getItem('ui_show_detail_cover') === 'true';
  const marginInput = document.getElementById('settingPreloadMargin');
  if (marginInput) marginInput.value = localStorage.getItem('reader_rootMargin')?.replace('px', '') || '1500';
  const countInput = document.getElementById('settingPreloadCount');
  if (countInput) countInput.value = localStorage.getItem('reader_preloadCount') || '8';
}

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
    return;
  }
  document.getElementById('quickTags').innerHTML = tags.map(t =>
    `<span class="tag-item" onclick="document.getElementById('searchInput').value='${t}';document.getElementById('searchBtn').click();">${t}</span>`
  ).join('');
}

function goBack() {
  const entry = pageStack.pop();
  if (!entry) { navigateTo('dashboard'); restorePageState('dashboard', {}, 1); return; }
  navigateTo(entry.page);
  restorePageState(entry.page, entry.extra, entry.pageNum);
}

function showLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
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
  if (confirm(`当前已登录: ${state.username}\n确定要登出吗？`)) {
    API.logout().then(() => {
      state.isLoggedIn = false;
      state.username = '';
      updateLoginStatus();
      showToast('已登出');
      if (currentPage === 'favorites') loadFavorites(1);
    }).catch(() => {
      state.isLoggedIn = false;
      state.username = '';
      updateLoginStatus();
    });
  }
}

function checkLoginStatus() {
  API.getLoginStatus().then(data => {
    state.isLoggedIn = data.is_logged_in;
    state.username = data.username || '';
    updateLoginStatus();
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();
  loadDashboard();
  loadDownloadTasks();
});