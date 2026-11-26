import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Compass,
  Download,
  FolderHeart,
  HardDrive,
  LayoutGrid,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { api, getPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';

const NAV_ITEMS = [
  { to: '/', label: '探索', icon: Compass, end: true },
  { to: '/explore', label: '分类', icon: LayoutGrid },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/library', label: '书库', icon: HardDrive },
  { to: '/downloads', label: '下载', icon: Download },
  { to: '/favorites', label: '我的', icon: FolderHeart },
  { to: '/settings', label: '设置', icon: Settings },
];

const MOBILE_TABS = [
  { to: '/', label: '探索', icon: Compass, end: true },
  { to: '/explore', label: '分类', icon: LayoutGrid },
  { to: '/library', label: '书库', icon: HardDrive },
  { to: '/downloads', label: '下载', icon: Download },
  { to: '/favorites', label: '我的', icon: FolderHeart },
];

export function IosLayout() {
  const { theme, setTheme, toast } = useAppStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: downloads = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: api.listDownloads,
    refetchInterval: false,
  });

  const { data: userStatus } = useQuery({
    queryKey: ['userStatus'],
    queryFn: api.getUserStatus,
  });

  const runningCount = downloads.filter((d) => d.status === 'running').length;

  useEffect(() => {
    const token = getPanelToken();
    const url = token ? `/api/v2/download/events?token=${encodeURIComponent(token)}` : '/api/v2/download/events';
    const es = new EventSource(url);
    es.addEventListener('snapshot', (e) => {
      try {
        queryClient.setQueryData(['downloads'], JSON.parse((e as MessageEvent).data));
      } catch {}
    });
    es.addEventListener('task_update', (e) => {
      try {
        const updated = JSON.parse((e as MessageEvent).data);
        queryClient.setQueryData(['downloads'], (old: any[] | undefined) => {
          const list = old ? [...old] : [];
          const idx = list.findIndex((t) => t.task_id === updated.task_id);
          if (idx >= 0) list[idx] = updated;
          else list.unshift(updated);
          return list;
        });
        if (updated.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['library'] });
        }
      } catch {}
    });
    es.addEventListener('task_deleted', (e) => {
      try {
        const { task_id } = JSON.parse((e as MessageEvent).data);
        queryClient.setQueryData(['downloads'], (old: any[] | undefined) =>
          (old || []).filter((t) => t.task_id !== task_id)
        );
      } catch {}
    });
    es.addEventListener('tasks_cleared', () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
    });
    return () => es.close();
  }, [queryClient]);

  const toggleDark = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* iPadOS / macOS 磨砂侧边栏 */}
      <aside
        className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen ios-vibrancy z-30"
        style={{ borderRight: '0.5px solid var(--ios-separator)' }}
      >
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div>
            <div className="text-[20px] font-bold tracking-tight">JMComic</div>
            <div className="text-[11px]" style={{ color: 'var(--ios-label-secondary)' }}>
              本地私有漫画库
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            aria-label="切换主题"
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)', color: 'var(--ios-label-primary)' }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-[11px] text-[15px] font-medium transition-all duration-150 ${
                    isActive ? 'text-white shadow-xs' : 'hover:opacity-80'
                  }`
                }
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--ios-blue)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--ios-label-primary)',
                })}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  {item.label}
                </span>
                {item.to === '/downloads' && runningCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-white/25 tabular-nums font-semibold">
                    {runningCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 ios-hairline-t">
          <button
            type="button"
            onClick={() => navigate('/favorites')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left cursor-pointer"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold text-white shrink-0"
              style={{ backgroundColor: userStatus?.is_logged_in ? 'var(--ios-blue)' : 'var(--ios-label-tertiary)' }}
            >
              {(userStatus?.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">
                {userStatus?.is_logged_in ? userStatus.username : '未登录 JM 账号'}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ios-label-secondary)' }}>
                {userStatus?.is_logged_in ? '点击管理收藏' : '点击登录同步收藏'}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex-1 min-w-0 flex flex-col pb-24 md:pb-10">
        {/* 移动端顶部工具条 */}
        <header
          className="md:hidden sticky top-0 z-20 ios-vibrancy ios-hairline-b px-4 h-12 flex items-center justify-between"
        >
          <span className="text-[16px] font-semibold">JMComic</span>
          <div className="flex items-center gap-2">
            {location.pathname !== '/search' && (
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-7">
          <Outlet />
        </main>
      </div>

      {/* 移动端 iOS 磨砂底部 Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 ios-vibrancy ios-hairline-t flex items-center justify-around pt-1.5 safe-bottom"
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-medium"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ios-blue)' : 'var(--ios-label-secondary)',
              })}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.9} />
              <span>{tab.label}</span>
              {tab.to === '/downloads' && runningCount > 0 && (
                <span
                  className="absolute top-0 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] text-white flex items-center justify-center tabular-nums"
                  style={{ backgroundColor: 'var(--ios-red)' }}
                >
                  {runningCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* iOS 顶部悬浮胶囊 Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div
            className="ios-vibrancy px-4 py-2.5 rounded-full shadow-lg text-[13.5px] font-medium flex items-center gap-2"
            style={{
              border: '0.5px solid var(--ios-separator)',
              color:
                toast.tone === 'error'
                  ? 'var(--ios-red)'
                  : toast.tone === 'success'
                    ? 'var(--ios-green)'
                    : 'var(--ios-label-primary)',
            }}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
