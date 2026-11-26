import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../reader/reader_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  List<({String title, List<ComicSummary> albums})> _sections = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final data = await src.getPromoteSections();
      if (mounted) {
        setState(() {
          _sections = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hybrid = ref.watch(hybridControllerProvider);
    final modeText = hybrid.activeMode == ActiveMode.lanServer ? '局域网服务端' : '手机直连模式';
    final modeColor = hybrid.activeMode == ActiveMode.lanServer
        ? CupertinoColors.activeGreen
        : CupertinoColors.activeBlue;

    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: const Text('探索'),
            trailing: GestureDetector(
              onTap: () => ref.read(hybridControllerProvider.notifier).probeAndSwitch().then((_) => _load()),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: modeColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  modeText,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: modeColor),
                ),
              ),
            ),
          ),
          CupertinoSliverRefreshControl(onRefresh: _load),
          if (hybrid.history.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('继续阅读', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 184,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        itemCount: hybrid.history.take(10).length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (ctx, i) {
                          final h = hybrid.history[i];
                          return GestureDetector(
                            onTap: () => Navigator.of(context).push(
                              CupertinoPageRoute(
                                builder: (_) => ReaderScreen(
                                  albumId: h.albumId,
                                  photoId: h.photoId,
                                  title: h.title,
                                  initialPage: h.pageIndex,
                                ),
                              ),
                            ),
                            child: SizedBox(
                              width: 112,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: h.coverUrl.isNotEmpty
                                          ? Image.network(h.coverUrl, fit: BoxFit.cover, width: 112)
                                          : Container(color: CupertinoColors.systemGrey5),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    h.title.isEmpty ? 'JM${h.albumId}' : h.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                                  ),
                                  Text(
                                    '第 ${h.pageIndex + 1} 页',
                                    style: const TextStyle(fontSize: 11, color: CupertinoColors.secondaryLabel),
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
          if (_loading)
            const SliverFillRemaining(
              child: Center(child: CupertinoActivityIndicator(radius: 14)),
            )
          else if (_error != null)
            SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败: $_error', textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      CupertinoButton.filled(onPressed: _load, child: const Text('重试')),
                    ],
                  ),
                ),
              ),
            )
          else
            for (final sec in _sections) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
                  child: Text(sec.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.58,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (ctx, idx) {
                      final album = sec.albums[idx];
                      return GestureDetector(
                        onTap: () => Navigator.of(context).push(
                          CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: album.albumId)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  album.coverUrl,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  errorBuilder: (_, __, ___) => Container(
                                    color: CupertinoColors.systemGrey5,
                                    alignment: Alignment.center,
                                    child: const Icon(CupertinoIcons.book),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              album.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      );
                    },
                    childCount: sec.albums.length,
                  ),
                ),
              ),
            ],
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }
}
