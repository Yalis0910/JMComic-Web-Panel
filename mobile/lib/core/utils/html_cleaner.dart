/// 将禁漫评论/简介接口返回的 HTML 片段清洗为纯文本。
String cleanCommentHtml(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  var text = raw;
  if (!text.contains('<') && !text.contains('&')) {
    return text.trim();
  }

  text = text
      .replaceAll(RegExp(r'<script[^>]*>[\s\S]*?</script>', caseSensitive: false), '')
      .replaceAll(RegExp(r'<style[^>]*>[\s\S]*?</style>', caseSensitive: false), '')
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</(div|p|li|blockquote|tr|h[1-6])>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]+>'), '');

  text = _decodeHtmlEntities(text);

  final lines = text
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n')
      .replaceAll('\u00A0', ' ')
      .split('\n')
      .map((line) => line.replaceAll(RegExp(r'[ \t]+'), ' ').trim())
      .toList();

  return lines.join('\n').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

String _decodeHtmlEntities(String input) {
  var out = input
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&apos;', "'");

  out = out.replaceAllMapped(RegExp(r'&#x([0-9a-fA-F]+);'), (m) {
    final code = int.tryParse(m.group(1)!, radix: 16);
    return code != null ? String.fromCharCode(code) : m.group(0)!;
  });
  out = out.replaceAllMapped(RegExp(r'&#(\d+);'), (m) {
    final code = int.tryParse(m.group(1)!);
    return code != null ? String.fromCharCode(code) : m.group(0)!;
  });

  return out;
}
