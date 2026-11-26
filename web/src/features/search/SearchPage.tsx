import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { SegmentedControl } from '../../components/ios/IosControls';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const initialType = params.get('type') || 'all';
  const initialPage = Number(params.get('page') || 1);

  const [input, setInput] = useState(initialQ);
  const [searchType, setSearchType] = useState(initialType);
  const [orderBy, setOrderBy] = useState(params.get('order') || 'mr');
  const [timeRange, setTimeRange] = useState(params.get('time') || 'a');
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useAppStore();

  useEffect(() => {
    setInput(params.get('q') || '');
    setSearchType(params.get('type') || 'all');
  }, [params]);

  const queryText = params.get('q') || '';
  const page = Number(params.get('page') || 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', queryText, searchType, page, orderBy, timeRange],
    queryFn: () =>
      api.search({
        q: queryText,
        type: searchType,
        page,
        order_by: orderBy,
        time: timeRange,
      }),
    enabled: !!queryText.trim(),
  });

  const submitSearch = (q: string, nextType = searchType) => {
    const clean = q.trim();
    if (!clean) return;
    addRecentSearch(clean);
    setParams({ q: clean, type: nextType, page: '1', order: orderBy, time: timeRange });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[34px] font-bold tracking-tight leading-tight">搜索</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(input);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ios-label-secondary)' }}
          />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="关键词、JM车号、+包含 -排除..."
            className="w-full rounded-[12px] pl-10 pr-4 py-2.5 text-[15px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
          />
        </div>
        <button
          type="submit"
          className="px-4 rounded-[12px] text-[15px] font-medium text-white cursor-pointer"
          style={{ backgroundColor: 'var(--ios-blue)' }}
        >
          搜索
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={searchType}
          onChange={(v) => {
            setSearchType(v);
            if (queryText) setParams({ q: queryText, type: v, page: '1', order: orderBy, time: timeRange });
          }}
          options={[
            { value: 'all', label: '全部' },
            { value: 'author', label: '作者' },
            { value: 'tag', label: '标签' },
            { value: 'work', label: '作品' },
            { value: 'actor', label: '角色' },
          ]}
        />
        <SegmentedControl
          value={orderBy}
          onChange={(v) => {
            setOrderBy(v);
            if (queryText) setParams({ q: queryText, type: searchType, page: '1', order: v, time: timeRange });
          }}
          options={[
            { value: 'mr', label: '最新' },
            { value: 'mv', label: '观看' },
            { value: 'tf', label: '点赞' },
            { value: 'mp', label: '页数' },
          ]}
        />
      </div>

      {!queryText && recentSearches.length > 0 && (
        <section className="ios-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">最近搜索</h2>
            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-[13px] cursor-pointer"
              style={{ color: 'var(--ios-blue)' }}
            >
              清空
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((item) => (
              <div
                key={item}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-[13px]"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              >
                <button type="button" onClick={() => submitSearch(item)} className="cursor-pointer">
                  {item}
                </button>
                <button
                  type="button"
                  onClick={() => removeRecentSearch(item)}
                  className="opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="ios-card p-10 text-center text-[14px]" style={{ color: 'var(--ios-label-secondary)' }}>
          正在搜索...
        </div>
      )}

      {error && (
        <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
          搜索失败：{(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="text-[13px]" style={{ color: 'var(--ios-label-secondary)' }}>
            共找到 {data.total} 条结果
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {data.albums.map((a) => (
              <ComicCard key={a.album_id} album={a} />
            ))}
          </div>
          {data.page_count > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={initialPage <= 1}
                onClick={() => setParams({ q: queryText, type: searchType, page: String(initialPage - 1), order: orderBy, time: timeRange })}
                className="px-4 py-2 rounded-xl text-[14px] font-medium disabled:opacity-40 cursor-pointer"
                style={{ backgroundColor: 'var(--ios-bg-secondary)', border: '0.5px solid var(--ios-separator)' }}
              >
                上一页
              </button>
              <span className="text-[13px] tabular-nums" style={{ color: 'var(--ios-label-secondary)' }}>
                {initialPage} / {data.page_count}
              </span>
              <button
                type="button"
                disabled={initialPage >= data.page_count}
                onClick={() => setParams({ q: queryText, type: searchType, page: String(initialPage + 1), order: orderBy, time: timeRange })}
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
