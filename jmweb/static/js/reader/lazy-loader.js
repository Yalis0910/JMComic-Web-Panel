class LazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || ReaderConfig.lazyLoad.rootMargin,
      threshold: options.threshold || ReaderConfig.lazyLoad.threshold
    };
    this.observer = null;
    this.init();
  }

  init() {
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      { rootMargin: this.options.rootMargin, threshold: this.options.threshold }
    );
  }

  observe(element, src) {
    element.dataset.src = src;
    this.observer.observe(element);
  }

  unobserve(element) {
    this.observer.unobserve(element);
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const src = element.dataset.src;
        if (src) {
          this.loadImage(element, src);
          this.unobserve(element);
        }
      }
    });
  }

  loadImage(element, src) {
    if (element.tagName === 'IMG') {
      const img = new Image();
      img.onload = () => {
        element.src = src;
        element.classList.add('loaded');
        element.removeAttribute('data-src');
        const placeholder = element.parentElement.querySelector('.image-placeholder');
        if (placeholder) placeholder.style.display = 'none';
      };
      img.onerror = () => {
        element.classList.add('error');
      };
      img.src = src;
    }
  }

  disconnect() {
    this.observer.disconnect();
  }
}