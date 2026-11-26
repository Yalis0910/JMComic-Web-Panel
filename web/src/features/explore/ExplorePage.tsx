import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ComicCard } from '../../components/ios/ComicCard';
import { SegmentedControl } from '../../components/ios/IosControls';

const CATEGORIES = [
  { value: '0', label: '全部' },
  { value: 'doujin', label: '同人' },
  { value: 'single', label: '单行本' },
  { value: 'short', label: '短篇' },
  { value: 'hanman', label: '韩漫' },
  { value: 'meiman', label: '美漫' },
  { value: 'another', label: '其他' },
];

export function ExplorePage() {
  const [tab, setTab] = useState<'ranking' | 'filter' | 'week'>('ranking');
  const [rankType, setRankType] = useState<'day' | 'week' | 'month'>('day');
  const [category, setCategory] = useState('0');
  const [orderBy, setOrderBy] = useState('mv');
  const [timeRange, setTimeRange] = useState('a');
  const [page, setPage] = useState(1);

  const [weekCatId, setWeekCatId] = useState('');
  const [weekTypeId, setWeekTypeId] = useState('manga');

  const rankQuery = useQuery({
    queryKey: ['ranking', rankType, page, category],
    queryFn: () => api.getRanking(rankType, page, category),
    enabled: tab === 'ranking',
  });

  const filterQuery = useQuery({
    queryKey: ['categoryFilter', page, timeRange, orderBy, category],
    queryFn: () => api.getCategoryFilter({ page, time: timeRange, order_by: orderBy, category }),
    enabled: tab === 'filter',
  });

  const weekMetaQuery = useQuery({
    queryKey: ['weekMeta'],
    queryFn: api.getWeekMeta,
    enabled: tab === 'week',
  });

  const activeWeekId = weekCatId || weekMetaQuery.data?.categories?.[0]?.id || '';
  const weekListQuery = useQuery({
    queryKey: ['weekFilter', activeWeekId, weekTypeId],
    queryFn: () => api.getWeekFilter(activeWeekId, weekTypeId),
    enabled: tab === 'week' && !!activeWeekId,
  });

  const activeData = tab === 'ranking' ? rankQuery.data : tab === 'filter' ? filterQuery.data : undefined;
  const isLoading =
    tab === 'ranking' ? rankQuery.isLoading : tab === 'filter' ? filterQuery.isLoading : weekListQuery.isLoading;
  const error = tab === 'ranking' ? rankQuery.error : tab === 'filter' ? filterQuery.error : weekListQuery.error;

  const albums = tab === 'week' ? weekListQuery.data?.albums || [] : activeData?.albums || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-[34px] font-bold tracking-tight leading-tight">分类与排行</h1>
        <SegmentedControl
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={[
            { value: 'ranking', label: '排行榜' },
            { value: 'filter', label: '分类筛选' },
            { value: 'week', label: '每周必看' },
          ]}
        />
      </div>

      {tab === 'ranking' && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={rankType}
            onChange={(v) => {
              setRankType(v);
              setPage(1);
            }}
            options={[
              { value: 'day', label: '日榜' },
              { value: 'week', label: '周榜' },
              { value: 'month', label: '月榜' },
            ]}
          />
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0"
                style={{
                  backgroundColor: category === c.value ? 'var(--ios-blue)' : 'var(--ios-fill-tertiary)',
                  color: category === c.value ? '#ffffff' : 'var(--ios-label-primary)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'filter' && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={orderBy}
            onChange={(v) => {
              setOrderBy(v);
              setPage(1);
            }}
            options={[
              { value: 'mv', label: '最多观看' },
              { value: 'tf', label: '最多点赞' },
              { value: 'mr', label: '最新' },
              { value: 'mp', label: '页数' },
            ]}
          />
          <SegmentedControl
            value={timeRange}
            onChange={(v) => {
              setTimeRange(v);
              setPage(1);
            }}
            options={[
              { value: 'a', label: '全部' },
              { value: 't', label: '今天' },
              { value: 'w', label: '本周' },
              { value: 'm', label: '本月' },
            ]}
          />
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0"
                style={{
                  backgroundColor: category === c.value ? 'var(--ios-blue)' : 'var(--ios-fill-tertiary)',
                  color: category === c.value ? '#ffffff' : 'var(--ios-label-primary)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'week' && weekMetaQuery.data && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeWeekId}
            onChange={(e) => setWeekCatId(e.target.value)}
            className="rounded-xl px-3 py-2 text-[14px] outline-none"
            style={{
              backgroundColor: 'var(--ios-bg-secondary)',
              border: '0.5px solid var(--ios-separator)',
            }}
          >
            {weekMetaQuery.data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <SegmentedControl
            value={weekTypeId}
            onChange={setWeekTypeId}
            options={
              weekMetaQuery.data.types.length > 0
                ? weekMetaQuery.data.types.map((t) => ({ value: t.id, label: t.title }))
                : [{ value: 'manga', label: '漫画' }]
            }
          />
        </div>
      )}

      {isLoading ? (
        <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
          加载中...
        </div>
      ) : error ? (
        <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
          加载失败：{(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {albums.map((a) => (
              <ComicCard key={a.album_id} album={a} />
            ))}
          </div>

          {tab !== 'week' && activeData && activeData.page_count > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl text-[14px] font-medium disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
              >
                上一页
              </button>
              <span className="text-[13px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
                {page} / {activeData.page_count}
              </span>
              <button
                type="button"
                disabled={page >= activeData.page_count}
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
    </div>
  );
}
