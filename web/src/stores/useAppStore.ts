import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ReaderMode = 'vertical' | 'single-ltr' | 'single-rtl' | 'double';

interface ToastState {
  id: number;
  message: string;
  tone: 'default' | 'error' | 'success';
}

interface AppStore {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  readerMode: ReaderMode;
  setReaderMode: (mode: ReaderMode) => void;
  preloadCount: number;
  setPreloadCount: (n: number) => void;
  fitWidth: boolean;
  setFitWidth: (v: boolean) => void;
  showThumbStrip: boolean;
  setShowThumbStrip: (v: boolean) => void;
  showCovers: boolean;
  setShowCovers: (v: boolean) => void;
  pageGap: number;
  setPageGap: (px: number) => void;

  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  removeRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;

  quickTags: string[];
  addQuickTag: (tag: string) => void;
  removeQuickTag: (tag: string) => void;

  pinRequired: boolean;
  setPinRequired: (v: boolean) => void;

  toast: ToastState | null;
  showToast: (message: string, tone?: ToastState['tone']) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      readerMode: 'vertical',
      setReaderMode: (readerMode) => set({ readerMode }),
      preloadCount: 6,
      setPreloadCount: (preloadCount) => set({ preloadCount: Math.max(1, Math.min(20, preloadCount)) }),
      fitWidth: true,
      setFitWidth: (fitWidth) => set({ fitWidth }),
      showThumbStrip: true,
      setShowThumbStrip: (showThumbStrip) => set({ showThumbStrip }),
      showCovers: true,
      setShowCovers: (showCovers) => set({ showCovers }),
      pageGap: 8,
      setPageGap: (pageGap) => set({ pageGap }),

      recentSearches: [],
      addRecentSearch: (q) => {
        const clean = q.trim();
        if (!clean) return;
        const next = [clean, ...get().recentSearches.filter((x) => x !== clean)].slice(0, 16);
        set({ recentSearches: next });
      },
      removeRecentSearch: (q) => set({ recentSearches: get().recentSearches.filter((x) => x !== q) }),
      clearRecentSearches: () => set({ recentSearches: [] }),

      quickTags: ['同人', '單行本', '全彩', '無修正', '中文', '短篇', '韓漫'],
      addQuickTag: (tag) => {
        const clean = tag.trim();
        if (!clean || get().quickTags.includes(clean)) return;
        set({ quickTags: [...get().quickTags, clean] });
      },
      removeQuickTag: (tag) => set({ quickTags: get().quickTags.filter((t) => t !== tag) }),

      pinRequired: false,
      setPinRequired: (pinRequired) => set({ pinRequired }),

      toast: null,
      showToast: (message, tone = 'default') => {
        const id = Date.now();
        set({ toast: { id, message, tone } });
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null });
        }, 2800);
      },
    }),
    {
      name: 'jm-panel-store',
      partialize: (state) => ({
        theme: state.theme,
        readerMode: state.readerMode,
        preloadCount: state.preloadCount,
        fitWidth: state.fitWidth,
        showThumbStrip: state.showThumbStrip,
        showCovers: state.showCovers,
        pageGap: state.pageGap,
        recentSearches: state.recentSearches,
        quickTags: state.quickTags,
      }),
    }
  )
);
