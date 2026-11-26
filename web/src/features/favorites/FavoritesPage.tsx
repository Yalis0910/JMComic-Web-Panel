import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Download, LogOut, Trash2 } from 'lucide-react';
import { api, getPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { CoverImage } from '../../components/ios/CoverImage';
import { InsetGroup, PillSelect, SegmentedControl, SkeletonCardGrid } from '../../components/ios/IosControls';

export function FavoritesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppStore();

  const activeTab = (params.get('tab') as 'fav' | 'history') || 'fav';
  const [folderId, setFolderId] = useState('0');
  const [orderBy, setOrderBy] = useState('mr');
  const [page, setPage] = useState(1);

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
    },
    onError: (err: Error) => showToast(err.message, 'error'),
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ios-blue)' }}>
            LIBRARY &amp; ACCOUNT
          </p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight leading-tight">收藏与记录</h1>
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
          className="ios-card p-6 sm:p-7 max-w-md mx-auto space-y-4"
        >
          <div>
            <h2 className="text-[20px] font-bold">登录 JM 账号</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ios-label-secondary)' }}>
              凭据仅通过 AES-256-GCM 加密保存在本地服务端
            </p>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名或邮箱"
            className="w-full rounded-[12px] px-3.5 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-[12px] px-3.5 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
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
            className="w-full py-2.5 rounded-full text-[15px] font-semibold text-white cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--brand-gradient)' }}
          >
            {loginMutation.isPending ? '登录中...' : '登录'}
          </button>
        </form>
      )}

      {activeTab === 'fav' && status?.is_logged_in && (
        <>
          <div className="ios-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-bold text-white shrink-0 shadow-md"
                style={{ background: 'var(--brand-gradient)' }}
              >
                {status.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[17px] font-bold">{status.username}</span>
                  {Boolean(status.profile?.level_name) && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: 'var(--ios-accent-soft)', color: 'var(--ios-blue)' }}
                    >
                      Lv.{String(status.profile?.level ?? 1)} · {String(status.profile.level_name)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--ios-label-secondary)' }}>
                  <span>金币 {String(status.profile?.coin ?? 0)}</span>
                  <span>· 通道 {status.impl.toUpperCase()}</span>
                  {expPct > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span>EXP</span>
                      <span className="inline-block w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ios-fill-secondary)' }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, expPct)}%`, backgroundColor: 'var(--ios-blue)' }} />
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold text-white cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: 'var(--ios-blue)' }}
              >
                <CalendarCheck className="w-3.5 h-3.5" /> {checkinMutation.isPending ? '签到中...' : '每日签到'}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
              >
                <Download className="w-3.5 h-3.5" /> 导出 CSV
              </button>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)', color: 'var(--ios-red)' }}
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
          </div>

          {favLoading ? (
            <SkeletonCardGrid count={10} />
          ) : favError ? (
            <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
              加载失败：{(favError as Error).message}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(favData?.albums || []).map((a) => (
                  <ComicCard key={a.album_id} album={a} />
                ))}
              </div>
              {favData && favData.page_count > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-4 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-separator)' }}
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
                    className="px-4 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-separator)' }}
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
                className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--ios-red)' }}
              >
                清空全部记录
              </button>
            </div>
          )}

          {history.length === 0 ? (
            <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
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
                    className={`flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${
                      idx < history.length - 1 ? 'ios-hairline-b' : ''
                    }`}
                  >
                    <div className="w-12 aspect-[3/4] rounded-[10px] overflow-hidden shrink-0">
                      <CoverImage src={h.cover_url || `/api/v2/media/cover/${h.album_id}`} alt={h.title} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[14.5px] font-semibold truncate">{h.title || `JM${h.album_id}`}</div>
                      <div className="text-[12px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
                        第 {h.page_index + 1} / {h.total_pages || '?'} 页 ({pct}%) · {new Date(h.updated_at).toLocaleString()}
                      </div>
                      <div className="h-1.5 w-full max-w-xs rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ios-fill-secondary)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--ios-blue)' }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteHistory(h.album_id);
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                      }}
                      className="p-2 cursor-pointer opacity-60 hover:opacity-100"
                      style={{ color: 'var(--ios-red)' }}
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
    </div>
  );
}
