class LazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || ReaderConfig.lazyLoad.rootMargin,
      threshold: options.threshold || ReaderConfig.lazyLoad.threshold,
      preloadCount: options.preloadCount || ReaderConfig.preload.count
    };
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      { rootMargin: this.options.rootMargin, threshold: this.options.threshold }
    );
    // 顺序加载队列
    this.queue = [];
    this.isLoading = false;
    // 所有图片的索引引用，用于预加载
    this.images = [];
  }

  /** 注册一张图片（替代原来的 observe） */
  register(element, src, index) {
    element.dataset.src = src;
    element.dataset.index = index;
    this.images[index] = { element, src };
    this.observer.observe(element);
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      // 已加载或已入列则跳过
      if (element.dataset.loaded || element.dataset.queued) return;
      element.dataset.queued = 'true';
      this.queue.push({
        element,
        src: element.dataset.src,
        index: parseInt(element.dataset.index)
      });
      this.queue.sort((a, b) => a.index - b.index);
      this.processQueue();
      this.observer.unobserve(element);
    });
  }

  /** 按顺序处理队列，同一时间只加载一张 */
  processQueue() {
    if (this.isLoading || this.queue.length === 0) return;
    this.isLoading = true;
    const item = this.queue.shift();
    this.loadImage(item.element, item.src, () => {
      this.isLoading = false;
      // 继续处理队列中剩余的
      this.processQueue();
      // 预加载后续图片
      this.preloadNext(item.index);
    });
  }

  /** 当前图片加载完成后，预加载后续 N 张 */
  preloadNext(currentIndex) {
    const count = this.options.preloadCount;
    let added = 0;
    for (let i = 1; i <= count; i++) {
      const idx = currentIndex + i;
      const img = this.images[idx];
      if (!img || img.element.dataset.loaded || img.element.dataset.queued) continue;
      img.element.dataset.queued = 'true';
      this.queue.push({
        element: img.element,
        src: img.src,
        index: idx
      });
      added++;
    }
    if (added > 0) {
      this.queue.sort((a, b) => a.index - b.index);
      if (!this.isLoading) this.processQueue();
    }
  }

  loadImage(element, src, onComplete) {
    if (element.tagName !== 'IMG') {
      onComplete();
      return;
    }
    const img = new Image();
    img.onload = () => {
      element.src = src;
      element.classList.add('loaded');
      element.dataset.loaded = 'true';
      element.removeAttribute('data-src');
      const placeholder = element.parentElement.querySelector('.image-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      onComplete();
    };
    img.onerror = () => {
      element.classList.add('error');
      element.dataset.loaded = 'error';
      onComplete();
    };
    img.src = src;
  }

  /** 重置状态（切换本子时调用） */
  reset() {
    this.queue = [];
    this.isLoading = false;
    this.images = [];
  }

  disconnect() {
    this.observer.disconnect();
    this.reset();
  }
}