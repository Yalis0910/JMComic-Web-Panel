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
  { value: '3D', label: '3D' },
  { value: 'doujin_cosplay', label: 'Cosplay' },
];

export const FALLBACK_SUB_CATEGORIES: Record<string, SubCategoryOption[]> = {
  doujin: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
    { slug: 'CG', name: 'CG' },
  ],
  single: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
    { slug: 'youth', name: '青年' },
  ],
  short: [
    { slug: 'chinese', name: '汉化' },
    { slug: 'japanese', name: '日语' },
  ],
  another: [
    { slug: 'other', name: '其他' },
    { slug: '3d', name: '3D' },
    { slug: 'cosplay', name: 'Cosplay' },
  ],
};

/** 合并服务端 /categories 动态元数据与本地兜底主分类，避免重复或缺失项。 */
export function resolveCategories(meta?: CategoriesMeta): CategoryOption[] {
  const map = new Map<string, string>();
  for (const item of FALLBACK_CATEGORIES) {
    map.set(item.value, item.label);
  }
  for (const raw of meta?.categories || []) {
    const slug = String(raw.slug ?? '').trim();
    const id = String(raw.id ?? '').trim();
    const value = slug || id || '0';
    const label = String(raw.name ?? raw.title ?? '').trim();
    if (!value || !label) continue;
    // 已有中文标准命名时保留可读标签，新增未知分类再追加
    if (!map.has(value)) {
      map.set(value, label);
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
