import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Download,
  FolderHeart,
  Heart,
  LayoutGrid,
  List,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { api, type CommentItem, type DownloadTask } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { BottomSheet, InsetGroup, InsetRow } from '../../components/liquid/LiquidControls';
import { ComicCard } from '../../components/liquid/ComicCard';
import { CommentCard } from '../../components/liquid/CommentCard';
import { CoverImage } from '../../components/liquid/CoverImage';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { cleanHtmlText } from '../../utils/text';

export function AlbumDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast, showCovers } = useAppStore();

  const [dlSheetOpen, setDlSheetOpen] = useState(false);
  const [favSheetOpen, setFavSheetOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [epLayout, setEpLayout] = useState<'grid' | 'list'>('grid');
  const [epReverse, setEpReverse] = useState(false);

  const { data: album, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.getAlbum(id),
    enabled: !!id,
  });

  const { data: userStatus } = useQuery({
    queryKey: ['userStatus'],
    queryFn: api.getUserStatus,
  });

  const { data: favFoldersMeta } = useQuery({
    queryKey: ['favoritesFolders'],
    queryFn: () => api.getFavorites(1, '0', 'mr'),
    enabled: !!userStatus?.is_logged_in,
    staleTime: 5 * 60 * 1000,
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
    mutationFn: ({ isFav, folderId = '0' }: { isFav: boolean; folderId?: string }) =>
      isFav ? api.removeFavorite(id) : api.addFavorite(id, folderId),
    onSuccess: (_, vars) => {
      setFavSheetOpen(false);
      showToast(vars.isFav ? '已取消收藏' : '已加入收藏', 'success');
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
    mutationFn: () => api.postComment(id, commentText.trim(), replyTarget?.cid, spoiler),
    onSuccess: () => {
      setCommentText('');
      setReplyTarget(null);
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
                  {album.pub_date && String(album.pub_date) !== '0' && <span>· 发布 {album.pub_date}</span>}
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
                      key={`author-${a}`}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(a)}&type=author`)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer liquid-tactile"
                      style={{ backgroundColor: 'rgba(199, 228, 229, 0.22)', color: '#E4EFEB' }}
                    >
                      作者: {a}
                    </button>
                  ))}
                  {(album.works || []).map((w) => (
                    <button
                      key={`work-${w}`}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(w)}&type=work`)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer liquid-tactile"
                      style={{ backgroundColor: 'rgba(147, 197, 253, 0.20)', color: '#E0F2FE' }}
                    >
                      原作: {w}
                    </button>
                  ))}
                  {(album.actors || []).map((act) => (
                    <button
                      key={`actor-${act}`}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(act)}&type=actor`)}
                      className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer liquid-tactile"
                      style={{ backgroundColor: 'rgba(244, 162, 166, 0.20)', color: '#FCE7F3' }}
                    >
                      角色: {act}
                    </button>
                  ))}
                  {album.tags.map((t) => (
                    <button
                      key={`tag-${t}`}
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
                    onClick={() => {
                      const folders = favFoldersMeta?.folders || [];
                      if (!album.is_favorite && folders.length > 0) {
                        setFavSheetOpen(true);
                      } else {
                        favMutation.mutate({ isFav: album.is_favorite });
                      }
                    }}
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
              <CommentCard
                key={c.cid}
                item={c}
                onReply={(target) => {
                  setReplyTarget(target);
                  setCommentOpen(true);
                }}
              />
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

      {/* 选夹收藏 Sheet */}
      <BottomSheet open={favSheetOpen} onClose={() => setFavSheetOpen(false)} title="选择收藏夹">
        <InsetGroup>
          <InsetRow
            label="默认收藏夹"
            sublabel="不指定分类直接收藏"
            icon={<FolderHeart className="w-4 h-4" />}
            isLast={(favFoldersMeta?.folders?.length || 0) === 0}
            onClick={() => favMutation.mutate({ isFav: false, folderId: '0' })}
          />
          {(favFoldersMeta?.folders || []).map((f, idx, arr) => (
            <InsetRow
              key={f.folder_id}
              label={f.name}
              sublabel={`收藏夹 #${f.folder_id}`}
              icon={<FolderHeart className="w-4 h-4" />}
              isLast={idx === arr.length - 1}
              onClick={() => favMutation.mutate({ isFav: false, folderId: f.folder_id })}
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
            {replyTarget && (
              <div
                className="flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full text-[12.5px]"
                style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
              >
                <span className="truncate font-medium">
                  正在回复 @{replyTarget.username || '匿名读者'}：{cleanHtmlText(replyTarget.content).slice(0, 28)}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="shrink-0 cursor-pointer opacity-80 hover:opacity-100"
                  aria-label="取消回复"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyTarget ? `回复 @${replyTarget.username || '匿名读者'}...` : '写下你的评论（需登录 JM 账号）...'}
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
                <Send className="w-3.5 h-3.5" /> {replyTarget ? '发送回复' : '发送'}
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
                <CommentCard key={c.cid} item={c} onReply={setReplyTarget} />
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
