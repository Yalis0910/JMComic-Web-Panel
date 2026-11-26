import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/comic_models.dart';
import '../sources/comic_data_source.dart';
import '../sources/direct_jm_source.dart';
import '../sources/lan_server_source.dart';

class HybridSettings {
  final String serverUrl;
  final String panelToken;
  final ConnectionPreference preference;
  final bool darkMode;
  final bool showCovers;

  const HybridSettings({
    this.serverUrl = 'http://192.168.1.10:8800',
    this.panelToken = '',
    this.preference = ConnectionPreference.auto,
    this.darkMode = false,
    this.showCovers = true,
  });

  HybridSettings copyWith({
    String? serverUrl,
    String? panelToken,
    ConnectionPreference? preference,
    bool? darkMode,
    bool? showCovers,
  }) =>
      HybridSettings(
        serverUrl: serverUrl ?? this.serverUrl,
        panelToken: panelToken ?? this.panelToken,
        preference: preference ?? this.preference,
        darkMode: darkMode ?? this.darkMode,
        showCovers: showCovers ?? this.showCovers,
      );
}

class HybridState {
  final HybridSettings settings;
  final ActiveMode activeMode;
  final bool probing;
  final List<HistoryRecord> history;
  final UserAccountStatus account;

  const HybridState({
    required this.settings,
    required this.activeMode,
    this.probing = false,
    this.history = const [],
    this.account = UserAccountStatus.empty,
  });

  HybridState copyWith({
    HybridSettings? settings,
    ActiveMode? activeMode,
    bool? probing,
    List<HistoryRecord>? history,
    UserAccountStatus? account,
  }) =>
      HybridState(
        settings: settings ?? this.settings,
        activeMode: activeMode ?? this.activeMode,
        probing: probing ?? this.probing,
        history: history ?? this.history,
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
  static const _kShowCovers = 'hybrid_show_covers';
  static const _kHistory = 'hybrid_history';

  final DirectJmSource _directSource = DirectJmSource();

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final prefIdx = prefs.getInt(_kPref) ?? 0;
    final loaded = HybridSettings(
      serverUrl: prefs.getString(_kServerUrl) ?? 'http://192.168.1.10:8800',
      panelToken: prefs.getString(_kPanelToken) ?? '',
      preference: ConnectionPreference.values[prefIdx.clamp(0, 2)],
      darkMode: prefs.getBool(_kDark) ?? false,
      showCovers: prefs.getBool(_kShowCovers) ?? true,
    );
    final rawHist = prefs.getString(_kHistory);
    final histList = rawHist == null
        ? <HistoryRecord>[]
        : (jsonDecode(rawHist) as List)
            .map((e) => HistoryRecord.fromJson(Map<String, dynamic>.from(e)))
            .toList();
    state = state.copyWith(settings: loaded, history: histList);
    await probeAndSwitch();
  }

  ComicDataSource get activeSource {
    if (state.activeMode == ActiveMode.lanServer) {
      return LanServerSource(
        baseUrl: state.settings.serverUrl,
        panelToken: state.settings.panelToken,
      );
    }
    return _directSource;
  }

  Future<void> updateSettings(HybridSettings next) async {
    final prev = state.settings;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrl, next.serverUrl);
    await prefs.setString(_kPanelToken, next.panelToken);
    await prefs.setInt(_kPref, next.preference.index);
    await prefs.setBool(_kDark, next.darkMode);
    await prefs.setBool(_kShowCovers, next.showCovers);
    state = state.copyWith(settings: next);
    if (prev.serverUrl != next.serverUrl ||
        prev.panelToken != next.panelToken ||
        prev.preference != next.preference) {
      await probeAndSwitch();
    }
  }

  Future<void> probeAndSwitch() async {
    final pref = state.settings.preference;
    if (pref == ConnectionPreference.directOnly) {
      state = state.copyWith(activeMode: ActiveMode.directJm, probing: false);
      await refreshAccount();
      return;
    }
    if (pref == ConnectionPreference.lanOnly) {
      state = state.copyWith(activeMode: ActiveMode.lanServer, probing: false);
      await Future.wait([_syncWithLan(), refreshAccount()]);
      return;
    }

    state = state.copyWith(probing: true);
    final cleanBase = state.settings.serverUrl.replaceAll(RegExp(r'/$'), '');
    try {
      final dio = Dio(BaseOptions(connectTimeout: const Duration(milliseconds: 900), receiveTimeout: const Duration(milliseconds: 900)));
      final res = await dio.get('$cleanBase/api/v2/system/health');
      if (res.statusCode == 200) {
        state = state.copyWith(activeMode: ActiveMode.lanServer, probing: false);
        await Future.wait([_syncWithLan(), refreshAccount()]);
        return;
      }
    } catch (_) {}

    state = state.copyWith(activeMode: ActiveMode.directJm, probing: false);
    await refreshAccount();
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

  Future<void> _syncWithLan() async {
    try {
      final lan = LanServerSource(
        baseUrl: state.settings.serverUrl,
        panelToken: state.settings.panelToken,
      );
      final merged = await lan.mergeHistory(state.history);
      state = state.copyWith(history: merged);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kHistory, jsonEncode(merged.map((e) => e.toJson()).toList()));
    } catch (_) {}
  }

  Future<File?> getCachedPageFile(String photoId, int index) async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/offline/$photoId/$index.jpg');
    return await file.exists() ? file : null;
  }

  Future<List<({String photoId, int pageCount})>> listOfflineChapters() async {
    final dir = await getApplicationDocumentsDirectory();
    final offlineDir = Directory('${dir.path}/offline');
    if (!await offlineDir.exists()) return const [];
    final out = <({String photoId, int pageCount})>[];
    await for (final entity in offlineDir.list()) {
      if (entity is Directory) {
        final name = entity.path.split(Platform.pathSeparator).last;
        final files = await entity.list().where((e) => e is File).length;
        if (files > 0) {
          out.add((photoId: name, pageCount: files));
        }
      }
    }
    return out;
  }

  Future<void> deleteOfflineChapter(String photoId) async {
    final dir = await getApplicationDocumentsDirectory();
    final target = Directory('${dir.path}/offline/$photoId');
    if (await target.exists()) {
      await target.delete(recursive: true);
    }
  }

  Future<void> cacheChapterOffline(String photoId, List<ChapterImageItem> items) async {
    final dir = await getApplicationDocumentsDirectory();
    final chapterDir = Directory('${dir.path}/offline/$photoId');
    await chapterDir.create(recursive: true);
    final src = activeSource;
    for (final item in items) {
      final f = File('${chapterDir.path}/${item.index}.jpg');
      if (await f.exists()) continue;
      final bytes = await src.fetchChapterImageBytes(item);
      await f.writeAsBytes(bytes);
    }
  }
}

final hybridControllerProvider = StateNotifierProvider<HybridController, HybridState>((ref) {
  return HybridController();
});
