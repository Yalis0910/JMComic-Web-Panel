import type { CategoriesMeta } from '../api/client';

export interface CategoryOption {
  value: string;
  label: string;
}

export interface SubCategoryOption {
  slug: string;
  name: string;
}

export const FALLBACK_CATEGORIES: CategoryOption[] = [
  { value: '0', label: '全部' },
  { value: 'doujin', label: '同人' },
  { value: 'single', label: '单行本' },
  { value: 'short', label: '短篇' },
  { value: 'hanman', label: '韩漫' },
  { value: 'meiman', label: '美漫' },
  { value: 'another', label: '其他' },
  { value: 'english_site', label: 'Eng' },
  { value: 'doujin_cosplay', label: 'Cosplay' },
];

export const FALLBACK_SUB_CATEGORIES: Record<string, SubCategoryOption[]> = {
  doujin: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
    { slug: 'CG', name: 'CG' },
    { slug: 'no_mosaic', name: '去码' },
    { slug: 'coloring', name: '上色' },
  ],
  single: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
    { slug: 'youth', name: '青年' },
    { slug: 'no_mosaic', name: '去码' },
    { slug: 'coloring', name: '上色' },
  ],
  short: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
    { slug: 'no_mosaic', name: '去码' },
    { slug: 'coloring', name: '上色' },
  ],
  another: [
    { slug: 'other', name: '其他' },
    { slug: '3d', name: '3D' },
    { slug: 'cosplay', name: 'Cosplay' },
  ],
  hanman: [{ slug: 'chinese', name: '汉化' }],
};

/** 合并服务端 /categories 动态元数据与本地兜底主分类，按 slug 与 label 双重去重，并跳过搜索快捷项。 */
export function resolveCategories(meta?: CategoriesMeta): CategoryOption[] {
  const map = new Map<string, string>();
  const seenLabels = new Set<string>();
  for (const item of FALLBACK_CATEGORIES) {
    map.set(item.value, item.label);
    seenLabels.add(item.label.toLowerCase());
  }
  for (const raw of meta?.categories || []) {
    if (raw.type === 'search') continue;
    const slug = String(raw.slug ?? '').trim();
    const id = String(raw.id ?? '').trim();
    const value = slug || id || '0';
    const label = String(raw.name ?? raw.title ?? '').trim();
    if (!value || !label) continue;
    if (!map.has(value) && !seenLabels.has(label.toLowerCase())) {
      map.set(value, label);
      seenLabels.add(label.toLowerCase());
    }
  }
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
}

export function resolveSubCategories(meta: CategoriesMeta | undefined, category: string): SubCategoryOption[] {
  const fromMeta = meta?.sub_categories?.[category];
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta;
  return FALLBACK_SUB_CATEGORIES[category] || [];
}

/** 从 /categories 返回的 blocks 块中提取官方热门标签列表。 */
export function extractHotTags(meta?: CategoriesMeta, limit = 18): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const block of meta?.blocks || []) {
    const items = Array.isArray(block.content) ? block.content : [];
    for (const entry of items) {
      const text =
        typeof entry === 'string'
          ? entry.trim()
          : String((entry as Record<string, unknown>)?.name ?? (entry as Record<string, unknown>)?.title ?? '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      tags.push(text);
      if (tags.length >= limit) return tags;
    }
  }
  return tags;
}
