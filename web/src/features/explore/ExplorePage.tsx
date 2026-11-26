import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ComicCard } from '../../components/ios/ComicCard';
import { PillSelect, SegmentedControl, SkeletonCardGrid } from '../../components/ios/IosControls';

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
  const pageSize = activeData?.page_size || 20;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ios-blue)' }}>
            CHARTS &amp; GENRES
          </p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight leading-tight">排行与分类</h1>
        </div>
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
        <div className="ios-card p-3.5 flex flex-wrap items-center gap-3">
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
                className="px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0 transition-all"
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
        <div className="ios-card p-3.5 flex flex-wrap items-center gap-3">
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
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full pt-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0 transition-all"
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
        <div className="ios-card p-3.5 flex flex-wrap items-center gap-3">
          <PillSelect
            value={activeWeekId}
            onChange={setWeekCatId}
            options={weekMetaQuery.data.categories.map((c) => ({ value: c.id, label: c.title }))}
          />
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
        <SkeletonCardGrid count={10} />
      ) : error ? (
        <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
          加载失败：{(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((a, idx) => (
              <ComicCard
                key={a.album_id}
                album={a}
                rank={tab === 'ranking' ? (page - 1) * pageSize + idx + 1 : undefined}
              />
            ))}
          </div>

          {tab !== 'week' && activeData && activeData.page_count > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer"
                style={{
                  backgroundColor: 'var(--ios-bg-secondary)',
                  border: '1px solid var(--ios-separator)',
                  boxShadow: 'var(--ios-shadow-sm)',
                }}
              >
                上一页
              </button>
              <span className="text-[13px] font-medium tabular-nums px-3" style={{ color: 'var(--ios-label-secondary)' }}>
                第 {page} / {activeData.page_count} 页
              </span>
              <button
                type="button"
                disabled={page >= activeData.page_count}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer"
                style={{
                  backgroundColor: 'var(--ios-bg-secondary)',
                  border: '1px solid var(--ios-separator)',
                  boxShadow: 'var(--ios-shadow-sm)',
                }}
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
