import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, Check, Download, LogOut, Sparkles, Trash2 } from 'lucide-react';
import { api, getPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/liquid/ComicCard';
import { CoverImage } from '../../components/liquid/CoverImage';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { BottomSheet, InsetGroup, PillSelect, SegmentedControl, SkeletonCardGrid } from '../../components/liquid/LiquidControls';

export function FavoritesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppStore();

  const activeTab = (params.get('tab') as 'fav' | 'history') || 'fav';
  const [folderId, setFolderId] = useState('0');
  const [orderBy, setOrderBy] = useState('mr');
  const [page, setPage] = useState(1);
  const [dailyOpen, setDailyOpen] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [impl, setImpl] = useState<'api' | 'html'>('api');

  const { data: status } = useQuery({
    queryKey: ['userStatus'],
    queryFn: api.getUserStatus,
  });

  const { data: favData, isLoading: favLoading, error: favError } = useQuery({
    queryKey: ['favorites', page, folderId, orderBy],
    queryFn: () => api.getFavorites(page, folderId, orderBy),
    enabled: !!status?.is_logged_in && activeTab === 'fav',
  });

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: api.listHistory,
    enabled: activeTab === 'history',
  });

  const loginMutation = useMutation({
    mutationFn: () => api.login(username.trim(), password, impl),
    onSuccess: () => {
      setPassword('');
      showToast('登录成功', 'success');
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      showToast('已退出登录');
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: api.dailyCheckin,
    onSuccess: (res) => {
      showToast(res.msg || (res.already_checked_in ? '今日已签到' : '签到成功'), 'success');
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dailyInfo'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const { data: dailyInfo, isLoading: dailyLoading, error: dailyError } = useQuery({
    queryKey: ['dailyInfo'],
    queryFn: api.getDailyInfo,
    enabled: !!status?.is_logged_in && dailyOpen,
  });

  const exportCsv = () => {
    const token = getPanelToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    window.open(`/api/v2/user/favorites/export${qs}`, '_blank');
  };

  const folderOptions = [
    { value: '0', label: '全部收藏夹' },
    ...(favData?.folders || []).map((f) => ({ value: f.folder_id, label: f.name })),
  ];

  const expPct = Number(status?.profile?.exp_percent ?? 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
            LIBRARY &amp; ACCOUNT
          </p>
          <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
            收藏与记录
          </h1>
        </div>
        <SegmentedControl
          value={activeTab}
          onChange={(t) => setParams({ tab: t })}
          options={[
            { value: 'fav', label: '云端收藏' },
            { value: 'history', label: '阅读历史' },
          ]}
        />
      </div>

      {activeTab === 'fav' && !status?.is_logged_in && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim() && password) loginMutation.mutate();
          }}
          className="liquid-solid-card p-7 sm:p-8 max-w-md mx-auto space-y-4"
        >
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">登录 JM 账号</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--liquid-muted)' }}>
              凭据仅通过 AES-256-GCM 加密保存在本地服务端
            </p>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名或邮箱"
            className="w-full min-h-[44px] rounded-full px-4 py-2.5 text-[15px] outline-none liquid-focus-ring"
            style={{ backgroundColor: 'var(--liquid-fill-soft)', border: '1px solid var(--liquid-separator)' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full min-h-[44px] rounded-full px-4 py-2.5 text-[15px] outline-none liquid-focus-ring"
            style={{ backgroundColor: 'var(--liquid-fill-soft)', border: '1px solid var(--liquid-separator)' }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--liquid-muted)' }}>
              登录通道
            </span>
            <SegmentedControl
              value={impl}
              onChange={setImpl}
              options={[
                { value: 'api', label: 'APP 端' },
                { value: 'html', label: '网页端' },
              ]}
            />
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full min-h-[46px] py-2.5 rounded-full text-[15px] font-semibold text-white cursor-pointer disabled:opacity-50 liquid-tactile"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            {loginMutation.isPending ? '登录中...' : '登录'}
          </button>
        </form>
      )}

      {activeTab === 'fav' && status?.is_logged_in && (
        <>
          <div className="liquid-solid-card p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-semibold text-white shrink-0"
                style={{ backgroundColor: 'var(--liquid-scene)' }}
              >
                {status.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[18px] font-semibold">{status.username}</span>
                  {Boolean(status.profile?.level_name) && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
                    >
                      Lv.{String(status.profile?.level ?? 1)} · {String(status.profile.level_name)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--liquid-muted)' }}>
                  <span>金币 {String(status.profile?.coin ?? 0)}</span>
                  <span>· 通道 {status.impl.toUpperCase()}</span>
                  {expPct > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span>EXP</span>
                      <span
                        className="inline-block w-16 h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--liquid-fill-mid)' }}
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.min(100, expPct)}%`, backgroundColor: 'var(--liquid-focus)' }}
                        />
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={checkinMutation.isPending}
                onClick={() => checkinMutation.mutate()}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white cursor-pointer disabled:opacity-60 liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-scene)' }}
              >
                <CalendarCheck className="w-3.5 h-3.5" /> {checkinMutation.isPending ? '签到中...' : '每日签到'}
              </button>
              <button
                type="button"
                onClick={() => setDailyOpen(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-fill-soft)', border: '1px solid var(--liquid-separator)' }}
              >
                <CalendarDays className="w-3.5 h-3.5" /> 签到日历
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-fill-soft)', border: '1px solid var(--liquid-separator)' }}
              >
                <Download className="w-3.5 h-3.5" /> 导出 CSV
              </button>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'rgba(197, 61, 67, 0.1)', color: 'var(--liquid-danger)' }}
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          </div>

          <LiquidGlass variant="tinted" radius={24} className="p-3.5 flex flex-wrap items-center gap-3">
            <PillSelect
              value={folderId}
              onChange={(v) => {
                setFolderId(v);
                setPage(1);
              }}
              options={folderOptions}
            />
            <SegmentedControl
              value={orderBy}
              onChange={(v) => {
                setOrderBy(v);
                setPage(1);
              }}
              options={[
                { value: 'mr', label: '收藏时间' },
                { value: 'mp', label: '更新时间' },
              ]}
            />
          </LiquidGlass>

          {favLoading ? (
            <SkeletonCardGrid count={10} />
          ) : favError ? (
            <div className="liquid-solid-card p-8 text-center text-[14px]" style={{ color: 'var(--liquid-danger)' }}>
              加载失败：{(favError as Error).message}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {(favData?.albums || []).map((a) => (
                  <ComicCard key={a.album_id} album={a} />
                ))}
              </div>
              {favData && favData.page_count > 1 && (
                <div className="flex items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="min-h-[42px] px-5 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer liquid-tactile"
                    style={{ backgroundColor: 'var(--liquid-solid)', border: '1px solid var(--liquid-separator)' }}
                  >
                    上一页
                  </button>
                  <span className="text-[13px] font-medium tabular-nums">
                    第 {page} / {favData.page_count} 页
                  </span>
                  <button
                    type="button"
                    disabled={page >= favData.page_count}
                    onClick={() => setPage((p) => p + 1)}
                    className="min-h-[42px] px-5 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer liquid-tactile"
                    style={{ backgroundColor: 'var(--liquid-solid)', border: '1px solid var(--liquid-separator)' }}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  await api.clearHistory();
                  queryClient.invalidateQueries({ queryKey: ['history'] });
                  showToast('阅读历史已清空');
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'rgba(197, 61, 67, 0.1)', color: 'var(--liquid-danger)' }}
              >
                清空全部记录
              </button>
            </div>
          )}

          {history.length === 0 ? (
            <div className="liquid-solid-card p-10 text-center text-[14px]" style={{ color: 'var(--liquid-muted)' }}>
              暂无阅读记录
            </div>
          ) : (
            <InsetGroup title={`最近阅读 (${history.length})`}>
              {history.map((h, idx) => {
                const pct = h.total_pages
                  ? Math.min(100, Math.round(((h.page_index + 1) / h.total_pages) * 100))
                  : 0;
                return (
                  <div
                    key={h.album_id}
                    onClick={() => navigate(`/read/online/${h.album_id}/${h.photo_id}?page=${h.page_index}`)}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-3.5 px-5 py-3.5 cursor-pointer hover:bg-black/[0.025] dark:hover:bg-white/[0.035] ${
                      idx < history.length - 1 ? 'liquid-hairline-b' : ''
                    }`}
                  >
                    <div className="w-12 aspect-[3/4] rounded-[10px] overflow-hidden shrink-0">
                      <CoverImage src={h.cover_url || `/api/v2/media/cover/${h.album_id}`} alt={h.title} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="text-[14.5px] font-semibold truncate">{h.title || `JM${h.album_id}`}</div>
                      <div className="text-[12px] tabular-nums" style={{ color: 'var(--liquid-muted)' }}>
                        第 {h.page_index + 1} / {h.total_pages || '?'} 页 ({pct}%) · {new Date(h.updated_at).toLocaleString()}
                      </div>
                      <div className="h-1.5 w-full max-w-xs rounded-full overflow-hidden" style={{ backgroundColor: 'var(--liquid-fill-soft)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--liquid-focus)' }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteHistory(h.album_id);
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                      }}
                      className="p-2 cursor-pointer opacity-65 hover:opacity-100"
                      style={{ color: 'var(--liquid-danger)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </InsetGroup>
          )}
        </div>
      )}

      {/* 签到日历 Sheet */}
      <BottomSheet open={dailyOpen} onClose={() => setDailyOpen(false)} title={dailyInfo?.event_name || '每日签到日历'}>
        {dailyLoading ? (
          <div className="py-10 text-center text-[13.5px]" style={{ color: 'var(--liquid-muted)' }}>
            正在获取签到日历...
          </div>
        ) : dailyError ? (
          <div className="py-8 text-center text-[13.5px]" style={{ color: 'var(--liquid-danger)' }}>
            获取失败：{(dailyError as Error).message}
          </div>
        ) : dailyInfo ? (
          <div className="space-y-5">
            <div className="liquid-solid-card p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold">
                  本月累计打卡 <span className="tabular-nums">{dailyInfo.streak_days}</span> 天
                </span>
                {dailyInfo.progress_text && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold tabular-nums"
                    style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
                  >
                    进度 {dailyInfo.progress_text}
                  </span>
                )}
              </div>
              {(dailyInfo.rewards.three_days_coin || dailyInfo.rewards.seven_days_coin) && (
                <div className="flex flex-wrap gap-2 text-[12px]" style={{ color: 'var(--liquid-muted)' }}>
                  {dailyInfo.rewards.three_days_coin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--liquid-fill-soft)' }}>
                      <Sparkles className="w-3 h-3" style={{ color: 'var(--liquid-accent)' }} />
                      满3天：+{dailyInfo.rewards.three_days_coin} 金币 / +{dailyInfo.rewards.three_days_exp} EXP
                    </span>
                  )}
                  {dailyInfo.rewards.seven_days_coin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--liquid-fill-soft)' }}>
                      <Sparkles className="w-3 h-3" style={{ color: 'var(--liquid-accent)' }} />
                      满7天：+{dailyInfo.rewards.seven_days_coin} 金币 / +{dailyInfo.rewards.seven_days_exp} EXP
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {dailyInfo.days.map((d) => {
                const isSigned = d.signed === true;
                const isMissed = d.signed === false;
                return (
                  <div
                    key={`${d.day}-${d.label}`}
                    className="aspect-square rounded-[14px] flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold relative"
                    style={{
                      backgroundColor: isSigned
                        ? 'var(--liquid-scene)'
                        : isMissed
                          ? 'var(--liquid-fill-soft)'
                          : 'var(--liquid-solid)',
                      color: isSigned ? '#ffffff' : isMissed ? 'var(--liquid-muted)' : 'var(--liquid-ink)',
                      border: d.bonus
                        ? '1.5px solid var(--liquid-accent)'
                        : '1px solid var(--liquid-separator)',
                    }}
                  >
                    <span className="tabular-nums">{d.label || d.day}</span>
                    {isSigned ? (
                      <Check className="w-3 h-3" />
                    ) : d.bonus ? (
                      <span className="text-[9px]" style={{ color: 'var(--liquid-accent)' }}>奖励</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={checkinMutation.isPending || dailyInfo.checked_in_today}
              onClick={() => checkinMutation.mutate()}
              className="w-full min-h-[44px] rounded-full text-[14px] font-semibold text-white cursor-pointer disabled:opacity-55 liquid-tactile"
              style={{ backgroundColor: 'var(--liquid-scene)' }}
            >
              {dailyInfo.checked_in_today ? '今日已完成打卡' : checkinMutation.isPending ? '签到中...' : '立即打卡签到'}
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
