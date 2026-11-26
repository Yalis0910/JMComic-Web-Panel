import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { api, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { CoverImage } from '../../components/liquid/CoverImage';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { InsetGroup, PillSelect } from '../../components/liquid/LiquidControls';

const STATUS_MAP: Record<DownloadTask['status'], { label: string; color: string; bg: string }> = {
  pending: { label: '排队中', color: 'var(--liquid-muted)', bg: 'var(--liquid-fill-soft)' },
  running: { label: '下载中', color: 'var(--liquid-accent)', bg: 'var(--liquid-focus-soft)' },
  completed: { label: '已完成', color: 'var(--liquid-success)', bg: 'rgba(42, 123, 98, 0.14)' },
  failed: { label: '失败', color: 'var(--liquid-danger)', bg: 'rgba(197, 61, 67, 0.14)' },
  cancelled: { label: '已取消', color: 'var(--liquid-warning)', bg: 'rgba(181, 117, 28, 0.14)' },
};

const FORMAT_OPTIONS: { value: DownloadTask['download_type']; label: string }[] = [
  { value: 'folder', label: '图片文件夹' },
  { value: 'zip', label: 'ZIP 压缩包' },
  { value: 'pdf', label: 'PDF 文档' },
  { value: 'long_img', label: '长图 PNG' },
];

export function DownloadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppStore();
  const [albumId, setAlbumId] = useState('');
  const [fmt, setFmt] = useState<DownloadTask['download_type']>('folder');

  const { data: tasks = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: api.listDownloads,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createDownload(albumId.trim(), fmt),
    onSuccess: (t) => {
      setAlbumId('');
      showToast(`已创建任务 #${t.task_id}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const clearMutation = useMutation({
    mutationFn: api.clearFinishedDownloads,
    onSuccess: () => {
      showToast('已清空已完成记录');
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
    },
  });

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
            DOWNLOAD QUEUE
          </p>
          <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
            下载队列
          </h1>
        </div>
        <button
          type="button"
          onClick={() => clearMutation.mutate()}
          className="min-h-[40px] px-4 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer liquid-tactile liquid-focus-ring"
          style={{
            backgroundColor: 'var(--liquid-solid)',
            border: '1px solid var(--liquid-separator)',
            color: 'var(--liquid-accent)',
          }}
        >
          清除已完成
        </button>
      </div>

      {/* 快速创建下载任务 */}
      <LiquidGlass variant="tinted" radius={24} className="p-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (albumId.trim()) createMutation.mutate();
          }}
          className="flex flex-wrap sm:flex-nowrap items-center gap-2.5"
        >
          <input
            type="text"
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            placeholder="输入漫画 JM ID..."
            className="flex-1 min-w-[160px] min-h-[42px] rounded-full px-4 py-2 text-[14.5px] outline-none liquid-focus-ring"
            style={{
              backgroundColor: 'var(--liquid-solid)',
              border: '1px solid var(--liquid-separator)',
              color: 'var(--liquid-ink)',
            }}
          />
          <PillSelect<DownloadTask['download_type']> value={fmt} onChange={setFmt} options={FORMAT_OPTIONS} />
          <button
            type="submit"
            disabled={createMutation.isPending || !albumId.trim()}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[14px] font-semibold text-white cursor-pointer disabled:opacity-50 liquid-tactile"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            <Download className="w-4 h-4" /> 添加任务
          </button>
        </form>
      </LiquidGlass>

      {tasks.length === 0 ? (
        <div className="liquid-solid-card p-12 text-center space-y-2">
          <Download className="w-9 h-9 mx-auto opacity-30" />
          <p className="text-[15px] font-semibold">暂无下载任务</p>
          <p className="text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
            输入 JM 车号或在详情页点击“下载”即可加入服务端队列
          </p>
        </div>
      ) : (
        <InsetGroup title={`任务队列 (${tasks.length})`}>
          {tasks.map((t, idx) => {
            const st = STATUS_MAP[t.status];
            return (
              <div
                key={t.task_id}
                className={`px-5 py-4 space-y-2.5 ${idx < tasks.length - 1 ? 'liquid-hairline-b' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/album/${t.album_id}`)}
                    className="min-w-0 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <div className="w-11 aspect-[3/4] rounded-[10px] overflow-hidden shrink-0">
                      <CoverImage src={`/api/v2/media/cover/${t.album_id}`} alt={t.title || `JM${t.album_id}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold truncate">
                        {t.title || `JM${t.album_id}`}
                      </div>
                      <div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--liquid-muted)' }}>
                        JM{t.album_id} · {t.download_type.toUpperCase()} · {t.completed_count}/{t.total_count || '?'} 页
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-3 py-1 rounded-full text-[11.5px] font-semibold tabular-nums"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      {t.status === 'running' ? `${t.progress}%` : st.label}
                    </span>
                    {t.status === 'running' ? (
                      <button
                        type="button"
                        title="取消"
                        onClick={() => api.cancelDownload(t.task_id)}
                        className="p-2 cursor-pointer"
                        style={{ color: 'var(--liquid-warning)' }}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        {(t.status === 'failed' || t.status === 'cancelled') && (
                          <button
                            type="button"
                            title="重试"
                            onClick={() => api.createDownload(t.album_id, t.download_type, t.photo_id || undefined)}
                            className="p-2 cursor-pointer"
                            style={{ color: 'var(--liquid-accent)' }}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="删除"
                          onClick={() => api.deleteDownload(t.task_id)}
                          className="p-2 cursor-pointer opacity-70 hover:opacity-100"
                          style={{ color: 'var(--liquid-danger)' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {t.status === 'running' && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--liquid-fill-soft)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${t.progress}%`, backgroundColor: 'var(--liquid-focus)' }}
                    />
                  </div>
                )}

                {t.error && (
                  <div className="text-[12px]" style={{ color: 'var(--liquid-danger)' }}>
                    {t.error}
                  </div>
                )}
              </div>
            );
          })}
        </InsetGroup>
      )}
    </div>
  );
}
