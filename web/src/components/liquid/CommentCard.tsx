import React, { useState } from 'react';
import { ArrowUpRight, Eye, MessageSquareReply, ThumbsUp } from 'lucide-react';
import type { CommentItem } from '../../api/client';
import { cleanHtmlText } from '../../utils/text';

const AVATAR_PALETTES = ['#25414A', '#355B63', '#557B79', '#3E6B66', '#4A5E6D'];

function avatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

export function CommentCard({
  item,
  onReply,
  onOpenAlbum,
}: {
  item: CommentItem;
  onReply?: (comment: CommentItem) => void;
  onOpenAlbum?: (albumId: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const cleanContent = cleanHtmlText(item.content);
  const name = item.username || '匿名读者';

  return (
    <div className="liquid-solid-card p-5 space-y-2.5 flex flex-col justify-between">
      <div className="space-y-2.5">
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

      {(onReply || (onOpenAlbum && item.album_id)) && (
        <div className="flex items-center justify-end gap-2 pt-1">
          {onOpenAlbum && item.album_id && (
            <button
              type="button"
              onClick={() => onOpenAlbum(item.album_id!)}
              className="min-h-[30px] inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer liquid-tactile"
              style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
            >
              查看漫画 JM{item.album_id} <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(item)}
              className="min-h-[30px] inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer liquid-tactile"
              style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-muted)' }}
            >
              <MessageSquareReply className="w-3.5 h-3.5" /> 回复
            </button>
          )}
        </div>
      )}
    </div>
  );
}
