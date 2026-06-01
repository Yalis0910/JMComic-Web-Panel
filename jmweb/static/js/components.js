const Components = {
  renderAlbumGrid(albums, containerId) {
    const container = document.getElementById(containerId);
    if (!albums || albums.length === 0) {
      container.innerHTML = '<p style="color:#808090;text-align:center;padding:40px;">暂无数据</p>';
      return;
    }
    container.innerHTML = albums.map(a => `
      <div class="album-item" onclick="showAlbumDetail('${a.album_id}')">
        <div class="cover-placeholder">${escapeHtml(a.title).charAt(0) || '?'}</div>
        <div class="info">
          <div class="title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>
          <div class="meta">JM${a.album_id}</div>
        </div>
      </div>
    `).join('');
  },

  renderPagination(total, pageCount, currentPage, containerId, callback) {
    const container = document.getElementById(containerId);
    if (pageCount <= 1) { container.innerHTML = ''; return; }

    let html = '';
    const showPages = 5;
    const start = Math.max(1, currentPage - Math.floor(showPages / 2));
    const end = Math.min(pageCount, start + showPages - 1);

    if (currentPage > 1) html += `<button onclick="${callback}${currentPage - 1})">&larr;</button>`;
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callback}${i})">${i}</button>`;
    }
    if (currentPage < pageCount) html += `<button onclick="${callback}${currentPage + 1})">&rarr;</button>`;
    container.innerHTML = html;
  },

  renderAlbumDetail(album) {
    const container = document.getElementById('albumDetail');
    const tags = (album.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const episodes = (album.episodes || []).map(ep => `
      <div class="episode-item">
        <span class="ep-name">第${ep.index}話 ${escapeHtml(ep.name)}</span>
        <span class="ep-action"><button onclick="downloadPhoto('${ep.photo_id}')">下载</button></span>
      </div>
    `).join('');
    const loggedIn = state.isLoggedIn;

    container.innerHTML = `
      <div class="album-detail">
        <div class="cover-placeholder-lg">${escapeHtml(album.title).charAt(0) || '?'}</div>
        <div class="info">
          <h2>${escapeHtml(album.title)}</h2>
          <div class="field"><span class="label">ID：</span>JM${album.album_id}</div>
          <div class="field"><span class="label">作者：</span>${(album.authors || []).join('、') || '未知'}</div>
          <div class="field"><span class="label">总页数：</span>${album.page_count}</div>
          <div class="field"><span class="label">观看：</span>${album.views}</div>
          <div class="field"><span class="label">点赞：</span>${album.likes}</div>
          <div class="field"><span class="label">发布日期：</span>${album.pub_date}</div>
          <div class="field"><span class="label">更新日期：</span>${album.update_date}</div>
          ${album.description ? `<div class="field"><span class="label">简介：</span>${escapeHtml(album.description)}</div>` : ''}
          ${tags ? `<div class="field"><span class="label">标签：</span>${tags}</div>` : ''}
          <button class="download-btn" onclick="downloadAlbum('${album.album_id}')">下载本子</button>
          <button class="download-btn" onclick="addFav('${album.album_id}')" style="margin-left:8px;background:#2a2a4a;border:1px solid #3a3a5a;">${loggedIn ? '收藏' : '登录后收藏'}</button>
        </div>
      </div>
      ${episodes ? `<div class="episode-list"><h3>章节列表 (${album.episodes.length})</h3>${episodes}</div>` : ''}
    `;
  },

  renderDownloadTasks(tasks) {
    const container = document.getElementById('downloadList');
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<p style="color:#808090;text-align:center;padding:20px;">暂无下载任务</p>';
      return;
    }
    container.innerHTML = [...tasks].reverse().map(t => {
      const statusMap = { pending: '等待中', running: '下载中', completed: '已完成', failed: '失败', cancelled: '已取消' };
      const colorMap = { pending: '#f0c040', running: '#4a9eff', completed: '#4ade80', failed: '#f04040', cancelled: '#808090' };
      const st = statusMap[t.status] || t.status;
      const sc = colorMap[t.status] || '#808090';
      return `
        <div class="download-item">
          <span>JM${t.album_id}</span>
          <div class="progress-bar"><div class="fill" style="width:${t.progress || 0}%;background:${sc};"></div></div>
          <span class="download-status" style="color:${sc};">${st} ${t.progress || 0}%</span>
          ${t.status === 'running' ? `<button onclick="cancelDownload('${t.task_id}')" style="padding:4px 12px;background:#f04040;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">取消</button>` : ''}
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