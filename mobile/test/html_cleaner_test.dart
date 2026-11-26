import 'package:flutter_test/flutter_test.dart';
import 'package:jmlis/core/utils/html_cleaner.dart';

void main() {
  test('cleanCommentHtml strips div wrapper, breaks and entities', () {
    const raw = "<div style='flex-direction:row;flex-wrap:wrap;'>畫風很棒<br/>第二行&nbsp;&amp;&nbsp;&#39;測試&#39;</div>";
    expect(cleanCommentHtml(raw), "畫風很棒\n第二行 & '測試'");
    expect(cleanCommentHtml('<p>第一段</p><p>第二段</p>'), '第一段\n第二段');
    expect(cleanCommentHtml(''), '');
    expect(cleanCommentHtml(null), '');
  });
}
