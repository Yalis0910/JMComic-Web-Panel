const DOM = {
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  create(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        element.dataset[key] = value;
      });
    }
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.textContent) element.textContent = options.textContent;
    if (options.children) options.children.forEach(child => element.appendChild(child));
    return element;
  },

  show(element) { element.classList.remove('hidden'); },
  hide(element) { element.classList.add('hidden'); },
  toggle(element, force) { element.classList.toggle('hidden', force); },

  addClass(element, className) { element.classList.add(className); },
  removeClass(element, className) { element.classList.remove(className); },
  hasClass(element, className) { return element.classList.contains(className); },

  showLoading() {
    const overlay = DOM.$('#reader-loading');
    if (overlay) DOM.show(overlay);
  },

  hideLoading() {
    const overlay = DOM.$('#reader-loading');
    if (overlay) DOM.hide(overlay);
  }
};