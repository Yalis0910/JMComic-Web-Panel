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

  test('DailyCheckinInfo.fromJson parses calendar days and rewards', () {
    final info = DailyCheckinInfo.fromJson({
      'daily_id': '72',
      'event_name': '11月签到',
      'progress_text': '25%',
      'streak_days': 2,
      'checked_in_today': true,
      'rewards': {
        'three_days_coin': '150',
        'three_days_exp': '150',
        'seven_days_coin': '350',
        'seven_days_exp': '350',
      },
      'days': [
        {'day': 1, 'label': '01', 'signed': true, 'bonus': false},
        {'day': 2, 'label': '02', 'signed': null, 'bonus': true},
      ],
    });

    expect(info.eventName, '11月签到');
    expect(info.streakDays, 2);
    expect(info.checkedInToday, isTrue);
    expect(info.sevenDaysCoin, '350');
    expect(info.days.length, 2);
    expect(info.days[0].signed, isTrue);
    expect(info.days[1].bonus, isTrue);
    expect(info.days[1].signed, isNull);
  });

  test('HistoryRecord, BookmarkRecord, OfflineChapterMeta, and ServerDownloadTask roundtrip', () {
    final hist = HistoryRecord.fromJson({
      'album_id': '123456',
      'photo_id': '1',
      'source': 'local',
      'title': 'Local Comic',
      'page_index': 4,
      'total_pages': 20,
      'updated_at': 1700000000000,
    });
    expect(hist.source, 'local');
    expect(hist.toJson()['source'], 'local');

    final bm = BookmarkRecord.fromJson({
      'bookmark_id': 'local:123456:1:4',
      'album_id': '123456',
      'photo_id': '1',
      'source': 'local',
      'title': 'Local Comic',
      'page_index': 4,
      'created_at': 1000,
      'updated_at': 2000,
      'deleted': 0,
    });
    expect(bm.deleted, isFalse);
    expect(bm.pageIndex, 4);

    final offline = OfflineChapterMeta.fromJson({
      'album_id': '123456',
      'album_title': 'Test Album',
      'photo_id': '789',
      'chapter_title': '第 1 话',
      'page_count': 15,
      'cached_at': 9999,
    });
    expect(offline.albumTitle, 'Test Album');
    expect(offline.toJson()['page_count'], 15);

    final dl = ServerDownloadTask.fromJson({
      'task_id': 'abc',
      'album_id': '123456',
      'status': 'pending',
      'download_type': 'zip',
      'progress': '0',
      'completed_count': 0,
      'total_count': 30,
    });
    expect(dl.status, 'pending');
    expect(dl.totalCount, 30);
  });
}
