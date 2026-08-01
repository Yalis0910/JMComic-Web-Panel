class ReaderToolbar {
  constructor(reader) {
    this.reader = reader;
    this.visible = false;
    this.hideTimer = null;
    this.elements = {
      toolbar: DOM.$('#reader-toolbar'),
      bottomBar: DOM.$('#reader-bottom-bar'),
      title: DOM.$('#reader-toolbar-title'),
    };
    this.bindEvents();
  }

  bindEvents() {
    DOM.$('#reader-btn-back').addEventListener('click', () => this.reader.goBack());
    DOM.$('#reader-btn-zoom-out').addEventListener('click', () => this.reader.zoom.out());
    DOM.$('#reader-btn-zoom-in').addEventListener('click', () => this.reader.zoom.in());
    DOM.$('#reader-btn-fit').addEventListener('click', () => this.reader.toggleFitWidth());
    DOM.$('#reader-btn-thumbs').addEventListener('click', () => this.reader.toggleThumbStrip());
    DOM.$('#reader-thumb-close').addEventListener('click', () => this.reader.toggleThumbStrip(false));
    DOM.$('#reader-btn-theme').addEventListener('click', () => this.reader.toggleTheme());
    DOM.$('#reader-btn-fullscreen').addEventListener('click', () => this.reader.toggleFullscreen());
  }

  setFitActive(active) {
    const btn = DOM.$('#reader-btn-fit');
    if (btn) btn.classList.toggle('active', active);
  }

  setThumbActive(active) {
    const btn = DOM.$('#reader-btn-thumbs');
    if (btn) btn.classList.toggle('active', active);
  }

  show() {
    DOM.addClass(this.elements.toolbar, 'visible');
    DOM.addClass(this.elements.bottomBar, 'visible');
    this.visible = true;
    this.scheduleHide();
  }

  hide() {
    DOM.removeClass(this.elements.toolbar, 'visible');
    DOM.removeClass(this.elements.bottomBar, 'visible');
    this.visible = false;
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.visible) this.hide();
    }, ReaderConfig.toolbar.hideDelay);
  }

  cancelHide() { clearTimeout(this.hideTimer); }

  setTitle(title) {
    this.elements.title.textContent = title || '漫画阅读器';
  }
}
