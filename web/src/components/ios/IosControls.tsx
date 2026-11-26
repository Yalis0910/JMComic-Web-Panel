import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface Option<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-[12px] p-[3px] select-none ${className}`}
      style={{
        backgroundColor: 'var(--ios-fill-secondary)',
        border: '1px solid var(--ios-separator)',
      }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="px-3.5 py-1.5 text-[13px] font-medium rounded-[9px] transition-all duration-200 ios-spring cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: active ? 'var(--ios-bg-secondary)' : 'transparent',
              color: active ? 'var(--ios-label-primary)' : 'var(--ios-label-secondary)',
              boxShadow: active ? 'var(--ios-shadow-sm)' : 'none',
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

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-between gap-2.5 rounded-[12px] px-3.5 py-2 text-[13.5px] font-medium cursor-pointer transition-all hover:opacity-90"
        style={{
          backgroundColor: 'var(--ios-bg-secondary)',
          border: '1px solid var(--ios-separator)',
          boxShadow: 'var(--ios-shadow-sm)',
          color: 'var(--ios-label-primary)',
        }}
      >
        <span className="truncate max-w-[180px]">{current?.label || placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ios-label-secondary)' }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1.5 min-w-[180px] max-h-72 overflow-y-auto rounded-[14px] p-1.5 z-40 animate-fade-in"
          style={{
            backgroundColor: 'var(--ios-sheet-bg)',
            backdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--ios-separator)',
            boxShadow: 'var(--ios-shadow-lg)',
          }}
        >
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
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] text-[13.5px] text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--ios-accent-soft)' : 'transparent',
                  color: active ? 'var(--ios-blue)' : 'var(--ios-label-primary)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function IosSwitch({
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
      className="relative inline-flex h-[30px] w-[50px] shrink-0 cursor-pointer rounded-full p-[2px] transition-colors duration-200 ios-spring disabled:opacity-50"
      style={{
        backgroundColor: checked ? 'var(--ios-green)' : 'var(--ios-fill-primary)',
      }}
    >
      <span
        className="inline-block h-[26px] w-[26px] rounded-full bg-white shadow-md transition-transform duration-200 ios-spring"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
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
          className="px-4 pb-2 text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          {title}
        </h3>
      )}
      <div className="ios-grouped-list">{children}</div>
      {footer && (
        <p className="px-4 pt-2 text-[12px] leading-relaxed" style={{ color: 'var(--ios-label-secondary)' }}>
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
      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
        onClick ? 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:opacity-70' : ''
      } ${isLast ? '' : 'ios-hairline-b'}`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {icon && (
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              backgroundColor: destructive ? 'rgba(239,68,68,0.12)' : 'var(--ios-accent-soft)',
              color: destructive ? 'var(--ios-red)' : 'var(--ios-blue)',
            }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className="text-[14.5px] font-medium truncate"
            style={{ color: destructive ? 'var(--ios-red)' : 'var(--ios-label-primary)' }}
          >
            {label}
          </div>
          {sublabel && (
            <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--ios-label-secondary)' }}>
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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-[24px] sm:rounded-[22px] overflow-hidden animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)]"
        style={{
          backgroundColor: 'var(--ios-bg-secondary)',
          border: '1px solid var(--ios-separator)',
          boxShadow: 'var(--ios-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--ios-fill-primary)' }} />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 ios-hairline-b">
            <h3 className="text-[16.5px] font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-full text-[13.5px] font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--ios-accent-soft)', color: 'var(--ios-blue)' }}
            >
              完成
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-4 sm:p-5 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="ios-card p-5 sm:p-7 flex flex-col sm:flex-row gap-6 items-center">
      <div className="w-36 sm:w-44 aspect-[3/4] rounded-[16px] skeleton-shimmer shrink-0" />
      <div className="flex-1 w-full space-y-3.5">
        <div className="h-4 w-28 rounded-full skeleton-shimmer" />
        <div className="h-7 w-3/4 rounded-xl skeleton-shimmer" />
        <div className="h-4 w-1/2 rounded-lg skeleton-shimmer" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 w-28 rounded-full skeleton-shimmer" />
          <div className="h-9 w-24 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2.5">
          <div className="aspect-[3/4] w-full rounded-[16px] skeleton-shimmer" />
          <div className="h-4 w-5/6 rounded-md skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
