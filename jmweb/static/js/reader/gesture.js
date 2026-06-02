class GestureManager {
  constructor(reader) {
    this.reader = reader;
    this.startY = 0;
    this.startX = 0;
    this.startDistance = 0;
    this.isZooming = false;
    this.lastTap = 0;
    this.init();
  }

  init() {
    const container = DOM.$('#reader-container');
    container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    container.addEventListener('touchend', () => this.handleTouchEnd());
    container.addEventListener('click', (e) => this.handleClick(e));
    container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
  }

  handleTouchStart(e) {
    if (e.touches.length === 1) {
      this.startY = e.touches[0].clientY;
      this.startX = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      this.isZooming = true;
      this.startDistance = this.getDistance(e.touches);
    }
  }

  handleTouchMove(e) {
    if (this.isZooming && e.touches.length === 2) {
      e.preventDefault();
      const scale = this.getDistance(e.touches) / this.startDistance;
      this.reader.zoom.set(this.reader.zoom.level * scale);
      this.startDistance = this.getDistance(e.touches);
    }
  }

  handleTouchEnd() { this.isZooming = false; }

  handleClick(e) {
    const container = DOM.$('#reader-container');
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      this.reader.prevPage();
    } else if (x > width * 0.7) {
      this.reader.nextPage();
    } else {
      this.reader.toolbar.toggle();
    }
  }

  handleDoubleClick(e) {
    e.preventDefault();
    this.reader.zoom.toggle();
  }

  getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}