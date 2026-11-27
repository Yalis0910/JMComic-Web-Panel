import 'dart:async';
import 'dart:collection';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/liquid_glass.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  final String albumId;
  final String photoId;
  final String title;
  final String source;
  final String coverUrl;
  final int initialPage;
  final List<ComicEpisode> initialEpisodes;

  const ReaderScreen({
    super.key,
    required this.albumId,
    required this.photoId,
    required this.title,
    this.source = 'online',
    this.coverUrl = '',
    this.initialPage = 0,
    this.initialEpisodes = const [],
  });

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  static const int _maxMemCachePages = 30;

  final ScrollController _scrollCtrl = ScrollController();
  late PageController _pageCtrl;

  late String _photoId;
  List<ComicEpisode> _episodes = const [];
  List<ChapterImageItem> _images = const [];
  final Map<String, List<ChapterImageItem>> _chapterImagesCache = {};
  final LinkedHashMap<String, Uint8List> _memCache = LinkedHashMap();
  final Map<String, Future<Uint8List>> _inFlight = {};

  bool _loading = true;
  bool _hudVisible = true;
  bool _epReverse = false;
  MobileReaderMode _mode = MobileReaderMode.vertical;
  int _currentPage = 0;
  Timer? _historyDebounce;
  bool _hasPendingHistory = false;
  bool _suppressVerticalScrollSync = false;
  String? _modeBanner;
  Timer? _bannerTimer;

  @override
  void initState() {
    super.initState();
    _photoId = widget.photoId;
    _episodes = widget.initialEpisodes;
    _currentPage = widget.initialPage;
    _mode = ref.read(hybridControllerProvider).settings.readerMode;
    _pageCtrl = PageController(initialPage: widget.initialPage);
    _scrollCtrl.addListener(_onVerticalScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadChapter();
      if (_episodes.isEmpty) {
        _loadEpisodes();
      }
    });
  }

  @override
  void dispose() {
    _historyDebounce?.cancel();
    _flushHistorySave(deferred: true);
    _bannerTimer?.cancel();
    _scrollCtrl.removeListener(_onVerticalScroll);
    _scrollCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  int get _currentEpisodeIndex => _episodes.indexWhere((e) => e.photoId == _photoId);
  ComicEpisode? get _currentEpisode =>
      _currentEpisodeIndex >= 0 ? _episodes[_currentEpisodeIndex] : null;
  ComicEpisode? get _prevEpisode =>
      _currentEpisodeIndex > 0 ? _episodes[_currentEpisodeIndex - 1] : null;
  ComicEpisode? get _nextEpisode =>
      (_currentEpisodeIndex >= 0 && _currentEpisodeIndex < _episodes.length - 1)
          ? _episodes[_currentEpisodeIndex + 1]
          : null;

  Future<void> _loadEpisodes() async {
    try {
      final ctrl = ref.read(hybridControllerProvider.notifier);
      final eps = widget.source == 'local'
          ? await ctrl.lanSource.getLocalEpisodes(widget.albumId)
          : (await ctrl.activeSource.getAlbumDetail(widget.albumId)).episodes;
      if (mounted && eps.isNotEmpty) {
        setState(() => _episodes = eps);
      }
    } catch (_) {}
  }

  void _onVerticalScroll() {
    if (_suppressVerticalScrollSync ||
        _mode != MobileReaderMode.vertical ||
        _images.isEmpty ||
        !_scrollCtrl.hasClients) {
      return;
    }
    final maxExtent = _scrollCtrl.position.maxScrollExtent;
    if (maxExtent <= 0) return;
    final ratio = (_scrollCtrl.offset / maxExtent).clamp(0.0, 1.0);
    final est = (ratio * (_images.length - 1)).round();
    if (est != _currentPage) {
      _onPageChanged(est);
    }
  }

  Future<List<ChapterImageItem>> _fetchChapterImageList(String targetPhotoId) async {
    final cached = _chapterImagesCache[targetPhotoId];
    if (cached != null) return cached;
    final ctrl = ref.read(hybridControllerProvider.notifier);
    List<ChapterImageItem> list;
    if (widget.source == 'local') {
      list = await ctrl.lanSource.getLocalChapterImages(widget.albumId, targetPhotoId);
    } else {
      try {
        list = await ctrl.activeSource.getChapterImages(targetPhotoId);
      } catch (e) {
        final offlineList = await ctrl.listOfflineChapterImages(targetPhotoId);
        if (offlineList.isEmpty) rethrow;
        list = offlineList;
      }
    }
    _chapterImagesCache[targetPhotoId] = list;
    return list;
  }

  Future<void> _loadChapter({String? targetPhotoId}) async {
    final pid = targetPhotoId ?? _photoId;
    setState(() => _loading = true);
    try {
      final list = await _fetchChapterImageList(pid);
      if (mounted && pid == _photoId) {
        final safePage = list.isEmpty ? 0 : _currentPage.clamp(0, list.length - 1);
        setState(() {
          _images = list;
          _currentPage = safePage;
          _loading = false;
        });
        _schedulePreload(safePage);
        if (list.isNotEmpty) {
          // Record chapter entry immediately even if the user exits on page 1.
          _hasPendingHistory = true;
          _flushHistorySave();
        }
        if (safePage > 0) {
          if (_mode == MobileReaderMode.vertical) {
            _suppressVerticalScrollSync = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _scrollCtrl.hasClients && _images.length > 1) {
                final maxExtent = _scrollCtrl.position.maxScrollExtent;
                if (maxExtent > 0) {
                  final target = (maxExtent * safePage) / (_images.length - 1);
                  _scrollCtrl.jumpTo(target);
                }
              }
            });
          } else {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _pageCtrl.hasClients) {
                _pageCtrl.jumpToPage(safePage);
              }
            });
          }
        }
      }
    } catch (_) {
      if (mounted && pid == _photoId) setState(() => _loading = false);
    }
  }

  String _pageKey(String pid, int index) => '$pid|$index';

  void _putMemCache(String key, Uint8List bytes) {
    _memCache.remove(key);
    _memCache[key] = bytes;
    while (_memCache.length > _maxMemCachePages) {
      _memCache.remove(_memCache.keys.first);
    }
  }

  Future<Uint8List> _loadPageBytesFor(String pid, ChapterImageItem item) {
    final key = _pageKey(pid, item.index);
    final memHit = _memCache[key];
    if (memHit != null) {
      _putMemCache(key, memHit);
      return Future.value(memHit);
    }
    final existing = _inFlight[key];
    if (existing != null) return existing;

    final future = () async {
      final ctrl = ref.read(hybridControllerProvider.notifier);
      final cachedFile = await ctrl.getCachedPageFile(pid, item.index);
      if (cachedFile != null) {
        final bytes = await cachedFile.readAsBytes();
        _putMemCache(key, bytes);
        return bytes;
      }
      final bytes = await ctrl.activeSource.fetchChapterImageBytes(item);
      _putMemCache(key, bytes);
      return bytes;
    }();

    _inFlight[key] = future;
    future.whenComplete(() => _inFlight.remove(key));
    return future;
  }

  void _schedulePreload(int anchorPage) {
    if (_images.isEmpty) return;
    final preloadCount = ref.read(hybridControllerProvider).settings.preloadCount;
    final pid = _photoId;
    final end = math.min(_images.length - 1, anchorPage + preloadCount);
    for (int i = anchorPage; i <= end; i++) {
      _loadPageBytesFor(pid, _images[i]).catchError((_) => Uint8List(0));
    }

    // Near end of chapter: prefetch next chapter's metadata and first 2 pages
    final nextEp = _nextEpisode;
    if (nextEp != null && anchorPage >= _images.length - 2) {
      _fetchChapterImageList(nextEp.photoId).then((nextImgs) {
        for (int i = 0; i < math.min(2, nextImgs.length); i++) {
          _loadPageBytesFor(nextEp.photoId, nextImgs[i]).catchError((_) => Uint8List(0));
        }
      }).catchError((_) {});
    }
  }

  HistoryRecord _buildHistoryRecord() {
    final ep = _currentEpisode;
    final chapterTitle = ep == null ? '' : '第 ${ep.index} 话 ${ep.name}'.trim();
    var cover = widget.coverUrl;
    if (cover.isEmpty) {
      for (final h in ref.read(hybridControllerProvider).history) {
        if (h.albumId == widget.albumId && h.coverUrl.isNotEmpty) {
          cover = h.coverUrl;
          break;
        }
      }
    }
    return HistoryRecord(
      albumId: widget.albumId,
      photoId: _photoId,
      source: widget.source,
      title: widget.title,
      chapterTitle: chapterTitle,
      coverUrl: cover,
      pageIndex: _currentPage,
      totalPages: _images.length,
      updatedAt: DateTime.now().millisecondsSinceEpoch,
    );
  }

  void _flushHistorySave({bool deferred = false}) {
    if (!_hasPendingHistory || _images.isEmpty) return;
    _hasPendingHistory = false;
    final ctrl = ref.read(hybridControllerProvider.notifier);
    final rec = _buildHistoryRecord();
    if (deferred) {
      Future.microtask(() => ctrl.recordReading(rec));
    } else {
      ctrl.recordReading(rec);
    }
  }

  void _onPageChanged(int idx) {
    final clamped = idx.clamp(0, _images.isEmpty ? 0 : _images.length - 1);
    if (_currentPage == clamped) return;
    setState(() => _currentPage = clamped);
    _schedulePreload(clamped);

    _hasPendingHistory = true;
    _historyDebounce?.cancel();
    _historyDebounce = Timer(const Duration(milliseconds: 600), _flushHistorySave);
  }

  List<List<int>> _computeDoubleSpreads(HybridSettings settings) {
    if (_images.isEmpty) return const [];
    final spreads = <List<int>>[];
    var i = 0;
    if (settings.doublePageCoverOffset && _images.isNotEmpty) {
      spreads.add([0]);
      i = 1;
    }
    while (i < _images.length) {
      if (i + 1 < _images.length) {
        spreads.add([i, i + 1]);
      } else {
        spreads.add([i]);
      }
      i += 2;
    }
    return spreads;
  }

  int _spreadIndexForPage(int pageIdx, List<List<int>> spreads) {
    for (var s = 0; s < spreads.length; s++) {
      if (spreads[s].contains(pageIdx)) return s;
    }
    return 0;
  }

  void _jumpToPage(int idx) {
    final clamped = idx.clamp(0, _images.isEmpty ? 0 : _images.length - 1);
    _onPageChanged(clamped);
    if (_mode == MobileReaderMode.vertical && _scrollCtrl.hasClients && _images.length > 1) {
      _suppressVerticalScrollSync = true;
      final target = (_scrollCtrl.position.maxScrollExtent * clamped) / (_images.length - 1);
      _scrollCtrl.jumpTo(target);
    } else if (_mode == MobileReaderMode.doublePage && _pageCtrl.hasClients) {
      final spreads = _computeDoubleSpreads(ref.read(hybridControllerProvider).settings);
      _pageCtrl.jumpToPage(_spreadIndexForPage(clamped, spreads));
    } else if (_mode != MobileReaderMode.vertical && _pageCtrl.hasClients) {
      _pageCtrl.jumpToPage(clamped);
    }
  }

  void _switchChapter(ComicEpisode target) {
    if (target.photoId == _photoId) return;
    _historyDebounce?.cancel();
    _flushHistorySave();
    _suppressVerticalScrollSync = false;
    if (_mode != MobileReaderMode.vertical) {
      final oldCtrl = _pageCtrl;
      _pageCtrl = PageController(initialPage: 0);
      WidgetsBinding.instance.addPostFrameCallback((_) => oldCtrl.dispose());
    }
    setState(() {
      _photoId = target.photoId;
      _currentPage = 0;
      _images = const [];
    });
    if (_scrollCtrl.hasClients) {
      _scrollCtrl.jumpTo(0);
    }
    _loadChapter(targetPhotoId: target.photoId);
  }

  void _showModeBanner(String text) {
    _bannerTimer?.cancel();
    setState(() => _modeBanner = text);
    _bannerTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _modeBanner = null);
    });
  }

  void _setReaderMode(MobileReaderMode next) {
    if (_mode == next) return;
    final settings = ref.read(hybridControllerProvider).settings;
    if (next != MobileReaderMode.vertical) {
      final oldCtrl = _pageCtrl;
      final initIndex = next == MobileReaderMode.doublePage
          ? _spreadIndexForPage(_currentPage, _computeDoubleSpreads(settings))
          : _currentPage;
      _pageCtrl = PageController(initialPage: initIndex);
      WidgetsBinding.instance.addPostFrameCallback((_) => oldCtrl.dispose());
    }
    setState(() => _mode = next);

    final ctrl = ref.read(hybridControllerProvider.notifier);
    ctrl.updateSettings(settings.copyWith(readerMode: next));

    if (next == MobileReaderMode.vertical) {
      _suppressVerticalScrollSync = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _scrollCtrl.hasClients && _images.length > 1) {
          final target = (_scrollCtrl.position.maxScrollExtent * _currentPage) / (_images.length - 1);
          _scrollCtrl.jumpTo(target);
        }
      });
    } else {
      _suppressVerticalScrollSync = false;
    }

    switch (next) {
      case MobileReaderMode.vertical:
        _showModeBanner('条漫模式 · 上下连续滚动');
        break;
      case MobileReaderMode.singleLtr:
        _showModeBanner('左→右模式 · 点击右侧或向左滑翻下一页');
        break;
      case MobileReaderMode.singleRtl:
        _showModeBanner('日漫模式 · 点击左侧或向右滑翻下一页');
        break;
      case MobileReaderMode.doublePage:
        _showModeBanner('双页模式 · 适合平板或横屏跨页阅读');
        break;
    }
  }

  void _stepPage(int delta) {
    if (_images.isEmpty) return;
    if (_mode == MobileReaderMode.doublePage) {
      final spreads = _computeDoubleSpreads(ref.read(hybridControllerProvider).settings);
      final curSpread = _spreadIndexForPage(_currentPage, spreads);
      final targetSpread = curSpread + delta;
      if (targetSpread < 0) {
        _showModeBanner(_prevEpisode != null ? '已到第 1 页 · 可切换上一话' : '已经是第 1 页');
        return;
      }
      if (targetSpread >= spreads.length) {
        _showModeBanner(_nextEpisode != null ? '已到本话末页 · 点击「下一话」继续' : '已经是最后一页');
        return;
      }
      if (_pageCtrl.hasClients) {
        _pageCtrl.animateToPage(
          targetSpread,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
        );
      }
      return;
    }
    final target = _currentPage + delta;
    if (target < 0) {
      _showModeBanner(_prevEpisode != null ? '已到第 1 页 · 可切换上一话' : '已经是第 1 页');
      return;
    }
    if (target >= _images.length) {
      _showModeBanner(_nextEpisode != null ? '已到本话末页 · 点击「下一话」继续' : '已经是最后一页');
      return;
    }
    if (_pageCtrl.hasClients) {
      _pageCtrl.animateToPage(
        target,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    } else {
      _jumpToPage(target);
    }
  }

  void _handleStageTapUp(TapUpDetails details, double width) {
    if (_mode == MobileReaderMode.vertical || _images.isEmpty || _loading) {
      setState(() => _hudVisible = !_hudVisible);
      return;
    }
    final settings = ref.read(hybridControllerProvider).settings;
    final isRtl = _mode == MobileReaderMode.singleRtl ||
        (_mode == MobileReaderMode.doublePage && settings.doublePageRtl);
    final ratio = width > 0 ? details.localPosition.dx / width : 0.5;
    if (ratio < 0.30) {
      _stepPage(isRtl ? 1 : -1);
    } else if (ratio > 0.70) {
      _stepPage(isRtl ? -1 : 1);
    } else {
      setState(() => _hudVisible = !_hudVisible);
    }
  }

  void _openThumbsSheet() {
    if (_images.isEmpty) return;
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(LiquidTokens.radiusSheet)),
        child: LiquidGlassSurface(
          variant: LiquidGlassVariant.tinted,
          borderRadius: LiquidTokens.radiusSheet,
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 22),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * 0.62,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: LiquidTokens.separator(ctx),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('快速跳页 (共 ${_images.length} 页)', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  Expanded(
                    child: GridView.builder(
                      physics: const BouncingScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 0.78,
                      ),
                      itemCount: _images.length,
                      itemBuilder: (_, idx) {
                        final active = idx == _currentPage;
                        final item = _images[idx];
                        return GestureDetector(
                          onTap: () {
                            Navigator.pop(ctx);
                            _jumpToPage(idx);
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: active ? LiquidTokens.accentStrong(ctx) : LiquidTokens.separator(ctx),
                                width: active ? 2 : 1,
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                _ReaderPageImage(
                                  key: ValueKey('thumb_${_photoId}_${item.index}'),
                                  fit: BoxFit.cover,
                                  loader: () => _loadPageBytesFor(_photoId, item),
                                ),
                                Positioned(
                                  right: 4,
                                  bottom: 4,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: active ? LiquidTokens.scene(ctx) : CupertinoColors.black.withValues(alpha: 0.7),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      '${idx + 1}',
                                      style: const TextStyle(
                                        color: CupertinoColors.white,
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openChapterSheet() {
    if (_episodes.isEmpty) return;
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final ordered = _epReverse ? _episodes.reversed.toList() : _episodes;
          return ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(LiquidTokens.radiusSheet)),
            child: LiquidGlassSurface(
              variant: LiquidGlassVariant.tinted,
              borderRadius: LiquidTokens.radiusSheet,
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 22),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: MediaQuery.of(ctx).size.height * 0.62,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: LiquidTokens.separator(ctx),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '章节目录 (${_episodes.length})',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                          ),
                          GestureDetector(
                            onTap: () {
                              setState(() => _epReverse = !_epReverse);
                              setSheetState(() {});
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                              decoration: BoxDecoration(
                                color: LiquidTokens.solid(ctx),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: LiquidTokens.separator(ctx)),
                              ),
                              child: Text(
                                _epReverse ? '倒序' : '正序',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: LiquidTokens.accentStrong(ctx),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: LiquidSolidCard(
                          padding: EdgeInsets.zero,
                          child: ListView.separated(
                            physics: const BouncingScrollPhysics(),
                            itemCount: ordered.length,
                            separatorBuilder: (_, __) =>
                                Container(height: 0.7, color: LiquidTokens.separator(ctx)),
                            itemBuilder: (_, idx) {
                              final ep = ordered[idx];
                              final active = ep.photoId == _photoId;
                              return Container(
                                color: active ? LiquidTokens.accentSoft(ctx) : null,
                                child: CupertinoListTile(
                                  title: Text(
                                    '第 ${ep.index} 话 ${ep.name}'.trim(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                                      color: active ? LiquidTokens.accentStrong(ctx) : LiquidTokens.ink(ctx),
                                    ),
                                  ),
                                  trailing: active
                                      ? Text(
                                          '当前',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: LiquidTokens.accentStrong(ctx),
                                          ),
                                        )
                                      : const CupertinoListTileChevron(),
                                  onTap: () {
                                    Navigator.pop(ctx);
                                    _switchChapter(ep);
                                  },
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _openSettingsSheet() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => Consumer(
        builder: (ctx, modalRef, _) {
          final settings = modalRef.watch(hybridControllerProvider).settings;
          final ctrl = modalRef.read(hybridControllerProvider.notifier);
          return ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(LiquidTokens.radiusSheet)),
            child: LiquidGlassSurface(
              variant: LiquidGlassVariant.tinted,
              borderRadius: LiquidTokens.radiusSheet,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: LiquidTokens.separator(ctx),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text('阅读器设置', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 14),
                    LiquidSolidCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          CupertinoListTile(
                            title: const Text('双页日漫方向 (右→左)'),
                            trailing: CupertinoSwitch(
                              activeTrackColor: LiquidTokens.accent(ctx),
                              value: settings.doublePageRtl,
                              onChanged: (v) => ctrl.updateSettings(settings.copyWith(doublePageRtl: v)),
                            ),
                          ),
                          Container(height: 0.7, color: LiquidTokens.separator(ctx)),
                          CupertinoListTile(
                            title: const Text('双页封面单独成页'),
                            trailing: CupertinoSwitch(
                              activeTrackColor: LiquidTokens.accent(ctx),
                              value: settings.doublePageCoverOffset,
                              onChanged: (v) => ctrl.updateSettings(settings.copyWith(doublePageCoverOffset: v)),
                            ),
                          ),
                          Container(height: 0.7, color: LiquidTokens.separator(ctx)),
                          CupertinoListTile(
                            title: const Text('预加载张数'),
                            subtitle: const Text('阅读时后台提前解密后续页面'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                CupertinoButton(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                  onPressed: settings.preloadCount <= 1
                                      ? null
                                      : () {
                                          ctrl.updateSettings(
                                            settings.copyWith(preloadCount: settings.preloadCount - 1),
                                          );
                                          _schedulePreload(_currentPage);
                                        },
                                  child: const Icon(CupertinoIcons.minus_circle, size: 22),
                                ),
                                SizedBox(
                                  width: 28,
                                  child: Text(
                                    '${settings.preloadCount}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                CupertinoButton(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                  onPressed: settings.preloadCount >= 20
                                      ? null
                                      : () {
                                          ctrl.updateSettings(
                                            settings.copyWith(preloadCount: settings.preloadCount + 1),
                                          );
                                          _schedulePreload(_currentPage);
                                        },
                                  child: const Icon(CupertinoIcons.plus_circle, size: 22),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final hybrid = ref.watch(hybridControllerProvider);
    final settings = hybrid.settings;
    final curEp = _currentEpisode;
    final prevEp = _prevEpisode;
    final nextEp = _nextEpisode;
    final isLastPage = _images.isNotEmpty && _currentPage >= _images.length - 1;
    final curBookmarkId = '${widget.source}:${widget.albumId}:$_photoId:$_currentPage';
    final isBookmarked = hybrid.bookmarks.any((b) => b.bookmarkId == curBookmarkId && !b.deleted);
    final doubleSpreads = _mode == MobileReaderMode.doublePage ? _computeDoubleSpreads(settings) : const <List<int>>[];

    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF080D10),
      child: Stack(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTapUp: (details) => _handleStageTapUp(details, MediaQuery.sizeOf(context).width),
            child: _loading
                ? const Center(child: CupertinoActivityIndicator(color: CupertinoColors.white))
                : _mode == MobileReaderMode.vertical
                    ? Listener(
                        onPointerDown: (_) => _suppressVerticalScrollSync = false,
                        onPointerSignal: (_) => _suppressVerticalScrollSync = false,
                        child: ListView.builder(
                          controller: _scrollCtrl,
                          cacheExtent: 1200,
                          physics: const BouncingScrollPhysics(),
                          itemCount: _images.length + (nextEp != null ? 1 : 0),
                          itemBuilder: (ctx, idx) {
                            if (idx >= _images.length && nextEp != null) {
                              return Padding(
                                padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
                                child: LiquidSpringControl(
                                  onTap: () => _switchChapter(nextEp),
                                  child: Container(
                                    height: 50,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: LiquidTokens.lightSaltMist,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      '继续阅读下一话：第 ${nextEp.index} 话 ${nextEp.name}'.trim(),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: LiquidTokens.lightInk,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }
                            final item = _images[idx];
                            return _ReaderPageImage(
                              key: ValueKey('${_photoId}_${item.index}'),
                              fit: BoxFit.fitWidth,
                              loader: () => _loadPageBytesFor(_photoId, item),
                            );
                          },
                        ),
                      )
                    : _mode == MobileReaderMode.doublePage
                        ? PageView.builder(
                            key: ValueKey('pv_double_${_photoId}_${settings.doublePageRtl}_${settings.doublePageCoverOffset}'),
                            controller: _pageCtrl,
                            reverse: settings.doublePageRtl,
                            itemCount: doubleSpreads.length,
                            onPageChanged: (spreadIdx) {
                              if (spreadIdx >= 0 && spreadIdx < doubleSpreads.length) {
                                _onPageChanged(doubleSpreads[spreadIdx].first);
                              }
                            },
                            itemBuilder: (ctx, spreadIdx) {
                              final indices = doubleSpreads[spreadIdx];
                              final ordered = settings.doublePageRtl ? indices.reversed.toList() : indices;
                              return InteractiveViewer(
                                minScale: 1.0,
                                maxScale: 4.0,
                                child: SizedBox.expand(
                                  child: Row(
                                    children: [
                                      for (final pIdx in ordered)
                                        Expanded(
                                          child: _ReaderPageImage(
                                            key: ValueKey('dp_${_photoId}_${_images[pIdx].index}'),
                                            fit: BoxFit.contain,
                                            loader: () => _loadPageBytesFor(_photoId, _images[pIdx]),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          )
                        : PageView.builder(
                        key: ValueKey('pv_${_photoId}_${_mode.name}'),
                        controller: _pageCtrl,
                        reverse: _mode == MobileReaderMode.singleRtl,
                        itemCount: _images.length,
                        onPageChanged: _onPageChanged,
                        itemBuilder: (ctx, idx) {
                          final item = _images[idx];
                          return InteractiveViewer(
                            minScale: 1.0,
                            maxScale: 4.0,
                            child: SizedBox.expand(
                              child: _ReaderPageImage(
                                key: ValueKey('${_photoId}_${item.index}_${_mode.name}'),
                                fit: BoxFit.contain,
                                loader: () => _loadPageBytesFor(_photoId, item),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          // Floating shortcut to next chapter on last page in single-page mode
          if (!_loading && _mode != MobileReaderMode.vertical && isLastPage && nextEp != null && !_hudVisible)
            Positioned(
              left: _mode == MobileReaderMode.singleRtl ? 16 : null,
              right: _mode == MobileReaderMode.singleRtl ? null : 16,
              bottom: (bottomPad > 0 ? bottomPad : 12) + 16,
              child: LiquidSpringControl(
                onTap: () => _switchChapter(nextEp),
                child: LiquidGlassSurface(
                  variant: LiquidGlassVariant.clear,
                  onDarkScene: true,
                  borderRadius: 999,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Text(
                    _mode == MobileReaderMode.singleRtl
                        ? '← 下一话：第 ${nextEp.index} 话'
                        : '下一话：第 ${nextEp.index} 话 →',
                    style: const TextStyle(
                      color: LiquidTokens.lightIce,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          if (_modeBanner != null)
            Positioned(
              top: topPad + 74,
              left: 24,
              right: 24,
              child: IgnorePointer(
                child: Center(
                  child: LiquidGlassSurface(
                    variant: LiquidGlassVariant.clear,
                    onDarkScene: true,
                    borderRadius: 999,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Text(
                      _modeBanner!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: LiquidTokens.lightIce,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          // Floating Liquid Glass Top Capsule HUD
          Positioned(
            top: topPad + 10,
            left: 14,
            right: 14,
            child: IgnorePointer(
              ignoring: !_hudVisible,
              child: AnimatedSlide(
                offset: _hudVisible ? Offset.zero : const Offset(0, -1.6),
                duration: LiquidTokens.releaseDuration,
                curve: const Cubic(0.26, 1.32, 0.52, 1.0),
                child: AnimatedOpacity(
                  opacity: _hudVisible ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 220),
                  child: LiquidGlassSurface(
                    variant: LiquidGlassVariant.clear,
                    onDarkScene: true,
                    borderRadius: 999,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    child: Row(
                      children: [
                        LiquidSpringControl(
                          onTap: () => Navigator.of(context).pop(),
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: CupertinoColors.white.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(CupertinoIcons.back, size: 18, color: CupertinoColors.white),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: CupertinoColors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (curEp != null)
                                Text(
                                  '第 ${curEp.index} 话 ${curEp.name}'.trim(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: CupertinoColors.white.withValues(alpha: 0.72),
                                    fontSize: 11,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (_episodes.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          LiquidSpringControl(
                            onTap: _openChapterSheet,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: CupertinoColors.white.withValues(alpha: 0.14),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                CupertinoIcons.list_bullet,
                                size: 17,
                                color: CupertinoColors.white,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(width: 6),
                        LiquidSpringControl(
                          onTap: () {
                            ref.read(hybridControllerProvider.notifier).toggleBookmark(
                                  albumId: widget.albumId,
                                  photoId: _photoId,
                                  source: widget.source,
                                  title: widget.title,
                                  chapterTitle: curEp == null ? '' : '第 ${curEp.index} 话 ${curEp.name}'.trim(),
                                  coverUrl: widget.coverUrl,
                                  pageIndex: _currentPage,
                                );
                            _showModeBanner(isBookmarked ? '已移除本页书签' : '已收藏第 ${_currentPage + 1} 页书签');
                          },
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: isBookmarked
                                  ? LiquidTokens.lightIce.withValues(alpha: 0.25)
                                  : CupertinoColors.white.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isBookmarked ? CupertinoIcons.bookmark_fill : CupertinoIcons.bookmark,
                              size: 16,
                              color: isBookmarked ? LiquidTokens.lightIce : CupertinoColors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        LiquidSpringControl(
                          onTap: _openThumbsSheet,
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: CupertinoColors.white.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              CupertinoIcons.square_grid_2x2,
                              size: 16,
                              color: CupertinoColors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        LiquidSpringControl(
                          onTap: _openSettingsSheet,
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: CupertinoColors.white.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              CupertinoIcons.slider_horizontal_3,
                              size: 16,
                              color: CupertinoColors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: CupertinoColors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${_images.isEmpty ? 0 : _currentPage + 1}/${_images.length}',
                            style: const TextStyle(
                              color: LiquidTokens.lightIce,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Floating Liquid Glass Bottom Capsule HUD
          if (_images.isNotEmpty)
            Positioned(
              left: 14,
              right: 14,
              bottom: bottomPad > 0 ? bottomPad + 8 : 14,
              child: IgnorePointer(
                ignoring: !_hudVisible,
                child: AnimatedSlide(
                  offset: _hudVisible ? Offset.zero : const Offset(0, 1.6),
                  duration: LiquidTokens.releaseDuration,
                  curve: const Cubic(0.26, 1.32, 0.52, 1.0),
                  child: AnimatedOpacity(
                    opacity: _hudVisible ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 220),
                    child: LiquidGlassSurface(
                      variant: LiquidGlassVariant.clear,
                      onDarkScene: true,
                      borderRadius: LiquidTokens.radiusSheet,
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_images.length > 1)
                            Row(
                              children: [
                                Text(
                                  '${_currentPage + 1}',
                                  style: const TextStyle(color: CupertinoColors.white, fontSize: 12),
                                ),
                                Expanded(
                                  child: CupertinoSlider(
                                    min: 0,
                                    max: (_images.length - 1).toDouble(),
                                    activeColor: LiquidTokens.lightIce,
                                    value: _currentPage.toDouble().clamp(0, (_images.length - 1).toDouble()),
                                    onChanged: (v) => _jumpToPage(v.round()),
                                  ),
                                ),
                                Text(
                                  '${_images.length}',
                                  style: const TextStyle(color: CupertinoColors.white, fontSize: 12),
                                ),
                              ],
                            ),
                          if (_episodes.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Expanded(
                                  child: LiquidSpringControl(
                                    onTap: prevEp != null ? () => _switchChapter(prevEp) : null,
                                    child: Opacity(
                                      opacity: prevEp != null ? 1.0 : 0.38,
                                      child: Container(
                                        height: 36,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: CupertinoColors.white.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: const Text(
                                          '‹ 上一话',
                                          style: TextStyle(
                                            color: CupertinoColors.white,
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                LiquidSpringControl(
                                  onTap: _openChapterSheet,
                                  child: Container(
                                    height: 36,
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: CupertinoColors.white.withValues(alpha: 0.18),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      '目录 (${_episodes.length})',
                                      style: const TextStyle(
                                        color: LiquidTokens.lightIce,
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: LiquidSpringControl(
                                    onTap: nextEp != null ? () => _switchChapter(nextEp) : null,
                                    child: Opacity(
                                      opacity: nextEp != null ? 1.0 : 0.38,
                                      child: Container(
                                        height: 36,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: CupertinoColors.white.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: const Text(
                                          '下一话 ›',
                                          style: TextStyle(
                                            color: CupertinoColors.white,
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 8),
                          LiquidSegmentedPill<MobileReaderMode>(
                            onDarkScene: true,
                            value: _mode,
                            items: const [
                              (value: MobileReaderMode.vertical, label: '条漫'),
                              (value: MobileReaderMode.singleLtr, label: '左→右'),
                              (value: MobileReaderMode.singleRtl, label: '日漫'),
                              (value: MobileReaderMode.doublePage, label: '双页'),
                            ],
                            onChanged: _setReaderMode,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ReaderPageImage extends StatefulWidget {
  final Future<Uint8List> Function() loader;
  final BoxFit fit;
  const _ReaderPageImage({
    super.key,
    required this.loader,
    this.fit = BoxFit.fitWidth,
  });

  @override
  State<_ReaderPageImage> createState() => _ReaderPageImageState();
}

class _ReaderPageImageState extends State<_ReaderPageImage> {
  late Future<Uint8List> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader();
  }

  @override
  void didUpdateWidget(covariant _ReaderPageImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.loader != widget.loader && oldWidget.key != widget.key) {
      _future = widget.loader();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List>(
      future: _future,
      builder: (ctx, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const SizedBox(
            height: 360,
            child: Center(child: CupertinoActivityIndicator(color: CupertinoColors.white)),
          );
        }
        if (snap.hasError || !snap.hasData || snap.data!.isEmpty) {
          return SizedBox(
            height: 260,
            child: Center(
              child: CupertinoButton(
                onPressed: () => setState(() => _future = widget.loader()),
                child: const Text('加载失败，点击重试'),
              ),
            ),
          );
        }
        return Image.memory(
          snap.data!,
          fit: widget.fit,
          width: widget.fit == BoxFit.fitWidth ? double.infinity : null,
          gaplessPlayback: true,
        );
      },
    );
  }
}
