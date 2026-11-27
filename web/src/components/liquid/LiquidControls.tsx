import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { LiquidGlass } from './LiquidGlass';

interface Option<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  onDark = false,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  onDark?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  useLayoutEffect(() => {
    const update = () => {
      const btn = btnRefs.current[activeIdx];
      if (!btn) return;
      setThumb({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [activeIdx, options]);

  return (
    <div
      ref={trackRef}
      className={`relative inline-flex items-center rounded-full p-1 select-none ${className}`}
      style={{
        backgroundColor: onDark ? 'rgba(255, 255, 255, 0.12)' : 'var(--liquid-fill-soft)',
        border: onDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid var(--liquid-separator)',
      }}
      role="tablist"
    >
      {thumb.width > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full pointer-events-none"
          style={{
            left: thumb.left,
            width: thumb.width,
            backgroundColor: onDark ? 'rgba(255, 255, 255, 0.22)' : 'var(--liquid-solid-elevated)',
            boxShadow: onDark
              ? 'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.22)'
              : '0 2px 8px rgba(19, 37, 41, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
            transition: 'left var(--liquid-release), width var(--liquid-release)',
          }}
        />
      )}

      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="relative z-10 min-h-[36px] px-3.5 py-1.5 text-[13px] font-medium rounded-full cursor-pointer whitespace-nowrap liquid-focus-ring liquid-tactile"
            style={{
              color: onDark
                ? active
                  ? '#ffffff'
                  : 'rgba(255, 255, 255, 0.72)'
                : active
                  ? 'var(--liquid-ink)'
                  : 'var(--liquid-muted)',
              fontWeight: active ? 600 : 500,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PillSelect<T extends string>({
  options,
  value,
  onChange,
  placeholder = '请选择',
  className = '',
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
    openUp: boolean;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > 240;
    const minWidth = Math.max(240, rect.width);
    const maxAllowedLeft = Math.max(12, window.innerWidth - minWidth - 12);
    const left = Math.max(12, Math.min(rect.left, maxAllowedLeft));
    setMenuPos({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left,
      minWidth,
      openUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inRoot = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inRoot && !inMenu) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[42px] items-center justify-between gap-2.5 rounded-full px-4 py-2 text-[13.5px] font-medium cursor-pointer liquid-tactile liquid-focus-ring"
        style={{
          backgroundColor: 'var(--liquid-solid)',
          border: '1px solid var(--liquid-rim-outer)',
          boxShadow: 'var(--liquid-shadow-card)',
          color: 'var(--liquid-ink)',
        }}
      >
        <span className="truncate max-w-[240px]">{current?.label || placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--liquid-muted)' }}
        />
      </button>

      {open &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[70] max-w-[340px] animate-liquid-in"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              transform: menuPos.openUp ? 'translateY(-100%)' : undefined,
            }}
          >
            <LiquidGlass variant="tinted" radius={24} className="p-1.5">
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className="w-full min-h-[42px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-[16px] text-[13.5px] text-left cursor-pointer transition-colors liquid-focus-ring"
                      style={{
                        backgroundColor: active ? 'var(--liquid-focus-soft)' : 'transparent',
                        color: active ? 'var(--liquid-accent)' : 'var(--liquid-ink)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </LiquidGlass>
          </div>,
          document.body
        )}
    </div>
  );
}

export function PaginationBar({
  page,
  pageCount,
  hasNext,
  onPageChange,
  compact = false,
}: {
  page: number;
  pageCount?: number;
  hasNext?: boolean;
  onPageChange: (nextPage: number) => void;
  compact?: boolean;
}) {
  const [jumpInput, setJumpInput] = useState(String(page));

  useEffect(() => {
    setJumpInput(String(page));
  }, [page]);

  const canNext = pageCount && pageCount > 0 ? page < pageCount : (hasNext ?? true);
  const btnHeight = compact ? 'min-h-[38px] px-4 py-1.5 text-[12.5px]' : 'min-h-[42px] px-5 py-2 text-[13.5px]';

  const submitJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setJumpInput(String(page));
      return;
    }
    const target = pageCount && pageCount > 0 ? Math.min(pageCount, parsed) : parsed;
    setJumpInput(String(target));
    if (target !== page) {
      onPageChange(target);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className={`${btnHeight} rounded-full font-semibold disabled:opacity-40 cursor-pointer liquid-tactile`}
        style={{
          backgroundColor: 'var(--liquid-solid)',
          border: '1px solid var(--liquid-separator)',
          boxShadow: 'var(--liquid-shadow-card)',
        }}
      >
        上一页
      </button>

      <span className="text-[13px] font-medium tabular-nums px-2" style={{ color: 'var(--liquid-muted)' }}>
        {pageCount && pageCount > 0 ? `第 ${page} / ${pageCount} 页` : `第 ${page} 页`}
      </span>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className={`${btnHeight} rounded-full font-semibold disabled:opacity-40 cursor-pointer liquid-tactile`}
        style={{
          backgroundColor: 'var(--liquid-solid)',
          border: '1px solid var(--liquid-separator)',
          boxShadow: 'var(--liquid-shadow-card)',
        }}
      >
        下一页
      </button>

      <form onSubmit={submitJump} className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={pageCount && pageCount > 0 ? pageCount : undefined}
          inputMode="numeric"
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          aria-label="跳转到指定页"
          className={`${compact ? 'w-14 h-[36px]' : 'w-16 h-[40px]'} rounded-full px-3 text-center text-[13px] tabular-nums outline-none liquid-focus-ring`}
          style={{
            backgroundColor: 'var(--liquid-solid)',
            border: '1px solid var(--liquid-separator)',
            color: 'var(--liquid-ink)',
          }}
        />
        <button
          type="submit"
          className={`${compact ? 'min-h-[36px] px-3.5 text-[12.5px]' : 'min-h-[40px] px-4 text-[13px]'} rounded-full font-semibold cursor-pointer liquid-tactile`}
          style={{
            backgroundColor: 'var(--liquid-focus-soft)',
            color: 'var(--liquid-accent)',
          }}
        >
          跳转
        </button>
      </form>
    </div>
  );
}

export function LiquidSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex h-[32px] w-[54px] shrink-0 cursor-pointer rounded-full p-[3px] transition-colors duration-200 disabled:opacity-50 liquid-focus-ring"
      style={{
        backgroundColor: checked ? 'var(--liquid-focus)' : 'var(--liquid-fill-mid)',
        boxShadow: 'inset 0 1px 2px rgba(19, 37, 41, 0.14)',
      }}
    >
      <span
        className="inline-block h-[26px] w-[26px] rounded-full bg-white shadow-md"
        style={{
          transform: checked ? 'translateX(22px)' : 'translateX(0px)',
          transition: 'transform var(--liquid-release)',
        }}
      />
    </button>
  );
}

export function InsetGroup({
  title,
  footer,
  children,
  className = '',
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <h3
          className="px-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.04em]"
          style={{ color: 'var(--liquid-muted)' }}
        >
          {title}
        </h3>
      )}
      <div className="liquid-grouped-list">{children}</div>
      {footer && (
        <p className="px-4 pt-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--liquid-muted)' }}>
          {footer}
        </p>
      )}
    </section>
  );
}

export function InsetRow({
  label,
  sublabel,
  icon,
  right,
  onClick,
  destructive = false,
  isLast = false,
}: {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full min-h-[52px] flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors liquid-focus-ring ${
        onClick ? 'cursor-pointer hover:bg-black/[0.025] dark:hover:bg-white/[0.035] active:opacity-75' : ''
      } ${isLast ? '' : 'liquid-hairline-b'}`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {icon && (
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              backgroundColor: destructive ? 'rgba(197, 61, 67, 0.12)' : 'var(--liquid-focus-soft)',
              color: destructive ? 'var(--liquid-danger)' : 'var(--liquid-accent)',
            }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className="text-[14.5px] font-medium truncate"
            style={{ color: destructive ? 'var(--liquid-danger)' : 'var(--liquid-ink)' }}
          >
            {label}
          </div>
          {sublabel && (
            <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--liquid-muted)' }}>
              {sublabel}
            </div>
          )}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </Comp>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] overflow-hidden liquid-tinted-surface animate-[liquidSlideUp_0.34s_cubic-bezier(0.26,1.55,0.52,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--liquid-fill-mid)' }} />
        </div>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 liquid-hairline-b">
            <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[34px] px-4 py-1 rounded-full text-[13px] font-semibold cursor-pointer liquid-tactile liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
            >
              完成
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5 sm:p-6 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="liquid-solid-card p-6 sm:p-7 flex flex-col sm:flex-row gap-6 items-center">
      <div className="w-36 sm:w-44 aspect-[3/4] rounded-[18px] skeleton-shimmer shrink-0" />
      <div className="flex-1 w-full space-y-3.5">
        <div className="h-4 w-28 rounded-full skeleton-shimmer" />
        <div className="h-7 w-3/4 rounded-xl skeleton-shimmer" />
        <div className="h-4 w-1/2 rounded-lg skeleton-shimmer" />
        <div className="flex gap-2 pt-2">
          <div className="h-10 w-28 rounded-full skeleton-shimmer" />
          <div className="h-10 w-24 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="liquid-solid-card p-2.5 space-y-2.5">
          <div className="aspect-[3/4] w-full rounded-[16px] skeleton-shimmer" />
          <div className="h-4 w-5/6 rounded-md skeleton-shimmer mx-1" />
          <div className="h-3 w-1/2 rounded-md skeleton-shimmer mx-1 mb-1" />
        </div>
      ))}
    </div>
  );
}
