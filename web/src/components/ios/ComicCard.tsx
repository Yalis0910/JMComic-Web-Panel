import React from 'react';
import { Link } from 'react-router-dom';
import type { AlbumSummary } from '../../api/client';
import { CoverImage } from './CoverImage';

function RankBadge({ rank }: { rank: number }) {
  const palette =
    rank === 1
      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
      : rank === 2
        ? 'linear-gradient(135deg, #94a3b8, #64748b)'
        : rank === 3
          ? 'linear-gradient(135deg, #d97706, #92400e)'
          : 'rgba(15, 23, 42, 0.72)';

  return (
    <span
      className="absolute top-2.5 left-2.5 z-10 min-w-[26px] h-[24px] px-2 rounded-full text-[11px] font-bold text-white flex items-center justify-center shadow-md tabular-nums backdrop-blur-md"
      style={{ background: palette }}
    >
      #{rank}
    </span>
  );
}

export function ComicCard({
  album,
  badge,
  rank,
  onClick,
}: {
  album: AlbumSummary;
  badge?: string;
  rank?: number;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className="group card-lift rounded-[18px] p-2 transition-all cursor-pointer flex flex-col gap-2.5 h-full"
      style={{
        backgroundColor: 'var(--ios-bg-secondary)',
        border: '1px solid var(--ios-separator)',
        boxShadow: 'var(--ios-shadow-sm)',
      }}
    >
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[13px]"
        style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
      >
        <CoverImage
          src={album.cover_url}
          alt={album.title}
          fallbackTitle={album.title || `JM${album.album_id}`}
          className="transition-transform duration-300 ios-spring group-hover:scale-[1.04]"
        />

        {/* 底部柔和暗角，保证角标可读性 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 via-black/15 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

        {typeof rank === 'number' && <RankBadge rank={rank} />}

        {badge && (
          <span
            className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-white backdrop-blur-md shadow-xs"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.68)' }}
          >
            {badge}
          </span>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 text-[10.5px] text-white/90 font-medium">
          <span className="px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-sm tabular-nums">
            JM{album.album_id}
          </span>
          {album.category && (
            <span className="px-1.5 py-0.5 rounded-md bg-white/18 backdrop-blur-sm truncate max-w-[90px]">
              {album.category}
            </span>
          )}
        </div>
      </div>

      <div className="px-1 pb-1 flex-1 flex flex-col justify-between gap-1">
        <div
          className="text-[13.5px] font-semibold leading-snug line-clamp-2 group-hover:text-[var(--ios-blue)] transition-colors"
          style={{ color: 'var(--ios-label-primary)' }}
          title={album.title}
        >
          {album.title || `JM${album.album_id}`}
        </div>
        <div
          className="text-[11.5px] truncate"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          {album.author || (album.tags?.slice(0, 2).map((t) => `#${t}`).join(' ') || '精选漫画')}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div onClick={onClick} role="button" tabIndex={0} className="h-full">
        {inner}
      </div>
    );
  }
  return (
    <Link to={`/album/${album.album_id}`} className="block h-full">
      {inner}
    </Link>
  );
}
