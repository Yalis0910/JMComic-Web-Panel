import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Clock, Flame, Search, Sparkles } from 'lucide-react';
import { api, type AlbumSummary } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { CoverImage } from '../../components/ios/CoverImage';
import { SkeletonCardGrid, SkeletonHero } from '../../components/ios/IosControls';

function HeroSpotlight({ albums }: { albums: AlbumSummary[] }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const featured = useMemo(() => albums.slice(0, 6), [albums]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % featured.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [featured.length]);

  if (!featured.length) return null;
  const active = featured[idx % featured.length];

  return (
    <section
      className="relative overflow-hidden rounded-[22px]"
      style={{
        backgroundColor: 'var(--ios-bg-secondary)',
        border: '1px solid var(--ios-separator)',
        boxShadow: 'var(--ios-shadow-md)',
      }}
    >
      {/* 氛围高斯模糊背景 */}
      <div
        className="absolute inset-0 scale-125 blur-3xl opacity-30 dark:opacity-35 pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `url(${active.cover_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, var(--ios-bg-secondary) 8%, rgba(79,70,229,0.06) 55%, transparent 100%)',
        }}
      />

      <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/album/${active.album_id}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate(`/album/${active.album_id}`);
          }}
          className="relative w-36 sm:w-44 aspect-[3/4] rounded-[16px] overflow-hidden shrink-0 shadow-xl cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
          style={{ border: '1px solid rgba(255,255,255,0.22)' }}
        >
          <CoverImage src={active.cover_url} alt={active.title} loading="eager" className="absolute inset-0" />
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
            style={{ backgroundColor: 'var(--ios-accent-soft)', color: 'var(--ios-blue)' }}>
            <Sparkles className="w-3.5 h-3.5" /> 本期精选焦点 · JM{active.album_id}
          </div>

          <h2 className="text-[20px] sm:text-[26px] font-bold leading-snug line-clamp-2">
            {active.title}
          </h2>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[12.5px]"
            style={{ color: 'var(--ios-label-secondary)' }}>
            {active.author && <span className="font-medium">作者：{active.author}</span>}
            {active.category && (
              <span
                className="px-2 py-0.5 rounded-full text-[11.5px]"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
              >
                {active.category}
              </span>
            )}
            {active.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[11.5px]"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate(`/album/${active.album_id}`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-semibold text-white cursor-pointer transition-transform active:scale-95"
                style={{
                  background: 'var(--brand-gradient)',
                  boxShadow: '0 8px 20px -6px rgba(79, 70, 229, 0.55)',
                }}
              >
                <BookOpen className="w-4 h-4" /> 查看详情与阅读
              </button>
            </div>

            {featured.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="上一条"
                  onClick={() => setIdx((i) => (i - 1 + featured.length) % featured.length)}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {featured.map((f, i) => (
                    <button
                      key={f.album_id}
                      type="button"
                      aria-label={`切换到第 ${i + 1} 条`}
                      onClick={() => setIdx(i)}
                      className="h-1.5 rounded-full transition-all cursor-pointer"
                      style={{
                        width: i === idx ? '18px' : '6px',
                        backgroundColor: i === idx ? 'var(--ios-blue)' : 'var(--ios-fill-primary)',
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="下一条"
                  onClick={() => setIdx((i) => (i + 1) % featured.length)}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const { quickTags, addRecentSearch } = useAppStore();

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

  const heroAlbums = promote?.sections?.[0]?.albums || latest?.albums || [];

  return (
    <div className="space-y-8">
      {/* 顶部标题与搜索框 */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ios-blue)' }}>
              DISCOVER · JMLIS
            </p>
            <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight leading-tight">探索精选</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--ios-accent-soft)',
              color: 'var(--ios-blue)',
            }}
          >
            排行与分类 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSearchSubmit} className="relative flex gap-2">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ios-label-secondary)' }}
            />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索漫画标题、JM 车号、作者或标签..."
              className="w-full rounded-[14px] pl-11 pr-4 py-3 text-[14.5px] outline-none transition-shadow focus:ring-2 focus:ring-[var(--ios-blue)]/30"
              style={{
                backgroundColor: 'var(--ios-bg-secondary)',
                border: '1px solid var(--ios-separator)',
                boxShadow: 'var(--ios-shadow-sm)',
              }}
            />
          </div>
          <button
            type="submit"
            className="hidden sm:inline-flex items-center px-5 rounded-[14px] text-[14px] font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--ios-blue)' }}
          >
            搜索
          </button>
        </form>

        {/* 快速标签 */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}&type=tag`)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium cursor-pointer transition-all hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--ios-bg-secondary)',
                border: '1px solid var(--ios-separator)',
                boxShadow: 'var(--ios-shadow-sm)',
                color: 'var(--ios-label-primary)',
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Hero 焦点精选 */}
      {promoteLoading ? <SkeletonHero /> : <HeroSpotlight albums={heroAlbums} />}

      {/* 继续阅读 */}
      {history.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--ios-blue)' }} />
              <h2 className="text-[19px] font-bold tracking-tight">继续阅读</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/favorites?tab=history')}
              className="text-[13px] font-semibold cursor-pointer"
              style={{ color: 'var(--ios-blue)' }}
            >
              全部记录
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
                  className="w-36 shrink-0 text-left rounded-[16px] p-2 card-lift cursor-pointer group flex flex-col gap-2"
                  style={{
                    backgroundColor: 'var(--ios-bg-secondary)',
                    border: '1px solid var(--ios-separator)',
                    boxShadow: 'var(--ios-shadow-sm)',
                  }}
                >
                  <div className="relative aspect-[3/4] w-full rounded-[12px] overflow-hidden">
                    <CoverImage
                      src={item.cover_url || `/api/v2/media/cover/${item.album_id}`}
                      alt={item.title}
                      fallbackTitle={item.title || `JM${item.album_id}`}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/45">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--ios-blue)' }} />
                    </div>
                  </div>
                  <div className="px-0.5">
                    <div className="text-[13px] font-semibold line-clamp-1">
                      {item.title || `JM${item.album_id}`}
                    </div>
                    <div className="text-[11px] tabular-nums mt-0.5" style={{ color: 'var(--ios-label-secondary)' }}>
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
        <div className="ios-card p-6 text-center space-y-3">
          <p className="text-[14px]" style={{ color: 'var(--ios-red)' }}>
            推荐流加载失败：{(promoteError as Error).message}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-full text-[13px] font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--ios-blue)' }}
          >
            重新加载
          </button>
        </div>
      )}

      {/* 首页精选推荐分区 */}
      {promote?.sections.map((sec) => (
        <section key={sec.id || sec.title} className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--ios-orange)' }} />
              <h2 className="text-[19px] font-bold tracking-tight">{sec.title}</h2>
            </div>
            <span className="text-[12px] font-medium" style={{ color: 'var(--ios-label-secondary)' }}>
              {sec.albums.length} 部作品
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sec.albums.slice(0, 10).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      ))}

      {/* 最新更新 */}
      {latest && latest.albums.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: 'var(--ios-pink)' }} />
            <h2 className="text-[19px] font-bold tracking-tight">最新更新</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {latest.albums.slice(0, 15).map((album) => (
              <ComicCard key={album.album_id} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
