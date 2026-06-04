const ReaderConfig = {
  get lazyLoad() {
    return {
      rootMargin: localStorage.getItem('reader_rootMargin') || '1500px',
      threshold: 0.01,
    };
  },
  get preload() {
    return {
      count: parseInt(localStorage.getItem('reader_preloadCount')) || 8,
    };
  },
  zoom: {
    min: 0.5,
    max: 3,
    step: 0.25,
    default: 1,
  },
  toolbar: {
    autoHide: true,
    hideDelay: 3000,
  },
};