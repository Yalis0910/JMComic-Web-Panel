import React from 'react';

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
      className={`inline-flex items-center rounded-[10px] p-[3px] select-none ${className}`}
      style={{ backgroundColor: 'var(--ios-fill-secondary)' }}
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
            className="px-3.5 py-1.5 text-[13px] font-medium rounded-[7px] transition-all duration-200 ios-spring cursor-pointer"
            style={{
              backgroundColor: active ? 'var(--ios-bg-secondary)' : 'transparent',
              color: active ? 'var(--ios-label-primary)' : 'var(--ios-label-secondary)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
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
      className="relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full p-[2px] transition-colors duration-200 ios-spring disabled:opacity-50"
      style={{
        backgroundColor: checked ? 'var(--ios-green)' : 'var(--ios-fill-primary)',
      }}
    >
      <span
        className="inline-block h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ios-spring"
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
          className="px-4 pb-1.5 text-[13px] font-normal uppercase tracking-wide"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          {title}
        </h3>
      )}
      <div className="ios-grouped-list">{children}</div>
      {footer && (
        <p className="px-4 pt-1.5 text-[12px]" style={{ color: 'var(--ios-label-secondary)' }}>
          {footer}
        </p>
      )}
    </section>
  );
}

export function InsetRow({
  label,
  sublabel,
  right,
  onClick,
  destructive = false,
  isLast = false,
}: {
  label: string;
  sublabel?: string;
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
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
        onClick ? 'cursor-pointer active:opacity-70' : ''
      } ${isLast ? '' : 'ios-hairline-b'}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[15px] font-normal truncate"
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-[22px] sm:rounded-[20px] shadow-2xl overflow-hidden animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)]"
        style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-9 rounded-full" style={{ backgroundColor: 'var(--ios-fill-primary)' }} />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 ios-hairline-b">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[15px] font-medium cursor-pointer"
              style={{ color: 'var(--ios-blue)' }}
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
