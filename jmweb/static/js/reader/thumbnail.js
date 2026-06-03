class ThumbnailPanel {
  constructor(reader) {
    this.reader = reader;
    this.panel = DOM.$('#reader-thumbnail-panel');
    this.grid = DOM.$('#reader-thumbnail-grid');
    this.items = [];
    this.activeIndex = -1;
    this.bindEvents();
  }

  bindEvents() {
    DOM.$('#reader-btn-close-thumbnails').addEventListener('click', () => this.hide());
  }

  generate(urls) {
    this.clear();
    urls.forEach((url, index) => {
      const item = DOM.create('div', {
        className: 'thumbnail-item',
        dataset: { index }
      });
      const img = DOM.create('img', {
        attributes: { src: url, alt: `Page ${index + 1}`, loading: 'lazy', width: '200', height: '300' }
      });
      const number = DOM.create('span', {
        className: 'thumbnail-number',
        textContent: index + 1
      });
      item.appendChild(img);
      item.appendChild(number);
      item.addEventListener('click', () => {
        this.reader.goTo(index);
        this.hide();
      });
      this.grid.appendChild(item);
      this.items.push(item);
    });
  }

  setActive(index) {
    if (this.activeIndex >= 0 && this.items[this.activeIndex]) {
      DOM.removeClass(this.items[this.activeIndex], 'active');
    }
    this.activeIndex = index;
    if (this.items[index]) {
      DOM.addClass(this.items[index], 'active');
      this.items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  show() { DOM.show(this.panel); }
  hide() { DOM.hide(this.panel); }

  toggle() {
    DOM.hasClass(this.panel, 'hidden') ? this.show() : this.hide();
  }

  clear() {
    this.grid.innerHTML = '';
    this.items = [];
    this.activeIndex = -1;
  }

  isVisible() { return !DOM.hasClass(this.panel, 'hidden'); }
}