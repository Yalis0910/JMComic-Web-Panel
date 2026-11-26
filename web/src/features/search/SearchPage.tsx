import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { ComicCard } from '../../components/liquid/ComicCard';
import { LiquidGlass } from '../../components/liquid/LiquidGlass';
import { SegmentedControl, SkeletonCardGrid } from '../../components/liquid/LiquidControls';

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
    <div className="space-y-7">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
          SEARCH · JMLIS
        </p>
        <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
          全站搜索
        </h1>
      </div>

      {/* Glass Search Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(input);
        }}
      >
        <LiquidGlass variant="tinted" radius={999} className="p-1.5">
          <div className="flex items-center gap-2 pl-3.5 pr-1">
            <Search className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--liquid-muted)' }} />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="关键词、JM 车号、+包含 -排除..."
              className="flex-1 min-h-[44px] bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--liquid-ink)' }}
            />
            <button
              type="submit"
              className="min-h-[42px] px-6 rounded-full text-[14px] font-semibold text-white cursor-pointer liquid-tactile liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-scene)' }}
            >
              搜索
            </button>
          </div>
        </LiquidGlass>
      </form>

      <LiquidGlass variant="tinted" radius={24} className="p-3.5 flex flex-wrap items-center gap-3">
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
      </LiquidGlass>

      {!queryText && (
        <div className="grid gap-5 md:grid-cols-2">
          {recentSearches.length > 0 && (
            <section className="liquid-solid-card p-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">最近搜索</h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[12.5px] font-medium cursor-pointer"
                  style={{ color: 'var(--liquid-accent)' }}
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 rounded-full text-[13px]"
                    style={{
                      backgroundColor: 'var(--liquid-fill-soft)',
                      border: '1px solid var(--liquid-separator)',
                    }}
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

          <section className="liquid-solid-card p-6 space-y-3.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--liquid-accent)' }} />
              <h2 className="text-[16px] font-semibold">热门标签与搜索技巧</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => submitSearch(tag, 'tag')}
                  className="min-h-[34px] px-3.5 py-1 rounded-full text-[12.5px] font-medium cursor-pointer liquid-tactile"
                  style={{ backgroundColor: 'var(--liquid-focus-soft)', color: 'var(--liquid-accent)' }}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--liquid-muted)' }}>
              提示：支持直接输入 JM 数字车号跳转；使用{' '}
              <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">+标签 -排除词</code> 可精确组合检索。
            </p>
          </section>
        </div>
      )}

      {isLoading && <SkeletonCardGrid count={10} />}

      {error && (
        <div className="liquid-solid-card p-8 text-center text-[14px]" style={{ color: 'var(--liquid-danger)' }}>
          搜索失败：{(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="text-[13px] font-medium" style={{ color: 'var(--liquid-muted)' }}>
            共找到 <span className="tabular-nums font-semibold" style={{ color: 'var(--liquid-ink)' }}>{data.total}</span> 条结果
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {data.albums.map((a) => (
              <ComicCard key={a.album_id} album={a} />
            ))}
          </div>
          {data.page_count > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                disabled={initialPage <= 1}
                onClick={() =>
                  setParams({ q: queryText, type: searchType, page: String(initialPage - 1), order: orderBy, time: timeRange })
                }
                className="min-h-[42px] px-5 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer liquid-tactile"
                style={{
                  backgroundColor: 'var(--liquid-solid)',
                  border: '1px solid var(--liquid-separator)',
                  boxShadow: 'var(--liquid-shadow-card)',
                }}
              >
                上一页
              </button>
              <span className="text-[13px] font-medium tabular-nums px-3" style={{ color: 'var(--liquid-muted)' }}>
                第 {initialPage} / {data.page_count} 页
              </span>
              <button
                type="button"
                disabled={initialPage >= data.page_count}
                onClick={() =>
                  setParams({ q: queryText, type: searchType, page: String(initialPage + 1), order: orderBy, time: timeRange })
                }
                className="min-h-[42px] px-5 py-2 rounded-full text-[13.5px] font-semibold disabled:opacity-40 cursor-pointer liquid-tactile"
                style={{
                  backgroundColor: 'var(--liquid-solid)',
                  border: '1px solid var(--liquid-separator)',
                  boxShadow: 'var(--liquid-shadow-card)',
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
