import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Download,
  Eye,
  Heart,
  LayoutGrid,
  List,
  MessageCircle,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { api, type CommentItem, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { BottomSheet, InsetGroup, InsetRow } from '../../components/liquid/LiquidControls';
import { ComicCard } from '../../components/liquid/ComicCard';
import { CoverImage } from '../../components/liquid/CoverImage';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { cleanHtmlText } from '../../utils/text';

const AVATAR_PALETTES = [
  '#25414A',
  '#355B63',
  '#557B79',
  '#3E6B66',
  '#4A5E6D',
];

function avatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function CommentCard({ item }: { item: CommentItem }) {
  const [revealed, setRevealed] = useState(false);
  const cleanContent = cleanHtmlText(item.content);
  const name = item.username || '匿名读者';

  return (
    <div className="liquid-solid-card p-5 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
            style={{ backgroundColor: avatarBg(name) }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13.5px] font-semibold truncate">{name}</span>
              {item.level_name && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                  style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
                >
                  {item.level_name}
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--liquid-subtle)' }}>
              {item.addtime}
            </div>
          </div>
        </div>

        {Number(item.likes || 0) > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] tabular-nums shrink-0"
            style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-muted)' }}
          >
            <ThumbsUp className="w-3 h-3" /> {item.likes}
          </span>
        )}
      </div>

      {item.spoiler && !revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full py-2.5 px-3 rounded-[14px] text-[12.5px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
          style={{
            backgroundColor: 'var(--liquid-fill-soft)',
            color: 'var(--liquid-muted)',
            border: '1px dashed var(--liquid-separator)',
          }}
        >
          <Eye className="w-3.5 h-3.5" /> 包含剧透内容，点击显示
        </button>
      ) : (
        <p className="text-[14px] whitespace-pre-wrap leading-relaxed break-words">
          {cleanContent || '（空评论）'}
        </p>
      )}

      {item.replies.length > 0 && (
        <div
          className="mt-2 rounded-[14px] p-3.5 space-y-2"
          style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
        >
          {item.replies.map((rep) => (
            <div key={rep.cid} className="text-[12.5px] leading-relaxed break-words">
              <span className="font-semibold" style={{ color: 'var(--liquid-accent)' }}>
                {rep.username || '匿名'}：
              </span>
              <span style={{ color: 'var(--liquid-ink)' }}>{cleanHtmlText(rep.content)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlbumDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast, showCovers } = useAppStore();

  const [dlSheetOpen, setDlSheetOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [commentText, setCommentText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [epLayout, setEpLayout] = useState<'grid' | 'list'>('grid');
  const [epReverse, setEpReverse] = useState(false);

  const { data: album, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.getAlbum(id),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: api.listHistory,
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id, commentPage],
    queryFn: () => api.getComments(id, commentPage),
    enabled: !!id,
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

  const historyRecord = useMemo(() => history.find((h) => h.album_id === id), [history, id]);

  const sortedEpisodes = useMemo(() => {
    if (!album) return [];
    return epReverse ? [...album.episodes].reverse() : album.episodes;
  }, [album, epReverse]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="liquid-solid-card p-6 flex flex-col sm:flex-row gap-6">
          <div className="w-40 sm:w-48 aspect-[3/4] rounded-[18px] skeleton-shimmer mx-auto sm:mx-0" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 rounded-full skeleton-shimmer" />
            <div className="h-8 w-4/5 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-full rounded-lg skeleton-shimmer" />
            <div className="h-11 w-56 rounded-full skeleton-shimmer mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="liquid-solid-card p-8 text-center space-y-3">
        <p style={{ color: 'var(--liquid-danger)' }}>加载失败：{(error as Error)?.message || '未知错误'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-[42px] px-5 py-2 rounded-full text-[14px] font-medium cursor-pointer liquid-tactile"
          style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
        >
          返回
        </button>
      </div>
    );
  }

  const firstEp = album.episodes[0];
  const cleanDesc = cleanHtmlText(album.description);

  return (
    <div className="space-y-9">
      {/* Deep Sea Scenic Hero Banner with Clear Glass Controls */}
      <section className="relative overflow-hidden rounded-[28px] liquid-scene-stage text-white shadow-[0_20px_50px_-20px_rgba(19,37,41,0.45)]">
        {showCovers && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30 blur-3xl scale-125 bg-cover bg-center"
            style={{ backgroundImage: `url(${album.cover_url})` }}
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(125deg, rgba(23, 43, 50, 0.88) 16%, rgba(37, 65, 74, 0.62) 68%, rgba(23, 43, 50, 0.84) 100%)',
          }}
        />

        <div className="relative z-10 p-5 sm:p-8 space-y-6">
          <LiquidGlass variant="clear" tone="dark" radius={999} interactive className="inline-block">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13.5px] font-medium text-white cursor-pointer liquid-focus-ring"
            >
              <ArrowLeft className="w-4 h-4" /> 返回
            </button>
          </LiquidGlass>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
            <div
              className="w-40 sm:w-52 aspect-[3/4] rounded-[20px] overflow-hidden shrink-0 mx-auto sm:mx-0 shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.28)' }}
            >
              <CoverImage src={album.cover_url} alt={album.title} loading="eager" allowRetry />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px] tabular-nums text-white/80">
                  <span
                    className="px-2.5 py-0.5 rounded-full font-semibold text-[#C7E4E5]"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.14)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                    }}
                  >
                    JM{album.album_id}
                  </span>
                  <span>{album.views} 阅读</span>
                  <span>· {album.likes} 喜欢</span>
                  <span>· {album.page_count || '?'} 页</span>
                  {album.update_date && String(album.update_date) !== '0' && <span>· 更新 {album.update_date}</span>}
                </div>

                <h1 className="text-[24px] sm:text-[32px] font-semibold leading-[1.2] tracking-[-0.025em]">
                  {album.title}
                </h1>

                {cleanDesc && (
                  <p className="text-[13.5px] leading-relaxed line-clamp-3 text-white/78">
                    {cleanDesc}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {album.authors.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(a)}&type=author`)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer liquid-tactile"
                      style={{ backgroundColor: 'rgba(199, 228, 229, 0.22)', color: '#E4EFEB' }}
                    >
                      作者: {a}
                    </button>
                  ))}
                  {album.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(t)}&type=tag`)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12px] text-white/85 cursor-pointer liquid-tactile"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.11)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                      }}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floating Clear Glass Action Bar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {historyRecord ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/read/online/${album.album_id}/${historyRecord.photo_id}?page=${historyRecord.page_index}`
                      )
                    }
                    className="min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-[14.5px] font-semibold cursor-pointer liquid-tactile liquid-focus-ring"
                    style={{
                      backgroundColor: '#E4EFEB',
                      color: '#202929',
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <BookOpen className="w-4 h-4" /> 继续阅读 (第 {historyRecord.page_index + 1} 页)
                  </button>
                ) : (
                  firstEp && (
                    <button
                      type="button"
                      onClick={() => navigate(`/read/online/${album.album_id}/${firstEp.photo_id}`)}
                      className="min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-[14.5px] font-semibold cursor-pointer liquid-tactile liquid-focus-ring"
                      style={{
                        backgroundColor: '#E4EFEB',
                        color: '#202929',
                        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.9)',
                      }}
                    >
                      <BookOpen className="w-4 h-4" /> 开始阅读
                    </button>
                  )
                )}

                <LiquidGlass variant="clear" tone="dark" radius={999} interactive>
                  <button
                    type="button"
                    onClick={() => favMutation.mutate(album.is_favorite)}
                    className="min-h-[46px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium text-white cursor-pointer liquid-focus-ring"
                  >
                    <Heart
                      className="w-4 h-4"
                      color={album.is_favorite ? '#F4A2A6' : 'currentColor'}
                      fill={album.is_favorite ? '#F4A2A6' : 'none'}
                    />
                    {album.is_favorite ? '已收藏' : '收藏'}
                  </button>
                </LiquidGlass>

                <LiquidGlass variant="clear" tone="dark" radius={999} interactive>
                  <button
                    type="button"
                    onClick={() => setDlSheetOpen(true)}
                    className="min-h-[46px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium text-white cursor-pointer liquid-focus-ring"
                  >
                    <Download className="w-4 h-4" /> 下载
                  </button>
                </LiquidGlass>

                <LiquidGlass variant="clear" tone="dark" radius={999} interactive>
                  <button
                    type="button"
                    onClick={() => setCommentOpen(true)}
                    className="min-h-[46px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[14px] font-medium text-white cursor-pointer liquid-focus-ring"
                  >
                    <MessageCircle className="w-4 h-4" /> 评论 ({album.comment_count})
                  </button>
                </LiquidGlass>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 章节列表（Solid Reading Surface） */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">章节目录 ({album.episodes.length})</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEpReverse((r) => !r)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium cursor-pointer liquid-tactile liquid-focus-ring"
              style={{
                backgroundColor: 'var(--liquid-solid)',
                border: '1px solid var(--liquid-separator)',
              }}
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> {epReverse ? '倒序' : '正序'}
            </button>
            <button
              type="button"
              onClick={() => setEpLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium cursor-pointer liquid-tactile liquid-focus-ring"
              style={{
                backgroundColor: 'var(--liquid-solid)',
                border: '1px solid var(--liquid-separator)',
              }}
            >
              {epLayout === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              {epLayout === 'grid' ? '列表' : '网格'}
            </button>
          </div>
        </div>

        {epLayout === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sortedEpisodes.map((ep) => {
              const isCurrent = historyRecord?.photo_id === ep.photo_id;
              return (
                <button
                  key={ep.photo_id}
                  type="button"
                  onClick={() => navigate(`/read/online/${album.album_id}/${ep.photo_id}`)}
                  className="liquid-solid-card liquid-card-hover px-4 py-3.5 text-left cursor-pointer liquid-focus-ring"
                  style={{
                    backgroundColor: isCurrent ? 'var(--liquid-focus-soft)' : 'var(--liquid-solid)',
                    borderColor: isCurrent ? 'var(--liquid-focus)' : 'var(--liquid-rim-outer)',
                  }}
                >
                  <div
                    className="text-[13.5px] font-semibold truncate"
                    style={{ color: isCurrent ? 'var(--liquid-accent)' : 'var(--liquid-ink)' }}
                  >
                    第 {ep.index} 话 {ep.name || ''}
                  </div>
                  <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--liquid-muted)' }}>
                    {isCurrent ? '上次阅读' : `ID ${ep.photo_id}`}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <InsetGroup>
            {sortedEpisodes.map((ep, idx) => (
              <InsetRow
                key={ep.photo_id}
                label={`第 ${ep.index} 话 ${ep.name || ''}`}
                sublabel={`Photo ID: ${ep.photo_id}`}
                isLast={idx === sortedEpisodes.length - 1}
                onClick={() => navigate(`/read/online/${album.album_id}/${ep.photo_id}`)}
                right={
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
                    阅读
                  </span>
                }
              />
            ))}
          </InsetGroup>
        )}
      </section>

      {/* 内嵌精选评论预览 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">读者评论 ({album.comment_count})</h2>
          <button
            type="button"
            onClick={() => setCommentOpen(true)}
            className="text-[13px] font-semibold cursor-pointer liquid-focus-ring rounded-full px-2 py-1"
            style={{ color: 'var(--liquid-accent)' }}
          >
            发表 / 查看全部评论
          </button>
        </div>

        {commentsLoading ? (
          <div className="liquid-solid-card p-6 text-center text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
            正在加载评论...
          </div>
        ) : (commentsData?.comments?.length || 0) > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {commentsData!.comments.slice(0, 6).map((c) => (
              <CommentCard key={c.cid} item={c} />
            ))}
          </div>
        ) : (
          <div className="liquid-solid-card p-6 text-center text-[13.5px]" style={{ color: 'var(--liquid-muted)' }}>
            暂无评论，快来抢沙发吧
          </div>
        )}
      </section>

      {/* 相关推荐 */}
      {album.related.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">相关推荐</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
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

      {/* 完整评论区 Sheet */}
      <BottomSheet open={commentOpen} onClose={() => setCommentOpen(false)} title={`评论 (${album.comment_count})`}>
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentText.trim()) commentMutation.mutate();
            }}
            className="flex flex-col gap-2.5"
          >
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论（需登录 JM 账号）..."
              className="w-full rounded-[16px] p-3.5 text-[14px] outline-none resize-none liquid-focus-ring"
              style={{
                backgroundColor: 'var(--liquid-solid)',
                border: '1px solid var(--liquid-separator)',
              }}
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: 'var(--liquid-muted)' }}>
                <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
                包含剧透
              </label>
              <button
                type="submit"
                disabled={commentMutation.isPending || !commentText.trim()}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13.5px] font-semibold text-white cursor-pointer disabled:opacity-50 liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-scene)' }}
              >
                <Send className="w-3.5 h-3.5" /> 发送
              </button>
            </div>
          </form>

          {commentsLoading ? (
            <div className="py-8 text-center text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
              正在加载评论...
            </div>
          ) : (
            <div className="space-y-3">
              {(commentsData?.comments || []).map((c) => (
                <CommentCard key={c.cid} item={c} />
              ))}
              {commentsData && commentsData.comments.length === 0 && (
                <div className="py-8 text-center text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
                  暂无评论
                </div>
              )}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={commentPage <= 1}
                  onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                  className="min-h-[38px] px-4 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-40 cursor-pointer liquid-tactile"
                  style={{ backgroundColor: 'var(--liquid-solid)', border: '1px solid var(--liquid-separator)' }}
                >
                  上一页
                </button>
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--liquid-muted)' }}>
                  第 {commentPage} 页
                </span>
                <button
                  type="button"
                  disabled={(commentsData?.comments.length || 0) === 0}
                  onClick={() => setCommentPage((p) => p + 1)}
                  className="min-h-[38px] px-4 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-40 cursor-pointer liquid-tactile"
                  style={{ backgroundColor: 'var(--liquid-solid)', border: '1px solid var(--liquid-separator)' }}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
