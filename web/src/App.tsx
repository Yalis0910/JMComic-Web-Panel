import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api/client';
import { useAppStore } from './stores/useAppStore';
import { IosLayout } from './components/ios/IosLayout';
import { PinLockScreen } from './components/ios/PinLockScreen';
import { HomePage } from './features/home/HomePage';
import { ExplorePage } from './features/explore/ExplorePage';
import { SearchPage } from './features/search/SearchPage';
import { AlbumDetailPage } from './features/album/AlbumDetailPage';
import { LibraryPage } from './features/library/LibraryPage';
import { DownloadsPage } from './features/downloads/DownloadsPage';
import { FavoritesPage } from './features/favorites/FavoritesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ReaderPage } from './features/reader/ReaderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => {
        if (err instanceof ApiError && err.status === 401) {
          useAppStore.getState().setPinRequired(true);
          return false;
        }
        return count < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function ThemeWatcher() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [theme]);

  return null;
}

function AppShell() {
  const { pinRequired, setPinRequired } = useAppStore();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
  });

  useEffect(() => {
    if (health?.pin_enabled && !localStorage.getItem('jm_panel_token')) {
      setPinRequired(true);
    }
  }, [health, setPinRequired]);

  if (pinRequired) {
    return (
      <PinLockScreen
        onUnlocked={() => {
          queryClient.invalidateQueries();
        }}
      />
    );
  }

  return (
    <Routes>
      <Route element={<IosLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/album/:id" element={<AlbumDetailPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/read/:source/:albumId/:photoId" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeWatcher />
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
