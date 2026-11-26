import React, { useEffect, useState } from 'react';
import { BookOpen, RotateCw } from 'lucide-react';
import { withPanelToken } from '../../api/client';

export function CoverImage({
  src,
  alt,
  className = '',
  fallbackTitle,
  loading = 'lazy',
  allowRetry = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  loading?: 'lazy' | 'eager';
  allowRetry?: boolean;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
    setAttempt(0);
  }, [src]);

  const tokenized = src ? withPanelToken(src) : '';
  const effectiveSrc =
    tokenized && attempt > 0
      ? `${tokenized}${tokenized.includes('?') ? '&' : '?'}retry=${attempt}`
      : tokenized;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {status === 'loading' && <div className="absolute inset-0 skeleton-shimmer" />}

      {status !== 'error' && effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`h-full w-full object-cover transition-all duration-300 ${
            status === 'loaded' ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
          }`}
        />
      ) : (
        <div
          className="h-full w-full flex flex-col items-center justify-center gap-2 px-3 text-center"
          style={{
            background:
              'linear-gradient(155deg, rgba(79,70,229,0.12) 0%, rgba(236,72,153,0.08) 100%)',
            color: 'var(--ios-label-secondary)',
          }}
        >
          <BookOpen className="w-6 h-6 opacity-45" />
          <span className="text-[11px] font-medium line-clamp-2 leading-snug">
            {fallbackTitle || alt || '暂无封面'}
          </span>
          {allowRetry && src && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStatus('loading');
                setAttempt((a) => a + 1);
              }}
              className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--ios-bg-secondary)',
                border: '1px solid var(--ios-separator)',
                color: 'var(--ios-blue)',
              }}
            >
              <RotateCw className="w-3 h-3" /> 重试
            </button>
          )}
        </div>
      )}
    </div>
  );
}
