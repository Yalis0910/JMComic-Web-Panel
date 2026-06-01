let currentPage = 'dashboard';
let state = { isLoggedIn: false, username: '' };

function navigateTo(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));

  currentPage = page;
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const sidebarItem = document.querySelector(`.sidebar li[data-page="${page}"]`);
  if (sidebarItem) sidebarItem.classList.add('active');

  if (page === 'ranking') loadRanking('day');
  if (page === 'downloads') loadDownloadTasks();
  if (page === 'favorites') loadFavorites(1);
  if (page === 'settings') loadConfig();
  if (page === 'dashboard') loadDashboard();
}

document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => navigateTo(li.dataset.page));
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
    document.getElementById('searchGrid').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">搜索失败：${err.message}</p>`;
  });
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'searchType' && state.searchQuery) {
    doSearch(state.searchQuery, 1);
  }
});

function loadRanking(type, page = 1) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-type="${type}"]`)?.classList.add('active');

  API.getRanking(type, page).then(data => {
    Components.renderAlbumGrid(data.albums, 'rankingGrid');
    Components.renderPagination(data.total, data.page_count, page, 'rankingPagination',
      `loadRanking('${type}',`);
  }).catch(err => {
    document.getElementById('rankingGrid').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">加载失败：${err.message}</p>`;
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => loadRanking(btn.dataset.type));
});

function showAlbumDetail(albumId) {
  navigateTo('detail');
  document.getElementById('albumDetail').innerHTML = '<p style="text-align:center;padding:40px;color:#808090;">加载中...</p>';

  API.getAlbum(albumId).then(data => {
    Components.renderAlbumDetail(data);
  }).catch(err => {
    document.getElementById('albumDetail').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">加载失败：${err.message}</p>`;
  });
}

function downloadAlbum(albumId) {
  API.startDownload(albumId).then(data => {
    alert(`下载任务已创建！任务ID: ${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => alert(`创建下载任务失败：${err.message}`));
}

function downloadPhoto(photoId) {
  alert(`章节下载功能将在后续版本完善，当前请直接下载整个本子`);
}

function cancelDownload(taskId) {
  API.cancelDownload(taskId).then(() => loadDownloadTasks());
}

function addFav(albumId) {
  if (!state.isLoggedIn) {
    showLoginModal();
    return;
  }
  API.addFavorite(albumId).then(() => alert('已添加到收藏')).catch(e => alert('收藏失败：' + e.message));
}

document.getElementById('startDownloadBtn')?.addEventListener('click', () => {
  const albumId = document.getElementById('downloadAlbumId').value.trim();
  if (!albumId) { alert('请输入本子 ID'); return; }
  downloadAlbum(albumId);
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
      <div class="fav-status-bar">
        <span class="fav-login-prompt">请先登录后查看收藏</span>
        <span class="fav-login-btn" onclick="showLoginModal()">去登录 &rarr;</span>
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
    document.getElementById('favoriteGrid').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">加载失败：${err.message}</p>`;
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
    API.updateConfig(config).then(() => alert('配置已保存'));
  } catch (e) {
    alert('配置格式错误：' + e.message);
  }
});

function loadDashboard() {
  const tags = ['全彩', '無修正', '中文', '同人', '單行本'];
  document.getElementById('quickTags').innerHTML = tags.map(t =>
    `<span class="quick-tag" onclick="document.getElementById('searchInput').value='${t}';document.getElementById('searchBtn').click();">${t}</span>`
  ).join('');
}

function goBack() {
  const detailPage = document.getElementById('page-detail');
  if (detailPage.classList.contains('active')) {
    navigateTo('dashboard');
  }
}

/* ---- Login ---- */

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
  }).catch(err => {
    document.getElementById('loginError').textContent = err.message || '登录失败';
  }).finally(() => {
    btn.textContent = '登录';
    btn.disabled = false;
  });
});

function updateLoginStatus() {
  const el = document.getElementById('loginStatus');
  if (state.isLoggedIn && state.username) {
    el.textContent = state.username;
    el.className = 'login-status logged-in';
    el.onclick = showLogoutConfirm;
  } else {
    el.textContent = '登录';
    el.className = 'login-status';
    el.onclick = showLoginModal;
  }
}

function showLogoutConfirm() {
  if (confirm(`当前已登录: ${state.username}\n确定要登出吗？`)) {
    API.logout().then(() => {
      state.isLoggedIn = false;
      state.username = '';
      updateLoginStatus();
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