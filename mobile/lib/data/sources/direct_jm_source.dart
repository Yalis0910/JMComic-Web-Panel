import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/network/jm_crypto.dart';
import '../../core/network/jm_image_decoder.dart';
import '../models/comic_models.dart';
import 'comic_data_source.dart';

class DirectJmSource implements ComicDataSource {
  static const List<String> defaultApiDomains = [
    'www.cdnhjk.net',
    'www.cdngwc.cc',
    'www.cdngwc.net',
    'www.cdngwc.club',
    'www.cdnhjk.cc',
  ];

  static const List<String> defaultImageDomains = [
    'cdn-msp.jmapiproxy1.cc',
    'cdn-msp.jmapiproxy2.cc',
    'cdn-msp2.jmapiproxy2.cc',
    'cdn-msp3.jmapiproxy2.cc',
    'cdn-msp.jmapinodeudzn.net',
  ];

  static const List<String> domainServers = [
    'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
    'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
  ];

  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 6),
      receiveTimeout: const Duration(seconds: 20),
      headers: {
        'user-agent':
            'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
      },
    ),
  );

  List<String> _apiDomains = List.of(defaultApiDomains);
  bool _domainsInitialized = false;
  String _cookieHeader = '';

  @override
  ActiveMode get mode => ActiveMode.directJm;

  Future<void> _ensureReady() async {
    if (!_domainsInitialized) {
      _domainsInitialized = true;
      for (final url in domainServers) {
        try {
          final resp = await _dio.get<String>(url);
          var text = (resp.data ?? '').trim();
          while (text.isNotEmpty && text.codeUnitAt(0) > 127) {
            text = text.substring(1);
          }
          final decoded = JmCrypto.decodeRespData(
            text,
            '',
            secret: JmCrypto.apiDomainServerSecret,
          );
          final parsed = jsonDecode(decoded) as Map<String, dynamic>;
          final servers = (parsed['Server'] as List?)?.map((e) => '$e').toList();
          if (servers != null && servers.isNotEmpty) {
            _apiDomains = servers;
            break;
          }
        } catch (_) {}
      }
    }
    if (_cookieHeader.isEmpty) {
      try {
        await _reqSetting();
      } catch (_) {}
    }
  }

  Future<void> _reqSetting() async {
    final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final auth = JmCrypto.buildHeadersAuth(ts);
    for (final domain in _apiDomains) {
      try {
        final resp = await _dio.get<String>(
          'https://$domain/setting',
          options: Options(headers: {'token': auth.token, 'tokenparam': auth.tokenparam}),
        );
        final setCookies = resp.headers['set-cookie'];
        if (setCookies != null && setCookies.isNotEmpty) {
          _cookieHeader = setCookies.map((c) => c.split(';').first).join('; ');
        }
        return;
      } catch (_) {}
    }
  }

  Future<dynamic> _reqApi(
    String path, {
    Map<String, dynamic>? query,
    String secret = JmCrypto.appTokenSecret,
    bool decodeData = true,
  }) async {
    await _ensureReady();
    final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final auth = JmCrypto.buildHeadersAuth(ts, secret: secret);

    Object? lastErr;
    for (final domain in _apiDomains) {
      try {
        final resp = await _dio.get<String>(
          'https://$domain$path',
          queryParameters: query,
          options: Options(
            headers: {
              'token': auth.token,
              'tokenparam': auth.tokenparam,
              if (_cookieHeader.isNotEmpty) 'Cookie': _cookieHeader,
            },
          ),
        );
        final bodyStr = resp.data ?? '';
        if (!decodeData) return bodyStr;
        final jsonMap = jsonDecode(bodyStr) as Map<String, dynamic>;
        final encoded = '${jsonMap['data'] ?? ''}';
        if (encoded.isEmpty) return {};
        final decoded = JmCrypto.decodeRespData(encoded, '$ts');
        return jsonDecode(decoded);
      } catch (e) {
        lastErr = e;
      }
    }
    throw Exception('直连禁漫 API 失败: $lastErr');
  }

  String _coverUrl(String albumId) {
    final host = defaultImageDomains[Random().nextInt(defaultImageDomains.length)];
    return 'https://$host/media/albums/${albumId}_3x4.jpg';
  }

  ComicSummary _parseRawAlbum(Map<String, dynamic> m) {
    final id = '${m['id'] ?? ''}';
    final author = m['author'] is List ? (m['author'] as List).join(', ') : '${m['author'] ?? ''}';
    return ComicSummary(
      albumId: id,
      title: '${m['name'] ?? ''}'.trim(),
      author: author,
      tags: (m['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      coverUrl: _coverUrl(id),
    );
  }

  @override
  Future<List<({String title, List<ComicSummary> albums})>> getPromoteSections() async {
    final raw = await _reqApi('/promote', query: {'page': 1});
    if (raw is! List) return const [];
    return raw.map((sec) {
      final m = Map<String, dynamic>.from(sec);
      final list = (m['content'] as List?) ?? const [];
      return (
        title: '${m['title'] ?? '推荐'}',
        albums: list.map((a) => _parseRawAlbum(Map<String, dynamic>.from(a))).toList(),
      );
    }).toList();
  }

  @override
  Future<List<ComicSummary>> getRanking(String type, {int page = 1, String category = '0'}) async {
    final suffix = type == 'day'
        ? 'mv_t'
        : type == 'week'
            ? 'mv_w'
            : 'mv_m';
    final data = await _reqApi(
      '/categories/filter',
      query: {'page': page, 'order': '', 'c': category, 'o': suffix},
    );
    final list = (data['content'] as List?) ?? const [];
    return list.map((a) => _parseRawAlbum(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<List<ComicSummary>> search(String query, {String type = 'all', int page = 1}) async {
    final mainTag = switch (type) {
      'work' => 1,
      'author' => 2,
      'tag' => 3,
      'actor' => 4,
      _ => 0,
    };
    final data = await _reqApi(
      '/search',
      query: {'main_tag': mainTag, 'search_query': query, 'page': page, 'o': 'mr', 't': 'a'},
    );
    final redirectAid = data['redirect_aid'];
    if (redirectAid != null) {
      final detail = await getAlbumDetail('$redirectAid');
      return [
        ComicSummary(
          albumId: detail.albumId,
          title: detail.title,
          author: detail.authors.join(', '),
          tags: detail.tags,
          coverUrl: detail.coverUrl,
        ),
      ];
    }
    final list = (data['content'] as List?) ?? const [];
    return list.map((a) => _parseRawAlbum(Map<String, dynamic>.from(a))).toList();
  }

  @override
  Future<ComicDetail> getAlbumDetail(String albumId) async {
    final d = Map<String, dynamic>.from(await _reqApi('/album', query: {'id': albumId}));
    final series = (d['series'] as List?) ?? const [];
    final episodes = series.isEmpty
        ? [ComicEpisode(photoId: '$albumId', index: 1, name: '${d['name'] ?? ''}')]
        : series
            .map(
              (s) => ComicEpisode(
                photoId: '${s['id']}',
                index: int.tryParse('${s['sort']}') ?? 1,
                name: '${s['name'] ?? ''}',
              ),
            )
            .toList();

    return ComicDetail(
      albumId: '${d['id']}',
      title: '${d['name'] ?? ''}',
      authors: (d['author'] as List?)?.map((e) => '$e').toList() ?? const [],
      tags: (d['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      description: '${d['description'] ?? ''}',
      views: '${d['total_views'] ?? '0'}',
      likes: '${d['likes'] ?? '0'}',
      commentCount: int.tryParse('${d['comment_total'] ?? '0'}') ?? 0,
      coverUrl: _coverUrl('${d['id']}'),
      episodes: episodes,
      related: ((d['related_list'] as List?) ?? const [])
          .map((r) => _parseRawAlbum(Map<String, dynamic>.from(r)))
          .toList(),
      isFavorite: d['is_favorite'] == true,
    );
  }

  @override
  Future<List<ChapterImageItem>> getChapterImages(String photoId) async {
    final d = Map<String, dynamic>.from(await _reqApi('/chapter', query: {'id': photoId}));
    final scrambleHtml = await _reqApi(
      '/chapter_view_template',
      query: {
        'id': photoId,
        'mode': 'vertical',
        'page': '0',
        'app_img_shunt': '1',
        'express': 'off',
        'v': DateTime.now().millisecondsSinceEpoch ~/ 1000,
      },
      secret: JmCrypto.appTokenSecret2,
      decodeData: false,
    );
    final match = RegExp(r'var scramble_id = (\d+);').firstMatch('$scrambleHtml');
    final scrambleId = int.tryParse(match?.group(1) ?? '') ?? 220980;
    final imgHost = defaultImageDomains[Random().nextInt(defaultImageDomains.length)];
    final images = (d['images'] as List?) ?? const [];

    return List.generate(images.length, (idx) {
      final filename = '${images[idx]}';
      return ChapterImageItem(
        index: idx + 1,
        url: 'https://$imgHost/media/photos/$photoId/$filename',
        scrambleId: scrambleId,
      );
    });
  }

  @override
  Future<List<CommentItemModel>> getComments(String albumId, {int page = 1}) async {
    final data = await _reqApi('/forum', query: {'mode': 'manhua', 'aid': albumId, 'page': page});
    final list = (data['list'] as List?) ?? const [];
    return list
        .map(
          (c) => CommentItemModel(
            cid: '${c['CID'] ?? ''}',
            username: '${c['username'] ?? c['nickname'] ?? ''}',
            content: '${c['content'] ?? ''}',
            addtime: '${c['addtime'] ?? ''}',
          ),
        )
        .toList();
  }

  @override
  Future<Uint8List> fetchChapterImageBytes(ChapterImageItem item) async {
    final resp = await _dio.get<List<int>>(
      item.url,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {
          'X-Requested-With': 'com.JMComic3.app',
          'Referer': 'https://${_apiDomains.first}',
        },
      ),
    );
    final raw = Uint8List.fromList(resp.data ?? const []);
    final num = JmImageDecoder.getNumByUrl(item.scrambleId, item.url);
    return JmImageDecoder.decodeStrips(raw, num);
  }
}
