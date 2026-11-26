import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { api, setPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { LiquidGlass } from './LiquidGlass';

export function PinLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setPinRequired } = useAppStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.unlock(pin.trim());
      setPanelToken(res.token);
      setPinRequired(false);
      onUnlocked();
    } catch (err: any) {
      setError(err.message || 'PIN 错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 liquid-scene-stage">
      <LiquidGlass variant="tinted" radius={28} className="w-full max-w-xs p-7">
        <form onSubmit={submit} className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
          >
            <Lock className="w-5 h-5" />
          </div>
          <div className="text-center">
            <h2 className="text-[20px] font-semibold tracking-tight">局域网访问锁定</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--liquid-muted)' }}>
              请输入面板 PIN 码解锁访问
            </p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="输入 PIN 码"
            autoFocus
            className="w-full min-h-[46px] rounded-full px-4 py-2.5 text-center text-[17px] tracking-widest outline-none liquid-focus-ring"
            style={{
              backgroundColor: 'var(--liquid-solid)',
              border: '1px solid var(--liquid-separator)',
              color: 'var(--liquid-ink)',
            }}
          />
          {error && (
            <p className="text-[13px]" style={{ color: 'var(--liquid-danger)' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-full py-2.5 text-[15px] font-semibold text-white cursor-pointer disabled:opacity-60 liquid-tactile liquid-focus-ring"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            {loading ? '验证中...' : '解锁'}
          </button>
        </form>
      </LiquidGlass>
    </div>
  );
}
