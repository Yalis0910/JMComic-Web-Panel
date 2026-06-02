class ZoomManager {
  constructor(reader) {
    this.reader = reader;
    this.level = ReaderConfig.zoom.default;
    this.min = ReaderConfig.zoom.min;
    this.max = ReaderConfig.zoom.max;
    this.step = ReaderConfig.zoom.step;
  }

  set(level) {
    this.level = Math.max(this.min, Math.min(this.max, level));
    this.apply();
    this.updateUI();
    return this.level;
  }

  in() { return this.set(this.level + this.step); }
  out() { return this.set(this.level - this.step); }
  reset() { return this.set(ReaderConfig.zoom.default); }

  toggle() {
    return this.level > 1 ? this.reset() : this.set(2);
  }

  apply() {
    const imageList = DOM.$('#reader-image-list');
    imageList.style.transform = `scale(${this.level})`;
    imageList.style.transformOrigin = 'top center';
  }

  updateUI() {
    DOM.$('#reader-zoom-level').textContent = `${Math.round(this.level * 100)}%`;
  }
}