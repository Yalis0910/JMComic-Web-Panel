import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Download, FolderOpen, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api, type LocalComic } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/liquid/ComicCard';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { BottomSheet, InsetGroup, InsetRow, SkeletonCardGrid } from '../../components/liquid/LiquidControls';

export function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppStore();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<LocalComic | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: api.listLibrary,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: api.listHistory,
  });

  const { data: detail } = useQuery({
    queryKey: ['libraryDetail', selected?.album_id],
    queryFn: () => api.getLibraryDetail(selected!.album_id),
    enabled: !!selected,
  });

  const scanMutation = useMutation({
    mutationFn: api.scanLibrary,
    onSuccess: (res) => {
      showToast(`扫描完成，共 ${res.count} 本本地漫画`, 'success');
      queryClient.setQueryData(['library'], res.items);
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, removeFiles }: { id: string; removeFiles: boolean }) =>
      api.deleteLibraryItem(id, removeFiles),
    onSuccess: () => {
      setSelected(null);
      showToast('已删除', 'success');
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.album_id.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [items, filter]);

  const selectedHistory = useMemo(
    () => (selected ? history.find((h) => h.album_id === selected.album_id) : undefined),
    [history, selected]
  );

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
            LOCAL ARCHIVE
          </p>
          <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
            本地书库
          </h1>
        </div>
        <button
          type="button"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[13.5px] font-semibold text-white cursor-pointer disabled:opacity-60 liquid-tactile liquid-focus-ring"
          style={{ backgroundColor: 'var(--liquid-scene)' }}
        >
          <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          扫描目录
        </button>
      </div>

      <LiquidGlass variant="tinted" radius={999} className="px-4 py-1">
        <div className="flex items-center gap-2.5 min-h-[42px]">
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--liquid-muted)' }} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="筛选本地已下载漫画..."
            className="flex-1 bg-transparent text-[14.5px] outline-none"
            style={{ color: 'var(--liquid-ink)' }}
          />
        </div>
      </LiquidGlass>

      {isLoading ? (
        <SkeletonCardGrid count={10} />
      ) : filtered.length === 0 ? (
        <div className="liquid-solid-card p-12 text-center space-y-2">
          <FolderOpen className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-[15px] font-semibold">暂无本地已下载漫画</p>
          <p className="text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
            下载的文件夹或 ZIP 漫画会自动出现在这里，局域网内可高速离线直读
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {filtered.map((item) => (
            <ComicCard
              key={item.album_id}
              onClick={() => setSelected(item)}
              badge={
                item.format === 'zip'
                  ? item.chapter_count > 1
                    ? `ZIP · ${item.chapter_count}话`
                    : 'ZIP'
                  : item.format === 'pdf'
                    ? 'PDF'
                    : `${item.page_count}P`
              }
              album={{
                album_id: item.album_id,
                title: item.title,
                author: [item.author, `${(item.size_bytes / 1024 / 1024).toFixed(1)} MB`].filter(Boolean).join(' · '),
                tags: item.tags,
                cover_url: item.format === 'pdf' ? '' : `/api/v2/library/${item.album_id}/cover`,
              }}
            />
          ))}
        </div>
      )}

      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || '本地漫画'}
      >
        {selected && (
          <div className="space-y-4">
            <div className="text-[12.5px] break-all px-1 space-y-1" style={{ color: 'var(--liquid-muted)' }}>
              {selected.author && <div>作者：{selected.author}</div>}
              <div>路径：{selected.path}</div>
            </div>
            {selectedHistory && selected.format !== 'pdf' && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  navigate(`/read/local/${selected.album_id}/${selectedHistory.photo_id}?page=${selectedHistory.page_index}`);
                }}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-[13.5px] font-semibold text-white cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-scene)' }}
              >
                <BookOpen className="w-4 h-4" /> 继续阅读（第 {selectedHistory.page_index + 1} 页）
              </button>
            )}
            {selected.format === 'pdf' ? (
              <InsetGroup title="PDF 文档">
                <InsetRow
                  label="在浏览器中打开 PDF"
                  sublabel="直接在线预览本地 PDF 漫画"
                  onClick={() => window.open(api.getLibraryExportUrl(selected.album_id, true), '_blank')}
                  right={<BookOpen className="w-4 h-4" style={{ color: 'var(--liquid-accent)' }} />}
                />
                <InsetRow
                  label="下载 PDF 到本机"
                  isLast
                  onClick={() => window.open(api.getLibraryExportUrl(selected.album_id), '_blank')}
                  right={<Download className="w-4 h-4" style={{ color: 'var(--liquid-accent)' }} />}
                />
              </InsetGroup>
            ) : (
              <>
                <InsetGroup title={`章节 (${detail?.chapters?.length || selected.chapter_count})`}>
                  {(detail?.chapters || [{ chapter_id: '1', index: 1, name: selected.title, page_count: selected.page_count }]).map(
                    (ch, idx, arr) => (
                      <InsetRow
                        key={ch.chapter_id}
                        label={ch.name}
                        sublabel={`${ch.page_count} 页`}
                        isLast={idx === arr.length - 1}
                        onClick={() => {
                          setSelected(null);
                          navigate(`/read/local/${selected.album_id}/${ch.chapter_id}`);
                        }}
                        right={
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
                            阅读
                          </span>
                        }
                      />
                    )
                  )}
                </InsetGroup>
                <InsetGroup>
                  <InsetRow
                    label="导出打包下载到本地 (.zip)"
                    sublabel="将本地漫画打包下载至当前浏览器设备"
                    isLast
                    onClick={() => window.open(api.getLibraryExportUrl(selected.album_id), '_blank')}
                    right={<Download className="w-4 h-4" style={{ color: 'var(--liquid-accent)' }} />}
                  />
                </InsetGroup>
              </>
            )}
            <InsetGroup>
              <InsetRow
                label="删除本地漫画文件"
                sublabel="从磁盘永久移除该目录或压缩包"
                destructive
                isLast
                onClick={() => deleteMutation.mutate({ id: selected.album_id, removeFiles: true })}
                right={<Trash2 className="w-4 h-4" style={{ color: 'var(--liquid-danger)' }} />}
              />
            </InsetGroup>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
