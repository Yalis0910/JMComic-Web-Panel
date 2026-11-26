import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/jm_crypto.dart';
import '../../core/network/jm_image_decoder.dart';
import '../../core/utils/html_cleaner.dart';
import '../models/comic_models.dart';
import 'comic_data_source.dart';

class DirectJmSource implements ComicDataSource {
  static const List<String> defaultApiDomains = [
    'www.cdnbtd.cc',
    'www.cdnutc.cc',
    'www.cdngwc.cc',
    'www.cdngwc.net',
    'www.cdngwc.club',
    'www.cdnhjk.net',
  ];

  static const List<String> defaultImageDomains = [
    'cdn-msp2.jmapiproxy3.cc',
    'cdn-msp.jmapiproxy1.cc',
    'cdn-msp.jmapiproxy2.cc',
    'cdn-msp2.jmapiproxy2.cc',
    'cdn-msp3.jmapiproxy2.cc',
    'cdn-msp.jmapinodeudzn.net',
  ];

  static const List<String> domainServers = [
    'https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt',
    'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
    'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
  ];

  static const _kUsername = 'direct_jm_username';
  static const _kPassword = 'direct_jm_password';
  static const _kAvs = 'direct_jm_avs';
  static const _kProfile = 'direct_jm_profile';

  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 7),
      receiveTimeout: const Duration(seconds: 20),
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'user-agent':
            'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
      },
    ),
  );

  List<String> _apiDomains = List.of(defaultApiDomains);
  List<String> _imageDomains = List.of(defaultImageDomains);
  bool _domainsInitialized = false;
  bool _sessionLoaded = false;
  final Map<String, String> _cookies = {};
  UserAccountStatus _account = UserAccountStatus.empty;

  @override
  ActiveMode get mode => ActiveMode.directJm;

  @override
  bool get supportsPostingComments => false;

  String get _cookieHeader {
    if (_cookies.isEmpty) return '';
    return _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
  }

  void _absorbSetCookies(List<String>? setCookies) {
    if (setCookies == null) return;
    for (final raw in setCookies) {
      final pair = raw.split(';').first.trim();
      final eq = pair.indexOf('=');
      if (eq > 0) {
        final key = pair.substring(0, eq).trim();
        final val = pair.substring(eq + 1).trim();
        if (val.isNotEmpty && val != 'deleted') {
          _cookies[key] = val;
        }
      }
    }
  }

  Future<void> _ensureSessionLoaded() async {
    if (_sessionLoaded) return;
    _sessionLoaded = true;
    final prefs = await SharedPreferences.getInstance();
    final avs = prefs.getString(_kAvs) ?? '';
    final rawProfile = prefs.getString(_kProfile);
    if (avs.isNotEmpty) {
      _cookies['AVS'] = avs;
    }
    if (rawProfile != null && rawProfile.isNotEmpty) {
      try {
        _account = UserAccountStatus.fromJson(
          Map<String, dynamic>.from(jsonDecode(rawProfile) as Map),
        );
      } catch (_) {}
    }
  }

  Future<void> _persistSession(UserAccountStatus account, {String? password}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kUsername, account.username);
    if (password != null) {
      await prefs.setString(_kPassword, password);
    }
    final avs = _cookies['AVS'] ?? '';
    await prefs.setString(_kAvs, avs);
    await prefs.setString(_kProfile, jsonEncode(account.toJson()));
  }

  Future<void> _ensureReady() async {
    await _ensureSessionLoaded();
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
        _absorbSetCookies(resp.headers['set-cookie']);
        final bodyStr = resp.data ?? '';
        if (bodyStr.isNotEmpty) {
          final jsonMap = jsonDecode(bodyStr) as Map<String, dynamic>;
          final encoded = '${jsonMap['data'] ?? ''}';
          if (encoded.isNotEmpty) {
            final data = jsonDecode(JmCrypto.decodeRespData(encoded, '$ts'));
            if (data is Map) {
              final imgHost = '${data['img_host'] ?? ''}'.replaceFirst(RegExp(r'^https?://'), '').replaceAll('/', '');
              if (imgHost.isNotEmpty) {
                _imageDomains = [imgHost, ..._imageDomains.where((d) => d != imgHost)];
              }
              final jm3Ver = '${data['jm3_version'] ?? ''}'.trim();
              if (jm3Ver.isNotEmpty) {
                JmCrypto.appVersion = jm3Ver;
              }
            }
          }
        }
        return;
      } catch (_) {}
    }
  }

  Future<dynamic> _reqApi(
    String path, {
    bool get = true,
    Map<String, dynamic>? query,
    Map<String, dynamic>? formData,
    String secret = JmCrypto.appTokenSecret,
    bool decodeData = true,
  }) async {
    await _ensureReady();
    final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final auth = JmCrypto.buildHeadersAuth(ts, secret: secret);

    Object? lastErr;
    for (final domain in _apiDomains) {
      try {
        final headers = <String, String>{
          'token': auth.token,
          'tokenparam': auth.tokenparam,
          if (_cookieHeader.isNotEmpty) 'Cookie': _cookieHeader,
        };
        final Response<String> resp;
        if (get) {
          resp = await _dio.get<String>(
            'https://$domain$path',
            queryParameters: query,
            options: Options(headers: headers),
          );
        } else {
          resp = await _dio.post<String>(
            'https://$domain$path',
            queryParameters: query,
            data: formData,
            options: Options(
              headers: headers,
              contentType: Headers.formUrlEncodedContentType,
            ),
          );
        }
        _absorbSetCookies(resp.headers['set-cookie']);
        final bodyStr = resp.data ?? '';
        if (!decodeData) return bodyStr;
        final jsonMap = jsonDecode(bodyStr) as Map<String, dynamic>;
        final code = jsonMap['code'];
        if (code != null && code != 200 && code != 0) {
          throw Exception(jsonMap['errorMsg'] ?? jsonMap['msg'] ?? 'API code=$code');
        }
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

  List<String> _coverUrls(String albumId) {
    return _imageDomains
        .take(3)
        .map((host) => 'https://$host/media/albums/${albumId}_3x4.jpg')
        .toList();
  }

  ComicSummary _parseRawAlbum(Map<String, dynamic> m) {
    final id = '${m['id'] ?? ''}';
    final author = m['author'] is List ? (m['author'] as List).join(', ') : '${m['author'] ?? ''}';
    final cat = m['category'];
    final category = cat is Map ? '${cat['title'] ?? ''}' : '${cat ?? ''}';
    final covers = _coverUrls(id);
    return ComicSummary(
      albumId: id,
      title: '${m['name'] ?? ''}'.trim(),
      author: author,
      category: category,
      tags: (m['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      coverUrl: covers.first,
      coverFallbacks: covers.skip(1).toList(),
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
          coverFallbacks: detail.coverFallbacks,
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
        ? [ComicEpisode(photoId: albumId, index: 1, name: '${d['name'] ?? ''}')]
        : series
            .map(
              (s) => ComicEpisode(
                photoId: '${s['id']}',
                index: int.tryParse('${s['sort']}') ?? 1,
                name: '${s['name'] ?? ''}',
              ),
            )
            .toList();

    final covers = _coverUrls('${d['id']}');
    return ComicDetail(
      albumId: '${d['id']}',
      title: '${d['name'] ?? ''}',
      authors: (d['author'] as List?)?.map((e) => '$e').toList() ?? const [],
      tags: (d['tags'] as List?)?.map((e) => '$e').toList() ?? const [],
      description: cleanCommentHtml('${d['description'] ?? ''}'),
      views: '${d['total_views'] ?? '0'}',
      likes: '${d['likes'] ?? '0'}',
      commentCount: int.tryParse('${d['comment_total'] ?? '0'}') ?? 0,
      coverUrl: covers.first,
      coverFallbacks: covers.skip(1).toList(),
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
    final imgHost = _imageDomains[Random().nextInt(min(3, _imageDomains.length))];
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
    return list.map((raw) {
      final c = Map<String, dynamic>.from(raw);
      final expinfo = c['expinfo'] is Map ? Map<String, dynamic>.from(c['expinfo']) : const {};
      final rawReplies = (c['replys'] as List?) ?? const [];
      final replies = rawReplies
          .map((r) {
            final rep = Map<String, dynamic>.from(r);
            return CommentReplyModel(
              cid: '${rep['CID'] ?? ''}',
              username: '${rep['username'] ?? rep['nickname'] ?? ''}',
              content: cleanCommentHtml('${rep['content'] ?? ''}'),
              addtime: '${rep['addtime'] ?? ''}',
            );
          })
          .toList();

      return CommentItemModel(
        cid: '${c['CID'] ?? ''}',
        username: '${c['username'] ?? c['nickname'] ?? ''}',
        levelName: '${expinfo['level_name'] ?? ''}',
        content: cleanCommentHtml('${c['content'] ?? ''}'),
        likes: '${c['likes'] ?? '0'}',
        addtime: '${c['addtime'] ?? ''}',
        spoiler: '${c['spoiler'] ?? '0'}' == '1',
        replies: replies,
      );
    }).toList();
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

  // ---------- 账号认证 / 收藏 / 每日签到（直连 APP 端协议） ----------

  @override
  Future<UserAccountStatus> login(String username, String password) async {
    final res = await _reqApi(
      '/login',
      get: false,
      formData: {'username': username, 'password': password},
    );
    if (res is! Map) {
      throw Exception('登录响应格式异常');
    }
    final data = Map<String, dynamic>.from(res);
    final avs = '${data['s'] ?? ''}';
    if (avs.isNotEmpty) {
      _cookies['AVS'] = avs;
    }
    final status = UserAccountStatus(
      isLoggedIn: true,
      uid: '${data['uid'] ?? ''}',
      username: '${data['username'] ?? username}',
      levelName: '${data['level_name'] ?? ''}',
      level: (data['level'] as num?)?.toInt() ?? 1,
      coin: (data['coin'] as num?)?.toInt() ?? 0,
      exp: '${data['exp'] ?? '0'}',
      expPercent: (data['expPercent'] as num?)?.toDouble() ?? 0,
      favoritesCount: (data['album_favorites'] as num?)?.toInt() ?? 0,
      favoritesMax: (data['album_favorites_max'] as num?)?.toInt() ?? 0,
    );
    _account = status;
    await _persistSession(status, password: password);
    return status;
  }

  @override
  Future<void> logout() async {
    await _ensureSessionLoaded();
    _cookies.remove('AVS');
    _account = UserAccountStatus.empty;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kUsername);
    await prefs.remove(_kPassword);
    await prefs.remove(_kAvs);
    await prefs.remove(_kProfile);
  }

  @override
  Future<UserAccountStatus> getUserStatus() async {
    await _ensureSessionLoaded();
    return _account;
  }

  Future<bool> _trySilentRelogin() async {
    final prefs = await SharedPreferences.getInstance();
    final u = prefs.getString(_kUsername) ?? '';
    final p = prefs.getString(_kPassword) ?? '';
    if (u.isEmpty || p.isEmpty) return false;
    try {
      await login(u, p);
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<FavoritePageResult> getFavorites({
    int page = 1,
    String folderId = '0',
    String orderBy = 'mr',
  }) async {
    await _ensureSessionLoaded();
    if (!_account.isLoggedIn) {
      throw Exception('未登录 JM 账号');
    }

    var relogged = false;
    if ((_cookies['AVS'] ?? '').isEmpty) {
      relogged = await _trySilentRelogin();
    }

    Future<dynamic> fetch() => _reqApi(
          '/favorite',
          query: {'page': page, 'folder_id': folderId, 'o': orderBy},
        );

    dynamic data;
    try {
      data = await fetch();
    } catch (e) {
      if (!relogged && await _trySilentRelogin()) {
        relogged = true;
        data = await fetch();
      } else {
        rethrow;
      }
    }

    if (data is! Map) {
      return const FavoritePageResult();
    }
    var map = Map<String, dynamic>.from(data);
    var parsed = _parseFavoriteMap(map);
    if (!relogged &&
        parsed.albums.isEmpty &&
        parsed.folders.isEmpty &&
        _account.favoritesCount > 0 &&
        await _trySilentRelogin()) {
      final retryData = await fetch();
      if (retryData is Map) {
        map = Map<String, dynamic>.from(retryData);
        parsed = _parseFavoriteMap(map);
      }
    }
    return parsed;
  }

  FavoritePageResult _parseFavoriteMap(Map<String, dynamic> map) {
    final list = (map['list'] as List?) ?? const [];
    final albums = list.map((a) => _parseRawAlbum(Map<String, dynamic>.from(a))).toList();

    final rawFolders = map['folder_list'];
    final Iterable<dynamic> folderItems = switch (rawFolders) {
      List l => l,
      Map m => m.values,
      _ => const [],
    };
    final folders = <FavoriteFolder>[];
    for (final f in folderItems) {
      if (f is! Map) continue;
      final fm = Map<String, dynamic>.from(f);
      final fid = '${fm['FID'] ?? fm['fid'] ?? fm['id'] ?? fm['0'] ?? ''}'.trim();
      final name = '${fm['name'] ?? fm['folder_name'] ?? fm['2'] ?? ''}'.trim();
      if (fid.isNotEmpty && name.isNotEmpty) {
        folders.add(FavoriteFolder(folderId: fid, name: name));
      }
    }

    final total = int.tryParse('${map['total'] ?? albums.length}') ?? albums.length;
    final count = int.tryParse('${map['count'] ?? 20}') ?? 20;
    final pageCount = count > 0 ? max(1, (total / count).ceil()) : 1;

    return FavoritePageResult(
      albums: albums,
      folders: folders,
      total: total,
      pageCount: pageCount,
    );
  }

  Future<void> _toggleFavorite(String albumId, {required String expectedType}) async {
    await _ensureSessionLoaded();
    if (!_account.isLoggedIn) {
      throw Exception('请先登录 JM 账号');
    }
    final res = Map<String, dynamic>.from(
      await _reqApi('/favorite', get: false, formData: {'aid': albumId}),
    );
    final actualType = '${res['type'] ?? ''}';
    if (actualType == expectedType) return;
    if (actualType == 'add' || actualType == 'remove') {
      // 移动端 /favorite 为 Toggle 接口，若状态不符则自动回滚还原
      await _reqApi('/favorite', get: false, formData: {'aid': albumId});
    }
    throw Exception(res['msg'] ?? '收藏状态与预期不符');
  }

  @override
  Future<void> addFavorite(String albumId, {String folderId = '0'}) {
    return _toggleFavorite(albumId, expectedType: 'add');
  }

  @override
  Future<void> removeFavorite(String albumId) {
    return _toggleFavorite(albumId, expectedType: 'remove');
  }

  @override
  Future<CheckinResult> dailyCheckin() async {
    await _ensureSessionLoaded();
    if (!_account.isLoggedIn || _account.uid.isEmpty) {
      throw Exception('请先登录 JM 账号');
    }
    final daily = Map<String, dynamic>.from(
      await _reqApi('/daily', query: {'user_id': _account.uid}),
    );
    final dailyId = '${daily['daily_id'] ?? ''}';
    if (dailyId.isEmpty) {
      throw Exception('无法获取签到任务 ID');
    }
    final chk = Map<String, dynamic>.from(
      await _reqApi('/daily_chk', get: false, formData: {'user_id': _account.uid, 'daily_id': dailyId}),
    );
    final msg = '${chk['msg'] ?? '签到完成'}';
    final already = msg.contains('簽到過') || msg.contains('签到过');
    return CheckinResult(alreadyCheckedIn: already, message: msg);
  }

  @override
  Future<void> postComment(String albumId, String comment, {String? commentId, bool spoiler = false}) {
    throw UnsupportedError('直连模式下仅支持浏览评论，发表评论请切换至局域网服务端模式');
  }
}
