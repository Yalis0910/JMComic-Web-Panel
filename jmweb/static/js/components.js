function _coverChar(title) {
  return escapeHtml(title).charAt(0) || '?';
}

function _showListCover() {
  return localStorage.getItem('ui_show_list_cover') === 'true';
}

function _showDetailCover() {
  return localStorage.getItem('ui_show_detail_cover') === 'true';
}

let _coverObserver = null;

function _getCoverObserver() {
  if (_coverObserver) return _coverObserver;
  _coverObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
      img.onload = () => {
        const skeleton = img.parentElement?.querySelector('.cover-skeleton');
        if (skeleton) skeleton.remove();
      };
      img.onerror = () => {
        const cover = img.parentElement;
        if (cover) {
          const title = cover.parentElement?.querySelector('.manga-title')?.textContent;
          cover.innerHTML = `<span class="cover-char">${_coverChar(title)}</span>`;
        }
      };
      _coverObserver.unobserve(img);
    });
  }, { rootMargin: '400px' });
  return _coverObserver;
}

const Components = {
  gridSpinner() {
    return '<div class="grid-spinner"><div class="spinner-ring"></div><div class="spinner-text">加载中...</div></div>';
  },

  renderAlbumGrid(albums, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!albums || albums.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无数据</p>';
      return;
    }
    const { selectable = false, selected = new Set() } = options;
    container.innerHTML = albums.map(a => {
      const isChecked = selected.has(a.album_id);
      const cover = _showListCover() && a.cover_url
        ? `<img class="cover-img" data-src="${escapeHtml(a.cover_url)}" alt="${escapeHtml(a.title)}"><span class="cover-skeleton"></span>`
        : `<span class="cover-char">${_coverChar(a.title)}</span>`;
      return `
      <div class="manga-card${selectable ? ' manga-card-selectable' : ''}"
           ${selectable ? '' : `onclick="showAlbumDetail('${a.album_id}')"`}>
        ${selectable ? `
          <div class="manga-checkbox" onclick="event.stopPropagation();toggleSelect('${a.album_id}')">
            <div class="checkbox-box${isChecked ? ' checked' : ''}">
              ${isChecked ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            </div>
          </div>` : ''}
        <div class="manga-cover" ${selectable ? `onclick="showAlbumDetail('${a.album_id}')"` : ''}>
          ${cover}
        </div>
        <div class="manga-info">
          <div class="manga-title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>
          <div class="manga-meta">JM${a.album_id}</div>
        </div>
      </div>`;
    }).join('');
    if (_showListCover()) {
      container.querySelectorAll('.cover-img[data-src]').forEach(img => _getCoverObserver().observe(img));
    }
  },

  renderHistoryGrid(items, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = items.map(h => `
      <div class="manga-card" onclick="continueReading('${h.albumId}')">
        <div class="manga-cover">
          <span class="cover-char">${_coverChar(h.title)}</span>
        </div>
        <div class="manga-info">
          <div class="manga-title" title="${escapeHtml(h.title)}">${escapeHtml(h.title)}</div>
          <div class="manga-meta">读到 ${(h.pageIndex || 0) + 1} / ${h.total || '?'} 页</div>
        </div>
      </div>
    `).join('');
  },

  renderPagination(total, pageCount, currentPage, containerId, pageName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (pageCount <= 1) { container.innerHTML = ''; return; }

    let html = '';
    const showPages = 5;
    const start = Math.max(1, currentPage - Math.floor(showPages / 2));
    const end = Math.min(pageCount, start + showPages - 1);

    if (currentPage > 1) html += `<button onclick="goPage('${pageName}', ${currentPage - 1})">←</button>`;
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goPage('${pageName}', ${i})">${i}</button>`;
    }
    if (currentPage < pageCount) html += `<button onclick="goPage('${pageName}', ${currentPage + 1})">→</button>`;
    container.innerHTML = html;
  },

  renderAlbumDetail(album) {
    const container = document.getElementById('albumDetail');
    const tags = (album.tags || []).map(t => `<span class="detail-tag" onclick="searchByTag('${escapeHtml(t)}')">${escapeHtml(t)}</span>`).join('');
    const authors = (album.authors || []).map(a => `<a class="detail-link" onclick="searchByAuthor('${escapeHtml(a)}')">${escapeHtml(a)}</a>`).join('、') || '未知';
    const episodes = (album.episodes || []).map(ep => `
      <div class="episode-row">
        <span class="episode-name">第${ep.index}話 ${escapeHtml(ep.name)}</span>
        <div class="episode-actions">
          <button class="episode-btn" onclick="openReader('${ep.photo_id}', '${album.album_id}', '${escapeHtml(ep.name.replace(/'/g, "\\'"))}')">阅读</button>
          <button class="episode-btn episode-btn-dl" onclick="downloadPhoto('${ep.photo_id}', '${album.album_id}')">下载</button>
        </div>
      </div>`).join('');
    const loggedIn = state.isLoggedIn;
    const isFav = album.is_favorite === true;

    container.innerHTML = `
      <div class="detail-frame">
        <div class="detail-cover">
          ${_showDetailCover() && album.cover_url ? `<img class="detail-cover-img" src="${escapeHtml(album.cover_url)}" alt="${escapeHtml(album.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="detail-cover-char" style="display:none;">${_coverChar(album.title)}</span>` : `<span class="detail-cover-char">${_coverChar(album.title)}</span>`}
        </div>
        <div class="detail-info">
          <h2>${escapeHtml(album.title)}</h2>
          <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">JM${album.album_id}</span></div>
          <div class="detail-row"><span class="detail-label">作者</span><span class="detail-value">${authors}</span></div>
          <div class="detail-row"><span class="detail-label">页数</span><span class="detail-value">${album.page_count}</span></div>
          <div class="detail-row"><span class="detail-label">观看</span><span class="detail-value">${album.views}</span></div>
          <div class="detail-row"><span class="detail-label">点赞</span><span class="detail-value">${album.likes}</span></div>
          <div class="detail-row"><span class="detail-label">发布</span><span class="detail-value">${album.pub_date}</span></div>
          <div class="detail-row"><span class="detail-label">更新</span><span class="detail-value">${album.update_date}</span></div>
          ${album.description ? `<div class="detail-row"><span class="detail-label">简介</span><span class="detail-value">${escapeHtml(album.description)}</span></div>` : ''}
          ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
          <div class="detail-actions">
            <select id="downloadFormatSelect" class="action-select">
              <option value="folder">图片文件夹</option>
              <option value="zip">ZIP 压缩包</option>
              <option value="pdf">PDF 文档</option>
              <option value="long_img">长图 PNG</option>
            </select>
            <button class="action-btn" onclick="downloadAlbumWithFormat('${album.album_id}')">下载本子</button>
            ${loggedIn
              ? `<span id="favGroup" class="fav-group" style="display:${isFav ? 'none' : 'inline-flex'};">
                   <select id="detailFavFolderSelect" class="action-select"><option value="0">默认收藏夹</option></select>
                   <button id="favToggleBtn" class="action-btn action-alt" data-fav="0" onclick="toggleFav('${album.album_id}', false)">收藏</button>
                 </span>
                 <button id="favRemoveBtn" class="action-btn action-faved" style="display:${isFav ? '' : 'none'};" onclick="toggleFav('${album.album_id}', true)">已收藏 ✓</button>`
              : `<button class="action-btn action-alt" onclick="showLoginModal()">登录后收藏</button>`}
          </div>
        </div>
      </div>
      ${episodes ? `
        <div class="episodes-section">
          <h3 class="episodes-title">章节列表 (${album.episodes.length})</h3>
          ${episodes}
        </div>
      ` : ''}
    `;

    if (loggedIn) {
      API.checkFavorite(album.album_id).then(data => {
        const fav = data && data.is_favorite;
        updateFavButtons(fav);
      }).catch(() => {});
      API.getFolders().then(data => {
        const sel = document.getElementById('detailFavFolderSelect');
        if (!sel) return;
        const folders = (data && data.folders) || [];
        folders.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.folder_id;
          opt.textContent = f.name;
          sel.appendChild(opt);
        });
      }).catch(() => {});
    }
  },

  renderDownloadSummary(tasks) {
    const el = document.getElementById('downloadSummary');
    if (!el) return;
    if (!tasks || tasks.length === 0) {
      el.innerHTML = '';
      return;
    }
    const count = s => tasks.filter(t => t.status === s).length;
    const running = count('running');
    const completed = count('completed');
    const failed = count('failed');
    const parts = [];
    parts.push(`共 <strong>${tasks.length}</strong> 个任务`);
    if (running) parts.push(`下载中 <strong>${running}</strong>`);
    if (completed) parts.push(`已完成 <strong>${completed}</strong>`);
    if (failed) parts.push(`失败 <strong>${failed}</strong>`);
    el.innerHTML = parts.join(' · ');
  },

  renderDownloadTasks(tasks) {
    const container = document.getElementById('downloadList');
    if (!container) return;
    Components.renderDownloadSummary(tasks);
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无下载任务</p>';
      return;
    }
    const statusMap = { pending: '等待中', running: '下载中', completed: '已完成', failed: '失败', cancelled: '已取消' };
    const colorMap = { pending: 'var(--warning)', running: 'var(--accent)', completed: 'var(--success)', failed: 'var(--error)', cancelled: 'var(--text-3)' };
    const fmtMap = { folder: '图片', zip: 'ZIP', pdf: 'PDF', long_img: '长图' };

    container.innerHTML = [...tasks].reverse().map(t => {
      const st = statusMap[t.status] || t.status;
      const sc = colorMap[t.status] || 'var(--text-3)';
      const fmtLabel = fmtMap[t.download_type] || t.download_type;
      const isMulti = t.total_chapters > 1;
      const chapterInfo = isMulti && t.status === 'running'
        ? `<span class="dl-chapter">第${t.current_chapter_index}/${t.total_chapters}章 (${t.current_chapter_completed}/${t.current_chapter_total}页)</span>`
        : '';
      const stats = window.dlStats && window.dlStats[t.task_id];
      const speedInfo = stats && stats.speed
        ? `<span>${stats.speed}</span><span>剩余 ${stats.eta}</span>`
        : '';
      const created = new Date(t.created_at * 1000).toLocaleString();
      const actions = t.status === 'running'
        ? `<button class="dl-mini-btn danger" onclick="cancelDownload('${t.task_id}')">取消</button>`
        : t.status === 'failed'
          ? `<button class="dl-mini-btn" onclick="retryDownload('${t.task_id}')">重试</button>`
          : t.status === 'completed' || t.status === 'cancelled'
            ? `<button class="dl-mini-btn danger" onclick="removeDownloadTask('${t.task_id}')">删除</button>`
            : '';
      return `
        <div class="dl-item" data-task="${t.task_id}">
          <div class="dl-item-body">
            <div class="dl-item-top" onclick="toggleDownloadDetail('${t.task_id}')">
              <span class="dl-id">JM${t.album_id}</span>
              <span class="dl-type">${fmtLabel}</span>
              ${chapterInfo}
              <div class="dl-progress"><div class="dl-progress-fill" style="width:${t.progress || 0}%;background:${sc};"></div></div>
              <span class="dl-status" style="color:${sc};">${st} ${t.progress || 0}%</span>
            </div>
            <div class="dl-meta" style="display:none;">
              <span>创建于 ${created}</span>
              ${speedInfo}
              ${t.error ? `<span class="dl-error">${escapeHtml(t.error)}</span>` : ''}
            </div>
          </div>
          <div class="dl-actions">${actions}</div>
        </div>
      `;
    }).join('');
  },
};

function toggleDownloadDetail(taskId) {
  const item = document.querySelector(`.dl-item[data-task="${taskId}"]`);
  if (!item) return;
  item.classList.toggle('expanded');
  const meta = item.querySelector('.dl-meta');
  if (meta) meta.style.display = meta.style.display === 'none' ? 'flex' : 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
