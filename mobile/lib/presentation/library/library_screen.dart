import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../detail/album_detail_screen.dart';
import '../reader/reader_screen.dart';
import '../widgets/comic_widgets.dart';

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  String _tab = 'fav';
  FavoritePageResult? _favResult;
  String _folderId = '0';
  int _page = 1;
  bool _favLoading = false;
  String? _favError;

  List<({String photoId, int pageCount})> _offlineChapters = const [];
  bool _offlineLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadFavorites();
      _loadOffline();
    });
  }

  Future<void> _loadFavorites() async {
    final acc = ref.read(hybridControllerProvider).account;
    if (!acc.isLoggedIn) return;
    setState(() {
      _favLoading = true;
      _favError = null;
    });
    try {
      final res = await ref
          .read(hybridControllerProvider.notifier)
          .activeSource
          .getFavorites(page: _page, folderId: _folderId);
      if (mounted) setState(() => _favResult = res);
    } catch (e) {
      if (mounted) setState(() => _favError = '$e');
    } finally {
      if (mounted) setState(() => _favLoading = false);
    }
  }

  Future<void> _loadOffline() async {
    setState(() => _offlineLoading = true);
    try {
      final list = await ref.read(hybridControllerProvider.notifier).listOfflineChapters();
      if (mounted) setState(() => _offlineChapters = list);
    } finally {
      if (mounted) setState(() => _offlineLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hybrid = ref.watch(hybridControllerProvider);

    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          const CupertinoSliverNavigationBar(largeTitle: Text('书架')),
          CupertinoSliverRefreshControl(
            onRefresh: _tab == 'fav' ? _loadFavorites : _loadOffline,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: CupertinoSlidingSegmentedControl<String>(
                groupValue: _tab,
                children: const {
                  'fav': Text('云端收藏'),
                  'history': Text('阅读历史'),
                  'offline': Text('离线缓存'),
                },
                onValueChanged: (v) {
                  if (v != null) {
                    setState(() => _tab = v);
                    if (v == 'fav') _loadFavorites();
                    if (v == 'offline') _loadOffline();
                  }
                },
              ),
            ),
          ),
          if (_tab == 'fav') ..._buildFavorites(context, hybrid)
          else if (_tab == 'history') ..._buildHistory(context, hybrid)
          else ..._buildOffline(context),
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  List<Widget> _buildFavorites(BuildContext context, HybridState hybrid) {
    if (!hybrid.account.isLoggedIn) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: JmlisColors.card(context),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: JmlisColors.border(context)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(CupertinoIcons.heart_circle_fill, size: 48, color: JmlisColors.accent(context)),
                    const SizedBox(height: 12),
                    const Text('登录后同步云端收藏', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(
                      '无论处于局域网还是外出直连模式，均可直接登录 JM 账号浏览与管理收藏夹。',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: JmlisColors.secondaryText(context)),
                    ),
                    const SizedBox(height: 16),
                    CupertinoButton(
                      color: JmlisColors.accent(context),
                      borderRadius: BorderRadius.circular(999),
                      onPressed: () async {
                        final ok = await showAccountLoginSheet(context, ref);
                        if (ok) _loadFavorites();
                      },
                      child: const Text('立即登录', style: TextStyle(color: CupertinoColors.white, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ];
    }

    if (_favLoading) {
      return const [SkeletonGridSliver(count: 9)];
    }

    if (_favError != null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('加载收藏失败：$_favError'),
                const SizedBox(height: 12),
                CupertinoButton.filled(onPressed: _loadFavorites, child: const Text('重试')),
              ],
            ),
          ),
        ),
      ];
    }

    final folders = _favResult?.folders ?? const <FavoriteFolder>[];
    final albums = _favResult?.albums ?? const <ComicSummary>[];

    return [
      if (folders.isNotEmpty)
        SliverToBoxAdapter(
          child: SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FolderPill(
                  label: '全部',
                  active: _folderId == '0',
                  onTap: () {
                    setState(() {
                      _folderId = '0';
                      _page = 1;
                    });
                    _loadFavorites();
                  },
                ),
                for (final f in folders) ...[
                  const SizedBox(width: 8),
                  _FolderPill(
                    label: f.name,
                    active: _folderId == f.folderId,
                    onTap: () {
                      setState(() {
                        _folderId = f.folderId;
                        _page = 1;
                      });
                      _loadFavorites();
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
      if (folders.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 12)),
      if (albums.isEmpty)
        const SliverFillRemaining(
          hasScrollBody: false,
          child: Center(child: Text('收藏夹暂无漫画')),
        )
      else ...[
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
                final a = albums[idx];
                return ModernComicCard(
                  album: a,
                  onTap: () => Navigator.of(context).push(
                    CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: a.albumId)),
                  ),
                );
              },
              childCount: albums.length,
            ),
          ),
        ),
        if ((_favResult?.pageCount ?? 1) > 1)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CupertinoButton(
                    onPressed: _page <= 1
                        ? null
                        : () {
                            setState(() => _page--);
                            _loadFavorites();
                          },
                    child: const Text('上一页'),
                  ),
                  Text('$_page / ${_favResult!.pageCount}'),
                  CupertinoButton(
                    onPressed: _page >= _favResult!.pageCount
                        ? null
                        : () {
                            setState(() => _page++);
                            _loadFavorites();
                          },
                    child: const Text('下一页'),
                  ),
                ],
              ),
            ),
          ),
      ],
    ];
  }

  List<Widget> _buildHistory(BuildContext context, HybridState hybrid) {
    if (hybrid.history.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(child: Text('暂无阅读历史')),
        ),
      ];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (ctx, idx) {
              final h = hybrid.history[idx];
              final pct = h.totalPages > 0 ? ((h.pageIndex + 1) / h.totalPages).clamp(0.0, 1.0) : 0.0;
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
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: JmlisColors.card(ctx),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: JmlisColors.border(ctx)),
                  ),
                  child: Row(
                    children: [
                      ModernCoverImage(coverUrl: h.coverUrl, width: 54, height: 72, borderRadius: 10),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              h.title.isEmpty ? 'JM${h.albumId}' : h.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '读至第 ${h.pageIndex + 1} / ${h.totalPages} 页',
                              style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(ctx)),
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: Container(
                                height: 4,
                                color: JmlisColors.elevated(ctx),
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
                      const SizedBox(width: 8),
                      Icon(CupertinoIcons.chevron_forward, size: 16, color: JmlisColors.secondaryText(ctx)),
                    ],
                  ),
                ),
              );
            },
            childCount: hybrid.history.length,
          ),
        ),
      ),
    ];
  }

  List<Widget> _buildOffline(BuildContext context) {
    if (_offlineLoading) {
      return const [
        SliverFillRemaining(child: Center(child: CupertinoActivityIndicator())),
      ];
    }
    if (_offlineChapters.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              '暂无本地离线章节，可在作品详情页点击“离线缓存”',
              style: TextStyle(color: JmlisColors.secondaryText(context), fontSize: 13.5),
            ),
          ),
        ),
      ];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (ctx, idx) {
              final item = _offlineChapters[idx];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: JmlisColors.card(ctx),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: JmlisColors.border(ctx)),
                ),
                child: Row(
                  children: [
                    Icon(CupertinoIcons.folder_fill, color: JmlisColors.accent(ctx)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('章节 ID ${item.photoId}', style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                          Text(
                            '已缓存 ${item.pageCount} 页',
                            style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(ctx)),
                          ),
                        ],
                      ),
                    ),
                    CupertinoButton(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      onPressed: () async {
                        await ref.read(hybridControllerProvider.notifier).deleteOfflineChapter(item.photoId);
                        _loadOffline();
                      },
                      child: const Icon(CupertinoIcons.trash, size: 18, color: CupertinoColors.systemRed),
                    ),
                  ],
                ),
              );
            },
            childCount: _offlineChapters.length,
          ),
        ),
      ),
    ];
  }
}

class _FolderPill extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _FolderPill({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? JmlisColors.accent(context) : JmlisColors.card(context),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? JmlisColors.accent(context) : JmlisColors.border(context)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: active ? CupertinoColors.white : JmlisColors.secondaryText(context),
          ),
        ),
      ),
    );
  }
}
