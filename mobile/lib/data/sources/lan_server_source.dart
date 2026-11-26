import 'dart:typed_data';

import 'package:dio/dio.dart';

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
      tags: (m['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      coverUrl: _absUrl('${m['cover_url'] ?? '/api/v2/media/cover/${m['album_id']}'}'),
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
  Future<List<ComicSummary>> getRanking(String type, {int page = 1, String category = '0'}) async {
    final resp = await _dio.get(
      '/api/v2/discovery/ranking/$type',
      queryParameters: {'page': page, 'category': category},
    );
    final list = (resp.data['data']['albums'] as List?) ?? const [];
    return list.map((a) => _parseSummary(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<List<ComicSummary>> search(String query, {String type = 'all', int page = 1}) async {
    final resp = await _dio.get(
      '/api/v2/search',
      queryParameters: {'q': query, 'type': type, 'page': page},
    );
    final list = (resp.data['data']['albums'] as List?) ?? const [];
    return list.map((a) => _parseSummary(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<ComicDetail> getAlbumDetail(String albumId) async {
    final resp = await _dio.get('/api/v2/album/$albumId');
    final d = Map<String, dynamic>.from(resp.data['data']);
    return ComicDetail(
      albumId: '${d['album_id']}',
      title: '${d['title'] ?? ''}',
      authors: (d['authors'] as List?)?.map((e) => '$e').toList() ?? const [],
      tags: (d['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      description: '${d['description'] ?? ''}',
      views: '${d['views'] ?? '0'}',
      likes: '${d['likes'] ?? '0'}',
      commentCount: (d['comment_count'] as num?)?.toInt() ?? 0,
      coverUrl: _absUrl('${d['cover_url']}'),
      episodes: ((d['episodes'] as List?) ?? const [])
          .map(
            (e) => ComicEpisode(
              photoId: '${e['photo_id']}',
              index: (e['index'] as num?)?.toInt() ?? 1,
              name: '${e['name'] ?? ''}',
            ),
          )
          .toList(),
      related: ((d['related'] as List?) ?? const [])
          .map((r) => _parseSummary(Map<String, dynamic>.from(r)))
          .toList(),
      isFavorite: d['is_favorite'] == true,
    );
  }

  @override
  Future<List<ChapterImageItem>> getChapterImages(String photoId) async {
    final resp = await _dio.get('/api/v2/photo/$photoId');
    final imgs = (resp.data['data']['images'] as List?) ?? const [];
    return imgs
        .map(
          (i) => ChapterImageItem(
            index: (i['index'] as num?)?.toInt() ?? 1,
            url: _absUrl('${i['proxy_url']}'),
            scrambleId: 0, // 服务端已完成条带解密
          ),
        )
        .toList();
  }

  @override
  Future<List<CommentItemModel>> getComments(String albumId, {int page = 1}) async {
    final resp = await _dio.get('/api/v2/album/$albumId/comments', queryParameters: {'page': page});
    final list = (resp.data['data']['comments'] as List?) ?? const [];
    return list
        .map(
          (c) => CommentItemModel(
            cid: '${c['cid']}',
            username: '${c['username']}',
            content: '${c['content']}',
            addtime: '${c['addtime']}',
          ),
        )
        .toList();
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
}
