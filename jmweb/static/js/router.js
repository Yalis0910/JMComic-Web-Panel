const Router = {
  cache: new Map(),
  scrollPos: {},
  pendingScroll: null,
  _cacheMax: 200,
  _cacheTTL: 10 * 60 * 1000,

  init() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  },

  parse() {
    const hash = location.hash.replace(/^#\/?/, '');
    const idx = hash.indexOf('?');
    let path = hash;
    let qs = '';
    if (idx !== -1) {
      path = hash.slice(0, idx);
      qs = hash.slice(idx + 1);
    }
    const segs = path.split('/').filter(Boolean);
    return { page: segs[0] || 'dashboard', segs, params: new URLSearchParams(qs) };
  },

  build(page, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    return `#/${page}${qs.toString() ? '?' + qs.toString() : ''}`;
  },

  currentKey() {
    return location.hash.slice(1);
  },

  navigate(page, params = {}, opts = {}) {
    const target = this.build(page, params);
    if (location.hash === target) {
      this.render();
      return;
    }
    if (opts.replace) location.replace(target);
    else location.hash = target;
  },

  getCache(key) {
    const c = this.cache.get(key);
    if (c && Date.now() - c.ts < this._cacheTTL) return c.data;
    return null;
  },

  setCache(key, data) {
    if (this.cache.size >= this._cacheMax) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, ts: Date.now() });
  },

  clearCache() {
    this.cache.clear();
  },

  saveScroll() {
    this.scrollPos[this.currentKey()] = window.scrollY;
  },

  afterRender() {
    if (this.pendingScroll === null) return;
    window.scrollTo(0, this.pendingScroll);
    this.pendingScroll = null;
  },

  render() {
    const { page, params } = this.parse();

    if (page === 'reader') {
      if (!mangaReader || !mangaReader.photoId) {
        this.navigate('dashboard', {}, { replace: true });
        return;
      }
      this.showReader();
      return;
    }

    this.hideReader();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

    const pageEl = page === 'album'
      ? document.getElementById('page-detail')
      : document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');
    const tabItem = document.querySelector(`.tab-item[data-page="${page}"]`);
    if (tabItem) tabItem.classList.add('active');

    this.pendingScroll = this.scrollPos[this.currentKey()] || 0;

    switch (page) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'ranking':
        {
          const type = params.get('type') || 'day';
          const pageNum = parseInt(params.get('page')) || 1;
          const category = params.get('category') || 'ALL';
          const catSel = document.getElementById('rankCategory');
          if (catSel && catSel.value !== category) catSel.value = category;
          loadRanking(type, pageNum);
        }
        break;
      case 'category':
        {
          const pageNum = parseInt(params.get('page')) || 1;
          syncSelect('categorySelect', params.get('category'));
          syncSelect('categoryOrderBy', params.get('order_by'));
          syncSelect('categoryTime', params.get('time'));
          loadCategory(pageNum);
        }
        break;
      case 'search':
        {
          const q = params.get('q');
          syncSelect('searchType', params.get('type'));
          syncSelect('searchOrderBy', params.get('order_by'));
          syncSelect('searchTime', params.get('time'));
          const pageNum = parseInt(params.get('page')) || 1;
          if (!q) {
            document.getElementById('searchGrid').innerHTML = '<p class="empty-state">输入关键词开始搜索</p>';
            document.getElementById('searchPagination').innerHTML = '';
            Router.afterRender();
            break;
          }
          doSearch(q, pageNum);
        }
        break;
      case 'album':
        {
          const id = params.get('id');
          if (!id) {
            this.navigate('dashboard', {}, { replace: true });
            break;
          }
          showAlbumDetailById(id);
        }
        break;
      case 'downloads':
        loadDownloadTasks();
        break;
      case 'favorites':
        {
          const pageNum = parseInt(params.get('page')) || 1;
          syncSelect('favFolderSelect', params.get('folder_id'));
          syncSelect('favSortSelect', params.get('sort'));
          loadFavorites(pageNum);
        }
        break;
      case 'settings':
        loadConfig();
        break;
      default:
        this.navigate('dashboard', {}, { replace: true });
    }
  },

  showReader() {
    const readerScreen = document.getElementById('page-reader');
    const app = document.getElementById('app');
    if (readerScreen) {
      readerScreen.classList.remove('hidden');
      readerScreen.classList.add('active');
    }
    if (app) app.style.display = 'none';
  },

  hideReader() {
    const readerScreen = document.getElementById('page-reader');
    const app = document.getElementById('app');
    if (readerScreen) {
      readerScreen.classList.add('hidden');
      readerScreen.classList.remove('active');
    }
    if (app) app.style.display = '';
  },
};

function syncSelect(id, value) {
  if (!value) return;
  const el = document.getElementById(id);
  if (!el) return;
  if ([...el.options].some(o => o.value === value)) el.value = value;
}
