/**
 * 安全剥离 HTML 标签并解码实体，确保评论与简介输出纯净可读的文本。
 */
export function cleanHtmlText(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw);
  if (!text.includes('<') && !text.includes('&')) {
    return text.trim();
  }

  // 将块级结束标签与换行标签提前转换为换行符
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|blockquote|tr|h[1-6])>/gi, '\n')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = text;
    const decoded = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ');
    return decoded
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
