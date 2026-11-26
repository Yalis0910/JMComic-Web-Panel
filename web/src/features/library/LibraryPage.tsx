import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api, type LocalComic } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { BottomSheet, InsetGroup, InsetRow } from '../../components/ios/IosControls';

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
      (i) => i.title.toLowerCase().includes(q) || i.album_id.toLowerCase().includes(q)
    );
  }, [items, filter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">本地书库</h1>
        <button
          type="button"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: 'var(--ios-blue)' }}
        >
          <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          扫描目录
        </button>
      </div>

      <div className="relative">
        <Search
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--ios-label-secondary)' }}
        />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="筛选本地已下载漫画..."
          className="w-full rounded-[12px] pl-10 pr-4 py-2.5 text-[15px] outline-none"
          style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
        />
      </div>

      {isLoading ? (
        <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
          加载本地书库...
        </div>
      ) : filtered.length === 0 ? (
        <div className="ios-card p-10 text-center space-y-2">
          <FolderOpen className="w-10 h-10 mx-auto opacity-35" />
          <p className="text-[15px] font-medium">暂无本地已下载漫画</p>
          <p className="text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
            下载的文件夹或 ZIP 漫画会自动出现在这里，局域网内可高速离线直读
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {filtered.map((item) => (
            <ComicCard
              key={item.album_id}
              onClick={() => setSelected(item)}
              badge={item.format === 'zip' ? 'ZIP' : `${item.page_count}P`}
              album={{
                album_id: item.album_id,
                title: item.title,
                author: `${(item.size_bytes / 1024 / 1024).toFixed(1)} MB`,
                tags: item.tags,
                cover_url: `/api/v2/library/${item.album_id}/cover`,
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
            <div className="text-[12.5px] break-all" style={{ color: 'var(--ios-label-secondary)' }}>
              路径：{selected.path}
            </div>
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
                      <span className="text-[13px] font-medium" style={{ color: 'var(--ios-blue)' }}>
                        阅读
                      </span>
                    }
                  />
                )
              )}
            </InsetGroup>
            <InsetGroup>
              <InsetRow
                label="删除本地漫画文件"
                sublabel="从磁盘永久移除该目录或压缩包"
                destructive
                isLast
                onClick={() => deleteMutation.mutate({ id: selected.album_id, removeFiles: true })}
                right={<Trash2 className="w-4 h-4" style={{ color: 'var(--ios-red)' }} />}
              />
            </InsetGroup>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
