import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { api, getPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { LiquidGlass } from './LiquidGlass';

const DESKTOP_NAV = [
  { to: '/', label: '探索', icon: Compass, end: true },
  { to: '/explore', label: '排行分类', icon: LayoutGrid },
  { to: '/library', label: '本地书库', icon: HardDrive },
  { to: '/downloads', label: '下载队列', icon: Download },
  { to: '/favorites', label: '我的收藏', icon: FolderHeart },
];

const MOBILE_TABS = [
  { to: '/', label: '探索', icon: Compass, end: true },
  { to: '/explore', label: '分类', icon: LayoutGrid },
  { to: '/library', label: '书库', icon: HardDrive },
  { to: '/downloads', label: '下载', icon: Download },
  { to: '/favorites', label: '我的', icon: FolderHeart },
];

function BrandLogo({ size = 32 }: { size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 text-[12px]"
        style={{ width: size, height: size, backgroundColor: 'var(--liquid-scene)' }}
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
      className="rounded-full object-cover shrink-0 ring-1 ring-white/30"
      style={{ width: size, height: size }}
    />
  );
}

function QuickSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { recentSearches, quickTags, addRecentSearch } = useAppStore();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setQ('');
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const go = (keyword: string, type = 'all') => {
    const clean = keyword.trim();
    if (!clean) return;
    addRecentSearch(clean);
    onClose();
    navigate(`/search?q=${encodeURIComponent(clean)}&type=${type}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/35 backdrop-blur-xs"
      onClick={onClose}
    >
      <div className="w-full max-w-xl animate-liquid-in" onClick={(e) => e.stopPropagation()}>
        <LiquidGlass variant="tinted" radius={28} className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(q);
            }}
            className="flex items-center gap-2.5 pb-3 liquid-hairline-b"
          >
            <Search className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--liquid-accent)' }} />
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索作品标题、JM 车号、作者或 +包含 -排除..."
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:opacity-60"
              style={{ color: 'var(--liquid-ink)' }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭搜索"
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3.5 space-y-3.5">
            {recentSearches.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--liquid-muted)' }}>
                  最近搜索
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.slice(0, 8).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => go(item)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12.5px] font-medium cursor-pointer liquid-tactile"
                      style={{
                        backgroundColor: 'var(--liquid-solid)',
                        border: '1px solid var(--liquid-separator)',
                        color: 'var(--liquid-ink)',
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--liquid-muted)' }}>
                热门标签
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => go(tag, 'tag')}
                    className="min-h-[32px] px-3 py-1 rounded-full text-[12.5px] font-medium cursor-pointer liquid-tactile"
                    style={{
                      backgroundColor: 'var(--liquid-focus-soft)',
                      color: 'var(--liquid-accent)',
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[12px]" style={{ color: 'var(--liquid-muted)' }}>
              <span>回车直接全站检索，或前往高级筛选页</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/search');
                }}
                className="font-semibold cursor-pointer"
                style={{ color: 'var(--liquid-accent)' }}
              >
                打开搜索页 →
              </button>
            </div>
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}

export function LiquidLayout() {
  const { theme, setTheme, toast } = useAppStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [activePill, setActivePill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

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

  const activeNavIdx = DESKTOP_NAV.findIndex((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  useLayoutEffect(() => {
    const updatePill = () => {
      if (activeNavIdx < 0) {
        setActivePill({ left: 0, width: 0 });
        return;
      }
      const el = navItemRefs.current[activeNavIdx];
      if (!el) return;
      setActivePill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [activeNavIdx, location.pathname, runningCount]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    <div className="min-h-screen liquid-canvas-backdrop flex flex-col">
      {/* 桌面端悬浮液态玻璃胶囊顶栏 (Floating Glass Navigation Dock) */}
      <div className="hidden md:block sticky top-4 z-30 px-6 pointer-events-none">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex-1 flex items-center justify-between gap-3">
            <LiquidGlass variant="clear" radius={999} bezelWidth={16} refraction={14} className="w-full px-3 py-1.5">
              <div className="flex items-center justify-between gap-2 min-h-[48px]">
                {/* Brand */}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full cursor-pointer liquid-tactile liquid-focus-ring shrink-0"
                >
                  <BrandLogo size={32} />
                  <span className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--liquid-ink)' }}>
                    JMlis
                  </span>
                </button>

                {/* Primary Floating Nav Pills with Spring Sliding Thumb */}
                <nav aria-label="主导航" className="relative flex items-center gap-0.5">
                  {activePill.width > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 rounded-full pointer-events-none"
                      style={{
                        left: activePill.left,
                        width: activePill.width,
                        backgroundColor: 'var(--liquid-solid-elevated)',
                        boxShadow: '0 4px 14px rgba(19, 37, 41, 0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
                        transition: 'left var(--liquid-release), width var(--liquid-release)',
                      }}
                    />
                  )}
                  {DESKTOP_NAV.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        ref={(el) => {
                          navItemRefs.current[idx] = el;
                        }}
                        to={item.to}
                        end={item.end}
                        className="relative z-10 min-h-[40px] px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 text-[13.5px] font-medium whitespace-nowrap liquid-focus-ring liquid-tactile"
                        style={({ isActive }) => ({
                          color: isActive ? 'var(--liquid-ink)' : 'var(--liquid-muted)',
                          fontWeight: isActive ? 600 : 500,
                        })}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.9} />
                        <span>{item.label}</span>
                        {item.to === '/downloads' && runningCount > 0 && (
                          <span
                            className="px-1.5 py-0.5 text-[10.5px] rounded-full text-white tabular-nums font-semibold"
                            style={{ backgroundColor: 'var(--liquid-accent)' }}
                          >
                            {runningCount}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>

                {/* Right Utilities: Search Pill, Theme, Settings, Account */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuickSearchOpen(true)}
                    className="min-h-[38px] px-3 rounded-full inline-flex items-center gap-2 text-[12.5px] cursor-pointer liquid-tactile liquid-focus-ring"
                    style={{
                      backgroundColor: 'var(--liquid-fill-soft)',
                      border: '1px solid var(--liquid-separator)',
                      color: 'var(--liquid-muted)',
                    }}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">搜索</span>
                    <kbd
                      className="hidden xl:inline px-1.5 py-0.5 rounded text-[10px] font-mono"
                      style={{ backgroundColor: 'var(--liquid-solid)', color: 'var(--liquid-ink)' }}
                    >
                      Ctrl K
                    </kbd>
                  </button>

                  <button
                    type="button"
                    onClick={toggleDark}
                    aria-label="切换深浅主题"
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                    style={{
                      backgroundColor: 'var(--liquid-fill-soft)',
                      border: '1px solid var(--liquid-separator)',
                      color: 'var(--liquid-ink)',
                    }}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>

                  <NavLink
                    to="/settings"
                    aria-label="系统设置"
                    className="w-9 h-9 rounded-full flex items-center justify-center liquid-tactile liquid-focus-ring"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'var(--liquid-solid-elevated)' : 'var(--liquid-fill-soft)',
                      border: '1px solid var(--liquid-separator)',
                      color: isActive ? 'var(--liquid-accent)' : 'var(--liquid-ink)',
                    })}
                  >
                    <Settings className="w-4 h-4" />
                  </NavLink>

                  <button
                    type="button"
                    onClick={() => navigate('/favorites')}
                    title={userStatus?.is_logged_in ? userStatus.username : '登录 JM 账号'}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold text-white cursor-pointer liquid-tactile liquid-focus-ring"
                    style={{
                      backgroundColor: userStatus?.is_logged_in ? 'var(--liquid-scene)' : 'var(--liquid-focus)',
                    }}
                  >
                    {userStatus?.is_logged_in ? (userStatus.username || 'J').slice(0, 1).toUpperCase() : '登'}
                  </button>
                </div>
              </div>
            </LiquidGlass>
          </div>
        </div>
      </div>

      {/* 移动端悬浮顶部小胶囊栏 */}
      <header className="md:hidden sticky top-3 z-30 px-3 pointer-events-none">
        <div className="pointer-events-auto">
          <LiquidGlass variant="clear" radius={999} bezelWidth={14} refraction={12} className="px-3 py-1.5">
            <div className="flex items-center justify-between min-h-[44px]">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 cursor-pointer liquid-tactile liquid-focus-ring"
              >
                <BrandLogo size={28} />
                <span className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--liquid-ink)' }}>
                  JMlis
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickSearchOpen(true)}
                  aria-label="搜索"
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-ink)' }}
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleDark}
                  aria-label="切换主题"
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-ink)' }}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  aria-label="设置"
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-ink)' }}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </LiquidGlass>
        </div>
      </header>

      {/* 主内容画布 (max-width: 1120px) */}
      <main className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-8 pt-6 sm:pt-8 pb-28 md:pb-16 flex-1 animate-liquid-in">
        <Outlet />
      </main>

      {/* 移动端底部悬浮液态玻璃胶囊导航栏 */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto">
          <LiquidGlass variant="clear" radius={999} bezelWidth={16} refraction={14} draggable className="px-2 py-1.5">
            <nav aria-label="移动端底部导航" className="flex items-center justify-around">
              {MOBILE_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className="relative min-w-[54px] min-h-[46px] flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-full text-[11px] font-medium liquid-tactile liquid-focus-ring"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'var(--liquid-solid-elevated)' : 'transparent',
                      color: isActive ? 'var(--liquid-ink)' : 'var(--liquid-muted)',
                      boxShadow: isActive ? '0 4px 12px rgba(19, 37, 41, 0.12)' : 'none',
                    })}
                  >
                    <Icon className="w-[19px] h-[19px]" strokeWidth={1.9} />
                    <span>{tab.label}</span>
                    {tab.to === '/downloads' && runningCount > 0 && (
                      <span
                        className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] text-white flex items-center justify-center tabular-nums font-semibold"
                        style={{ backgroundColor: 'var(--liquid-accent)' }}
                      >
                        {runningCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </LiquidGlass>
        </div>
      </div>

      {/* 顶部悬浮着色玻璃胶囊 Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-liquid-in">
          <LiquidGlass variant="tinted" radius={999} className="px-5 py-2.5">
            <span
              className="text-[13.5px] font-medium"
              style={{
                color:
                  toast.tone === 'error'
                    ? 'var(--liquid-danger)'
                    : toast.tone === 'success'
                      ? 'var(--liquid-success)'
                      : 'var(--liquid-ink)',
              }}
            >
              {toast.message}
            </span>
          </LiquidGlass>
        </div>
      )}

      <QuickSearchModal open={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />
    </div>
  );
}
