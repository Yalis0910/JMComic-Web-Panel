import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  List,
  Maximize2,
  Minimize2,
  RotateCw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { api, withPanelToken } from '../../api/client';
import { useAppStore, type ReaderMode } from '../../stores/useAppStore';
import { BottomSheet, InsetGroup, InsetRow, LiquidSwitch, SegmentedControl } from '../../components/liquid/LiquidControls';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';

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
      { threshold: 0, rootMargin: '-40% 0px -40% 0px' }
    );
    obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [onVisible]);

  const effectiveSrc = attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src;

  return (
    <div ref={imgRef} className={`relative flex items-center justify-center min-h-[260px] ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/55 text-[13px]">
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
          className="min-h-[42px] px-4 py-2 rounded-full bg-white/15 text-white text-[13px] inline-flex items-center gap-1.5 cursor-pointer liquid-tactile"
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
  const queryClient = useQueryClient();

  const {
    readerMode,
    setReaderMode,
    preloadCount,
    setPreloadCount,
    fitWidth,
    setFitWidth,
    showThumbStrip,
    setShowThumbStrip,
    doublePageRtl,
    setDoublePageRtl,
    doublePageCoverOffset,
    setDoublePageCoverOffset,
    readerBrightness,
    setReaderBrightness,
    pageGap,
    setPageGap,
    showToast,
  } = useAppStore();

  const startPage = Math.max(0, Number(searchParams.get('page') || 0));
  const [currentIndex, setCurrentIndex] = useState(startPage);
  const [hudVisible, setHudVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [epReverse, setEpReverse] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
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
    return (onlinePhotoQuery.data?.images || []).map((img, i) => ({
      index: i,
      url: withPanelToken(img.proxy_url),
    }));
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

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks', albumId],
    queryFn: () => api.listBookmarks(albumId),
    enabled: !!albumId,
  });

  const currentBookmark = useMemo(
    () =>
      (bookmarksQuery.data || []).find(
        (b) => b.photo_id === photoId && b.page_index === currentIndex && (b.source || 'online') === (source === 'local' ? 'local' : 'online')
      ),
    [bookmarksQuery.data, photoId, currentIndex, source]
  );

  const bookmarkToggleMutation = useMutation({
    mutationFn: async () => {
      if (currentBookmark) {
        await api.deleteBookmark(currentBookmark.bookmark_id);
        return false;
      }
      await api.saveBookmark({
        album_id: albumId,
        photo_id: photoId,
        source: source === 'local' ? 'local' : 'online',
        title,
        chapter_title: chapters[epIndex]?.name || '',
        cover_url: coverUrl,
        page_index: currentIndex,
        note: '',
      });
      return true;
    },
    onSuccess: (added) => {
      showToast(added ? `已收藏第 ${currentIndex + 1} 页书签` : '已移除本页书签', 'success');
      queryClient.invalidateQueries({ queryKey: ['bookmarks', albumId] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const epIndex = chapters.findIndex((c) => c.id === photoId);
  const prevEp = epIndex > 0 ? chapters[epIndex - 1] : null;
  const nextEp = epIndex >= 0 && epIndex < chapters.length - 1 ? chapters[epIndex + 1] : null;

  useEffect(() => {
    if (!pages.length) return;
    const end = Math.min(pages.length, currentIndex + preloadCount + 1);
    for (let i = currentIndex + 1; i < end; i++) {
      const preloadImg = new Image();
      preloadImg.src = pages[i].url;
    }
  }, [currentIndex, pages, preloadCount]);

  useEffect(() => {
    if (!albumId || !photoId || !pages.length) return;
    const normSource = source === 'local' ? 'local' : 'online';
    const timer = setTimeout(() => {
      api
        .saveHistory({
          album_id: albumId,
          photo_id: photoId,
          source: normSource,
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

  const doubleSpreadPages = useMemo(() => {
    if (readerMode !== 'double' || pages.length === 0) return [];
    if (doublePageCoverOffset && currentIndex === 0) {
      return [pages[0]];
    }
    const base =
      doublePageCoverOffset && currentIndex % 2 === 0
        ? Math.max(1, currentIndex - 1)
        : !doublePageCoverOffset && currentIndex % 2 === 1
          ? currentIndex - 1
          : currentIndex;
    const pair = [pages[base], pages[base + 1]].filter((p): p is PageItem => Boolean(p));
    return doublePageRtl ? [...pair].reverse() : pair;
  }, [readerMode, pages, currentIndex, doublePageCoverOffset, doublePageRtl]);

  const stepPage = useCallback(
    (delta: number) => {
      if (readerMode === 'double') {
        if (delta > 0) {
          if (doublePageCoverOffset && currentIndex === 0) {
            goToPage(1);
            return;
          }
          goToPage(currentIndex + 2);
        } else {
          if (doublePageCoverOffset && currentIndex <= 2) {
            goToPage(0);
            return;
          }
          goToPage(currentIndex - 2);
        }
        return;
      }
      goToPage(currentIndex + delta);
    },
    [currentIndex, doublePageCoverOffset, goToPage, readerMode]
  );

  const switchChapter = useCallback(
    (targetId: string) => {
      setCurrentIndex(0);
      if (stageRef.current) {
        stageRef.current.scrollTop = 0;
      }
      navigate(`/read/${source}/${albumId}/${targetId}`, { replace: true });
    },
    [albumId, navigate, source]
  );

  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.scrollTop = 0;
    }
  }, [photoId]);

  const orderedChapters = useMemo(
    () => (epReverse ? [...chapters].reverse() : chapters),
    [chapters, epReverse]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const rtl = readerMode === 'single-rtl' || (readerMode === 'double' && doublePageRtl);
      if (e.key === 'Escape') navigate(-1);
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        stepPage(rtl ? -1 : 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPage(rtl ? 1 : -1);
      } else if (e.key === '[' && prevEp) switchChapter(prevEp.id);
      else if (e.key === ']' && nextEp) switchChapter(nextEp.id);
      else if (e.key.toLowerCase() === 'b') bookmarkToggleMutation.mutate();
      else if (e.key === '?' || (e.shiftKey && e.key === '/')) setHelpOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookmarkToggleMutation, doublePageRtl, navigate, nextEp, prevEp, readerMode, stepPage, switchChapter]);

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
    const rtl = readerMode === 'single-rtl' || (readerMode === 'double' && doublePageRtl);
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 0.3) {
      stepPage(rtl ? 1 : -1);
    } else if (ratio > 0.7) {
      stepPage(rtl ? -1 : 1);
    } else {
      setHudVisible((v) => !v);
    }
  };

  const isLoading = source === 'local' ? localChapterQuery.isLoading : onlinePhotoQuery.isLoading;

  return (
    <div className="fixed inset-0 z-50 bg-[#080d10] text-white flex flex-col overflow-hidden">
      {/* 悬浮 Liquid Glass 顶部胶囊 HUD */}
      <header
        className={`fixed top-3 inset-x-0 z-30 px-3 sm:px-6 pointer-events-none transition-all duration-400 ${
          hudVisible ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.26, 1.55, 0.52, 1)' }}
      >
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <LiquidGlass variant="clear" tone="dark" radius={999} bezelWidth={16} refraction={14} className="px-3 py-1.5">
            <div className="flex items-center justify-between gap-2 min-h-[44px]">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-[38px] px-3 rounded-full inline-flex items-center gap-1 text-[14px] font-medium text-[#C7E4E5] cursor-pointer shrink-0 liquid-tactile liquid-focus-ring"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
              >
                <ChevronLeft className="w-4 h-4" /> 返回
              </button>

              <div className="min-w-0 text-center flex-1 px-2">
                <div className="text-[13.5px] font-semibold truncate">{title}</div>
                <div className="text-[11px] text-white/65 tabular-nums truncate">
                  {chapters[epIndex]?.name ? `${chapters[epIndex].name} · ` : ''}
                  {pages.length ? `${currentIndex + 1} / ${pages.length}` : '加载中'}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {chapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setChaptersOpen(true)}
                    className="min-h-[36px] px-3 rounded-full bg-white/12 flex items-center gap-1.5 text-[12.5px] font-medium cursor-pointer liquid-tactile liquid-focus-ring"
                    title="章节目录"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">目录</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => bookmarkToggleMutation.mutate()}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setBookmarksOpen(true);
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  style={{
                    backgroundColor: currentBookmark ? 'rgba(199, 228, 229, 0.28)' : 'rgba(255, 255, 255, 0.12)',
                    color: currentBookmark ? '#C7E4E5' : '#ffffff',
                  }}
                  title="收藏/取消本页书签（右键查看全部）"
                >
                  <Bookmark className="w-4 h-4" fill={currentBookmark ? '#C7E4E5' : 'none'} />
                </button>
                {showThumbStrip && (
                  <button
                    type="button"
                    onClick={() => setThumbsOpen(true)}
                    className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                    title="缩略图与书签"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  title="阅读设置"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="hidden sm:flex w-9 h-9 rounded-full bg-white/12 items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  title="快捷键说明 (?)"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="hidden sm:flex w-9 h-9 rounded-full bg-white/12 items-center justify-center cursor-pointer liquid-tactile liquid-focus-ring"
                  title="全屏"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </LiquidGlass>
        </div>
      </header>

      {/* 阅读主舞台 */}
      <div
        ref={stageRef}
        onClick={handleStageClick}
        className="flex-1 overflow-y-auto overflow-x-hidden select-none"
        style={{ filter: readerBrightness < 100 ? `brightness(${readerBrightness / 100})` : undefined }}
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-white/60 text-[14px]">
            正在加载章节图片...
          </div>
        ) : readerMode === 'vertical' ? (
          <div
            className="mx-auto flex flex-col items-center py-20"
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
                className="mt-6 min-h-[46px] px-6 py-3 rounded-full text-[14.5px] font-semibold cursor-pointer liquid-tactile"
                style={{ backgroundColor: '#E4EFEB', color: '#202929' }}
              >
                继续阅读下一话：{nextEp.name} →
              </button>
            )}
          </div>
        ) : readerMode === 'double' ? (
          <div className="h-full w-full flex items-center justify-center gap-2 px-2 py-16">
            {doubleSpreadPages.map((pg) => (
              <ComicImage
                key={pg.index}
                src={pg.url}
                alt={`Page ${pg.index + 1}`}
                className={doubleSpreadPages.length === 1 ? 'h-full max-w-3xl w-full' : 'h-full flex-1'}
              />
            ))}
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center px-2 py-16">
            <ComicImage
              src={pages[currentIndex]?.url || ''}
              alt={`Page ${currentIndex + 1}`}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      {/* 悬浮 Liquid Glass 底部胶囊控制台 */}
      <footer
        className={`fixed bottom-3 inset-x-0 z-30 px-3 sm:px-6 pb-[env(safe-area-inset-bottom)] pointer-events-none transition-all duration-400 ${
          hudVisible ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.26, 1.55, 0.52, 1)' }}
      >
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <LiquidGlass variant="clear" tone="dark" radius={28} bezelWidth={16} refraction={14} className="px-4 py-3">
            <div className="space-y-2.5">
              {pages.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-white/75 tabular-nums w-9 text-right">
                    {currentIndex + 1}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={pages.length - 1}
                    value={currentIndex}
                    onChange={(e) => goToPage(Number(e.target.value))}
                    className="flex-1 accent-[#C7E4E5]"
                  />
                  <span className="text-[12px] text-white/75 tabular-nums w-9">{pages.length}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!prevEp}
                  onClick={() => prevEp && switchChapter(prevEp.id)}
                  className="min-h-[38px] inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/12 text-[13px] disabled:opacity-35 cursor-pointer liquid-tactile"
                >
                  <ChevronLeft className="w-4 h-4" /> 上一话
                </button>

                <div className="hidden sm:block">
                  <SegmentedControl<ReaderMode>
                    onDark
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
                  className="min-h-[38px] inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/12 text-[13px] disabled:opacity-35 cursor-pointer liquid-tactile"
                >
                  下一话 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </LiquidGlass>
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
            <InsetRow label="宽度自适应" right={<LiquidSwitch checked={fitWidth} onChange={setFitWidth} />} />
            <InsetRow
              label="双页日漫方向 (右→左)"
              right={<LiquidSwitch checked={doublePageRtl} onChange={setDoublePageRtl} />}
            />
            <InsetRow
              label="双页封面单独成页"
              right={<LiquidSwitch checked={doublePageCoverOffset} onChange={setDoublePageCoverOffset} />}
            />
            <InsetRow
              label={`画面亮度 (${readerBrightness}%)`}
              right={
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={readerBrightness}
                  onChange={(e) => setReaderBrightness(Number(e.target.value))}
                  className="w-28 accent-[#557B79]"
                />
              }
            />
            <InsetRow
              label="查看本漫全部书签"
              onClick={() => {
                setSettingsOpen(false);
                setBookmarksOpen(true);
              }}
              right={<span className="text-[13px]" style={{ color: 'var(--liquid-accent)' }}>{bookmarksQuery.data?.length || 0} 条</span>}
            />
            <InsetRow
              label="条漫页间距 (px)"
              right={
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={pageGap}
                  onChange={(e) => setPageGap(Number(e.target.value))}
                  className="w-20 rounded-full px-3 py-1 text-right text-[14px] outline-none"
                  style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
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
                  className="w-20 rounded-full px-3 py-1 text-right text-[14px] outline-none"
                  style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
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
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
                        当前
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </InsetGroup>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => {
                  setThumbsOpen(false);
                  goToPage(p.index);
                }}
                className="aspect-[3/4] rounded-[12px] overflow-hidden relative cursor-pointer liquid-tactile"
                style={{
                  border:
                    p.index === currentIndex
                      ? '2px solid var(--liquid-focus)'
                      : '1px solid var(--liquid-separator)',
                }}
              >
                <img src={p.url} alt={`Thumb ${p.index + 1}`} loading="lazy" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 px-1.5 rounded-full bg-black/70 text-white text-[10px] tabular-nums">
                  {p.index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* 章节目录跳转 Sheet */}
      <BottomSheet open={chaptersOpen} onClose={() => setChaptersOpen(false)} title={`章节目录 (${chapters.length})`}>
        <div className="space-y-3.5">
          {chapters.length > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[12.5px]" style={{ color: 'var(--liquid-muted)' }}>
                点击章节直接跳转阅读
              </span>
              <button
                type="button"
                onClick={() => setEpReverse((r) => !r)}
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer liquid-tactile"
                style={{
                  backgroundColor: 'var(--liquid-solid)',
                  border: '1px solid var(--liquid-separator)',
                }}
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> {epReverse ? '倒序' : '正序'}
              </button>
            </div>
          )}
          <InsetGroup>
            {orderedChapters.map((c, idx) => {
              const active = c.id === photoId;
              return (
                <InsetRow
                  key={c.id}
                  label={c.name}
                  isLast={idx === orderedChapters.length - 1}
                  onClick={() => {
                    setChaptersOpen(false);
                    if (!active) switchChapter(c.id);
                  }}
                  right={
                    active ? (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold"
                        style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
                      >
                        当前
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 opacity-45" />
                    )
                  }
                />
              );
            })}
          </InsetGroup>
        </div>
      </BottomSheet>

      {/* 本漫书签 Sheet */}
      <BottomSheet open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} title={`本漫书签 (${bookmarksQuery.data?.length || 0})`}>
        <div className="space-y-3.5">
          <button
            type="button"
            onClick={() => bookmarkToggleMutation.mutate()}
            className="w-full min-h-[42px] rounded-full text-[13.5px] font-semibold text-white cursor-pointer liquid-tactile"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            {currentBookmark ? `移除当前页 (第 ${currentIndex + 1} 页) 书签` : `添加当前页 (第 ${currentIndex + 1} 页) 书签`}
          </button>
          {(bookmarksQuery.data?.length || 0) === 0 ? (
            <div className="py-6 text-center text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
              暂无书签
            </div>
          ) : (
            <InsetGroup>
              {(bookmarksQuery.data || []).map((b, idx, arr) => (
                <InsetRow
                  key={b.bookmark_id}
                  label={`${b.chapter_title || `章节 ${b.photo_id}`} · 第 ${b.page_index + 1} 页`}
                  sublabel={new Date(b.updated_at).toLocaleString()}
                  isLast={idx === arr.length - 1}
                  onClick={() => {
                    setBookmarksOpen(false);
                    if (b.photo_id === photoId) {
                      goToPage(b.page_index);
                    } else {
                      navigate(`/read/${source}/${albumId}/${b.photo_id}?page=${b.page_index}`, { replace: true });
                    }
                  }}
                  right={
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteBookmark(b.bookmark_id);
                        queryClient.invalidateQueries({ queryKey: ['bookmarks', albumId] });
                      }}
                      className="p-2 cursor-pointer"
                      style={{ color: 'var(--liquid-danger)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              ))}
            </InsetGroup>
          )}
        </div>
      </BottomSheet>

      {/* 快捷键说明 Sheet */}
      <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title="阅读器快捷键">
        <InsetGroup>
          <InsetRow label="← / → / 空格" sublabel="上一页 / 下一页（日漫与 RTL 双页自动反向）" />
          <InsetRow label="[ / ]" sublabel="切换上一话 / 下一话" />
          <InsetRow label="B" sublabel="收藏或移除当前页书签" />
          <InsetRow label="?" sublabel="打开 / 关闭快捷键说明" />
          <InsetRow label="Esc" sublabel="退出阅读器返回上一页" isLast />
        </InsetGroup>
      </BottomSheet>
    </div>
  );
}
