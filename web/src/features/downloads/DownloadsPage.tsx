import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { api, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { InsetGroup } from '../../components/ios/IosControls';

const STATUS_MAP: Record<DownloadTask['status'], { label: string; color: string }> = {
  pending: { label: '排队中', color: 'var(--ios-label-secondary)' },
  running: { label: '下载中', color: 'var(--ios-blue)' },
  completed: { label: '已完成', color: 'var(--ios-green)' },
  failed: { label: '失败', color: 'var(--ios-red)' },
  cancelled: { label: '已取消', color: 'var(--ios-orange)' },
};

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">下载管理</h1>
        <button
          type="button"
          onClick={() => clearMutation.mutate()}
          className="text-[14px] font-medium cursor-pointer"
          style={{ color: 'var(--ios-blue)' }}
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
          className="flex-1 min-w-[160px] rounded-xl px-3.5 py-2 text-[15px] outline-none"
          style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
        />
        <select
          value={fmt}
          onChange={(e) => setFmt(e.target.value as DownloadTask['download_type'])}
          className="rounded-xl px-3 py-2 text-[14px] outline-none"
          style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
        >
          <option value="folder">图片文件夹</option>
          <option value="zip">ZIP 压缩包</option>
          <option value="pdf">PDF 文档</option>
          <option value="long_img">长图 PNG</option>
        </select>
        <button
          type="submit"
          disabled={createMutation.isPending || !albumId.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-semibold text-white cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: 'var(--ios-blue)' }}
        >
          <Download className="w-4 h-4" /> 下载
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
          暂无下载任务
        </div>
      ) : (
        <InsetGroup title={`任务队列 (${tasks.length})`}>
          {tasks.map((t, idx) => {
            const st = STATUS_MAP[t.status];
            return (
              <div
                key={t.task_id}
                className={`px-4 py-3.5 space-y-2 ${idx < tasks.length - 1 ? 'ios-hairline-b' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/album/${t.album_id}`)}
                    className="min-w-0 text-left cursor-pointer"
                  >
                    <div className="text-[15px] font-medium truncate">
                      {t.title || `JM${t.album_id}`}
                    </div>
                    <div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--ios-label-secondary)' }}>
                      JM{t.album_id} · {t.download_type.toUpperCase()} · {t.completed_count}/{t.total_count || '?'} 页
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: st.color }}>
                      {t.status === 'running' ? `${t.progress}%` : st.label}
                    </span>
                    {t.status === 'running' ? (
                      <button
                        type="button"
                        title="取消"
                        onClick={() => api.cancelDownload(t.task_id)}
                        className="p-1 cursor-pointer"
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
                            className="p-1 cursor-pointer"
                            style={{ color: 'var(--ios-blue)' }}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="删除"
                          onClick={() => api.deleteDownload(t.task_id)}
                          className="p-1 cursor-pointer opacity-70 hover:opacity-100"
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
                      style={{ width: `${t.progress}%`, backgroundColor: 'var(--ios-blue)' }}
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
