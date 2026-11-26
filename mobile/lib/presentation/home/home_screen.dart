import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../reader/reader_screen.dart';
import '../widgets/comic_widgets.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final PageController _heroCtrl = PageController(viewportFraction: 0.92);
  List<({String title, List<ComicSummary> albums})> _sections = const [];
  bool _loading = true;
  String? _error;
  int _heroPage = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _heroCtrl.dispose();
    super.dispose();
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
    final isLan = hybrid.activeMode == ActiveMode.lanServer;
    final modeText = isLan ? '局域网' : '直连';
    final modeColor = isLan ? CupertinoColors.activeGreen : JmlisColors.accent(context);
    final heroAlbums = _sections.isNotEmpty ? _sections.first.albums.take(6).toList() : const <ComicSummary>[];

    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset('assets/icon/app_icon.png', width: 26, height: 26),
                ),
                const SizedBox(width: 8),
                const Text('JMlis'),
              ],
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => ref.read(hybridControllerProvider.notifier).probeAndSwitch().then((_) => _load()),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: modeColor.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: modeColor, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          modeText,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: modeColor),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () {
                    if (!hybrid.account.isLoggedIn) {
                      showAccountLoginSheet(context, ref);
                    }
                  },
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: hybrid.account.isLoggedIn
                          ? JmlisColors.accent(context)
                          : JmlisColors.elevated(context),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: hybrid.account.isLoggedIn
                        ? Text(
                            hybrid.account.username.substring(0, 1).toUpperCase(),
                            style: const TextStyle(color: CupertinoColors.white, fontSize: 12, fontWeight: FontWeight.w700),
                          )
                        : Icon(CupertinoIcons.person, size: 15, color: JmlisColors.secondaryText(context)),
                  ),
                ),
              ],
            ),
          ),
          CupertinoSliverRefreshControl(onRefresh: _load),
          if (heroAlbums.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Column(
                  children: [
                    SizedBox(
                      height: 196,
                      child: PageView.builder(
                        controller: _heroCtrl,
                        itemCount: heroAlbums.length,
                        onPageChanged: (i) => setState(() => _heroPage = i),
                        itemBuilder: (ctx, idx) {
                          final a = heroAlbums[idx];
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 5),
                            child: GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: a.albumId)),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    ModernCoverImage(
                                      coverUrl: a.coverUrl,
                                      fallbacks: a.coverFallbacks,
                                      headers: a.coverHeaders,
                                      borderRadius: 0,
                                    ),
                                    BackdropFilter(
                                      filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                                      child: Container(
                                        color: CupertinoColors.black.withValues(alpha: 0.48),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 112,
                                            height: double.infinity,
                                            child: ModernCoverImage(
                                              coverUrl: a.coverUrl,
                                              fallbacks: a.coverFallbacks,
                                              headers: a.coverHeaders,
                                              borderRadius: 12,
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: JmlisColors.accent(ctx),
                                                    borderRadius: BorderRadius.circular(999),
                                                  ),
                                                  child: Text(
                                                    '精选焦点 · JM${a.albumId}',
                                                    style: const TextStyle(
                                                      color: CupertinoColors.white,
                                                      fontSize: 10.5,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(height: 8),
                                                Text(
                                                  a.title,
                                                  maxLines: 3,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    color: CupertinoColors.white,
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.w700,
                                                    height: 1.25,
                                                  ),
                                                ),
                                                if (a.author.isNotEmpty) ...[
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    a.author,
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                      color: CupertinoColors.white.withValues(alpha: 0.78),
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
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
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        heroAlbums.length,
                        (i) => AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: i == _heroPage ? 16 : 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: i == _heroPage ? JmlisColors.accent(context) : JmlisColors.border(context),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (hybrid.history.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('继续阅读', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 192,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        itemCount: hybrid.history.take(10).length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (ctx, i) {
                          final h = hybrid.history[i];
                          final pct = h.totalPages > 0
                              ? ((h.pageIndex + 1) / h.totalPages).clamp(0.0, 1.0)
                              : 0.0;
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
                            child: Container(
                              width: 118,
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: JmlisColors.card(ctx),
                                borderRadius: BorderRadius.circular(15),
                                border: Border.all(color: JmlisColors.border(ctx)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        ModernCoverImage(coverUrl: h.coverUrl, borderRadius: 10),
                                        Positioned(
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          child: Container(
                                            height: 4,
                                            color: CupertinoColors.black.withValues(alpha: 0.4),
                                            alignment: Alignment.centerLeft,
                                            child: FractionallySizedBox(
                                              widthFactor: pct,
                                              child: Container(color: JmlisColors.accent(ctx)),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    h.title.isEmpty ? 'JM${h.albumId}' : h.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                                  ),
                                  Text(
                                    '第 ${h.pageIndex + 1} 页',
                                    style: TextStyle(fontSize: 11, color: JmlisColors.secondaryText(ctx)),
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
          if (_loading) ...[
            const SliverToBoxAdapter(child: SizedBox(height: 16)),
            const SkeletonGridSliver(count: 9),
          ] else if (_error != null)
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
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(sec.title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                      Text(
                        '${sec.albums.length} 部',
                        style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(context)),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.56,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (ctx, idx) {
                      final album = sec.albums[idx];
                      return ModernComicCard(
                        album: album,
                        onTap: () => Navigator.of(context).push(
                          CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: album.albumId)),
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
