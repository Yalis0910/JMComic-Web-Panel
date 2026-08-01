class MangaReader {
  constructor() {
    this.images = [];
    this.photoId = null;
    this.albumId = null;
    this.title = '';
    this.currentIndex = 0;
    this.isFullscreen = false;
    this.fitWidth = false;
    this.theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.thumbStripVisible = false;
    this.thumbEnabled = true;
    this.episodes = null;
    this.epIndex = -1;
    this.nextHintTimer = null;

    this.lazyLoader = null;
    this.progress = null;
    this.zoom = null;
    this.keyboard = null;
    this.gesture = null;
    this.toolbar = null;

    this.initComponents();
    this.bindScrollEvents();
    this.bindEpisodeNav();
  }

  bindEpisodeNav() {
    const prevBtn = DOM.$('#reader-btn-prev-ep');
    const nextBtn = DOM.$('#reader-btn-next-ep');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevEpisode());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextEpisode());
    const hintBtn = DOM.$('#reader-next-hint-btn');
    if (hintBtn) hintBtn.addEventListener('click', () => this.nextEpisode());
    const helpClose = DOM.$('#reader-help-close');
    if (helpClose) helpClose.addEventListener('click', () => this.toggleHelp());
    const help = DOM.$('#reader-help');
    if (help) help.addEventListener('click', e => { if (e.target === help) this.toggleHelp(); });
    const chapterSel = DOM.$('#reader-thumb-chapter');
    if (chapterSel) chapterSel.addEventListener('change', () => {
      const i = parseInt(chapterSel.value, 10);
      if (isNaN(i) || !this.episodes || i === this.epIndex) return;
      const ep = this.episodes[i];
      this.loadImages(ep.photo_id, this.albumId, (ep.name || '').trim() || this.title, 0, this.episodes);
    });
  }

  initComponents() {
    this.lazyLoader = new LazyLoader();
    this.progress = new ProgressManager(this);
    this.zoom = new ZoomManager(this);
    this.keyboard = new KeyboardManager(this);
    this.gesture = new GestureManager(this);
    this.toolbar = new ReaderToolbar(this);
  }

  bindScrollEvents() {
    const container = DOM.$('#reader-container');
    let ticking = false;
    container.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const imageWrappers = DOM.$$('.image-wrapper');
          let currentIndex = 0;
          imageWrappers.forEach((wrapper, index) => {
            const rect = wrapper.getBoundingClientRect();
            if (rect.top < container.clientHeight / 2) {
              currentIndex = index;
            }
          });
          if (currentIndex !== this.currentIndex) {
            this.currentIndex = currentIndex;
            this.progress.update(currentIndex);
            this.updateThumbActive();
            if (this.albumId && this.images.length) {
              ReadingHistory.updateProgress(this.albumId, currentIndex, this.images.length);
            }
            if (currentIndex === this.images.length - 1) {
              this.showNextHint();
            } else {
              this.hideNextHint();
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  async loadImages(photoId, albumId, title, jumpTo = 0, episodes = null) {
    DOM.showLoading();
    try {
      const data = await API.getPhoto(photoId);
      this.images = data.images.map(img => img.url);
      this.photoId = photoId;
      this.albumId = albumId;
      this.title = title || `Photo ${photoId}`;
      this.episodes = episodes && episodes.length ? episodes : null;
      this.epIndex = this.episodes
        ? this.episodes.findIndex(e => String(e.photo_id) === String(photoId))
        : -1;
      this.progress.setTotal(this.images.length);
      this.render();
      this.buildThumbStrip();
      this.toolbar.setTitle(this.title);
      this.thumbEnabled = localStorage.getItem('reader_thumb_strip') === '1';
      const thumbBtn = DOM.$('#reader-btn-thumbs');
      if (thumbBtn) thumbBtn.style.display = this.thumbEnabled ? '' : 'none';
      if (!this.thumbEnabled) this.toggleThumbStrip(false);
      this.updateEpisodeNav();
      this.hideNextHint();
      navigateToReader();
      DOM.hideLoading();
      this.toolbar.show();
      ReadingHistory.record(albumId, photoId, this.title, jumpTo, this.images.length);
      if (jumpTo > 0 && jumpTo < this.images.length) {
        const idx = jumpTo;
        setTimeout(() => this.goTo(idx), 60);
      }
    } catch (e) {
      DOM.hideLoading();
      showToast('加载失败: ' + e.message, true);
    }
  }

  render() {
    const imageList = DOM.$('#reader-image-list');
    imageList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    this.images.forEach((url, index) => {
      const wrapper = this.createImageWrapper(url, index);
      fragment.appendChild(wrapper);
    });
    imageList.appendChild(fragment);
    DOM.$('#reader-container').scrollTop = 0;
  }

  createImageWrapper(url, index) {
    const wrapper = DOM.create('div', {
      className: 'image-wrapper',
      dataset: { index }
    });
    const placeholder = DOM.create('div', {
      className: 'image-placeholder',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>'
    });
    const img = DOM.create('img', { attributes: { alt: `Page ${index + 1}` } });
    if (this.fitWidth) wrapper.classList.add('fit-width');
    wrapper.appendChild(placeholder);
    wrapper.appendChild(img);
    const proxyUrl = `/api/v1/image/proxy?url=${encodeURIComponent(url)}`;
    this.lazyLoader.register(img, proxyUrl, index);
    return wrapper;
  }

  scrollBy(amount) {
    DOM.$('#reader-container').scrollBy({ top: amount, behavior: 'smooth' });
  }

  async goTo(index) {
    if (index < 0 || index >= this.images.length) return;
    const wrapper = DOM.$(`.image-wrapper[data-index="${index}"]`);
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  prevPage() { if (this.currentIndex > 0) this.goTo(this.currentIndex - 1); }
  nextPage() { if (this.currentIndex < this.images.length - 1) this.goTo(this.currentIndex + 1); }

  /* ---------- 章节切换 ---------- */

  hasNextEpisode() {
    return this.episodes && this.epIndex >= 0 && this.epIndex < this.episodes.length - 1;
  }

  hasPrevEpisode() {
    return this.episodes && this.epIndex > 0;
  }

  nextEpisode() {
    if (!this.hasNextEpisode()) return;
    const next = this.episodes[this.epIndex + 1];
    this.loadImages(next.photo_id, this.albumId, (next.name || '').trim() || this.title, 0, this.episodes);
  }

  prevEpisode() {
    if (!this.hasPrevEpisode()) return;
    const prev = this.episodes[this.epIndex - 1];
    this.loadImages(prev.photo_id, this.albumId, (prev.name || '').trim() || this.title, 0, this.episodes);
  }

  updateEpisodeNav() {
    const prevBtn = DOM.$('#reader-btn-prev-ep');
    const nextBtn = DOM.$('#reader-btn-next-ep');
    if (prevBtn) {
      prevBtn.style.display = this.hasPrevEpisode() ? '' : 'none';
    }
    if (nextBtn) {
      nextBtn.style.display = this.hasNextEpisode() ? '' : 'none';
    }
    const chapterSel = DOM.$('#reader-thumb-chapter');
    if (!chapterSel) return;
    if (!this.episodes || this.episodes.length <= 1) { chapterSel.style.display = 'none'; return; }
    chapterSel.innerHTML = this.episodes.map((ep, i) =>
      `<option value="${i}">第${ep.index}話 ${escapeHtml((ep.name || '').trim())}</option>`
    ).join('');
    if (this.epIndex >= 0) chapterSel.value = String(this.epIndex);
    chapterSel.style.display = '';
  }

  showNextHint() {
    if (!this.hasNextEpisode()) return;
    const hint = DOM.$('#reader-next-hint');
    if (!hint) return;
    hint.classList.remove('hidden');
    clearTimeout(this.nextHintTimer);
    this.nextHintTimer = setTimeout(() => this.hideNextHint(), 4000);
  }

  hideNextHint() {
    clearTimeout(this.nextHintTimer);
    const hint = DOM.$('#reader-next-hint');
    if (hint) hint.classList.add('hidden');
  }

  /* ---------- 快捷键帮助 ---------- */

  toggleHelp() {
    const help = DOM.$('#reader-help');
    if (!help) return;
    help.classList.toggle('hidden');
  }

  nextScreen() {
    const container = DOM.$('#reader-container');
    const zoomLevel = this.zoom.level;

    if (zoomLevel <= 1) {
      this.nextPage();
      return;
    }

    const viewH = container.clientHeight;
    const scrollStep = viewH;
    const maxScroll = container.scrollHeight - viewH;

    if (container.scrollTop >= maxScroll - 2) {
      this.nextPage();
      return;
    }

    container.scrollBy({ top: scrollStep, behavior: 'smooth' });
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('ui_theme', this.theme);
    applyTheme(this.theme);
  }

  toggleFitWidth() {
    this.fitWidth = !this.fitWidth;
    DOM.$$('.image-wrapper').forEach(w => w.classList.toggle('fit-width', this.fitWidth));
    this.toolbar.setFitActive(this.fitWidth);
    if (this.fitWidth) this.zoom.reset();
    setTimeout(() => { if (this.images.length) this.goTo(this.currentIndex); }, 80);
  }

  /* ---------- 缩略图条 ---------- */

  buildThumbStrip() {
    const list = DOM.$('#reader-thumb-list');
    if (!list) return;
    list.innerHTML = '';
    if (!this.images.length) return;
    const fragment = document.createDocumentFragment();
    this.images.forEach((url, index) => {
      const item = DOM.create('div', {
        className: 'reader-thumb-item',
        dataset: { index }
      });
      const img = DOM.create('img', {
        attributes: { alt: `${index + 1}`, loading: 'lazy' }
      });
      img.dataset.src = `/api/v1/image/proxy?url=${encodeURIComponent(url)}`;
      item.appendChild(img);
      const label = DOM.create('span', { className: 'thumb-index', textContent: `${index + 1}` });
      item.appendChild(label);
      item.addEventListener('click', () => {
        this.goTo(index);
        if (window.innerWidth < 768) this.toggleThumbStrip(false);
      });
      fragment.appendChild(item);
    });
    list.appendChild(fragment);
    this.thumbObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        this.thumbObserver.unobserve(img);
      });
    }, { root: list });
    list.querySelectorAll('img[data-src]').forEach(img => this.thumbObserver.observe(img));
  }

  toggleThumbStrip(force) {
    const strip = DOM.$('#reader-thumb-strip');
    if (!strip) return;
    const show = force !== undefined ? force : !this.thumbStripVisible;
    if (show && !this.thumbEnabled) return;
    strip.classList.toggle('visible', show);
    this.thumbStripVisible = show;
    this.toolbar.setThumbActive(show);
    if (show) this.updateThumbActive();
  }

  updateThumbActive() {
    const items = DOM.$$('.reader-thumb-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.currentIndex);
    });
    const active = DOM.$('.reader-thumb-item.active');
    const list = DOM.$('#reader-thumb-list');
    if (active && list) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      this.isFullscreen = false;
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } else {
      await document.documentElement.requestFullscreen();
      this.isFullscreen = true;
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('natural'); } catch (e) {
          try { await screen.orientation.lock('portrait'); } catch (e2) {}
        }
      }
    }
  }

  goBack() {
    this.exitReader();
    const before = location.hash;
    if (history.length > 1) {
      history.back();
      setTimeout(() => {
        if (location.hash === before) Router.navigate('dashboard');
      }, 300);
    } else {
      Router.navigate('dashboard');
    }
  }

  exitReader() {
    this.lazyLoader.reset();
    this.images = [];
    this.photoId = null;
    this.albumId = null;
    this.title = '';
    this.episodes = null;
    this.epIndex = -1;
    this.hideNextHint();
    this.zoom.reset();
    this.toggleThumbStrip(false);
    DOM.$('#reader-image-list').innerHTML = '';
    DOM.$('#reader-thumb-list').innerHTML = '';
    DOM.$('#reader-container').scrollTop = 0;
  }
}

let mangaReader = null;

function navigateToReader() {
  const readerScreen = document.getElementById('page-reader');
  const app = document.getElementById('app');
  if (readerScreen) {
    readerScreen.classList.remove('hidden');
    readerScreen.classList.add('active');
  }
  if (app) app.style.display = 'none';
}
