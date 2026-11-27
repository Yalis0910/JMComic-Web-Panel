import 'dart:async';
import 'dart:collection';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/liquid_glass.dart';

enum MobileReaderMode { vertical, singleLtr, singleRtl }

class ReaderScreen extends ConsumerStatefulWidget {
  final String albumId;
  final String photoId;
  final String title;
  final int initialPage;
  final List<ComicEpisode> initialEpisodes;

  const ReaderScreen({
    super.key,
    required this.albumId,
    required this.photoId,
    required this.title,
    this.initialPage = 0,
    this.initialEpisodes = const [],
  });

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  static const int _maxMemCachePages = 30;

  final ScrollController _scrollCtrl = ScrollController();
  late final PageController _pageCtrl;

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

  @override
  void initState() {
    super.initState();
    _photoId = widget.photoId;
    _episodes = widget.initialEpisodes;
    _currentPage = widget.initialPage;
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
    _flushHistorySave();
    _historyDebounce?.cancel();
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
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final detail = await src.getAlbumDetail(widget.albumId);
      if (mounted && detail.episodes.isNotEmpty) {
        setState(() => _episodes = detail.episodes);
      }
    } catch (_) {}
  }

  void _onVerticalScroll() {
    if (_mode != MobileReaderMode.vertical || _images.isEmpty || !_scrollCtrl.hasClients) return;
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
    final src = ref.read(hybridControllerProvider.notifier).activeSource;
    final list = await src.getChapterImages(targetPhotoId);
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
        if (_mode != MobileReaderMode.vertical && _pageCtrl.hasClients && safePage > 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _pageCtrl.hasClients) {
              _pageCtrl.jumpToPage(safePage);
            }
          });
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

  void _flushHistorySave() {
    if (!_hasPendingHistory || _images.isEmpty) return;
    _hasPendingHistory = false;
    ref.read(hybridControllerProvider.notifier).recordReading(
          HistoryRecord(
            albumId: widget.albumId,
            photoId: _photoId,
            title: widget.title,
            pageIndex: _currentPage,
            totalPages: _images.length,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
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

  void _jumpToPage(int idx) {
    final clamped = idx.clamp(0, _images.isEmpty ? 0 : _images.length - 1);
    _onPageChanged(clamped);
    if (_mode == MobileReaderMode.vertical && _scrollCtrl.hasClients && _images.length > 1) {
      final target = (_scrollCtrl.position.maxScrollExtent * clamped) / (_images.length - 1);
      _scrollCtrl.jumpTo(target);
    } else if (_mode != MobileReaderMode.vertical && _pageCtrl.hasClients) {
      _pageCtrl.jumpToPage(clamped);
    }
  }

  void _switchChapter(ComicEpisode target) {
    if (target.photoId == _photoId) return;
    _historyDebounce?.cancel();
    _flushHistorySave();
    setState(() {
      _photoId = target.photoId;
      _currentPage = 0;
      _images = const [];
    });
    if (_scrollCtrl.hasClients) {
      _scrollCtrl.jumpTo(0);
    }
    if (_pageCtrl.hasClients) {
      _pageCtrl.jumpToPage(0);
    }
    _loadChapter(targetPhotoId: target.photoId);
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
    final curEp = _currentEpisode;
    final prevEp = _prevEpisode;
    final nextEp = _nextEpisode;
    final isLastPage = _images.isNotEmpty && _currentPage >= _images.length - 1;

    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF080D10),
      child: Stack(
        children: [
          GestureDetector(
            onTap: () => setState(() => _hudVisible = !_hudVisible),
            child: _loading
                ? const Center(child: CupertinoActivityIndicator(color: CupertinoColors.white))
                : _mode == MobileReaderMode.vertical
                    ? ListView.builder(
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
                            loader: () => _loadPageBytesFor(_photoId, item),
                          );
                        },
                      )
                    : PageView.builder(
                        controller: _pageCtrl,
                        reverse: _mode == MobileReaderMode.singleRtl,
                        itemCount: _images.length,
                        onPageChanged: _onPageChanged,
                        itemBuilder: (ctx, idx) {
                          final item = _images[idx];
                          return InteractiveViewer(
                            minScale: 1.0,
                            maxScale: 4.0,
                            child: Center(
                              child: _ReaderPageImage(
                                key: ValueKey('${_photoId}_${item.index}'),
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
              right: 16,
              bottom: (bottomPad > 0 ? bottomPad : 12) + 16,
              child: LiquidSpringControl(
                onTap: () => _switchChapter(nextEp),
                child: LiquidGlassSurface(
                  variant: LiquidGlassVariant.clear,
                  onDarkScene: true,
                  borderRadius: 999,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Text(
                    '下一话：第 ${nextEp.index} 话 →',
                    style: const TextStyle(
                      color: LiquidTokens.lightIce,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
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
                            ],
                            onChanged: (v) {
                              setState(() => _mode = v);
                              if (v != MobileReaderMode.vertical) {
                                WidgetsBinding.instance.addPostFrameCallback((_) {
                                  if (mounted && _pageCtrl.hasClients) {
                                    _pageCtrl.jumpToPage(_currentPage);
                                  }
                                });
                              }
                            },
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
  const _ReaderPageImage({super.key, required this.loader});

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
          fit: BoxFit.fitWidth,
          width: double.infinity,
          gaplessPlayback: true,
        );
      },
    );
  }
}
