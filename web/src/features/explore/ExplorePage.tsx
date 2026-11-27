import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ComicCard } from '../../components/liquid/ComicCard';
import { CommentCard } from '../../components/liquid/CommentCard';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { PillSelect, PaginationBar, SegmentedControl, SkeletonCardGrid } from '../../components/liquid/LiquidControls';
import { resolveCategories, resolveSubCategories } from '../../utils/categories';

type ExploreTab = 'ranking' | 'filter' | 'week' | 'forum';
type RankType = 'day' | 'week' | 'month' | 'all' | 'likes' | 'latest';

export function ExplorePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ExploreTab>('ranking');
  const [rankType, setRankType] = useState<RankType>('day');
  const [category, setCategory] = useState('0');
  const [subCategory, setSubCategory] = useState('');
  const [orderBy, setOrderBy] = useState('mv');
  const [timeRange, setTimeRange] = useState('a');
  const [page, setPage] = useState(1);

  const [weekCatId, setWeekCatId] = useState('');
  const [weekTypeId, setWeekTypeId] = useState('manga');

  const categoriesMetaQuery = useQuery({
    queryKey: ['categoriesMeta'],
    queryFn: api.getCategoriesMeta,
    staleTime: 30 * 60 * 1000,
  });

  const categories = useMemo(
    () => resolveCategories(categoriesMetaQuery.data),
    [categoriesMetaQuery.data]
  );

  const subCategories = useMemo(
    () => resolveSubCategories(categoriesMetaQuery.data, category),
    [categoriesMetaQuery.data, category]
  );

  const rankQuery = useQuery({
    queryKey: ['ranking', rankType, page, category],
    queryFn: () => api.getRanking(rankType, page, category),
    enabled: tab === 'ranking',
  });

  const filterQuery = useQuery({
    queryKey: ['categoryFilter', page, timeRange, orderBy, category, subCategory],
    queryFn: () =>
      api.getCategoryFilter({
        page,
        time: timeRange,
        order_by: orderBy,
        category,
        sub_category: subCategory || undefined,
      }),
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

  const forumQuery = useQuery({
    queryKey: ['forumComments', page],
    queryFn: () => api.getForum(page),
    enabled: tab === 'forum',
  });

  const activeData = tab === 'ranking' ? rankQuery.data : tab === 'filter' ? filterQuery.data : undefined;
  const isLoading =
    tab === 'ranking'
      ? rankQuery.isLoading
      : tab === 'filter'
        ? filterQuery.isLoading
        : tab === 'week'
          ? weekListQuery.isLoading
          : forumQuery.isLoading;
  const error =
    tab === 'ranking'
      ? rankQuery.error
      : tab === 'filter'
        ? filterQuery.error
        : tab === 'week'
          ? weekListQuery.error
          : forumQuery.error;

  const albums = tab === 'week' ? weekListQuery.data?.albums || [] : activeData?.albums || [];
  const pageSize = activeData?.page_size || 40;

  const handleSelectCategory = (nextCat: string) => {
    setCategory(nextCat);
    setSubCategory('');
    setPage(1);
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
            CHARTS &amp; GENRES
          </p>
          <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
            排行与分类
          </h1>
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
            { value: 'forum', label: '讨论区' },
          ]}
        />
      </div>

      {/* L2 Tinted Glass 筛选控制栏 */}
      {tab === 'ranking' && (
        <LiquidGlass variant="tinted" radius={24} className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto no-scrollbar">
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
                { value: 'all', label: '总榜' },
                { value: 'likes', label: '最多爱心' },
                { value: 'latest', label: '最新' },
              ]}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleSelectCategory(c.value)}
                  className="min-h-[38px] px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0 liquid-tactile liquid-focus-ring"
                  style={{
                    backgroundColor: active ? 'var(--liquid-scene)' : 'var(--liquid-solid)',
                    color: active ? '#ffffff' : 'var(--liquid-ink)',
                    border: active ? '1px solid transparent' : '1px solid var(--liquid-separator)',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </LiquidGlass>
      )}

      {tab === 'filter' && (
        <LiquidGlass variant="tinted" radius={24} className="p-4 space-y-3">
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
                { value: 'tr', label: '评分' },
                { value: 'md', label: '评论' },
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
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleSelectCategory(c.value)}
                  className="min-h-[38px] px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer shrink-0 liquid-tactile liquid-focus-ring"
                  style={{
                    backgroundColor: active ? 'var(--liquid-scene)' : 'var(--liquid-solid)',
                    color: active ? '#ffffff' : 'var(--liquid-ink)',
                    border: active ? '1px solid transparent' : '1px solid var(--liquid-separator)',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* 第3层：条件展开的二级副分类胶囊条（仅选中含子类目的主类时出现） */}
          {subCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[11.5px] font-semibold pr-1 shrink-0" style={{ color: 'var(--liquid-muted)' }}>
                子分类
              </span>
              <button
                type="button"
                onClick={() => {
                  setSubCategory('');
                  setPage(1);
                }}
                className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer shrink-0 liquid-tactile"
                style={{
                  backgroundColor: subCategory === '' ? 'var(--liquid-focus-soft)' : 'var(--liquid-fill-soft)',
                  color: subCategory === '' ? 'var(--liquid-accent)' : 'var(--liquid-muted)',
                }}
              >
                全部
              </button>
              {subCategories.map((sc) => {
                const active = subCategory === sc.slug;
                return (
                  <button
                    key={sc.slug}
                    type="button"
                    onClick={() => {
                      setSubCategory(sc.slug);
                      setPage(1);
                    }}
                    className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer shrink-0 liquid-tactile"
                    style={{
                      backgroundColor: active ? 'var(--liquid-focus-soft)' : 'var(--liquid-fill-soft)',
                      color: active ? 'var(--liquid-accent)' : 'var(--liquid-muted)',
                    }}
                  >
                    {sc.name}
                  </button>
                );
              })}
            </div>
          )}
        </LiquidGlass>
      )}

      {tab === 'week' && weekMetaQuery.data && (
        <LiquidGlass variant="tinted" radius={24} className="p-4 flex flex-wrap items-center gap-3">
          <PillSelect
            value={activeWeekId}
            onChange={setWeekCatId}
            options={weekMetaQuery.data.categories.map((c) => ({
              value: c.id,
              label: c.title || c.time || `第${c.id}期`,
            }))}
          />
          <SegmentedControl
            value={weekTypeId}
            onChange={setWeekTypeId}
            options={
              weekMetaQuery.data.types.length > 0
                ? weekMetaQuery.data.types.map((t) => ({
                    value: t.id,
                    label: t.title || (t.id === 'hanman' ? '韩漫' : t.id),
                  }))
                : [{ value: 'manga', label: '日漫' }]
            }
          />
        </LiquidGlass>
      )}

      {isLoading ? (
        <SkeletonCardGrid count={10} />
      ) : error ? (
        <div className="liquid-solid-card p-8 text-center text-[14px]" style={{ color: 'var(--liquid-danger)' }}>
          加载失败：{(error as Error).message}
        </div>
      ) : tab === 'forum' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {(forumQuery.data?.comments || []).map((c) => (
              <CommentCard
                key={c.cid}
                item={c}
                onOpenAlbum={(aid) => navigate(`/album/${aid}`)}
              />
            ))}
          </div>
          {(forumQuery.data?.comments?.length || 0) === 0 && (
            <div className="liquid-solid-card p-8 text-center text-[14px]" style={{ color: 'var(--liquid-muted)' }}>
              暂无讨论内容
            </div>
          )}
          <PaginationBar
            page={page}
            pageCount={forumQuery.data?.page_count && forumQuery.data.page_count > 1 ? forumQuery.data.page_count : undefined}
            hasNext={(forumQuery.data?.comments.length || 0) > 0}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {albums.map((a, idx) => (
              <ComicCard
                key={a.album_id}
                album={a}
                rank={tab === 'ranking' ? (page - 1) * pageSize + idx + 1 : undefined}
              />
            ))}
          </div>

          {tab !== 'week' && activeData && activeData.page_count > 1 && (
            <PaginationBar page={page} pageCount={activeData.page_count} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
