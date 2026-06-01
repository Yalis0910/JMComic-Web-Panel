let currentPage = 'dashboard';
let state = { isLoggedIn: false, username: '' };

function navigateTo(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  currentPage = page;
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'ranking') loadRanking('day');
  if (page === 'downloads') loadDownloadTasks();
  if (page === 'favorites') loadFavorites(1);
  if (page === 'settings') loadConfig();
  if (page === 'dashboard') loadDashboard();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

document.getElementById('searchBtn').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
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

  let promise;
  if (type === 'author') promise = API.searchByAuthor(query, page);
  else if (type === 'tag') promise = API.searchByTag(query, page);
  else promise = API.search(query, page);

  promise.then(data => {
    Components.renderAlbumGrid(data.albums, 'searchGrid');
    Components.renderPagination(data.total, data.page_count, page, 'searchPagination',
      `doSearch('${query}',`);
  }).catch(err => {
    document.getElementById('searchGrid').innerHTML = `<p class="error-state">搜索失败：${err.message}</p>`;
  });
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'searchType' && state.searchQuery) {
    doSearch(state.searchQuery, 1);
  }
});

function loadRanking(type, page = 1) {
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.rank-tab[data-type="${type}"]`)?.classList.add('active');

  API.getRanking(type, page).then(data => {
    Components.renderAlbumGrid(data.albums, 'rankingGrid');
    Components.renderPagination(data.total, data.page_count, page, 'rankingPagination',
      `loadRanking('${type}',`);
  }).catch(err => {
    document.getElementById('rankingGrid').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

document.querySelectorAll('.rank-tab').forEach(tab => {
  tab.addEventListener('click', () => loadRanking(tab.dataset.type));
});

function showAlbumDetail(albumId) {
  navigateTo('detail');
  document.getElementById('albumDetail').innerHTML = '<p class="empty-state">加载中...</p>';

  API.getAlbum(albumId).then(data => {
    Components.renderAlbumDetail(data);
  }).catch(err => {
    document.getElementById('albumDetail').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
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

function downloadPhoto(photoId) {
  showToast('章节下载功能将在后续版本完善');
}

function cancelDownload(taskId) {
  API.cancelDownload(taskId).then(() => loadDownloadTasks());
}

function addFav(albumId) {
  if (!state.isLoggedIn) {
    showLoginModal();
    return;
  }
  API.addFavorite(albumId).then(() => showToast('已添加到收藏')).catch(e => showToast('收藏失败：' + e.message, true));
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

document.getElementById('startDownloadBtn')?.addEventListener('click', () => {
  const albumId = document.getElementById('downloadAlbumId').value.trim();
  if (!albumId) { showToast('请输入漫画 ID', true); return; }
  const fmt = document.getElementById('downloadFormatSelectGlobal')?.value || 'folder';
  API.startDownload(albumId, null, fmt).then(data => {
    showToast(`任务已创建 #${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => showToast(`创建失败：${err.message}`, true));
});

function loadDownloadTasks() {
  API.getDownloadTasks().then(tasks => {
    Components.renderDownloadTasks(tasks);
  });
}

setInterval(() => {
  if (currentPage === 'downloads') loadDownloadTasks();
}, 2000);

function loadFavorites(page) {
  const statusEl = document.getElementById('favoritesStatus');

  if (!state.isLoggedIn) {
    statusEl.innerHTML = `
      <div class="fav-prompt">
        <span class="fav-prompt-text">请先登录后查看收藏</span>
        <span class="fav-prompt-btn" onclick="showLoginModal()">去登录 →</span>
      </div>`;
    document.getElementById('favoriteGrid').innerHTML = '';
    document.getElementById('favoritePagination').innerHTML = '';
    return;
  }

  statusEl.innerHTML = '';
  API.getFavorites(page).then(data => {
    Components.renderAlbumGrid(data.albums, 'favoriteGrid');
    Components.renderPagination(data.total, data.page_count, page, 'favoritePagination',
      'loadFavorites(');
  }).catch(err => {
    document.getElementById('favoriteGrid').innerHTML = `<p class="error-state">加载失败：${err.message}</p>`;
  });
}

function loadConfig() {
  API.getConfig().then(config => {
    document.getElementById('settingClientImpl').value = config.client?.impl || 'html';
    document.getElementById('settingBaseDir').value = config.dir_rule?.base_dir || '';
    document.getElementById('settingDirRule').value = config.dir_rule?.rule || 'Bd_Aauthor_Atitle';
    document.getElementById('settingImageThread').value = config.download?.threading?.image || 3;
    document.getElementById('configEditor').value = JSON.stringify(config, null, 2);
  });
}

document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
  try {
    const config = JSON.parse(document.getElementById('configEditor').value);
    API.updateConfig(config).then(() => showToast('配置已保存'));
  } catch (e) {
    showToast('配置格式错误：' + e.message, true);
  }
});

function loadDashboard() {
  const tags = ['全彩', '無修正', '中文', '同人', '單行本'];
  document.getElementById('quickTags').innerHTML = tags.map(t =>
    `<span class="tag-item" onclick="document.getElementById('searchInput').value='${t}';document.getElementById('searchBtn').click();">${t}</span>`
  ).join('');
}

function goBack() {
  if (currentPage === 'detail' || currentPage === 'search') {
    navigateTo('dashboard');
  }
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