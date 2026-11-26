import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, LogOut, Trash2 } from 'lucide-react';
import { api, getPanelToken } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { InsetGroup, InsetRow, SegmentedControl } from '../../components/ios/IosControls';

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

  const exportCsv = () => {
    const token = getPanelToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    window.open(`/api/v2/user/favorites/export${qs}`, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">我的</h1>
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
          className="ios-card p-6 max-w-md mx-auto space-y-4"
        >
          <div>
            <h2 className="text-[20px] font-semibold">登录 JMComic 账号</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ios-label-secondary)' }}>
              凭据仅通过 AES-256-GCM 加密保存在本地服务端
            </p>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名或邮箱"
            className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
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
            className="w-full py-2.5 rounded-xl text-[15px] font-semibold text-white cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--ios-blue)' }}
          >
            {loginMutation.isPending ? '登录中...' : '登录'}
          </button>
        </form>
      )}

      {activeTab === 'fav' && status?.is_logged_in && (
        <>
          <div className="ios-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[17px] font-bold text-white"
                style={{ backgroundColor: 'var(--ios-blue)' }}
              >
                {status.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="text-[16px] font-semibold">{status.username}</div>
                <div className="text-[12px]" style={{ color: 'var(--ios-label-secondary)' }}>
                  {status.profile?.level_name
                    ? `${String(status.profile.level_name)} · 金币 ${String(status.profile.coin ?? 0)}`
                    : `通道: ${status.impl.toUpperCase()}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                <Download className="w-3.5 h-3.5" /> 导出 CSV
              </button>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)', color: 'var(--ios-red)' }}
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={folderId}
              onChange={(e) => {
                setFolderId(e.target.value);
                setPage(1);
              }}
              className="rounded-xl px-3 py-2 text-[14px] outline-none"
              style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
            >
              <option value="0">全部收藏夹</option>
              {(favData?.folders || []).map((f) => (
                <option key={f.folder_id} value={f.folder_id}>
                  {f.name}
                </option>
              ))}
            </select>
            <SegmentedControl
              value={orderBy}
              onChange={(v) => {
                setOrderBy(v);
                setPage(1);
              }}
              options={[
                { value: 'mr', label: '收藏时间' },
                { value: 'mv', label: '更新时间' },
              ]}
            />
          </div>

          {favLoading ? (
            <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
              加载收藏夹...
            </div>
          ) : favError ? (
            <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
              加载失败：{(favError as Error).message}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
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
                    className="px-4 py-2 rounded-xl text-[14px] font-medium disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
                  >
                    上一页
                  </button>
                  <span className="text-[13px] tabular-nums">
                    {page} / {favData.page_count}
                  </span>
                  <button
                    type="button"
                    disabled={page >= favData.page_count}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 rounded-xl text-[14px] font-medium disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                await api.clearHistory();
                queryClient.invalidateQueries({ queryKey: ['history'] });
                showToast('阅读历史已清空');
              }}
              className="text-[13px] font-medium cursor-pointer"
              style={{ color: 'var(--ios-red)' }}
            >
              清空全部记录
            </button>
          </div>
          {history.length === 0 ? (
            <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
              暂无阅读记录
            </div>
          ) : (
            <InsetGroup title={`最近阅读 (${history.length})`}>
              {history.map((h, idx) => (
                <InsetRow
                  key={h.album_id}
                  label={h.title || `JM${h.album_id}`}
                  sublabel={`读到第 ${h.page_index + 1} / ${h.total_pages || '?'} 页 · ${new Date(h.updated_at).toLocaleString()}`}
                  isLast={idx === history.length - 1}
                  onClick={() => navigate(`/read/online/${h.album_id}/${h.photo_id}?page=${h.page_index}`)}
                  right={
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteHistory(h.album_id);
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                      }}
                      className="p-1.5 cursor-pointer opacity-60 hover:opacity-100"
                      style={{ color: 'var(--ios-red)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  }
                />
              ))}
            </InsetGroup>
          )}
        </div>
      )}
    </div>
  );
}
