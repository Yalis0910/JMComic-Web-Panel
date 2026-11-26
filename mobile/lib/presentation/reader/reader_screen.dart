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

  const ReaderScreen({
    super.key,
    required this.albumId,
    required this.photoId,
    required this.title,
    this.initialPage = 0,
  });

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  final ScrollController _scrollCtrl = ScrollController();
  late final PageController _pageCtrl;

  List<ChapterImageItem> _images = const [];
  final Map<int, Uint8List> _memCache = {};
  bool _loading = true;
  bool _hudVisible = true;
  MobileReaderMode _mode = MobileReaderMode.vertical;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage;
    _pageCtrl = PageController(initialPage: widget.initialPage);
    _scrollCtrl.addListener(_onVerticalScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadChapter());
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onVerticalScroll);
    _scrollCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
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

  Future<void> _loadChapter() async {
    setState(() => _loading = true);
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final list = await src.getChapterImages(widget.photoId);
      if (mounted) {
        setState(() {
          _images = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<Uint8List> _loadPageBytes(ChapterImageItem item) async {
    if (_memCache.containsKey(item.index)) return _memCache[item.index]!;
    final ctrl = ref.read(hybridControllerProvider.notifier);
    final cachedFile = await ctrl.getCachedPageFile(widget.photoId, item.index);
    if (cachedFile != null) {
      final bytes = await cachedFile.readAsBytes();
      _memCache[item.index] = bytes;
      return bytes;
    }
    final bytes = await ctrl.activeSource.fetchChapterImageBytes(item);
    _memCache[item.index] = bytes;
    return bytes;
  }

  void _onPageChanged(int idx) {
    final clamped = idx.clamp(0, _images.isEmpty ? 0 : _images.length - 1);
    if (_currentPage == clamped) return;
    setState(() => _currentPage = clamped);
    ref.read(hybridControllerProvider.notifier).recordReading(
          HistoryRecord(
            albumId: widget.albumId,
            photoId: widget.photoId,
            title: widget.title,
            pageIndex: clamped,
            totalPages: _images.length,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
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

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final bottomPad = MediaQuery.of(context).padding.bottom;

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
                        physics: const BouncingScrollPhysics(),
                        itemCount: _images.length,
                        itemBuilder: (ctx, idx) =>
                            _ReaderPageImage(loader: () => _loadPageBytes(_images[idx])),
                      )
                    : PageView.builder(
                        controller: _pageCtrl,
                        reverse: _mode == MobileReaderMode.singleRtl,
                        itemCount: _images.length,
                        onPageChanged: _onPageChanged,
                        itemBuilder: (ctx, idx) => InteractiveViewer(
                          minScale: 1.0,
                          maxScale: 4.0,
                          child: Center(
                            child: _ReaderPageImage(loader: () => _loadPageBytes(_images[idx])),
                          ),
                        ),
                      ),
          ),
          // Floating Liquid Glass Top Capsule HUD
          Positioned(
            top: topPad + 10,
            left: 14,
            right: 14,
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
                        child: Text(
                          widget.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: CupertinoColors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
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
          // Floating Liquid Glass Bottom Capsule HUD
          if (_images.isNotEmpty)
            Positioned(
              left: 14,
              right: 14,
              bottom: bottomPad > 0 ? bottomPad + 8 : 14,
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
                        const SizedBox(height: 6),
                        LiquidSegmentedPill<MobileReaderMode>(
                          onDarkScene: true,
                          value: _mode,
                          items: const [
                            (value: MobileReaderMode.vertical, label: '条漫'),
                            (value: MobileReaderMode.singleLtr, label: '左→右'),
                            (value: MobileReaderMode.singleRtl, label: '日漫'),
                          ],
                          onChanged: (v) => setState(() => _mode = v),
                        ),
                      ],
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
  const _ReaderPageImage({required this.loader});

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
        if (snap.hasError || !snap.hasData) {
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
        return Image.memory(snap.data!, fit: BoxFit.fitWidth, width: double.infinity);
      },
    );
  }
}
