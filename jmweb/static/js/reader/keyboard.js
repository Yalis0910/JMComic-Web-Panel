class KeyboardManager {
  constructor(reader) {
    this.reader = reader;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleKeydown(e) {
    const readerPage = DOM.$('#page-reader');
    if (!readerPage || !DOM.hasClass(readerPage, 'active')) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.reader.scrollBy(-100);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.reader.scrollBy(100);
        break;
      case 'PageUp':
        e.preventDefault();
        this.reader.prevPage();
        break;
      case 'PageDown':
      case ' ':
        e.preventDefault();
        this.reader.nextScreen();
        break;
      case 'Home':
        e.preventDefault();
        this.reader.goTo(0);
        break;
      case 'End':
        e.preventDefault();
        this.reader.goTo(this.reader.images.length - 1);
        break;
      case 'f':
      case 'F11':
        e.preventDefault();
        this.reader.toggleFullscreen();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          this.reader.exitReader();
          goBack();
        }
        break;
      case 'Backspace':
        e.preventDefault();
        this.reader.exitReader();
        goBack();
        break;
      case 'q':
        e.preventDefault();
        this.reader.exitReader();
        goBack();
        break;
      case '+':
      case '=':
        e.preventDefault();
        this.reader.zoom.in();
        break;
      case '-':
        e.preventDefault();
        this.reader.zoom.out();
        break;
    }
  }
}