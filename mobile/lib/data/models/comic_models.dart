class ComicSummary {
  final String albumId;
  final String title;
  final String author;
  final List<String> tags;
  final String coverUrl;
  final Map<String, String> coverHeaders;

  const ComicSummary({
    required this.albumId,
    required this.title,
    this.author = '',
    this.tags = const [],
    required this.coverUrl,
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

class CommentItemModel {
  final String cid;
  final String username;
  final String content;
  final String addtime;

  const CommentItemModel({
    required this.cid,
    required this.username,
    required this.content,
    required this.addtime,
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
