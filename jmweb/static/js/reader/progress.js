class ProgressManager {
  constructor(reader) {
    this.reader = reader;
    this.totalImages = 0;
    this.currentIndex = 0;
    this.isDragging = false;
    this.init();
  }

  init() {
    const progressBar = DOM.$('#reader-progress-bar');
    progressBar.addEventListener('mousedown', (e) => this.handleDragStart(e));
    progressBar.addEventListener('touchstart', (e) => this.handleDragStart(e), { passive: true });
    document.addEventListener('mousemove', (e) => this.handleDragMove(e));
    document.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: true });
    document.addEventListener('mouseup', () => this.handleDragEnd());
    document.addEventListener('touchend', () => this.handleDragEnd());
  }

  handleDragStart(e) {
    if (this.totalImages === 0) return;
    this.isDragging = true;
    DOM.addClass(DOM.$('#reader-progress-bar'), 'dragging');
    this.updateFromPosition(e);
  }

  handleDragMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.updateFromPosition(e);
  }

  handleDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    DOM.removeClass(DOM.$('#reader-progress-bar'), 'dragging');
    this.reader.goTo(this.currentIndex);
  }

  updateFromPosition(e) {
    const progressBar = DOM.$('#reader-progress-bar');
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let percentage = (clientX - rect.left) / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    this.currentIndex = Math.round(percentage * (this.totalImages - 1));
    this.updateUI();
  }

  setTotal(total) {
    this.totalImages = total;
    this.currentIndex = 0;
  }

  update(index) {
    if (this.isDragging) return;
    this.currentIndex = index;
    this.updateUI();
  }

  updateUI() {
    const fill = DOM.$('#reader-progress-fill');
    const thumb = DOM.$('#reader-progress-thumb');
    const info = DOM.$('#reader-page-info');
    if (this.totalImages > 0) {
      const pct = ((this.currentIndex + 1) / this.totalImages) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      info.textContent = `${this.currentIndex + 1} / ${this.totalImages}`;
    }
  }
}