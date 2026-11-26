import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { api, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { CoverImage } from '../../components/ios/CoverImage';
import { InsetGroup, PillSelect } from '../../components/ios/IosControls';

const STATUS_MAP: Record<DownloadTask['status'], { label: string; color: string; bg: string }> = {
  pending: { label: '排队中', color: 'var(--ios-label-secondary)', bg: 'var(--ios-fill-tertiary)' },
  running: { label: '下载中', color: 'var(--ios-blue)', bg: 'var(--ios-accent-soft)' },
  completed: { label: '已完成', color: 'var(--ios-green)', bg: 'rgba(16,185,129,0.12)' },
  failed: { label: '失败', color: 'var(--ios-red)', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: '已取消', color: 'var(--ios-orange)', bg: 'rgba(245,158,11,0.12)' },
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
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ios-blue)' }}>
            DOWNLOAD QUEUE
          </p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight leading-tight">下载队列</h1>
        </div>
        <button
          type="button"
          onClick={() => clearMutation.mutate()}
          className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer"
          style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-separator)', color: 'var(--ios-blue)' }}
        >
          清除已完成
        </button>
      </div>

      {/* 快速创建下载任务 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (albumId.trim()) createMutation.mutate();
        }}
        className="ios-card p-3.5 flex flex-wrap sm:flex-nowrap items-center gap-2.5"
      >
        <input
          type="text"
          value={albumId}
          onChange={(e) => setAlbumId(e.target.value)}
          placeholder="输入漫画 JM ID..."
          className="flex-1 min-w-[160px] rounded-[12px] px-3.5 py-2 text-[14.5px] outline-none"
          style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
        />
        <PillSelect<DownloadTask['download_type']>
          value={fmt}
          onChange={setFmt}
          options={FORMAT_OPTIONS}
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !albumId.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-[12px] text-[14px] font-semibold text-white cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--brand-gradient)' }}
        >
          <Download className="w-4 h-4" /> 添加任务
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="ios-card p-12 text-center space-y-2">
          <Download className="w-9 h-9 mx-auto opacity-30" />
          <p className="text-[15px] font-semibold">暂无下载任务</p>
          <p className="text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
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
                className={`px-4 py-3.5 space-y-2.5 ${idx < tasks.length - 1 ? 'ios-hairline-b' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/album/${t.album_id}`)}
                    className="min-w-0 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <div className="w-11 aspect-[3/4] rounded-[9px] overflow-hidden shrink-0">
                      <CoverImage src={`/api/v2/media/cover/${t.album_id}`} alt={t.title || `JM${t.album_id}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold truncate">
                        {t.title || `JM${t.album_id}`}
                      </div>
                      <div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--ios-label-secondary)' }}>
                        JM{t.album_id} · {t.download_type.toUpperCase()} · {t.completed_count}/{t.total_count || '?'} 页
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold tabular-nums"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      {t.status === 'running' ? `${t.progress}%` : st.label}
                    </span>
                    {t.status === 'running' ? (
                      <button
                        type="button"
                        title="取消"
                        onClick={() => api.cancelDownload(t.task_id)}
                        className="p-1.5 cursor-pointer"
                        style={{ color: 'var(--ios-orange)' }}
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
                            className="p-1.5 cursor-pointer"
                            style={{ color: 'var(--ios-blue)' }}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="删除"
                          onClick={() => api.deleteDownload(t.task_id)}
                          className="p-1.5 cursor-pointer opacity-70 hover:opacity-100"
                          style={{ color: 'var(--ios-red)' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {t.status === 'running' && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ios-fill-secondary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${t.progress}%`, background: 'var(--brand-gradient)' }}
                    />
                  </div>
                )}

                {t.error && (
                  <div className="text-[12px]" style={{ color: 'var(--ios-red)' }}>
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
