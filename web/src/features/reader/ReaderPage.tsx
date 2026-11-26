import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  RotateCw,
  SlidersHorizontal,
} from 'lucide-react';
import { api, withPanelToken } from '../../api/client';
import { useAppStore, type ReaderMode } from '../../stores/useAppStore';
import { BottomSheet, InsetGroup, InsetRow, IosSwitch, SegmentedControl } from '../../components/ios/IosControls';

interface PageItem {
  index: number;
  url: string;
}

function ComicImage({
  src,
  alt,
  className = '',
  onVisible,
}: {
  src: string;
  alt: string;
  className?: string;
  onVisible?: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus('loading');
  }, [src]);

  useEffect(() => {
    if (!onVisible || !imgRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { threshold: 0.4 }
    );
    obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [onVisible]);

  const effectiveSrc = attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src;

  return (
    <div ref={imgRef} className={`relative flex items-center justify-center min-h-[260px] ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[13px]">
          加载中...
        </div>
      )}
      {status === 'error' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setStatus('loading');
            setAttempt((a) => a + 1);
          }}
          className="px-4 py-2 rounded-full bg-white/15 text-white text-[13px] inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" /> 加载失败，点击重试
        </button>
      ) : (
        <img
          src={effectiveSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className="max-w-full max-h-full select-none object-contain"
        />
      )}
    </div>
  );
}

export function ReaderPage() {
  const { source = 'online', albumId = '', photoId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    readerMode,
    setReaderMode,
    preloadCount,
    setPreloadCount,
    fitWidth,
    setFitWidth,
    showThumbStrip,
    setShowThumbStrip,
    pageGap,
    setPageGap,
  } = useAppStore();

  const startPage = Math.max(0, Number(searchParams.get('page') || 0));
  const [currentIndex, setCurrentIndex] = useState(startPage);
  const [hudVisible, setHudVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const verticalRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const onlineAlbumQuery = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.getAlbum(albumId),
    enabled: source === 'online' && !!albumId,
  });

  const onlinePhotoQuery = useQuery({
    queryKey: ['photo', photoId],
    queryFn: () => api.getPhoto(photoId),
    enabled: source === 'online' && !!photoId,
  });

  const localDetailQuery = useQuery({
    queryKey: ['libraryDetail', albumId],
    queryFn: () => api.getLibraryDetail(albumId),
    enabled: source === 'local' && !!albumId,
  });

  const localChapterQuery = useQuery({
    queryKey: ['libraryChapter', albumId, photoId],
    queryFn: () => api.getLibraryChapter(albumId, photoId),
    enabled: source === 'local' && !!albumId && !!photoId,
  });

  const pages: PageItem[] = useMemo(() => {
    if (source === 'local') {
      return (localChapterQuery.data?.pages || []).map((p) => ({ index: p.index - 1, url: withPanelToken(p.url) }));
    }
    return (onlinePhotoQuery.data?.images || []).map((img, i) => ({ index: i, url: img.proxy_url }));
  }, [source, localChapterQuery.data, onlinePhotoQuery.data]);

  const chapters = useMemo(() => {
    if (source === 'local') {
      return (localDetailQuery.data?.chapters || []).map((c) => ({
        id: c.chapter_id,
        name: c.name,
      }));
    }
    return (onlineAlbumQuery.data?.episodes || []).map((ep) => ({
      id: ep.photo_id,
      name: `第 ${ep.index} 话 ${ep.name}`.trim(),
    }));
  }, [source, localDetailQuery.data, onlineAlbumQuery.data]);

  const title =
    source === 'local'
      ? localDetailQuery.data?.title || `本地 ${albumId}`
      : onlineAlbumQuery.data?.title || onlinePhotoQuery.data?.name || `JM${albumId}`;

  const coverUrl =
    source === 'local'
      ? `/api/v2/library/${albumId}/cover`
      : `/api/v2/media/cover/${albumId}`;

  const epIndex = chapters.findIndex((c) => c.id === photoId);
  const prevEp = epIndex > 0 ? chapters[epIndex - 1] : null;
  const nextEp = epIndex >= 0 && epIndex < chapters.length - 1 ? chapters[epIndex + 1] : null;

  // 预加载后续 N 页图片到浏览器缓存
  useEffect(() => {
    if (!pages.length) return;
    const end = Math.min(pages.length, currentIndex + preloadCount + 1);
    for (let i = currentIndex + 1; i < end; i++) {
      const preloadImg = new Image();
      preloadImg.src = pages[i].url;
    }
  }, [currentIndex, pages, preloadCount]);

  // 节流同步阅读进度到 SQLite 服务端
  useEffect(() => {
    if (!albumId || !photoId || !pages.length || source !== 'online') return;
    const timer = setTimeout(() => {
      api
        .saveHistory({
          album_id: albumId,
          photo_id: photoId,
          title,
          chapter_title: chapters[epIndex]?.name || '',
          cover_url: coverUrl,
          page_index: currentIndex,
          total_pages: pages.length,
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [albumId, photoId, currentIndex, pages.length, source, title, coverUrl, chapters, epIndex]);

  const goToPage = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, idx));
      setCurrentIndex(clamped);
      if (readerMode === 'vertical') {
        verticalRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [pages.length, readerMode]
  );

  const stepPage = useCallback(
    (delta: number) => {
      const step = readerMode === 'double' ? delta * 2 : delta;
      goToPage(currentIndex + step);
    },
    [currentIndex, goToPage, readerMode]
  );

  const switchChapter = useCallback(
    (targetId: string) => {
      setCurrentIndex(0);
      navigate(`/read/${source}/${albumId}/${targetId}`, { replace: true });
    },
    [albumId, navigate, source]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1);
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        stepPage(readerMode === 'single-rtl' ? -1 : 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPage(readerMode === 'single-rtl' ? 1 : -1);
      } else if (e.key === '[' && prevEp) switchChapter(prevEp.id);
      else if (e.key === ']' && nextEp) switchChapter(nextEp.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, nextEp, prevEp, readerMode, stepPage, switchChapter]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readerMode === 'vertical') {
      setHudVisible((v) => !v);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 0.3) {
      stepPage(readerMode === 'single-rtl' ? 1 : -1);
    } else if (ratio > 0.7) {
      stepPage(readerMode === 'single-rtl' ? -1 : 1);
    } else {
      setHudVisible((v) => !v);
    }
  };

  const isLoading = source === 'local' ? localChapterQuery.isLoading : onlinePhotoQuery.isLoading;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden">
      {/* iOS 磨砂顶部控制栏 */}
      <header
        className={`fixed top-0 inset-x-0 z-30 transition-transform duration-300 ios-spring backdrop-blur-xl bg-black/70 border-b border-white/10 px-4 h-14 flex items-center justify-between gap-3 ${
          hudVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-[15px] font-medium text-[#0a84ff] cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" /> 返回
        </button>

        <div className="min-w-0 text-center flex-1">
          <div className="text-[14px] font-semibold truncate">{title}</div>
          <div className="text-[11px] text-white/60 tabular-nums">
            {pages.length ? `${currentIndex + 1} / ${pages.length}` : '加载中'}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showThumbStrip && (
            <button
              type="button"
              onClick={() => setThumbsOpen(true)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              title="目录与缩略图"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
            title="阅读设置"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex w-8 h-8 rounded-full bg-white/10 items-center justify-center cursor-pointer"
            title="全屏"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 阅读主舞台 */}
      <div
        onClick={handleStageClick}
        className="flex-1 overflow-y-auto overflow-x-hidden select-none"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-white/60 text-[14px]">
            正在加载章节图片...
          </div>
        ) : readerMode === 'vertical' ? (
          <div
            className="mx-auto flex flex-col items-center py-16"
            style={{
              maxWidth: fitWidth ? '920px' : 'none',
              gap: `${pageGap}px`,
            }}
          >
            {pages.map((p) => (
              <div
                key={p.index}
                ref={(el) => {
                  verticalRefs.current[p.index] = el;
                }}
                className="w-full flex justify-center"
              >
                <ComicImage
                  src={p.url}
                  alt={`Page ${p.index + 1}`}
                  className={fitWidth ? 'w-full' : ''}
                  onVisible={() => setCurrentIndex(p.index)}
                />
              </div>
            ))}
            {nextEp && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  switchChapter(nextEp.id);
                }}
                className="mt-6 px-6 py-3 rounded-full bg-[#0a84ff] text-white text-[15px] font-semibold cursor-pointer"
              >
                继续阅读下一话：{nextEp.name} →
              </button>
            )}
          </div>
        ) : readerMode === 'double' ? (
          <div className="h-full w-full flex items-center justify-center gap-2 px-2 py-14">
            <ComicImage
              src={pages[currentIndex]?.url || ''}
              alt={`Page ${currentIndex + 1}`}
              className="h-full flex-1"
            />
            {pages[currentIndex + 1] && (
              <ComicImage
                src={pages[currentIndex + 1].url}
                alt={`Page ${currentIndex + 2}`}
                className="h-full flex-1"
              />
            )}
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center px-2 py-14">
            <ComicImage
              src={pages[currentIndex]?.url || ''}
              alt={`Page ${currentIndex + 1}`}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      {/* iOS 磨砂底部控制条 */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-30 transition-transform duration-300 ios-spring backdrop-blur-xl bg-black/75 border-t border-white/10 px-4 py-3 safe-bottom ${
          hudVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-3xl mx-auto space-y-2.5">
          {pages.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-white/70 tabular-nums w-10 text-right">
                {currentIndex + 1}
              </span>
              <input
                type="range"
                min={0}
                max={pages.length - 1}
                value={currentIndex}
                onChange={(e) => goToPage(Number(e.target.value))}
                className="flex-1 accent-[#0a84ff]"
              />
              <span className="text-[12px] text-white/70 tabular-nums w-10">{pages.length}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!prevEp}
              onClick={() => prevEp && switchChapter(prevEp.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-[13px] disabled:opacity-35 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> 上一话
            </button>

            <div className="hidden sm:block">
              <SegmentedControl<ReaderMode>
                value={readerMode}
                onChange={setReaderMode}
                options={[
                  { value: 'vertical', label: '条漫' },
                  { value: 'single-ltr', label: '左→右' },
                  { value: 'single-rtl', label: '日漫' },
                  { value: 'double', label: '双页' },
                ]}
              />
            </div>

            <button
              type="button"
              disabled={!nextEp}
              onClick={() => nextEp && switchChapter(nextEp.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-[13px] disabled:opacity-35 cursor-pointer"
            >
              下一话 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* 阅读器设置 Sheet */}
      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="阅读器设置">
        <div className="space-y-4">
          <InsetGroup title="翻页与布局">
            <InsetRow
              label="阅读模式"
              right={
                <SegmentedControl<ReaderMode>
                  value={readerMode}
                  onChange={setReaderMode}
                  options={[
                    { value: 'vertical', label: '条漫' },
                    { value: 'single-ltr', label: '单页' },
                    { value: 'single-rtl', label: '日漫' },
                    { value: 'double', label: '双页' },
                  ]}
                />
              }
            />
            <InsetRow label="宽度自适应" right={<IosSwitch checked={fitWidth} onChange={setFitWidth} />} />
            <InsetRow
              label="条漫页间距 (px)"
              right={
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={pageGap}
                  onChange={(e) => setPageGap(Number(e.target.value))}
                  className="w-20 rounded-lg px-2 py-1 text-right text-[14px] outline-none"
                  style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
                />
              }
            />
            <InsetRow
              label="预加载张数"
              isLast
              right={
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={preloadCount}
                  onChange={(e) => setPreloadCount(Number(e.target.value))}
                  className="w-20 rounded-lg px-2 py-1 text-right text-[14px] outline-none"
                  style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
                />
              }
            />
          </InsetGroup>
        </div>
      </BottomSheet>

      {/* 章节与页码缩略图 Sheet */}
      <BottomSheet open={thumbsOpen} onClose={() => setThumbsOpen(false)} title="章节与页码">
        <div className="space-y-4">
          {chapters.length > 1 && (
            <InsetGroup title="切换章节">
              {chapters.map((c, idx) => (
                <InsetRow
                  key={c.id}
                  label={c.name}
                  isLast={idx === chapters.length - 1}
                  onClick={() => {
                    setThumbsOpen(false);
                    switchChapter(c.id);
                  }}
                  right={
                    c.id === photoId ? (
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--ios-blue)' }}>
                        当前
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </InsetGroup>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => {
                  setThumbsOpen(false);
                  goToPage(p.index);
                }}
                className="aspect-[3/4] rounded-lg overflow-hidden relative cursor-pointer"
                style={{
                  border: p.index === currentIndex ? '2px solid var(--ios-blue)' : '0.5px solid var(--ios-separator)',
                }}
              >
                <img src={p.url} alt={`Thumb ${p.index + 1}`} loading="lazy" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 px-1.5 rounded bg-black/70 text-white text-[10px] tabular-nums">
                  {p.index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
