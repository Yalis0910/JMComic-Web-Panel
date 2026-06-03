function _coverChar(title) {
  return escapeHtml(title).charAt(0) || '?';
}

function _showListCover() {
  return localStorage.getItem('ui_show_list_cover') === 'true';
}

function _showDetailCover() {
  return localStorage.getItem('ui_show_detail_cover') === 'true';
}

const Components = {
  renderAlbumGrid(albums, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!albums || albums.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无数据</p>';
      return;
    }
    const { selectable = false, selected = new Set() } = options;
    container.innerHTML = albums.map(a => {
      const isChecked = selected.has(a.album_id);
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
          ${_showListCover() && a.cover_url
            ? `<img class="cover-img" src="${escapeHtml(a.cover_url)}"
                  alt="${escapeHtml(a.title)}"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <span class="cover-char" style="display:none;">${_coverChar(a.title)}</span>`
            : `<span class="cover-char">${_coverChar(a.title)}</span>`
          }
        </div>
        <div class="manga-info">
          <div class="manga-title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>
          <div class="manga-meta">JM${a.album_id}</div>
        </div>
      </div>`;
    }).join('');
  },

  renderPagination(total, pageCount, currentPage, containerId, callback) {
    const container = document.getElementById(containerId);
    if (pageCount <= 1) { container.innerHTML = ''; return; }

    let html = '';
    const showPages = 5;
    const start = Math.max(1, currentPage - Math.floor(showPages / 2));
    const end = Math.min(pageCount, start + showPages - 1);

    if (currentPage > 1) html += `<button onclick="${callback}${currentPage - 1})">←</button>`;
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callback}${i})">${i}</button>`;
    }
    if (currentPage < pageCount) html += `<button onclick="${callback}${currentPage + 1})">→</button>`;
    container.innerHTML = html;
  },

  renderAlbumDetail(album) {
    const container = document.getElementById('albumDetail');
    const tags = (album.tags || []).map(t => `<span class="detail-tag">${escapeHtml(t)}</span>`).join('');
    const episodes = (album.episodes || []).map(ep => `
      <div class="episode-row">
        <span class="episode-name">第${ep.index}話 ${escapeHtml(ep.name)}</span>
        <button class="episode-btn" onclick="openReader('${ep.photo_id}', '${album.album_id}', '${escapeHtml(ep.name.replace(/'/g, "\\'"))}')">阅读</button>
      </div>`).join('');
    const loggedIn = state.isLoggedIn;

    container.innerHTML = `
      <div class="detail-frame">
        <div class="detail-cover">
          ${_showDetailCover() && album.cover_url ? `<img class="detail-cover-img" src="${escapeHtml(album.cover_url)}" alt="${escapeHtml(album.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="detail-cover-char" style="display:none;">${_coverChar(album.title)}</span>` : `<span class="detail-cover-char">${_coverChar(album.title)}</span>`}
        </div>
        <div class="detail-info">
          <h2>${escapeHtml(album.title)}</h2>
          <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">JM${album.album_id}</span></div>
          <div class="detail-row"><span class="detail-label">作者</span><span class="detail-value">${(album.authors || []).join('、') || '未知'}</span></div>
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
            </select>
            <button class="action-btn" onclick="downloadAlbumWithFormat('${album.album_id}')">下载本子</button>
            <button class="action-btn action-alt" onclick="addFav('${album.album_id}')">${loggedIn ? '收藏' : '登录后收藏'}</button>
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
  },

  renderDownloadTasks(tasks) {
    const container = document.getElementById('downloadList');
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无下载任务</p>';
      return;
    }
    container.innerHTML = [...tasks].reverse().map(t => {
      const statusMap = { pending: '等待中', running: '下载中', completed: '已完成', failed: '失败', cancelled: '已取消' };
      const colorMap = { pending: 'var(--warning)', running: 'var(--slate)', completed: 'var(--success)', failed: 'var(--error)', cancelled: 'var(--slate-light)' };
      const st = statusMap[t.status] || t.status;
      const sc = colorMap[t.status] || 'var(--slate-light)';
      const fmtLabel = t.download_type === 'zip' ? 'ZIP' : '图片';
      return `
        <div class="dl-item">
          <span class="dl-id">JM${t.album_id}</span>
          <span class="dl-type">${fmtLabel}</span>
          <div class="dl-progress"><div class="dl-progress-fill" style="width:${t.progress || 0}%;background:${sc};"></div></div>
          <span class="dl-status" style="color:${sc};">${st} ${t.progress || 0}%</span>
          ${t.status === 'running' ? `<button class="dl-cancel" onclick="cancelDownload('${t.task_id}')">取消</button>` : ''}
        </div>
      `;
    }).join('');
  },
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}