import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChevronRight, Clock, Flame, Search, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/liquid/ComicCard';
import { CoverImage } from '../../components/liquid/CoverImage';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { SkeletonCardGrid } from '../../components/liquid/LiquidControls';

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const { quickTags, addRecentSearch, showCovers } = useAppStore();

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: api.listHistory,
  });

  const { data: promote, isLoading: promoteLoading, error: promoteError, refetch } = useQuery({
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

  const featuredAlbum = promote?.sections?.[0]?.albums?.[0];
  const latestResume = history[0];

  return (
    <div className="space-y-12">
      {/* Deep Sea Scenic Hero Stage — Clear Glass Controls over Textured Scene */}
      <section className="relative overflow-hidden rounded-[28px] liquid-scene-stage text-white p-6 sm:p-9 shadow-[0_20px_50px_-20px_rgba(19,37,41,0.45)]">
        {showCovers && featuredAlbum?.cover_url && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-25 scale-110 blur-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${featuredAlbum.cover_url})` }}
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(125deg, rgba(23, 43, 50, 0.88) 12%, rgba(37, 65, 74, 0.56) 65%, rgba(37, 65, 74, 0.78) 100%)',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-[0.06em] text-[#C7E4E5]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.36)',
                }}
              >
                DISCOVER · JMLIS
              </span>
              {featuredAlbum && (
                <span className="text-[12px] text-white/70 truncate">
                  当期精选：{featuredAlbum.title}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-[32px] sm:text-[42px] font-medium tracking-[-0.035em] leading-[1.12]">
                探索精选画廊
              </h1>
              <p className="text-[14.5px] text-white/75 max-w-xl leading-relaxed">
                在清晰、克制的阅读画布上浏览精选漫画与本地归档，悬浮玻璃控件随手势响应。
              </p>
            </div>

            {/* Glass Search Field */}
            <form onSubmit={onSearchSubmit} className="max-w-2xl">
              <LiquidGlass variant="clear" tone="dark" radius={999} bezelWidth={14} refraction={12} className="p-1.5">
                <div className="flex items-center gap-2 pl-3 pr-1">
                  <Search className="w-4 h-4 text-white/75 shrink-0" />
                  <input
                    type="search"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="搜索漫画标题、JM 车号、作者或标签..."
                    className="flex-1 min-h-[42px] bg-transparent text-[14.5px] text-white placeholder:text-[#d5e0e0]/75 outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-5 rounded-full text-[13.5px] font-semibold cursor-pointer liquid-tactile liquid-focus-ring shrink-0"
                    style={{
                      backgroundColor: 'rgba(228, 239, 235, 0.92)',
                      color: '#202929',
                    }}
                  >
                    搜索
                  </button>
                </div>
              </LiquidGlass>
            </form>

            {/* Clear Glass Quick Tags */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}&type=tag`)}
                  className="shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-white/95 cursor-pointer liquid-tactile liquid-focus-ring backdrop-blur-md"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 1px 0 rgba(255,255,255,0.45)',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Right Action Capsules over Scene */}
          <div className="flex flex-wrap lg:flex-col items-stretch sm:items-end gap-2.5 shrink-0">
            {latestResume && (
              <LiquidGlass variant="clear" tone="dark" radius={999} interactive className="inline-block">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/read/online/${latestResume.album_id}/${latestResume.photo_id}?page=${latestResume.page_index}`
                    )
                  }
                  className="min-h-[46px] px-5 py-2.5 rounded-full inline-flex items-center gap-2 text-[13.5px] font-semibold text-white cursor-pointer liquid-focus-ring"
                >
                  <BookOpen className="w-4 h-4 text-[#C7E4E5]" />
                  <span>继续第 {latestResume.page_index + 1} 页</span>
                </button>
              </LiquidGlass>
            )}
            <LiquidGlass variant="clear" tone="dark" radius={999} interactive className="inline-block">
              <button
                type="button"
                onClick={() => navigate('/explore')}
                className="min-h-[46px] px-5 py-2.5 rounded-full inline-flex items-center gap-2 text-[13.5px] font-semibold text-white cursor-pointer liquid-focus-ring"
              >
                <span>排行与分类</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </LiquidGlass>
          </div>
        </div>
      </section>

      {/* 继续阅读 Bento Strip (Solid Reading Cards) */}
      {history.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5" style={{ color: 'var(--liquid-accent)' }} />
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">继续阅读</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/favorites?tab=history')}
              className="inline-flex items-center gap-1 text-[13px] font-semibold cursor-pointer liquid-focus-ring rounded-full px-2 py-1"
              style={{ color: 'var(--liquid-accent)' }}
            >
              全部记录 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
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
                  className="w-40 shrink-0 text-left liquid-solid-card liquid-card-hover p-2.5 cursor-pointer group flex flex-col gap-2.5 liquid-focus-ring"
                >
                  <div className="relative aspect-[3/4] w-full rounded-[15px] overflow-hidden">
                    <CoverImage
                      src={item.cover_url || `/api/v2/media/cover/${item.album_id}`}
                      alt={item.title}
                      fallbackTitle={item.title || `JM${item.album_id}`}
                      className="group-hover:scale-[1.04] transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--liquid-ice)' }}
                      />
                    </div>
                  </div>
                  <div className="px-1 pb-0.5">
                    <div className="text-[13px] font-semibold line-clamp-1">
                      {item.title || `JM${item.album_id}`}
                    </div>
                    <div className="text-[11px] tabular-nums mt-0.5" style={{ color: 'var(--liquid-muted)' }}>
                      第 {item.page_index + 1} / {item.total_pages || '?'} 页 · {pct}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 加载与报错 */}
      {promoteLoading && <SkeletonCardGrid count={10} />}

      {promoteError && (
        <div className="liquid-solid-card p-8 text-center space-y-3">
          <p className="text-[14px]" style={{ color: 'var(--liquid-danger)' }}>
            推荐流加载失败：{(promoteError as Error).message}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-[42px] px-5 py-2 rounded-full text-[13.5px] font-semibold text-white cursor-pointer liquid-tactile"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            重新加载
          </button>
        </div>
      )}

      {/* 首页精选推荐分区 */}
      {promote?.sections.map((sec) => (
        <section key={sec.id || sec.title} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5" style={{ color: 'var(--liquid-accent)' }} />
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{sec.title}</h2>
            </div>
            <span className="text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--liquid-muted)' }}>
              {sec.albums.length} 部作品
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {sec.albums.slice(0, 10).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      ))}

      {/* 最新更新 */}
      {latest && latest.albums.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4.5 h-4.5" style={{ color: 'var(--liquid-accent)' }} />
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">最新更新</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {latest.albums.slice(0, 15).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
