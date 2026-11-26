import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  generateOpticalDisplacementMap,
  supportsBackdropSvgFilter,
} from '../../lib/liquidGlassOptics';

export type LiquidGlassVariant = 'clear' | 'tinted';
export type LiquidGlassBackdropTone = 'auto' | 'dark' | 'light';

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LiquidGlassVariant;
  tone?: LiquidGlassBackdropTone;
  radius?: number;
  bezelWidth?: number;
  refraction?: number;
  blurPx?: number;
  interactive?: boolean;
  draggable?: boolean;
  children: React.ReactNode;
}

export function LiquidGlass({
  variant = 'clear',
  tone = 'auto',
  radius = 24,
  bezelWidth = 16,
  refraction = 14,
  blurPx,
  interactive = false,
  draggable = false,
  className = '',
  style,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...rest
}: LiquidGlassProps) {
  const rawId = useId();
  const filterId = useMemo(() => `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);
  const rootRef = useRef<HTMLDivElement>(null);

  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [pressed, setPressed] = useState(false);
  const [dragStretch, setDragStretch] = useState({ sx: 1, sy: 1, tx: 0, ty: 0 });
  const [glintAngle, setGlintAngle] = useState(165);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  const canUseSvgOptics = useMemo(() => supportsBackdropSvgFilter(), []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width / 4) * 4;
      const h = Math.round(rect.height / 4) * 4;
      setDims((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    update();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    observer.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const opticalMap = useMemo(() => {
    if (!canUseSvgOptics || dims.width < 20 || dims.height < 20) return null;
    return generateOpticalDisplacementMap({
      width: dims.width,
      height: dims.height,
      radius,
      bezelWidth,
      maxDisplacement: variant === 'clear' ? refraction : Math.round(refraction * 0.65),
    });
  }, [canUseSvgOptics, dims.width, dims.height, radius, bezelWidth, refraction, variant]);

  const effectiveBlur = blurPx ?? (variant === 'clear' ? (opticalMap ? 3 : 12) : 18);

  const fillColor =
    variant === 'tinted'
      ? 'var(--liquid-tinted-fill)'
      : tone === 'dark'
        ? 'var(--liquid-clear-on-dark)'
        : tone === 'light'
          ? 'var(--liquid-clear-on-paper)'
          : 'var(--liquid-clear-on-paper)';

  const backdropStyle: React.CSSProperties = {
    borderRadius: radius,
    backgroundColor: fillColor,
    backdropFilter: opticalMap
      ? `url(#${filterId}) blur(${effectiveBlur}px) saturate(145%)`
      : `blur(${effectiveBlur}px) saturate(145%)`,
    WebkitBackdropFilter: `blur(${effectiveBlur}px) saturate(145%)`,
  };

  const resetGesture = () => {
    setPressed(false);
    dragOrigin.current = null;
    setDragStretch({ sx: 1, sy: 1, tx: 0, ty: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    if (!interactive && !draggable) return;
    setPressed(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    const el = rootRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        setGlintAngle(Math.round(165 + relX * 26));
      }
    }
    if (!draggable || !pressed || !dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    const stretchX = Math.min(0.038, Math.abs(dx) / 480);
    const stretchY = Math.min(0.032, Math.abs(dy) / 480);
    setDragStretch({
      sx: 0.96 + stretchX - stretchY * 0.4,
      sy: 0.96 + stretchY - stretchX * 0.4,
      tx: Math.max(-6, Math.min(6, dx * 0.12)),
      ty: Math.max(-4, Math.min(4, dy * 0.1)),
    });
  };

  const transformValue = pressed
    ? `translate3d(${dragStretch.tx}px, ${dragStretch.ty}px, 0) scale(${dragStretch.sx}, ${dragStretch.sy})`
    : 'translate3d(0, 0, 0) scale(1)';

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        resetGesture();
      }}
      onPointerCancel={(e) => {
        onPointerCancel?.(e);
        resetGesture();
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        if (pressed) resetGesture();
      }}
      className={`relative isolate ${className}`}
      style={{
        borderRadius: radius,
        boxShadow: variant === 'tinted' ? 'var(--liquid-shadow-panel)' : 'var(--liquid-shadow-control)',
        transform: interactive || draggable ? transformValue : undefined,
        transition: pressed
          ? 'transform var(--liquid-press) ease-out, box-shadow var(--liquid-ease-out)'
          : 'transform var(--liquid-release), box-shadow var(--liquid-ease-out)',
        ...style,
      }}
      {...rest}
    >
      {/* Hidden SVG optical displacement filter (Chromium real rim refraction) */}
      {opticalMap && (
        <svg
          aria-hidden="true"
          style={{
            position: 'fixed',
            width: 0,
            height: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <filter
              id={filterId}
              x="0"
              y="0"
              width={opticalMap.width}
              height={opticalMap.height}
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={opticalMap.dataUrl}
                x="0"
                y="0"
                width={opticalMap.width}
                height={opticalMap.height}
                preserveAspectRatio="none"
                result="dispMap"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="dispMap"
                scale={opticalMap.scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* Optical backdrop layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={backdropStyle}
      />

      {/* Directional 1px specular rim & thickness highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow:
            variant === 'clear'
              ? 'inset 0 0 0 1px var(--liquid-rim), inset 0 1px 0 var(--liquid-glint), inset 0 -1px 0 rgba(255, 255, 255, 0.12)'
              : 'inset 0 0 0 1px var(--liquid-rim-outer), inset 0 1px 0 var(--liquid-glint)',
          background: `linear-gradient(${glintAngle}deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 18%, transparent 45%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
