import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';

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
  List<ChapterImageItem> _images = const [];
  final Map<int, Uint8List> _memCache = {};
  bool _loading = true;
  bool _hudVisible = true;
  bool _verticalMode = true;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadChapter());
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
    if (_currentPage == idx) return;
    setState(() => _currentPage = idx);
    ref.read(hybridControllerProvider.notifier).recordReading(
          HistoryRecord(
            albumId: widget.albumId,
            photoId: widget.photoId,
            title: widget.title,
            pageIndex: idx,
            totalPages: _images.length,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: CupertinoColors.black,
      child: Stack(
        children: [
          GestureDetector(
            onTap: () => setState(() => _hudVisible = !_hudVisible),
            child: _loading
                ? const Center(child: CupertinoActivityIndicator(color: CupertinoColors.white))
                : _verticalMode
                    ? ListView.builder(
                        physics: const BouncingScrollPhysics(),
                        itemCount: _images.length,
                        itemBuilder: (ctx, idx) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) _onPageChanged(idx);
                          });
                          return _ReaderPageImage(loader: () => _loadPageBytes(_images[idx]));
                        },
                      )
                    : PageView.builder(
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
          if (_hudVisible)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: ClipRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                  child: Container(
                    color: CupertinoColors.black.withValues(alpha: 0.65),
                    padding: EdgeInsets.only(
                      top: MediaQuery.of(context).padding.top + 6,
                      bottom: 10,
                      left: 12,
                      right: 12,
                    ),
                    child: Row(
                      children: [
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Icon(CupertinoIcons.back, color: CupertinoColors.white),
                        ),
                        Expanded(
                          child: Text(
                            '${widget.title} (${_currentPage + 1}/${_images.length})',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: CupertinoColors.white, fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                        ),
                        CupertinoSlidingSegmentedControl<bool>(
                          groupValue: _verticalMode,
                          children: const {
                            true: Text('条漫', style: TextStyle(fontSize: 12)),
                            false: Text('单页', style: TextStyle(fontSize: 12)),
                          },
                          onValueChanged: (v) {
                            if (v != null) setState(() => _verticalMode = v);
                          },
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
