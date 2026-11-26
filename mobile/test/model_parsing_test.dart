import 'package:flutter_test/flutter_test.dart';
import 'package:jmlis/data/models/comic_models.dart';

void main() {
  test('parseJsonInt and parseJsonDouble accept num and numeric String values', () {
    expect(parseJsonInt(42), 42);
    expect(parseJsonInt(42.9), 42);
    expect(parseJsonInt(' 18 '), 18);
    expect(parseJsonInt('18.5'), 18);
    expect(parseJsonInt('', 7), 7);
    expect(parseJsonInt(null, 7), 7);

    expect(parseJsonDouble(12), 12.0);
    expect(parseJsonDouble(' 45.6 '), 45.6);
    expect(parseJsonDouble(null, 1.5), 1.5);
  });

  test('UserAccountStatus.fromJson handles String numeric fields from JM API', () {
    final status = UserAccountStatus.fromJson({
      'uid': 2232080,
      'username': '2232080',
      'level_name': 'Lv.3',
      'level': '3',
      'coin': '120',
      'exp': '350',
      'expPercent': '62.5',
      'album_favorites': '14',
      'album_favorites_max': '500',
    });

    expect(status.isLoggedIn, isTrue);
    expect(status.uid, '2232080');
    expect(status.level, 3);
    expect(status.coin, 120);
    expect(status.expPercent, 62.5);
    expect(status.favoritesCount, 14);
    expect(status.favoritesMax, 500);
  });
}
