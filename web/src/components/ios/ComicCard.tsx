import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import type { AlbumSummary } from '../../api/client';

export function ComicCard({
  album,
  badge,
  onClick,
}: {
  album: AlbumSummary;
  badge?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  const inner = (
    <div className="group flex flex-col gap-2 cursor-pointer">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px] transition-transform duration-200 ios-spring group-hover:scale-[1.02] group-active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--ios-fill-tertiary)',
          border: '0.5px solid var(--ios-separator)',
        }}
      >
        {!failed && album.cover_url ? (
          <img
            src={album.cover_url}
            alt={album.title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full flex flex-col items-center justify-center gap-1.5 px-2 text-center"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            <BookOpen className="w-6 h-6 opacity-50" />
            <span className="text-[11px] font-medium line-clamp-2">{album.title || `JM${album.album_id}`}</span>
          </div>
        )}
        {badge && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white backdrop-blur-md"
            style={{ backgroundColor: 'rgba(0,0,0,0.58)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="px-0.5">
        <div
          className="text-[13.5px] font-medium leading-snug line-clamp-2"
          style={{ color: 'var(--ios-label-primary)' }}
          title={album.title}
        >
          {album.title || `JM${album.album_id}`}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
          <span>JM{album.album_id}</span>
          {album.author && <span className="truncate">· {album.author}</span>}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div onClick={onClick} role="button" tabIndex={0}>
        {inner}
      </div>
    );
  }
  return <Link to={`/album/${album.album_id}`}>{inner}</Link>;
}
