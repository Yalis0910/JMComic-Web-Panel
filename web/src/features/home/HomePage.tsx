import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Flame, Search, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const { quickTags, addRecentSearch } = useAppStore();

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: api.listHistory,
  });

  const { data: promote, isLoading: promoteLoading, error: promoteError } = useQuery({
    queryKey: ['promote', 1],
    queryFn: () => api.getPromote(1),
    staleTime: 5 * 60 * 1000,
  });

  const { data: latest } = useQuery({
    queryKey: ['latest', 1],
    queryFn: () => api.getLatest(1),
    staleTime: 5 * 60 * 1000,
  });

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keyword.trim();
    if (!clean) return;
    addRecentSearch(clean);
    navigate(`/search?q=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="space-y-7">
      {/* iOS 大标题与搜索框 */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h1 className="text-[34px] font-bold tracking-tight leading-tight">探索</h1>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="text-[14px] font-medium flex items-center gap-0.5 cursor-pointer"
            style={{ color: 'var(--ios-blue)' }}
          >
            排行与分类 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSearchSubmit} className="relative">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ios-label-secondary)' }}
          />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索漫画名、车号、作者、标签..."
            className="w-full rounded-[12px] pl-10 pr-4 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
          />
        </form>

        {/* 快速标签 */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}&type=tag`)}
              className="shrink-0 px-3 py-1 rounded-full text-[13px] font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--ios-bg-secondary)',
                border: '0.5px solid var(--ios-separator)',
                color: 'var(--ios-label-primary)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 继续阅读 */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-semibold tracking-tight">继续阅读</h2>
            <button
              type="button"
              onClick={() => navigate('/favorites?tab=history')}
              className="text-[13px] font-medium cursor-pointer"
              style={{ color: 'var(--ios-blue)' }}
            >
              全部记录
            </button>
          </div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1">
            {history.slice(0, 10).map((item) => {
              const pct = item.total_pages
                ? Math.min(100, Math.round(((item.page_index + 1) / item.total_pages) * 100))
                : 0;
              return (
                <button
                  key={item.album_id}
                  type="button"
                  onClick={() =>
                    navigate(`/read/online/${item.album_id}/${item.photo_id}?page=${item.page_index}`)
                  }
                  className="w-36 shrink-0 text-left flex flex-col gap-1.5 cursor-pointer group"
                >
                  <div
                    className="relative aspect-[3/4] w-full rounded-[14px] overflow-hidden"
                    style={{
                      backgroundColor: 'var(--ios-fill-tertiary)',
                      border: '0.5px solid var(--ios-separator)',
                    }}
                  >
                    <img
                      src={item.cover_url || `/api/v2/media/cover/${item.album_id}`}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: 'var(--ios-blue)' }} />
                    </div>
                  </div>
                  <div className="text-[13px] font-medium line-clamp-1">{item.title || `JM${item.album_id}`}</div>
                  <div className="text-[11px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
                    第 {item.page_index + 1} / {item.total_pages || '?'} 页
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 首页精选推荐分区 */}
      {promoteLoading && (
        <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
          正在加载首页推荐...
        </div>
      )}

      {promoteError && (
        <div className="ios-card p-6 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
          推荐流加载失败：{(promoteError as Error).message}（可在设置页检查域名或代理）
        </div>
      )}

      {promote?.sections.map((sec) => (
        <section key={sec.id || sec.title} className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--ios-orange)' }} />
            <h2 className="text-[20px] font-semibold tracking-tight">{sec.title}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {sec.albums.slice(0, 10).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      ))}

      {/* 最新更新 */}
      {latest && latest.albums.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: 'var(--ios-pink)' }} />
            <h2 className="text-[20px] font-semibold tracking-tight">最新更新</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {latest.albums.slice(0, 15).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
