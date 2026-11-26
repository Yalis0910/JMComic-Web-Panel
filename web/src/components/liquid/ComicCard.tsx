import React from 'react';
import { Link } from 'react-router-dom';
import type { AlbumSummary } from '../../api/client';
import { CoverImage } from './CoverImage';

function RankPill({ rank }: { rank: number }) {
  const bg =
    rank === 1
      ? 'rgba(181, 117, 28, 0.88)'
      : rank === 2
        ? 'rgba(76, 93, 87, 0.88)'
        : rank === 3
          ? 'rgba(140, 88, 36, 0.88)'
          : 'rgba(15, 25, 32, 0.66)';

  return (
    <span
      className="absolute top-2.5 left-2.5 z-10 min-w-[28px] h-[24px] px-2 rounded-full text-[11px] font-semibold text-white flex items-center justify-center tabular-nums backdrop-blur-md"
      style={{
        backgroundColor: bg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42), 0 4px 10px rgba(0,0,0,0.22)',
      }}
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
    <article
      className="group liquid-solid-card liquid-card-hover p-2.5 cursor-pointer flex flex-col gap-2.5 h-full"
    >
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[16px]"
        style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
      >
        <CoverImage
          src={album.cover_url}
          alt={album.title}
          fallbackTitle={album.title || `JM${album.album_id}`}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0f1920]/65 via-[#0f1920]/15 to-transparent" />

        {typeof rank === 'number' && <RankPill rank={rank} />}

        {badge && (
          <span
            className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold text-white backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(15, 25, 32, 0.56)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)',
            }}
          >
            {badge}
          </span>
        )}

        {/* Clear Glass Metadata Chips over Cover Texture */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 text-[10.5px] text-white/95 font-medium">
          <span
            className="px-2 py-0.5 rounded-full backdrop-blur-md tabular-nums"
            style={{
              backgroundColor: 'rgba(15, 25, 32, 0.44)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
            }}
          >
            JM{album.album_id}
          </span>
          {album.category && (
            <span
              className="px-2 py-0.5 rounded-full backdrop-blur-md truncate max-w-[92px]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)',
              }}
            >
              {album.category}
            </span>
          )}
        </div>
      </div>

      {/* Solid Content Text Area */}
      <div className="px-1 pb-0.5 flex-1 flex flex-col justify-between gap-1">
        <h3
          className="text-[13.5px] font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-[var(--liquid-accent)]"
          style={{ color: 'var(--liquid-ink)' }}
          title={album.title}
        >
          {album.title || `JM${album.album_id}`}
        </h3>
        <p className="text-[11.5px] truncate" style={{ color: 'var(--liquid-muted)' }}>
          {album.author || (album.tags?.slice(0, 2).map((t) => `#${t}`).join(' ') || '精选漫画')}
        </p>
      </div>
    </article>
  );

  if (onClick) {
    return (
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        className="h-full rounded-[24px] liquid-focus-ring"
      >
        {inner}
      </div>
    );
  }
  return (
    <Link to={`/album/${album.album_id}`} className="block h-full rounded-[24px] liquid-focus-ring">
      {inner}
    </Link>
  );
}
