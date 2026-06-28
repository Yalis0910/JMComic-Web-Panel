class MangaReader {
  constructor() {
    this.images = [];
    this.photoId = null;
    this.albumId = null;
    this.currentIndex = 0;
    this.isFullscreen = false;
    this.theme = localStorage.getItem('reader-theme') || 'light';

    this.lazyLoader = null;
    this.progress = null;
    this.zoom = null;
    this.keyboard = null;
    this.gesture = null;
    this.toolbar = null;

    this.applyTheme(this.theme);
    this.initComponents();
    this.bindScrollEvents();
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
          this.currentIndex = currentIndex;
          this.progress.update(currentIndex);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  async loadImages(photoId, albumId, title) {
    DOM.showLoading();
    try {
      const data = await API.getPhoto(photoId);
      this.images = data.images.map(img => img.url);
      this.photoId = photoId;
      this.albumId = albumId;
      this.progress.setTotal(this.images.length);
      this.render();
      this.toolbar.setTitle(title || `Photo ${photoId}`);
      navigateTo('reader');
      DOM.hideLoading();
      this.toolbar.show();
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
    this.applyTheme(this.theme);
    localStorage.setItem('reader-theme', this.theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
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
    this.lazyLoader.reset();
    this.images = [];
    this.photoId = null;
    this.albumId = null;
    this.zoom.reset();
    DOM.$('#reader-image-list').innerHTML = '';
    DOM.$('#reader-container').scrollTop = 0;
    navigateTo('detail');
  }
}

let mangaReader = null;