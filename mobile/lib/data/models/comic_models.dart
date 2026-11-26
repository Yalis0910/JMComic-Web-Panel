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
  final List<String> tags;
  final String description;
  final String views;
  final String likes;
  final int commentCount;
  final String coverUrl;
  final List<String> coverFallbacks;
  final List<ComicEpisode> episodes;
  final List<ComicSummary> related;
  final bool isFavorite;

  const ComicDetail({
    required this.albumId,
    required this.title,
    this.authors = const [],
    this.tags = const [],
    this.description = '',
    this.views = '0',
    this.likes = '0',
    this.commentCount = 0,
    required this.coverUrl,
    this.coverFallbacks = const [],
    this.episodes = const [],
    this.related = const [],
    this.isFavorite = false,
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
  final String username;
  final String levelName;
  final String content;
  final String likes;
  final String addtime;
  final bool spoiler;
  final List<CommentReplyModel> replies;

  const CommentItemModel({
    required this.cid,
    required this.username,
    this.levelName = '',
    required this.content,
    this.likes = '0',
    required this.addtime,
    this.spoiler = false,
    this.replies = const [],
  });
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
        level: (json['level'] as num?)?.toInt() ?? 1,
        coin: (json['coin'] as num?)?.toInt() ?? 0,
        exp: '${json['exp'] ?? '0'}',
        expPercent: (json['exp_percent'] as num?)?.toDouble() ??
            (json['expPercent'] as num?)?.toDouble() ??
            0,
        favoritesCount: (json['album_favorites'] as num?)?.toInt() ?? 0,
        favoritesMax: (json['album_favorites_max'] as num?)?.toInt() ?? 0,
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
        pageIndex: (json['page_index'] as num?)?.toInt() ?? 0,
        totalPages: (json['total_pages'] as num?)?.toInt() ?? 0,
        updatedAt: (json['updated_at'] as num?)?.toInt() ?? 0,
      );
}
