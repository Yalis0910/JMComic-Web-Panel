import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../explore/explore_screen.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/comic_widgets.dart';
import '../widgets/liquid_glass.dart';

class HomeScreen extends ConsumerStatefulWidget {
  final VoidCallback? onOpenExplore;

  const HomeScreen({super.key, this.onOpenExplore});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  List<({String title, List<ComicSummary> albums})> _sections = const [];
  List<ComicSummary> _latestAlbums = const [];
  List<String> _hotTags = const [];
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
      final promoteFuture = src.getPromoteSections();
      final latestFuture = src.getLatest().catchError((_) => const <ComicSummary>[]);
      final metaFuture = src.getCategoriesMeta().catchError((_) => const CategoryMetaResult());
      final results = await Future.wait([promoteFuture, latestFuture, metaFuture]);
      if (mounted) {
        setState(() {
          _sections = results[0] as List<({String title, List<ComicSummary> albums})>;
          _latestAlbums = results[1] as List<ComicSummary>;
          _hotTags = (results[2] as CategoryMetaResult).hotTags;
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
    final modeDot = isLan ? LiquidTokens.successDark : LiquidTokens.darkIce;
    final featured = _sections.isNotEmpty && _sections.first.albums.isNotEmpty
        ? _sections.first.albums.first
        : null;
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;

    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverRefreshControl(onRefresh: _load),
          // Deep Sea Scenic Header Stage with Floating Clear Glass Controls
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                MediaQuery.of(context).padding.top + 12,
                16,
                8,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              LiquidTokens.lightSceneDeep,
                              LiquidTokens.lightScene,
                              Color(0xFF335761),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (hybrid.settings.showCovers && featured != null && featured.coverUrl.isNotEmpty)
                      Positioned.fill(
                        child: Opacity(
                          opacity: 0.24,
                          child: ImageFiltered(
                            imageFilter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                            child: ModernCoverImage(
                              coverUrl: featured.coverUrl,
                              fallbacks: featured.coverFallbacks,
                              headers: featured.coverHeaders,
                              borderRadius: 0,
                            ),
                          ),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: Image.asset('assets/icon/app_icon.png', width: 32, height: 32),
                              ),
                              const SizedBox(width: 10),
                              const Expanded(
                                child: Text(
                                  'JMlis',
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: -0.5,
                                    color: CupertinoColors.white,
                                  ),
                                ),
                              ),
                              LiquidSpringControl(
                                onTap: () => ref
                                    .read(hybridControllerProvider.notifier)
                                    .probeAndSwitch()
                                    .then((_) => _load()),
                                child: LiquidGlassSurface(
                                  variant: LiquidGlassVariant.clear,
                                  onDarkScene: true,
                                  borderRadius: 999,
                                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 7,
                                        height: 7,
                                        decoration: BoxDecoration(color: modeDot, shape: BoxShape.circle),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        modeText,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: CupertinoColors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              LiquidSpringControl(
                                onTap: () {
                                  if (!hybrid.account.isLoggedIn) {
                                    showAccountLoginSheet(context, ref);
                                  }
                                },
                                child: LiquidGlassSurface(
                                  variant: LiquidGlassVariant.clear,
                                  onDarkScene: true,
                                  borderRadius: 999,
                                  padding: const EdgeInsets.all(6),
                                  child: SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: Center(
                                      child: hybrid.account.isLoggedIn
                                          ? Text(
                                              hybrid.account.username.substring(0, 1).toUpperCase(),
                                              style: const TextStyle(
                                                color: CupertinoColors.white,
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            )
                                          : const Icon(
                                              CupertinoIcons.person,
                                              size: 15,
                                              color: CupertinoColors.white,
                                            ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            '探索精选画廊',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.6,
                              color: CupertinoColors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            featured != null
                                ? '当期精选：${featured.title}'
                                : '清透玻璃操作层 · 暖纸实体阅读面',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              color: CupertinoColors.white.withValues(alpha: 0.78),
                            ),
                          ),
                          const SizedBox(height: 14),
                          LiquidSpringControl(
                            onTap: widget.onOpenExplore,
                            child: LiquidGlassSurface(
                              variant: LiquidGlassVariant.clear,
                              onDarkScene: true,
                              borderRadius: 999,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                              child: Row(
                                children: [
                                  Icon(
                                    CupertinoIcons.search,
                                    size: 16,
                                    color: CupertinoColors.white.withValues(alpha: 0.82),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      '搜索漫画名、JM 车号、作者或标签...',
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        color: CupertinoColors.white.withValues(alpha: 0.80),
                                      ),
                                    ),
                                  ),
                                  const Icon(
                                    CupertinoIcons.arrow_right,
                                    size: 15,
                                    color: LiquidTokens.lightIce,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (_hotTags.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            SizedBox(
                              height: 32,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: _hotTags.take(12).length,
                                separatorBuilder: (_, __) => const SizedBox(width: 8),
                                itemBuilder: (ctx, i) {
                                  final tag = _hotTags[i];
                                  return LiquidSpringControl(
                                    onTap: () => Navigator.of(context).push(
                                      CupertinoPageRoute(
                                        builder: (_) => ExploreScreen(
                                          initialQuery: tag,
                                          initialSearchType: 'tag',
                                        ),
                                      ),
                                    ),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: CupertinoColors.white.withValues(alpha: 0.14),
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(
                                          color: CupertinoColors.white.withValues(alpha: 0.24),
                                          width: 0.7,
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        '#$tag',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: CupertinoColors.white,
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
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
                    Text(
                      '继续阅读',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                        color: LiquidTokens.ink(context),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 204,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        itemCount: hybrid.history.take(10).length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (ctx, i) {
                          final h = hybrid.history[i];
                          final pct = h.totalPages > 0
                              ? ((h.pageIndex + 1) / h.totalPages).clamp(0.0, 1.0)
                              : 0.0;
                          return LiquidSpringControl(
                            onTap: () => openReaderScreen(
                              context,
                              albumId: h.albumId,
                              photoId: h.photoId,
                              title: h.title,
                              initialPage: h.pageIndex,
                            ),
                            child: SizedBox(
                              width: 126,
                              child: LiquidSolidCard(
                                borderRadius: 20,
                                padding: const EdgeInsets.all(7),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          ModernCoverImage(coverUrl: h.coverUrl, borderRadius: 13),
                                          Positioned(
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            child: ClipRRect(
                                              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(13)),
                                              child: Container(
                                                height: 4,
                                                color: CupertinoColors.black.withValues(alpha: 0.42),
                                                alignment: Alignment.centerLeft,
                                                child: FractionallySizedBox(
                                                  widthFactor: pct,
                                                  child: Container(color: LiquidTokens.lightIce),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 7),
                                    Text(
                                      h.title.isEmpty ? 'JM${h.albumId}' : h.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                                    ),
                                    Text(
                                      '第 ${h.pageIndex + 1} 页',
                                      style: TextStyle(fontSize: 11, color: LiquidTokens.muted(ctx)),
                                    ),
                                  ],
                                ),
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
            const SkeletonGridSliver(count: 6),
          ] else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败: $_error', textAlign: TextAlign.center),
                      const SizedBox(height: 14),
                      LiquidSpringControl(
                        onTap: _load,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          decoration: BoxDecoration(
                            color: LiquidTokens.scene(context),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            '重试',
                            style: TextStyle(color: CupertinoColors.white, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            for (final sec in _sections) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        sec.title,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          color: LiquidTokens.ink(context),
                        ),
                      ),
                      Text(
                        '${sec.albums.length} 部',
                        style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossCount,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.60,
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
          if (!_loading && _error == null && _latestAlbums.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '最新更新',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          color: LiquidTokens.ink(context),
                        ),
                      ),
                      Text(
                        '${_latestAlbums.length} 部',
                        style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossCount,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.60,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (ctx, idx) {
                      final album = _latestAlbums[idx];
                      return ModernComicCard(
                        album: album,
                        onTap: () => Navigator.of(context).push(
                          CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: album.albumId)),
                        ),
                      );
                    },
                    childCount: _latestAlbums.length,
                  ),
                ),
              ),
            ],
          const SliverToBoxAdapter(child: SizedBox(height: 112)),
        ],
      ),
    );
  }
}
