import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/ios/ComicCard';
import { SegmentedControl, SkeletonCardGrid } from '../../components/ios/IosControls';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const initialType = params.get('type') || 'all';
  const initialPage = Number(params.get('page') || 1);

  const [input, setInput] = useState(initialQ);
  const [searchType, setSearchType] = useState(initialType);
  const [orderBy, setOrderBy] = useState(params.get('order') || 'mr');
  const [timeRange] = useState(params.get('time') || 'a');
  const { recentSearches, quickTags, addRecentSearch, removeRecentSearch, clearRecentSearches } = useAppStore();

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
    <div className="space-y-6">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ios-blue)' }}>
          SEARCH · JMLIS
        </p>
        <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight leading-tight">全站搜索</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(input);
        }}
        className="flex gap-2.5"
      >
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ios-label-secondary)' }}
          />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="关键词、JM 车号、+包含 -排除..."
            className="w-full rounded-[14px] pl-11 pr-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--ios-blue)]/30"
            style={{
              backgroundColor: 'var(--ios-bg-secondary)',
              border: '1px solid var(--ios-separator)',
              boxShadow: 'var(--ios-shadow-sm)',
            }}
          />
        </div>
        <button
          type="submit"
          className="px-6 rounded-[14px] text-[14.5px] font-semibold text-white cursor-pointer"
          style={{ background: 'var(--brand-gradient)' }}
        >
          搜索
        </button>
      </form>

      <div className="ios-card p-3.5 flex flex-wrap items-center gap-3">
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

      {!queryText && (
        <div className="grid gap-4 md:grid-cols-2">
          {recentSearches.length > 0 && (
            <section className="ios-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">最近搜索</h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[12.5px] font-medium cursor-pointer"
                  style={{ color: 'var(--ios-blue)' }}
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[13px]"
                    style={{ backgroundColor: 'var(--ios-fill-tertiary)', border: '1px solid var(--ios-separator)' }}
                  >
                    <button type="button" onClick={() => submitSearch(item)} className="cursor-pointer font-medium">
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

          <section className="ios-card p-5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--ios-orange)' }} />
              <h2 className="text-[15px] font-semibold">热门标签与搜索技巧</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => submitSearch(tag, 'tag')}
                  className="px-3 py-1.5 rounded-full text-[12.5px] font-medium cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--ios-accent-soft)', color: 'var(--ios-blue)' }}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ios-label-secondary)' }}>
              提示：支持直接输入 JM 数字车号跳转；使用 <code className="px-1 rounded bg-black/5 dark:bg-white/10">+标签 -排除词</code> 可精确组合检索。
            </p>
          </section>
        </div>
      )}

      {isLoading && <SkeletonCardGrid count={10} />}

      {error && (
        <div className="ios-card p-8 text-center text-[14px]" style={{ color: 'var(--ios-red)' }}>
          搜索失败：{(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="text-[13px] font-medium" style={{ color: 'var(--ios-label-secondary)' }}>
            共找到 <span className="tabular-nums font-semibold" style={{ color: 'var(--ios-label-primary)' }}>{data.total}</span> 条结果
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.albums.map((a) => (
              <ComicCard key={a.album_id} album={a} />
            ))}
          </div>
          {data.page_count > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={initialPage <= 1}
                onClick={() =>
                  setParams({ q: queryText, type: searchType, page: String(initialPage - 1), order: orderBy, time: timeRange })
                }
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
                第 {initialPage} / {data.page_count} 页
              </span>
              <button
                type="button"
                disabled={initialPage >= data.page_count}
                onClick={() =>
                  setParams({ q: queryText, type: searchType, page: String(initialPage + 1), order: orderBy, time: timeRange })
                }
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
