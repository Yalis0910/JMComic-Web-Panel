import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/utils/html_cleaner.dart';
import '../models/comic_models.dart';
import 'comic_data_source.dart';

class LanServerSource implements ComicDataSource {
  final Dio _dio;
  final String baseUrl;
  final String panelToken;

  LanServerSource({
    required this.baseUrl,
    this.panelToken = '',
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl.replaceAll(RegExp(r'/$'), ''),
            connectTimeout: const Duration(seconds: 4),
            receiveTimeout: const Duration(seconds: 20),
            headers: panelToken.isNotEmpty ? {'X-Panel-Token': panelToken} : null,
          ),
        );

  @override
  ActiveMode get mode => ActiveMode.lanServer;

  @override
  bool get supportsPostingComments => true;

  @override
  bool get supportsWebOnlyFilters => true;

  Map<String, String> get _authHeaders =>
      panelToken.isNotEmpty ? {'X-Panel-Token': panelToken} : const {};

  String _absUrl(String path) {
    if (path.startsWith('http')) return path;
    final cleanBase = baseUrl.replaceAll(RegExp(r'/$'), '');
    return '$cleanBase$path';
  }

  ComicSummary _parseSummary(Map<String, dynamic> m) {
    return ComicSummary(
      albumId: '${m['album_id'] ?? ''}',
      title: '${m['title'] ?? ''}',
      author: '${m['author'] ?? ''}',
      category: '${m['category'] ?? ''}',
      tags: (m['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      coverUrl: _absUrl('${m['cover_url'] ?? '/api/v2/media/cover/${m['album_id']}'}'),
      coverHeaders: _authHeaders,
    );
  }

  PagedComicsResult _parsePagedComics(Map<String, dynamic> d) {
    final list = (d['albums'] as List?) ?? const [];
    return PagedComicsResult(
      albums: list.map((a) => _parseSummary(Map<String, dynamic>.from(a))).toList(),
      total: parseJsonInt(d['total'], list.length),
      pageCount: max(1, parseJsonInt(d['page_count'], 1)),
      pageSize: max(1, parseJsonInt(d['page_size'], 80)),
    );
  }

  CommentItemModel _parseCommentItem(Map<String, dynamic> c) {
    final rawReplies = (c['replies'] as List?) ?? const [];
    return CommentItemModel(
      cid: '${c['cid'] ?? ''}',
      albumId: '${c['album_id'] ?? ''}',
      username: '${c['username'] ?? ''}',
      levelName: '${c['level_name'] ?? ''}',
      content: cleanCommentHtml('${c['content'] ?? ''}'),
      likes: '${c['likes'] ?? '0'}',
      addtime: '${c['addtime'] ?? ''}',
      spoiler: c['spoiler'] == true,
      replies: rawReplies
          .map((r) {
            final rep = Map<String, dynamic>.from(r);
            return CommentReplyModel(
              cid: '${rep['cid'] ?? ''}',
              username: '${rep['username'] ?? ''}',
              content: cleanCommentHtml('${rep['content'] ?? ''}'),
              addtime: '${rep['addtime'] ?? ''}',
            );
          })
          .toList(),
    );
  }

  @override
  Future<List<({String title, List<ComicSummary> albums})>> getPromoteSections() async {
    final resp = await _dio.get('/api/v2/discovery/promote');
    final sections = (resp.data['data']['sections'] as List?) ?? const [];
    return sections.map((s) {
      final albums = ((s['albums'] as List?) ?? const [])
          .map((a) => _parseSummary(Map<String, dynamic>.from(a)))
          .toList();
      return (title: '${s['title'] ?? '推荐'}', albums: albums);
    }).toList();
  }

  @override
  Future<List<ComicSummary>> getLatest({int page = 1}) async {
    final resp = await _dio.get('/api/v2/discovery/latest', queryParameters: {'page': page});
    final list = (resp.data['data']['albums'] as List?) ?? const [];
    return list.map((a) => _parseSummary(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<CategoryMetaResult> getCategoriesMeta() async {
    final resp = await _dio.get('/api/v2/discovery/categories');
    final d = Map<String, dynamic>.from(resp.data['data'] ?? const {});
    final catMap = <String, String>{
      for (final c in CategoryMetaResult.fallbackCategories) c.value: c.label,
    };
    final seenLabels = <String>{
      for (final c in CategoryMetaResult.fallbackCategories) c.label.toLowerCase(),
    };
    for (final raw in (d['categories'] as List?) ?? const []) {
      if (raw is! Map) continue;
      final m = Map<String, dynamic>.from(raw);
      if ('${m['type'] ?? ''}' == 'search') continue;
      final val = '${m['slug'] ?? ''}'.trim().isNotEmpty ? '${m['slug']}'.trim() : '${m['id'] ?? ''}'.trim();
      final label = '${m['name'] ?? m['title'] ?? ''}'.trim();
      if (val.isNotEmpty && label.isNotEmpty && !catMap.containsKey(val) && seenLabels.add(label.toLowerCase())) {
        catMap[val] = label;
      }
    }
    final hotTags = <String>[];
    final seenTags = <String>{};
    for (final b in (d['blocks'] as List?) ?? const []) {
      if (b is! Map) continue;
      for (final entry in (b['content'] as List?) ?? const []) {
        final t = entry is Map ? '${entry['name'] ?? entry['title'] ?? ''}'.trim() : '$entry'.trim();
        if (t.isNotEmpty && seenTags.add(t)) {
          hotTags.add(t);
        }
      }
    }
    final subMap = <String, List<SubCategoryOptionItem>>{...CategoryMetaResult.fallbackSubCategories};
    final rawSub = d['sub_categories'];
    if (rawSub is Map) {
      rawSub.forEach((k, v) {
        if (v is List) {
          subMap['$k'] = v
              .whereType<Map>()
              .map((sc) => SubCategoryOptionItem(slug: '${sc['slug'] ?? ''}', name: '${sc['name'] ?? ''}'))
              .where((sc) => sc.slug.isNotEmpty)
              .toList();
        }
      });
    }
    return CategoryMetaResult(
      categories: catMap.entries.map((e) => CategoryOptionItem(value: e.key, label: e.value)).toList(),
      hotTags: hotTags,
      subCategories: subMap,
    );
  }

  @override
  Future<WeekMetaResult> getWeekMeta() async {
    final resp = await _dio.get('/api/v2/discovery/week');
    final d = Map<String, dynamic>.from(resp.data['data'] ?? const {});
    final cats = ((d['categories'] as List?) ?? const [])
        .whereType<Map>()
        .map((c) => WeekCategoryOption(
              id: '${c['id'] ?? ''}',
              title: '${c['title'] ?? c['time'] ?? ''}',
              time: '${c['time'] ?? ''}',
            ))
        .where((c) => c.id.isNotEmpty)
        .toList();
    final types = ((d['types'] as List?) ?? const [])
        .whereType<Map>()
        .map((t) => WeekTypeOption(id: '${t['id'] ?? ''}', title: '${t['title'] ?? ''}'))
        .where((t) => t.id.isNotEmpty)
        .toList();
    return WeekMetaResult(categories: cats, types: types);
  }

  @override
  Future<List<ComicSummary>> getWeekFilter(String categoryId, {String typeId = 'manga'}) async {
    final resp = await _dio.get(
      '/api/v2/discovery/week/filter',
      queryParameters: {'category_id': categoryId, 'type_id': typeId},
    );
    final list = (resp.data['data']['albums'] as List?) ?? const [];
    return list.map((a) => _parseSummary(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<PagedComicsResult> getRanking(String type, {int page = 1, String category = '0'}) async {
    final resp = await _dio.get(
      '/api/v2/discovery/ranking/$type',
      queryParameters: {'page': page, 'category': category},
    );
    return _parsePagedComics(Map<String, dynamic>.from(resp.data['data'] ?? const {}));
  }

  @override
  Future<PagedComicsResult> getCategoryFilter({
    int page = 1,
    String time = 'a',
    String orderBy = 'mv',
    String category = '0',
    String? subCategory,
  }) async {
    final resp = await _dio.get(
      '/api/v2/discovery/filter',
      queryParameters: {
        'page': page,
        'time': time,
        'order_by': orderBy,
        'category': category,
        if (subCategory != null && subCategory.isNotEmpty) 'sub_category': subCategory,
      },
    );
    return _parsePagedComics(Map<String, dynamic>.from(resp.data['data'] ?? const {}));
  }

  @override
  Future<PagedComicsResult> search(
    String query, {
    String type = 'all',
    int page = 1,
    String orderBy = 'mr',
    String time = 'a',
    String category = '0',
    String? subCategory,
  }) async {
    final resp = await _dio.get(
      '/api/v2/search',
      queryParameters: {
        'q': query,
        'type': type,
        'page': page,
        'order_by': orderBy,
        'time': time,
        'category': category,
        if (subCategory != null && subCategory.isNotEmpty) 'sub_category': subCategory,
      },
    );
    return _parsePagedComics(Map<String, dynamic>.from(resp.data['data'] ?? const {}));
  }

  @override
  Future<List<CommentItemModel>> getForumComments({int page = 1}) async {
    final resp = await _dio.get('/api/v2/discovery/forum', queryParameters: {'page': page});
    final list = (resp.data['data']['comments'] as List?) ?? const [];
    return list.map((raw) => _parseCommentItem(Map<String, dynamic>.from(raw))).toList();
  }

  @override
  Future<ComicDetail> getAlbumDetail(String albumId) async {
    final resp = await _dio.get('/api/v2/album/$albumId');
    final d = Map<String, dynamic>.from(resp.data['data']);
    return ComicDetail(
      albumId: '${d['album_id']}',
      title: '${d['title'] ?? ''}',
      authors: (d['authors'] as List?)?.map((e) => '$e').toList() ?? const [],
      works: (d['works'] as List?)?.map((e) => '$e').toList() ?? const [],
      actors: (d['actors'] as List?)?.map((e) => '$e').toList() ?? const [],
      tags: (d['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      description: cleanCommentHtml('${d['description'] ?? ''}'),
      views: '${d['views'] ?? '0'}',
      likes: '${d['likes'] ?? '0'}',
      commentCount: parseJsonInt(d['comment_count']),
      pubDate: '${d['pub_date'] ?? ''}',
      updateDate: '${d['update_date'] ?? ''}',
      coverUrl: _absUrl('${d['cover_url']}'),
      episodes: ((d['episodes'] as List?) ?? const [])
          .map(
            (e) => ComicEpisode(
              photoId: '${e['photo_id']}',
              index: parseJsonInt(e['index'], 1),
              name: '${e['name'] ?? ''}',
            ),
          )
          .toList(),
      related: ((d['related'] as List?) ?? const [])
          .map((r) => _parseSummary(Map<String, dynamic>.from(r)))
          .toList(),
      isFavorite: d['is_favorite'] == true,
      liked: d['liked'] == true,
    );
  }

  @override
  Future<List<ChapterImageItem>> getChapterImages(String photoId) async {
    final resp = await _dio.get('/api/v2/photo/$photoId');
    final imgs = (resp.data['data']['images'] as List?) ?? const [];
    return imgs
        .map(
          (i) => ChapterImageItem(
            index: parseJsonInt(i['index'], 1),
            url: _absUrl('${i['proxy_url']}'),
            scrambleId: 0,
          ),
        )
        .toList();
  }

  @override
  Future<List<CommentItemModel>> getComments(String albumId, {int page = 1}) async {
    final resp = await _dio.get('/api/v2/album/$albumId/comments', queryParameters: {'page': page});
    final list = (resp.data['data']['comments'] as List?) ?? const [];
    return list.map((raw) => _parseCommentItem(Map<String, dynamic>.from(raw))).toList();
  }

  @override
  Future<Uint8List> fetchChapterImageBytes(ChapterImageItem item) async {
    final resp = await _dio.get<List<int>>(
      item.url,
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(resp.data ?? const []);
  }

  Future<List<HistoryRecord>> mergeHistory(List<HistoryRecord> localItems) async {
    final resp = await _dio.post(
      '/api/v2/sync/history/merge',
      data: {
        'since_ms': 0,
        'items': localItems.map((e) => e.toJson()).toList(),
      },
    );
    final items = (resp.data['data']['items'] as List?) ?? const [];
    return items.map((e) => HistoryRecord.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  UserAccountStatus _parseUserStatus(Map<String, dynamic> d) {
    final loggedIn = d['is_logged_in'] == true;
    if (!loggedIn) return UserAccountStatus.empty;
    final profile = d['profile'] is Map ? Map<String, dynamic>.from(d['profile']) : const {};
    return UserAccountStatus(
      isLoggedIn: true,
      uid: '${profile['uid'] ?? ''}',
      username: '${d['username'] ?? profile['username'] ?? ''}',
      levelName: '${profile['level_name'] ?? ''}',
      level: parseJsonInt(profile['level'], 1),
      coin: parseJsonInt(profile['coin']),
      exp: '${profile['exp'] ?? '0'}',
      expPercent: parseJsonDouble(profile['exp_percent'] ?? profile['expPercent']),
      favoritesCount: parseJsonInt(profile['album_favorites']),
      favoritesMax: parseJsonInt(profile['album_favorites_max']),
    );
  }

  @override
  Future<UserAccountStatus> login(String username, String password) async {
    final resp = await _dio.post(
      '/api/v2/user/login',
      data: {'username': username, 'password': password, 'impl': 'api'},
    );
    return _parseUserStatus(Map<String, dynamic>.from(resp.data['data']));
  }

  @override
  Future<void> logout() async {
    await _dio.post('/api/v2/user/logout');
  }

  @override
  Future<UserAccountStatus> getUserStatus() async {
    final resp = await _dio.get('/api/v2/user/status');
    return _parseUserStatus(Map<String, dynamic>.from(resp.data['data']));
  }

  @override
  Future<FavoritePageResult> getFavorites({
    int page = 1,
    String folderId = '0',
    String orderBy = 'mr',
  }) async {
    final resp = await _dio.get(
      '/api/v2/user/favorites',
      queryParameters: {'page': page, 'folder_id': folderId, 'order_by': orderBy},
    );
    final d = Map<String, dynamic>.from(resp.data['data']);
    final albums = ((d['albums'] as List?) ?? const [])
        .map((a) => _parseSummary(Map<String, dynamic>.from(a)))
        .toList();
    final folders = ((d['folders'] as List?) ?? const [])
        .map((f) {
          final fm = Map<String, dynamic>.from(f);
          return FavoriteFolder(folderId: '${fm['folder_id'] ?? ''}', name: '${fm['name'] ?? ''}');
        })
        .toList();
    return FavoritePageResult(
      albums: albums,
      folders: folders,
      total: parseJsonInt(d['total'], albums.length),
      pageCount: max(1, parseJsonInt(d['page_count'], 1)),
    );
  }

  @override
  Future<void> addFavorite(String albumId, {String folderId = '0'}) async {
    await _dio.post('/api/v2/user/favorites/$albumId', data: {'folder_id': folderId});
  }

  @override
  Future<void> removeFavorite(String albumId) async {
    await _dio.delete('/api/v2/user/favorites/$albumId');
  }

  @override
  Future<DailyCheckinInfo> getDailyInfo() async {
    final resp = await _dio.get('/api/v2/user/daily');
    return DailyCheckinInfo.fromJson(Map<String, dynamic>.from(resp.data['data'] ?? const {}));
  }

  @override
  Future<CheckinResult> dailyCheckin() async {
    final resp = await _dio.post('/api/v2/user/checkin');
    final d = Map<String, dynamic>.from(resp.data['data'] ?? const {});
    return CheckinResult(
      alreadyCheckedIn: d['already_checked_in'] == true,
      message: '${d['msg'] ?? resp.data['message'] ?? '签到完成'}',
    );
  }

  @override
  Future<void> postComment(String albumId, String comment, {String? commentId, bool spoiler = false}) async {
    await _dio.post(
      '/api/v2/album/$albumId/comments',
      data: {'comment': comment, 'comment_id': commentId, 'spoiler': spoiler},
    );
  }
}
