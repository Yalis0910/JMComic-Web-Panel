import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { api, setPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--ios-bg-grouped)' }}
    >
      <form onSubmit={submit} className="ios-card w-full max-w-xs p-6 flex flex-col items-center gap-4 shadow-xl">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--ios-fill-secondary)', color: 'var(--ios-blue)' }}
        >
          <Lock className="w-6 h-6" />
        </div>
        <div className="text-center">
          <h2 className="text-[19px] font-semibold">局域网访问锁定</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ios-label-secondary)' }}>
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
          className="w-full rounded-xl px-4 py-2.5 text-center text-[17px] tracking-widest outline-none"
          style={{
            backgroundColor: 'var(--ios-fill-tertiary)',
            border: '0.5px solid var(--ios-separator)',
          }}
        />
        {error && (
          <p className="text-[13px]" style={{ color: 'var(--ios-red)' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-[15px] font-semibold text-white cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: 'var(--ios-blue)' }}
        >
          {loading ? '验证中...' : '解锁'}
        </button>
      </form>
    </div>
  );
}
