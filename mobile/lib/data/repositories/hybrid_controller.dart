import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/app_proxy.dart';
import '../models/comic_models.dart';
import '../sources/comic_data_source.dart';
import '../sources/direct_jm_source.dart';
import '../sources/lan_server_source.dart';

class HybridSettings {
  final String serverUrl;
  final String panelToken;
  final ConnectionPreference preference;
  final AppThemeMode themeMode;
  final CoverPrivacyMode coverPrivacyMode;
  final int preloadCount;
  final MobileReaderMode readerMode;
  final bool doublePageRtl;
  final bool doublePageCoverOffset;
  final bool proxyEnabled;
  final String proxyUrl;
  final String proxyUsername;
  final String proxyPassword;

  const HybridSettings({
    this.serverUrl = 'http://192.168.1.10:8800',
    this.panelToken = '',
    this.preference = ConnectionPreference.auto,
    this.themeMode = AppThemeMode.system,
    this.coverPrivacyMode = CoverPrivacyMode.show,
    this.preloadCount = 6,
    this.readerMode = MobileReaderMode.vertical,
    this.doublePageRtl = false,
    this.doublePageCoverOffset = true,
    this.proxyEnabled = false,
    this.proxyUrl = '',
    this.proxyUsername = '',
    this.proxyPassword = '',
  });

  bool get darkMode => themeMode == AppThemeMode.dark;
  bool get showCovers => coverPrivacyMode == CoverPrivacyMode.show;

  HybridSettings copyWith({
    String? serverUrl,
    String? panelToken,
    ConnectionPreference? preference,
    AppThemeMode? themeMode,
    CoverPrivacyMode? coverPrivacyMode,
    bool? darkMode,
    bool? showCovers,
    int? preloadCount,
    MobileReaderMode? readerMode,
    bool? doublePageRtl,
    bool? doublePageCoverOffset,
    bool? proxyEnabled,
    String? proxyUrl,
    String? proxyUsername,
    String? proxyPassword,
  }) =>
      HybridSettings(
        serverUrl: serverUrl ?? this.serverUrl,
        panelToken: panelToken ?? this.panelToken,
        preference: preference ?? this.preference,
        themeMode: themeMode ?? (darkMode != null ? (darkMode ? AppThemeMode.dark : AppThemeMode.light) : this.themeMode),
        coverPrivacyMode: coverPrivacyMode ??
            (showCovers != null ? (showCovers ? CoverPrivacyMode.show : CoverPrivacyMode.hide) : this.coverPrivacyMode),
        preloadCount: (preloadCount ?? this.preloadCount).clamp(1, 20),
        readerMode: readerMode ?? this.readerMode,
        doublePageRtl: doublePageRtl ?? this.doublePageRtl,
        doublePageCoverOffset: doublePageCoverOffset ?? this.doublePageCoverOffset,
        proxyEnabled: proxyEnabled ?? this.proxyEnabled,
        proxyUrl: proxyUrl ?? this.proxyUrl,
        proxyUsername: proxyUsername ?? this.proxyUsername,
        proxyPassword: proxyPassword ?? this.proxyPassword,
      );
}

class HybridState {
  final HybridSettings settings;
  final ActiveMode activeMode;
  final bool probing;
  final List<HistoryRecord> history;
  final List<BookmarkRecord> bookmarks;
  final UserAccountStatus account;

  const HybridState({
    required this.settings,
    required this.activeMode,
    this.probing = false,
    this.history = const [],
    this.bookmarks = const [],
    this.account = UserAccountStatus.empty,
  });

  HybridState copyWith({
    HybridSettings? settings,
    ActiveMode? activeMode,
    bool? probing,
    List<HistoryRecord>? history,
    List<BookmarkRecord>? bookmarks,
    UserAccountStatus? account,
  }) =>
      HybridState(
        settings: settings ?? this.settings,
        activeMode: activeMode ?? this.activeMode,
        probing: probing ?? this.probing,
        history: history ?? this.history,
        bookmarks: bookmarks ?? this.bookmarks,
        account: account ?? this.account,
      );
}

class HybridController extends StateNotifier<HybridState> {
  HybridController()
      : super(const HybridState(settings: HybridSettings(), activeMode: ActiveMode.directJm)) {
    _init();
  }

  static const _kServerUrl = 'hybrid_server_url';
  static const _kPanelToken = 'hybrid_panel_token';
  static const _kPref = 'hybrid_pref';
  static const _kDark = 'hybrid_dark';
  static const _kThemeMode = 'hybrid_theme_mode';
  static const _kShowCovers = 'hybrid_show_covers';
  static const _kCoverPrivacy = 'hybrid_cover_privacy';
  static const _kPreloadCount = 'hybrid_preload_count';
  static const _kReaderMode = 'hybrid_reader_mode';
  static const _kDoubleRtl = 'hybrid_double_rtl';
  static const _kDoubleOffset = 'hybrid_double_offset';
  static const _kProxyEnabled = 'hybrid_proxy_enabled';
  static const _kProxyUrl = 'hybrid_proxy_url';
  static const _kProxyUsername = 'hybrid_proxy_username';
  static const _kProxyPassword = 'hybrid_proxy_password';
  static const _kHistory = 'hybrid_history';
  static const _kBookmarks = 'hybrid_bookmarks';

  final DirectJmSource _directSource = DirectJmSource();
  LanServerSource? _lanSource;

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final prefIdx = prefs.getInt(_kPref) ?? 0;
    final readerModeIdx = prefs.getInt(_kReaderMode) ?? 0;
    final themeIdx = prefs.getInt(_kThemeMode);
    final resolvedTheme = themeIdx != null
        ? AppThemeMode.values[themeIdx.clamp(0, AppThemeMode.values.length - 1)]
        : (prefs.containsKey(_kDark)
            ? ((prefs.getBool(_kDark) ?? false) ? AppThemeMode.dark : AppThemeMode.light)
            : AppThemeMode.system);
    final privacyIdx = prefs.getInt(_kCoverPrivacy);
    final resolvedPrivacy = privacyIdx != null
        ? CoverPrivacyMode.values[privacyIdx.clamp(0, CoverPrivacyMode.values.length - 1)]
        : ((prefs.getBool(_kShowCovers) ?? true) ? CoverPrivacyMode.show : CoverPrivacyMode.hide);

    final rawServerUrl = prefs.getString(_kServerUrl) ?? 'http://192.168.1.10:8800';
    final rawProxyUrl = prefs.getString(_kProxyUrl) ?? '';
    final rawProxyUser = prefs.getString(_kProxyUsername) ?? '';
    final rawProxyPass = prefs.getString(_kProxyPassword) ?? '';
    final proxyReady = parseProxyConfig(
          rawProxyUrl,
          username: rawProxyUser,
          password: rawProxyPass,
        ) !=
        null;
    final resolvedProxyEnabled = (prefs.getBool(_kProxyEnabled) ?? false) && proxyReady;

    AppProxyManager.instance.applySettings(
      enabled: resolvedProxyEnabled,
      proxyUrl: rawProxyUrl,
      username: rawProxyUser,
      password: rawProxyPass,
      lanServerUrl: rawServerUrl,
    );

    final loaded = HybridSettings(
      serverUrl: rawServerUrl,
      panelToken: prefs.getString(_kPanelToken) ?? '',
      preference: ConnectionPreference.values[prefIdx.clamp(0, 2)],
      themeMode: resolvedTheme,
      coverPrivacyMode: resolvedPrivacy,
      preloadCount: (prefs.getInt(_kPreloadCount) ?? 6).clamp(1, 20),
      readerMode: MobileReaderMode.values[readerModeIdx.clamp(0, MobileReaderMode.values.length - 1)],
      doublePageRtl: prefs.getBool(_kDoubleRtl) ?? false,
      doublePageCoverOffset: prefs.getBool(_kDoubleOffset) ?? true,
      proxyEnabled: resolvedProxyEnabled,
      proxyUrl: rawProxyUrl,
      proxyUsername: rawProxyUser,
      proxyPassword: rawProxyPass,
    );
    final rawHist = prefs.getString(_kHistory);
    final histList = rawHist == null
        ? <HistoryRecord>[]
        : (jsonDecode(rawHist) as List)
            .map((e) => HistoryRecord.fromJson(Map<String, dynamic>.from(e)))
            .toList();
    final rawBm = prefs.getString(_kBookmarks);
    final bmList = rawBm == null
        ? <BookmarkRecord>[]
        : (jsonDecode(rawBm) as List)
            .map((e) => BookmarkRecord.fromJson(Map<String, dynamic>.from(e)))
            .where((b) => !b.deleted)
            .toList();
    state = state.copyWith(settings: loaded, history: histList, bookmarks: bmList);
    await probeAndSwitch();
  }

  LanServerSource get lanSource => _getLanSource();

  LanServerSource _getLanSource() {
    final existing = _lanSource;
    if (existing != null &&
        existing.baseUrl == state.settings.serverUrl &&
        existing.panelToken == state.settings.panelToken) {
      return existing;
    }
    final next = LanServerSource(
      baseUrl: state.settings.serverUrl,
      panelToken: state.settings.panelToken,
    );
    _lanSource = next;
    return next;
  }

  ComicDataSource get activeSource {
    if (state.activeMode == ActiveMode.lanServer) {
      return _getLanSource();
    }
    return _directSource;
  }

  Future<void> updateSettings(HybridSettings next) async {
    final prev = state.settings;
    final cleanProxyUrl = next.proxyUrl.trim();
    final cleanProxyUser = next.proxyUsername.trim();
    final proxyReady = parseProxyConfig(
          cleanProxyUrl,
          username: cleanProxyUser,
          password: next.proxyPassword,
        ) !=
        null;
    final sanitized = next.copyWith(
      proxyUrl: cleanProxyUrl,
      proxyUsername: cleanProxyUser,
      proxyEnabled: next.proxyEnabled && proxyReady,
    );

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrl, sanitized.serverUrl);
    await prefs.setString(_kPanelToken, sanitized.panelToken);
    await prefs.setInt(_kPref, sanitized.preference.index);
    await prefs.setInt(_kThemeMode, sanitized.themeMode.index);
    await prefs.setBool(_kDark, sanitized.darkMode);
    await prefs.setInt(_kCoverPrivacy, sanitized.coverPrivacyMode.index);
    await prefs.setBool(_kShowCovers, sanitized.showCovers);
    await prefs.setInt(_kPreloadCount, sanitized.preloadCount);
    await prefs.setInt(_kReaderMode, sanitized.readerMode.index);
    await prefs.setBool(_kDoubleRtl, sanitized.doublePageRtl);
    await prefs.setBool(_kDoubleOffset, sanitized.doublePageCoverOffset);
    await prefs.setBool(_kProxyEnabled, sanitized.proxyEnabled);
    await prefs.setString(_kProxyUrl, sanitized.proxyUrl);
    await prefs.setString(_kProxyUsername, sanitized.proxyUsername);
    await prefs.setString(_kProxyPassword, sanitized.proxyPassword);
    state = state.copyWith(settings: sanitized);

    final proxyChanged = prev.proxyEnabled != sanitized.proxyEnabled ||
        prev.proxyUrl != sanitized.proxyUrl ||
        prev.proxyUsername != sanitized.proxyUsername ||
        prev.proxyPassword != sanitized.proxyPassword ||
        prev.serverUrl != sanitized.serverUrl;
    if (proxyChanged) {
      AppProxyManager.instance.applySettings(
        enabled: sanitized.proxyEnabled,
        proxyUrl: sanitized.proxyUrl,
        username: sanitized.proxyUsername,
        password: sanitized.proxyPassword,
        lanServerUrl: sanitized.serverUrl,
      );
      _directSource.resetHttpClient();
      PaintingBinding.instance.imageCache.clear();
    }

    if (prev.serverUrl != sanitized.serverUrl ||
        prev.panelToken != sanitized.panelToken ||
        prev.preference != sanitized.preference) {
      _lanSource = null;
      await probeAndSwitch();
    }
  }

  Future<({bool lanReachable, int latencyMs, String message})> probeAndSwitch() async {
    final pref = state.settings.preference;
    if (pref == ConnectionPreference.directOnly) {
      state = state.copyWith(activeMode: ActiveMode.directJm, probing: false);
      await refreshAccount();
      return (lanReachable: false, latencyMs: 0, message: '已切换为仅直连模式');
    }

    state = state.copyWith(probing: true);
    final cleanBase = state.settings.serverUrl.replaceAll(RegExp(r'/$'), '');
    final sw = Stopwatch()..start();
    try {
      final dio = Dio(BaseOptions(connectTimeout: const Duration(milliseconds: 1200), receiveTimeout: const Duration(milliseconds: 1200)));
      final res = await dio.get('$cleanBase/api/v2/system/health');
      sw.stop();
      if (res.statusCode == 200) {
        state = state.copyWith(activeMode: ActiveMode.lanServer, probing: false);
        await Future.wait([_syncWithLan(), refreshAccount()]);
        return (
          lanReachable: true,
          latencyMs: sw.elapsedMilliseconds,
          message: '局域网服务端连接成功 (${sw.elapsedMilliseconds}ms)',
        );
      }
    } catch (_) {
      sw.stop();
    }

    if (pref == ConnectionPreference.lanOnly) {
      state = state.copyWith(activeMode: ActiveMode.lanServer, probing: false);
      return (lanReachable: false, latencyMs: sw.elapsedMilliseconds, message: '局域网探测失败，当前强制保持局域网模式');
    }

    state = state.copyWith(activeMode: ActiveMode.directJm, probing: false);
    await refreshAccount();
    return (lanReachable: false, latencyMs: sw.elapsedMilliseconds, message: '未检测到局域网服务端，已自动切至直连模式');
  }

  Future<void> refreshAccount() async {
    try {
      final acc = await activeSource.getUserStatus();
      state = state.copyWith(account: acc);
    } catch (_) {
      state = state.copyWith(account: UserAccountStatus.empty);
    }
  }

  Future<UserAccountStatus> login(String username, String password) async {
    final acc = await activeSource.login(username, password);
    state = state.copyWith(account: acc);
    return acc;
  }

  Future<void> logout() async {
    await activeSource.logout();
    state = state.copyWith(account: UserAccountStatus.empty);
  }

  Future<DailyCheckinInfo> getDailyInfo() async {
    return activeSource.getDailyInfo();
  }

  Future<CheckinResult> dailyCheckin() async {
    final res = await activeSource.dailyCheckin();
    await refreshAccount();
    return res;
  }

  Future<void> recordReading(HistoryRecord rec) async {
    final updated = [
      rec,
      ...state.history.where((h) => h.albumId != rec.albumId),
    ].take(100).toList();
    state = state.copyWith(history: updated);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kHistory, jsonEncode(updated.map((e) => e.toJson()).toList()));
    if (state.activeMode == ActiveMode.lanServer) {
      await _syncWithLan();
    }
  }

  Future<void> toggleBookmark({
    required String albumId,
    required String photoId,
    String source = 'online',
    required String title,
    String chapterTitle = '',
    String coverUrl = '',
    required int pageIndex,
  }) async {
    final bmId = '$source:$albumId:$photoId:$pageIndex';
    final exists = state.bookmarks.any((b) => b.bookmarkId == bmId && !b.deleted);
    final now = DateTime.now().millisecondsSinceEpoch;
    List<BookmarkRecord> next;
    BookmarkRecord changed;
    if (exists) {
      final existing = state.bookmarks.firstWhere((b) => b.bookmarkId == bmId);
      changed = BookmarkRecord(
        bookmarkId: bmId,
        albumId: albumId,
        photoId: photoId,
        source: source,
        title: title,
        chapterTitle: chapterTitle,
        coverUrl: coverUrl,
        pageIndex: pageIndex,
        createdAt: existing.createdAt,
        updatedAt: now,
        deleted: true,
      );
      next = state.bookmarks.where((b) => b.bookmarkId != bmId).toList();
    } else {
      changed = BookmarkRecord(
        bookmarkId: bmId,
        albumId: albumId,
        photoId: photoId,
        source: source,
        title: title,
        chapterTitle: chapterTitle,
        coverUrl: coverUrl,
        pageIndex: pageIndex,
        createdAt: now,
        updatedAt: now,
      );
      next = [changed, ...state.bookmarks];
    }
    state = state.copyWith(bookmarks: next);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kBookmarks, jsonEncode(next.map((e) => e.toJson()).toList()));
    if (state.activeMode == ActiveMode.lanServer) {
      try {
        await _getLanSource().mergeBookmarks([changed]);
      } catch (_) {}
    }
  }

  Future<void> _syncWithLan() async {
    try {
      final lan = _getLanSource();
      final merged = await lan.mergeHistory(state.history);
      final mergedBm = (await lan.mergeBookmarks(state.bookmarks)).where((b) => !b.deleted).toList();
      state = state.copyWith(history: merged, bookmarks: mergedBm);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kHistory, jsonEncode(merged.map((e) => e.toJson()).toList()));
      await prefs.setString(_kBookmarks, jsonEncode(mergedBm.map((e) => e.toJson()).toList()));
    } catch (_) {}
  }

  Future<File?> getCachedPageFile(String photoId, int index) async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/offline/$photoId/$index.jpg');
    return await file.exists() ? file : null;
  }

  Future<File> _offlineIndexFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/offline/index.json');
  }

  Future<Map<String, OfflineChapterMeta>> _readOfflineIndex() async {
    final file = await _offlineIndexFile();
    if (!await file.exists()) return {};
    try {
      final decoded = jsonDecode(await file.readAsString());
      if (decoded is! Map) return {};
      final out = <String, OfflineChapterMeta>{};
      decoded.forEach((k, v) {
        if (v is Map) {
          out['$k'] = OfflineChapterMeta.fromJson(Map<String, dynamic>.from(v));
        }
      });
      return out;
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeOfflineIndex(Map<String, OfflineChapterMeta> index) async {
    final file = await _offlineIndexFile();
    await file.parent.create(recursive: true);
    final map = <String, dynamic>{};
    index.forEach((k, v) => map[k] = v.toJson());
    await file.writeAsString(jsonEncode(map));
  }

  Future<List<OfflineChapterMeta>> listOfflineChapters() async {
    final dir = await getApplicationDocumentsDirectory();
    final offlineDir = Directory('${dir.path}/offline');
    if (!await offlineDir.exists()) return const [];
    final idxMap = await _readOfflineIndex();
    final out = <OfflineChapterMeta>[];
    await for (final entity in offlineDir.list()) {
      if (entity is Directory) {
        final name = entity.path.split(Platform.pathSeparator).last;
        final files = await entity.list().where((e) => e is File).length;
        if (files > 0) {
          final meta = idxMap[name];
          out.add(
            meta != null
                ? OfflineChapterMeta(
                    albumId: meta.albumId,
                    albumTitle: meta.albumTitle,
                    photoId: name,
                    chapterTitle: meta.chapterTitle,
                    coverUrl: meta.coverUrl,
                    pageCount: files,
                    cachedAt: meta.cachedAt,
                  )
                : OfflineChapterMeta(
                    albumId: name,
                    albumTitle: '离线章节 $name',
                    photoId: name,
                    chapterTitle: '章节 $name',
                    pageCount: files,
                    cachedAt: 0,
                  ),
          );
        }
      }
    }
    out.sort((a, b) => b.cachedAt.compareTo(a.cachedAt));
    return out;
  }

  Future<List<ChapterImageItem>> listOfflineChapterImages(String photoId) async {
    final dir = await getApplicationDocumentsDirectory();
    final chapterDir = Directory('${dir.path}/offline/$photoId');
    if (!await chapterDir.exists()) return const [];
    final files = await chapterDir.list().where((e) => e is File).cast<File>().toList();
    final indices = <int>[];
    for (final f in files) {
      final base = f.path.split(Platform.pathSeparator).last.replaceAll('.jpg', '');
      final idx = int.tryParse(base);
      if (idx != null) indices.add(idx);
    }
    indices.sort();
    return indices
        .map((i) => ChapterImageItem(index: i, url: 'offline://$photoId/$i', scrambleId: 0))
        .toList();
  }

  Future<void> deleteOfflineChapter(String photoId) async {
    final dir = await getApplicationDocumentsDirectory();
    final target = Directory('${dir.path}/offline/$photoId');
    if (await target.exists()) {
      await target.delete(recursive: true);
    }
    final idxMap = await _readOfflineIndex();
    if (idxMap.remove(photoId) != null) {
      await _writeOfflineIndex(idxMap);
    }
  }

  Future<void> cacheChapterOffline(
    String photoId,
    List<ChapterImageItem> items, {
    String albumId = '',
    String albumTitle = '',
    String chapterTitle = '',
    String coverUrl = '',
    void Function(int done, int total)? onProgress,
  }) async {
    final dir = await getApplicationDocumentsDirectory();
    final chapterDir = Directory('${dir.path}/offline/$photoId');
    await chapterDir.create(recursive: true);
    final src = activeSource;
    var done = 0;
    for (final item in items) {
      final f = File('${chapterDir.path}/${item.index}.jpg');
      if (!await f.exists()) {
        final bytes = await src.fetchChapterImageBytes(item);
        await f.writeAsBytes(bytes);
      }
      done++;
      onProgress?.call(done, items.length);
    }
    final idxMap = await _readOfflineIndex();
    idxMap[photoId] = OfflineChapterMeta(
      albumId: albumId.isNotEmpty ? albumId : photoId,
      albumTitle: albumTitle.isNotEmpty ? albumTitle : 'JM$albumId',
      photoId: photoId,
      chapterTitle: chapterTitle.isNotEmpty ? chapterTitle : '章节 $photoId',
      coverUrl: coverUrl,
      pageCount: items.length,
      cachedAt: DateTime.now().millisecondsSinceEpoch,
    );
    await _writeOfflineIndex(idxMap);
  }
}

final hybridControllerProvider = StateNotifierProvider<HybridController, HybridState>((ref) {
  return HybridController();
});
