const ReadingHistory = {
  KEY: 'jm_reading_history',
  MAX: 50,

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  _save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items.slice(0, this.MAX)));
  },

  record(albumId, photoId, title, pageIndex, total) {
    const items = this.get().filter(i => i.albumId !== albumId);
    items.unshift({ albumId, photoId, title, pageIndex, total, updatedAt: Date.now() });
    this._save(items);
  },

  updateProgress(albumId, pageIndex, total) {
    const items = this.get();
    const item = items.find(i => i.albumId === albumId);
    if (!item) return;
    item.pageIndex = pageIndex;
    item.total = total;
    item.updatedAt = Date.now();
    this._save(items);
  },

  remove(albumId) {
    this._save(this.get().filter(i => i.albumId !== albumId));
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};

const RecentSearches = {
  KEY: 'jm_recent_searches',
  MAX: 10,

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  add(q) {
    const items = this.get().filter(i => i !== q);
    items.unshift(q);
    localStorage.setItem(this.KEY, JSON.stringify(items.slice(0, this.MAX)));
  },

  remove(q) {
    localStorage.setItem(this.KEY, JSON.stringify(this.get().filter(i => i !== q)));
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};
