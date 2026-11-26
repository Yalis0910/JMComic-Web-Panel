import React, { useEffect, useState } from 'react';
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
  { to: '/', label: '探索精选', icon: Compass, end: true },
  { to: '/explore', label: '排行与分类', icon: LayoutGrid },
  { to: '/search', label: '全站搜索', icon: Search },
  { to: '/library', label: '本地书库', icon: HardDrive },
  { to: '/downloads', label: '下载队列', icon: Download },
  { to: '/favorites', label: '收藏与记录', icon: FolderHeart },
  { to: '/settings', label: '系统设置', icon: Settings },
];

const MOBILE_TABS = [
  { to: '/', label: '探索', icon: Compass, end: true },
  { to: '/explore', label: '分类', icon: LayoutGrid },
  { to: '/library', label: '书库', icon: HardDrive },
  { to: '/downloads', label: '下载', icon: Download },
  { to: '/favorites', label: '我的', icon: FolderHeart },
];

function BrandLogo({ size = 34 }: { size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="rounded-[10px] flex items-center justify-center text-white font-bold shadow-sm shrink-0"
        style={{ width: size, height: size, background: 'var(--brand-gradient)' }}
      >
        JL
      </div>
    );
  }
  return (
    <img
      src="/icon.png"
      alt="JMlis"
      onError={() => setErr(true)}
      className="rounded-[10px] object-cover shadow-sm shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

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
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

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
      {/* 桌面端现代磨砂侧边栏 */}
      <aside
        className="hidden md:flex md:w-[252px] md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen ios-vibrancy z-30"
        style={{ borderRight: '1px solid var(--ios-separator)' }}
      >
        <div className="px-4 pt-5 pb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <BrandLogo size={36} />
            <div>
              <div className="text-[19px] font-bold tracking-tight leading-none flex items-center gap-1.5">
                JMlis
              </div>
              <div className="text-[11px] mt-1 font-medium" style={{ color: 'var(--ios-label-secondary)' }}>
                私有漫画画廊
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={toggleDark}
            aria-label="切换主题"
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--ios-fill-tertiary)',
              border: '1px solid var(--ios-separator)',
              color: 'var(--ios-label-primary)',
            }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* 快捷搜索触发条 */}
        <div className="px-3.5 pb-3">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-[12px] text-[13px] cursor-pointer transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--ios-fill-tertiary)',
              border: '1px solid var(--ios-separator)',
              color: 'var(--ios-label-secondary)',
            }}
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>搜索作品 / 车号</span>
            </span>
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-separator)' }}
            >
              Ctrl K
            </kbd>
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
                className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[14.5px] font-medium transition-all duration-150"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--ios-blue)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--ios-label-primary)',
                  boxShadow: isActive ? '0 6px 18px -6px rgba(79, 70, 229, 0.65)' : 'none',
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

        <div className="p-3.5 ios-hairline-t">
          <button
            type="button"
            onClick={() => navigate('/favorites')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] text-left cursor-pointer transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--ios-bg-secondary)',
              border: '1px solid var(--ios-separator)',
              boxShadow: 'var(--ios-shadow-sm)',
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13.5px] font-bold text-white shrink-0"
              style={{
                background: userStatus?.is_logged_in ? 'var(--brand-gradient)' : 'var(--ios-label-tertiary)',
              }}
            >
              {(userStatus?.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold truncate">
                {userStatus?.is_logged_in ? userStatus.username : '登录 JM 账号'}
              </div>
              <div className="text-[11px] truncate" style={{ color: 'var(--ios-label-secondary)' }}>
                {userStatus?.is_logged_in
                  ? String(userStatus.profile?.level_name || '已连接云端收藏')
                  : '同步云端收藏与签到'}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex-1 min-w-0 flex flex-col pb-24 md:pb-12">
        {/* 移动端磨砂顶栏 */}
        <header className="md:hidden sticky top-0 z-20 ios-vibrancy ios-hairline-b px-4 h-14 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer">
            <BrandLogo size={28} />
            <span className="text-[17px] font-bold tracking-tight">JMlis</span>
          </button>
          <div className="flex items-center gap-2">
            {location.pathname !== '/search' && (
              <button
                type="button"
                onClick={() => navigate('/search')}
                aria-label="搜索"
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleDark}
              aria-label="切换主题"
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="设置"
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="w-full max-w-6xl mx-auto px-4 sm:px-7 pt-5 sm:pt-7 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* 移动端磨砂底部 Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 ios-vibrancy ios-hairline-t flex items-center justify-around pt-1.5 safe-bottom">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10.5px] font-medium"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ios-blue)' : 'var(--ios-label-secondary)',
              })}
            >
              <Icon className="w-[21px] h-[21px]" strokeWidth={2} />
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

      {/* 顶部悬浮胶囊 Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div
            className="ios-vibrancy px-4 py-2.5 rounded-full text-[13.5px] font-medium flex items-center gap-2 animate-fade-in"
            style={{
              border: '1px solid var(--ios-separator)',
              boxShadow: 'var(--ios-shadow-md)',
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
