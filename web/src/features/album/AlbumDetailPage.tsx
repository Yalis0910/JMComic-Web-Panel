import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Download, Heart, MessageCircle, Send } from 'lucide-react';
import { api, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { BottomSheet, InsetGroup, InsetRow } from '../../components/ios/IosControls';
import { ComicCard } from '../../components/ios/ComicCard';

export function AlbumDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppStore();

  const [dlSheetOpen, setDlSheetOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [spoiler, setSpoiler] = useState(false);

  const { data: album, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.getAlbum(id),
    enabled: !!id,
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api.getComments(id, 1),
    enabled: !!id && commentOpen,
  });

  const favMutation = useMutation({
    mutationFn: (isFav: boolean) => (isFav ? api.removeFavorite(id) : api.addFavorite(id)),
    onSuccess: (_, wasFav) => {
      showToast(wasFav ? '已取消收藏' : '已加入收藏', 'success');
      queryClient.invalidateQueries({ queryKey: ['album', id] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const dlMutation = useMutation({
    mutationFn: (fmt: DownloadTask['download_type']) => api.createDownload(id, fmt),
    onSuccess: (task) => {
      setDlSheetOpen(false);
      showToast(`已创建下载任务 #${task.task_id}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const commentMutation = useMutation({
    mutationFn: () => api.postComment(id, commentText.trim(), undefined, spoiler),
    onSuccess: () => {
      setCommentText('');
      showToast('评论已发布', 'success');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
        正在加载漫画详情...
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="ios-card p-8 text-center space-y-3">
        <p style={{ color: 'var(--ios-red)' }}>加载失败：{(error as Error)?.message || '未知错误'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl text-[14px] cursor-pointer"
          style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
        >
          返回
        </button>
      </div>
    );
  }

  const firstEp = album.episodes[0];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-[15px] font-medium cursor-pointer"
        style={{ color: 'var(--ios-blue)' }}
      >
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      {/* 顶部大卡片 */}
      <div className="ios-card overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${album.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
          <div
            className="w-40 sm:w-48 aspect-[3/4] rounded-[14px] overflow-hidden shrink-0 mx-auto sm:mx-0 shadow-lg"
            style={{ border: '0.5px solid var(--ios-separator)', backgroundColor: 'var(--ios-fill-tertiary)' }}
          >
            <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}>
                  JM{album.album_id}
                </span>
                <span>{album.views} 阅读</span>
                <span>· {album.likes} 喜欢</span>
                <span>· {album.page_count || '?'} 页</span>
              </div>
              <h1 className="text-[22px] sm:text-[26px] font-bold leading-snug">{album.title}</h1>
              {album.description && (
                <p className="text-[13.5px] leading-relaxed line-clamp-3" style={{ color: 'var(--ios-label-secondary)' }}>
                  {album.description}
                </p>
              )}

              {/* 作者与标签胶囊 */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {album.authors.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(a)}&type=author`)}
                    className="px-2.5 py-1 rounded-full text-[12px] font-medium cursor-pointer"
                    style={{ backgroundColor: 'rgba(0,122,255,0.14)', color: 'var(--ios-blue)' }}
                  >
                    作者: {a}
                  </button>
                ))}
                {album.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(t)}&type=tag`)}
                    className="px-2.5 py-1 rounded-full text-[12px] cursor-pointer"
                    style={{ backgroundColor: 'var(--ios-fill-tertiary)', color: 'var(--ios-label-secondary)' }}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>

            {/* 操作按钮栏 */}
            <div className="flex flex-wrap items-center gap-2.5">
              {firstEp && (
                <button
                  type="button"
                  onClick={() => navigate(`/read/online/${album.album_id}/${firstEp.photo_id}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--ios-blue)' }}
                >
                  <BookOpen className="w-4 h-4" /> 开始阅读
                </button>
              )}
              <button
                type="button"
                onClick={() => favMutation.mutate(album.is_favorite)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium cursor-pointer"
                style={{
                  backgroundColor: 'var(--ios-fill-tertiary)',
                  color: album.is_favorite ? 'var(--ios-pink)' : 'var(--ios-label-primary)',
                }}
              >
                <Heart className="w-4 h-4" fill={album.is_favorite ? 'currentColor' : 'none'} />
                {album.is_favorite ? '已收藏' : '收藏'}
              </button>
              <button
                type="button"
                onClick={() => setDlSheetOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                <Download className="w-4 h-4" /> 下载
              </button>
              <button
                type="button"
                onClick={() => setCommentOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                <MessageCircle className="w-4 h-4" /> 评论 ({album.comment_count})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 章节列表 */}
      <InsetGroup title={`章节列表 (${album.episodes.length})`}>
        {album.episodes.map((ep, idx) => (
          <InsetRow
            key={ep.photo_id}
            label={`第 ${ep.index} 话 ${ep.name || ''}`}
            sublabel={`Photo ID: ${ep.photo_id}`}
            isLast={idx === album.episodes.length - 1}
            onClick={() => navigate(`/read/online/${album.album_id}/${ep.photo_id}`)}
            right={
              <span className="text-[13px] font-medium" style={{ color: 'var(--ios-blue)' }}>
                阅读
              </span>
            }
          />
        ))}
      </InsetGroup>

      {/* 相关推荐 */}
      {album.related.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[20px] font-semibold tracking-tight">相关推荐</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {album.related.slice(0, 10).map((rel) => (
              <ComicCard key={rel.album_id} album={rel} />
            ))}
          </div>
        </section>
      )}

      {/* 下载格式 Action Sheet */}
      <BottomSheet open={dlSheetOpen} onClose={() => setDlSheetOpen(false)} title="选择下载格式">
        <InsetGroup>
          {(
            [
              { fmt: 'folder', label: '图片文件夹', desc: '保留原始解密分章图片，可直接进本地书库阅读' },
              { fmt: 'zip', label: 'ZIP 压缩包', desc: '打包为单个归档文件，同样支持本地书库阅读' },
              { fmt: 'pdf', label: 'PDF 文档', desc: '合并为单一 PDF 便于归档或电子书阅读器' },
              { fmt: 'long_img', label: '长图 PNG', desc: '拼接为竖向长图' },
            ] as const
          ).map((item, idx, arr) => (
            <InsetRow
              key={item.fmt}
              label={item.label}
              sublabel={item.desc}
              isLast={idx === arr.length - 1}
              onClick={() => dlMutation.mutate(item.fmt)}
            />
          ))}
        </InsetGroup>
      </BottomSheet>

      {/* 评论区 Sheet */}
      <BottomSheet open={commentOpen} onClose={() => setCommentOpen(false)} title={`评论 (${album.comment_count})`}>
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentText.trim()) commentMutation.mutate();
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论（需登录 JM 账号）..."
              className="w-full rounded-xl p-3 text-[14px] outline-none resize-none"
              style={{
                backgroundColor: 'var(--ios-fill-tertiary)',
                border: '0.5px solid var(--ios-separator)',
              }}
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--ios-label-secondary)' }}>
                <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
                包含剧透
              </label>
              <button
                type="submit"
                disabled={commentMutation.isPending || !commentText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13.5px] font-medium text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--ios-blue)' }}
              >
                <Send className="w-3.5 h-3.5" /> 发送
              </button>
            </div>
          </form>

          {commentsLoading ? (
            <div className="py-8 text-center text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
              正在加载评论...
            </div>
          ) : (
            <div className="space-y-3">
              {(commentsData?.comments || []).map((c) => (
                <div key={c.cid} className="ios-card p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold">
                      {c.username}{' '}
                      {c.level_name && (
                        <span className="font-normal opacity-60">· {c.level_name}</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--ios-label-secondary)' }}>{c.addtime}</span>
                  </div>
                  <p className="text-[14px] whitespace-pre-wrap leading-relaxed">{c.content}</p>
                  {c.replies.length > 0 && (
                    <div
                      className="mt-2 pl-3 space-y-1.5"
                      style={{ borderLeft: '2px solid var(--ios-separator)' }}
                    >
                      {c.replies.map((rep) => (
                        <div key={rep.cid} className="text-[12.5px]">
                          <span className="font-medium">{rep.username}：</span>
                          <span style={{ color: 'var(--ios-label-secondary)' }}>{rep.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {commentsData && commentsData.comments.length === 0 && (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
                  暂无评论
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
