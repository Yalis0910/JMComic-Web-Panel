import React, { useEffect, useState } from 'react';
import { BookOpen, Eye, EyeOff, RotateCw } from 'lucide-react';
import { withPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';

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
  const showCovers = useAppStore((s) => s.showCovers);
  const coverPrivacyMode = useAppStore((s) => s.coverPrivacyMode);
  const effectiveMode = coverPrivacyMode || (showCovers ? 'show' : 'hide');
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');
  const [attempt, setAttempt] = useState(0);
  const [tempReveal, setTempReveal] = useState(false);

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
    setAttempt(0);
    setTempReveal(false);
  }, [src, effectiveMode]);

  if (effectiveMode === 'hide') {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <div
          className="h-full w-full flex flex-col items-center justify-center gap-1.5 px-3 text-center"
          style={{
            backgroundColor: 'var(--liquid-fill-soft)',
            color: 'var(--liquid-muted)',
          }}
        >
          <EyeOff className="w-5 h-5 opacity-55" />
          <span className="text-[11px] font-medium opacity-80">封面已隐藏</span>
        </div>
      </div>
    );
  }

  const isBlurred = effectiveMode === 'blur' && !tempReveal;
  const tokenized = src ? withPanelToken(src) : '';
  const effectiveSrc =
    tokenized && attempt > 0
      ? `${tokenized}${tokenized.includes('?') ? '&' : '?'}retry=${attempt}`
      : tokenized;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {status === 'loading' && <div className="absolute inset-0 skeleton-shimmer" />}

      {status !== 'error' && effectiveSrc ? (
        <>
          <img
            src={effectiveSrc}
            alt={alt}
            loading={loading}
            decoding="async"
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
            className={`h-full w-full object-cover transition-all duration-300 ${
              status === 'loaded' ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
            } ${isBlurred ? 'blur-xl scale-110' : ''}`}
          />
          {effectiveMode === 'blur' && status === 'loaded' && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTempReveal((v) => !v);
              }}
              title={isBlurred ? '点击临时预览封面' : '恢复模糊'}
              className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-medium text-white backdrop-blur-md cursor-pointer"
              style={{
                backgroundColor: 'rgba(15, 25, 32, 0.56)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              {isBlurred ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{isBlurred ? '预览' : '遮罩'}</span>
            </button>
          )}
        </>
      ) : (
        <div
          className="h-full w-full flex flex-col items-center justify-center gap-2 px-3 text-center"
          style={{
            background: 'linear-gradient(155deg, rgba(37, 65, 74, 0.14) 0%, rgba(199, 228, 229, 0.18) 100%)',
            color: 'var(--liquid-muted)',
          }}
        >
          <BookOpen className="w-6 h-6 opacity-50" />
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
              className="mt-0.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer liquid-tactile"
              style={{
                backgroundColor: 'var(--liquid-solid)',
                border: '1px solid var(--liquid-separator)',
                color: 'var(--liquid-accent)',
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
