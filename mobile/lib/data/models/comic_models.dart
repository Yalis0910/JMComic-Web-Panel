class ComicSummary {
  final String albumId;
  final String title;
  final String author;
  final String category;
  final List<String> tags;
  final String coverUrl;
  final List<String> coverFallbacks;
  final Map<String, String> coverHeaders;

  const ComicSummary({
    required this.albumId,
    required this.title,
    this.author = '',
    this.category = '',
    this.tags = const [],
    required this.coverUrl,
    this.coverFallbacks = const [],
    this.coverHeaders = const {},
  });
}

class ComicEpisode {
  final String photoId;
  final int index;
  final String name;

  const ComicEpisode({
    required this.photoId,
    required this.index,
    required this.name,
  });
}

class ComicDetail {
  final String albumId;
  final String title;
  final List<String> authors;
  final List<String> works;
  final List<String> actors;
  final List<String> tags;
  final String description;
  final String views;
  final String likes;
  final int commentCount;
  final String pubDate;
  final String updateDate;
  final String coverUrl;
  final List<String> coverFallbacks;
  final List<ComicEpisode> episodes;
  final List<ComicSummary> related;
  final bool isFavorite;
  final bool liked;

  const ComicDetail({
    required this.albumId,
    required this.title,
    this.authors = const [],
    this.works = const [],
    this.actors = const [],
    this.tags = const [],
    this.description = '',
    this.views = '0',
    this.likes = '0',
    this.commentCount = 0,
    this.pubDate = '',
    this.updateDate = '',
    required this.coverUrl,
    this.coverFallbacks = const [],
    this.episodes = const [],
    this.related = const [],
    this.isFavorite = false,
    this.liked = false,
  });
}

class ChapterImageItem {
  final int index;
  final String url;
  final int scrambleId;

  const ChapterImageItem({
    required this.index,
    required this.url,
    this.scrambleId = 0,
  });
}

class CommentReplyModel {
  final String cid;
  final String username;
  final String content;
  final String addtime;

  const CommentReplyModel({
    required this.cid,
    required this.username,
    required this.content,
    required this.addtime,
  });
}

class CommentItemModel {
  final String cid;
  final String albumId;
  final String username;
  final String levelName;
  final String content;
  final String likes;
  final String addtime;
  final bool spoiler;
  final List<CommentReplyModel> replies;

  const CommentItemModel({
    required this.cid,
    this.albumId = '',
    required this.username,
    this.levelName = '',
    required this.content,
    this.likes = '0',
    required this.addtime,
    this.spoiler = false,
    this.replies = const [],
  });
}

/// Safely converts dynamic JSON values (int, double, or numeric String) to [int].
int parseJsonInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return fallback;
    return int.tryParse(trimmed) ?? double.tryParse(trimmed)?.toInt() ?? fallback;
  }
  return fallback;
}

/// Safely converts dynamic JSON values (int, double, or numeric String) to [double].
double parseJsonDouble(dynamic value, [double fallback = 0]) {
  if (value is num) return value.toDouble();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return fallback;
    return double.tryParse(trimmed) ?? fallback;
  }
  return fallback;
}

class UserAccountStatus {
  final bool isLoggedIn;
  final String uid;
  final String username;
  final String levelName;
  final int level;
  final int coin;
  final String exp;
  final double expPercent;
  final int favoritesCount;
  final int favoritesMax;

  const UserAccountStatus({
    this.isLoggedIn = false,
    this.uid = '',
    this.username = '',
    this.levelName = '',
    this.level = 1,
    this.coin = 0,
    this.exp = '0',
    this.expPercent = 0,
    this.favoritesCount = 0,
    this.favoritesMax = 0,
  });

  static const empty = UserAccountStatus();

  Map<String, dynamic> toJson() => {
        'is_logged_in': isLoggedIn,
        'uid': uid,
        'username': username,
        'level_name': levelName,
        'level': level,
        'coin': coin,
        'exp': exp,
        'exp_percent': expPercent,
        'album_favorites': favoritesCount,
        'album_favorites_max': favoritesMax,
      };

  factory UserAccountStatus.fromJson(Map<String, dynamic> json) => UserAccountStatus(
        isLoggedIn: json['is_logged_in'] == true || '${json['username'] ?? ''}'.isNotEmpty,
        uid: '${json['uid'] ?? ''}',
        username: '${json['username'] ?? ''}',
        levelName: '${json['level_name'] ?? ''}',
        level: parseJsonInt(json['level'], 1),
        coin: parseJsonInt(json['coin']),
        exp: '${json['exp'] ?? '0'}',
        expPercent: parseJsonDouble(json['exp_percent'] ?? json['expPercent']),
        favoritesCount: parseJsonInt(json['album_favorites']),
        favoritesMax: parseJsonInt(json['album_favorites_max']),
      );
}

class FavoriteFolder {
  final String folderId;
  final String name;

  const FavoriteFolder({required this.folderId, required this.name});
}

class FavoritePageResult {
  final List<ComicSummary> albums;
  final List<FavoriteFolder> folders;
  final int total;
  final int pageCount;

  const FavoritePageResult({
    this.albums = const [],
    this.folders = const [],
    this.total = 0,
    this.pageCount = 1,
  });
}

class CheckinResult {
  final bool alreadyCheckedIn;
  final String message;

  const CheckinResult({
    required this.alreadyCheckedIn,
    required this.message,
  });
}

class CategoryOptionItem {
  final String value;
  final String label;

  const CategoryOptionItem({required this.value, required this.label});
}

class SubCategoryOptionItem {
  final String slug;
  final String name;

  const SubCategoryOptionItem({required this.slug, required this.name});
}

class CategoryMetaResult {
  final List<CategoryOptionItem> categories;
  final List<String> hotTags;
  final Map<String, List<SubCategoryOptionItem>> subCategories;

  const CategoryMetaResult({
    this.categories = const [],
    this.hotTags = const [],
    this.subCategories = const {},
  });

  static const fallbackCategories = [
    CategoryOptionItem(value: '0', label: '全部'),
    CategoryOptionItem(value: 'doujin', label: '同人'),
    CategoryOptionItem(value: 'single', label: '单行本'),
    CategoryOptionItem(value: 'short', label: '短篇'),
    CategoryOptionItem(value: 'hanman', label: '韩漫'),
    CategoryOptionItem(value: 'meiman', label: '美漫'),
    CategoryOptionItem(value: 'another', label: '其他'),
    CategoryOptionItem(value: 'english_site', label: 'Eng'),
    CategoryOptionItem(value: 'doujin_cosplay', label: 'Cosplay'),
  ];

  static const fallbackSubCategories = <String, List<SubCategoryOptionItem>>{
    'doujin': [
      SubCategoryOptionItem(slug: 'chinese', name: '汉化'),
      SubCategoryOptionItem(slug: 'japanese', name: '日语'),
      SubCategoryOptionItem(slug: 'CG', name: 'CG'),
      SubCategoryOptionItem(slug: 'no_mosaic', name: '去码'),
      SubCategoryOptionItem(slug: 'coloring', name: '上色'),
    ],
    'single': [
      SubCategoryOptionItem(slug: 'chinese', name: '汉化'),
      SubCategoryOptionItem(slug: 'japanese', name: '日语'),
      SubCategoryOptionItem(slug: 'youth', name: '青年'),
      SubCategoryOptionItem(slug: 'no_mosaic', name: '去码'),
      SubCategoryOptionItem(slug: 'coloring', name: '上色'),
    ],
    'short': [
      SubCategoryOptionItem(slug: 'chinese', name: '汉化'),
      SubCategoryOptionItem(slug: 'japanese', name: '日语'),
      SubCategoryOptionItem(slug: 'no_mosaic', name: '去码'),
      SubCategoryOptionItem(slug: 'coloring', name: '上色'),
    ],
    'another': [
      SubCategoryOptionItem(slug: 'other', name: '其他'),
      SubCategoryOptionItem(slug: '3d', name: '3D'),
      SubCategoryOptionItem(slug: 'cosplay', name: 'Cosplay'),
    ],
    'hanman': [
      SubCategoryOptionItem(slug: 'chinese', name: '汉化'),
    ],
  };
}

class WeekCategoryOption {
  final String id;
  final String title;
  final String time;

  const WeekCategoryOption({required this.id, required this.title, this.time = ''});
}

class WeekTypeOption {
  final String id;
  final String title;

  const WeekTypeOption({required this.id, required this.title});
}

class WeekMetaResult {
  final List<WeekCategoryOption> categories;
  final List<WeekTypeOption> types;

  const WeekMetaResult({this.categories = const [], this.types = const []});
}

class PagedComicsResult {
  final List<ComicSummary> albums;
  final int total;
  final int pageCount;
  final int pageSize;

  const PagedComicsResult({
    this.albums = const [],
    this.total = 0,
    this.pageCount = 1,
    this.pageSize = 40,
  });
}

class DailyDayStatus {
  final int day;
  final String label;
  final bool? signed;
  final bool bonus;

  const DailyDayStatus({
    required this.day,
    required this.label,
    this.signed,
    this.bonus = false,
  });

  factory DailyDayStatus.fromJson(Map<String, dynamic> json) => DailyDayStatus(
        day: parseJsonInt(json['day']),
        label: '${json['label'] ?? json['date'] ?? ''}',
        signed: json['signed'] is bool ? json['signed'] as bool : null,
        bonus: json['bonus'] == true,
      );
}

class DailyCheckinInfo {
  final String dailyId;
  final String eventName;
  final String progressText;
  final int streakDays;
  final bool checkedInToday;
  final String threeDaysCoin;
  final String threeDaysExp;
  final String sevenDaysCoin;
  final String sevenDaysExp;
  final List<DailyDayStatus> days;

  const DailyCheckinInfo({
    this.dailyId = '',
    this.eventName = '每日签到',
    this.progressText = '',
    this.streakDays = 0,
    this.checkedInToday = false,
    this.threeDaysCoin = '',
    this.threeDaysExp = '',
    this.sevenDaysCoin = '',
    this.sevenDaysExp = '',
    this.days = const [],
  });

  factory DailyCheckinInfo.fromJson(Map<String, dynamic> json) {
    final rewards = json['rewards'] is Map
        ? Map<String, dynamic>.from(json['rewards'] as Map)
        : const <String, dynamic>{};
    final rawDays = (json['days'] as List?) ?? const [];
    return DailyCheckinInfo(
      dailyId: '${json['daily_id'] ?? ''}',
      eventName: '${json['event_name'] ?? '每日签到'}',
      progressText: '${json['progress_text'] ?? ''}',
      streakDays: parseJsonInt(json['streak_days']),
      checkedInToday: json['checked_in_today'] == true,
      threeDaysCoin: '${rewards['three_days_coin'] ?? ''}',
      threeDaysExp: '${rewards['three_days_exp'] ?? ''}',
      sevenDaysCoin: '${rewards['seven_days_coin'] ?? ''}',
      sevenDaysExp: '${rewards['seven_days_exp'] ?? ''}',
      days: rawDays
          .whereType<Map>()
          .map((d) => DailyDayStatus.fromJson(Map<String, dynamic>.from(d)))
          .toList(),
    );
  }
}

class HistoryRecord {
  final String albumId;
  final String photoId;
  final String title;
  final String chapterTitle;
  final String coverUrl;
  final int pageIndex;
  final int totalPages;
  final int updatedAt;

  const HistoryRecord({
    required this.albumId,
    required this.photoId,
    required this.title,
    this.chapterTitle = '',
    this.coverUrl = '',
    required this.pageIndex,
    required this.totalPages,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() => {
        'album_id': albumId,
        'photo_id': photoId,
        'title': title,
        'chapter_title': chapterTitle,
        'cover_url': coverUrl,
        'page_index': pageIndex,
        'total_pages': totalPages,
        'updated_at': updatedAt,
      };

  factory HistoryRecord.fromJson(Map<String, dynamic> json) => HistoryRecord(
        albumId: '${json['album_id'] ?? ''}',
        photoId: '${json['photo_id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        chapterTitle: '${json['chapter_title'] ?? ''}',
        coverUrl: '${json['cover_url'] ?? ''}',
        pageIndex: parseJsonInt(json['page_index']),
        totalPages: parseJsonInt(json['total_pages']),
        updatedAt: parseJsonInt(json['updated_at']),
      );
}
