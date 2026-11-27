import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/comic_widgets.dart';
import '../widgets/liquid_glass.dart';

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  String _tab = 'fav';
  FavoritePageResult? _favResult;
  List<FavoriteFolder> _folders = const [];
  String _folderId = '0';
  String _orderBy = 'mr';
  int _page = 1;
  bool _favLoading = false;
  String? _favError;

  final Map<String, FavoritePageResult> _favCache = {};
  int _favRequestSeq = 0;

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

  String _favCacheKey(ActiveMode mode) => '${mode.name}|$_folderId|$_orderBy|$_page';

  Future<void> _loadFavorites({bool forceRefresh = false}) async {
    final hybrid = ref.read(hybridControllerProvider);
    if (!hybrid.account.isLoggedIn) return;
    final key = _favCacheKey(hybrid.activeMode);
    if (!forceRefresh && _favCache.containsKey(key)) {
      final cached = _favCache[key]!;
      setState(() {
        _favResult = cached;
        if (cached.folders.isNotEmpty || _folderId == '0') {
          _folders = cached.folders;
        }
        _favLoading = false;
        _favError = null;
      });
      return;
    }

    final reqId = ++_favRequestSeq;
    setState(() {
      _favLoading = true;
      _favError = null;
    });
    try {
      final res = await ref
          .read(hybridControllerProvider.notifier)
          .activeSource
          .getFavorites(page: _page, folderId: _folderId, orderBy: _orderBy);
      if (mounted && reqId == _favRequestSeq) {
        _favCache[key] = res;
        setState(() {
          _favResult = res;
          if (res.folders.isNotEmpty || _folderId == '0') {
            _folders = res.folders;
          }
        });
      }
    } catch (e) {
      if (mounted && reqId == _favRequestSeq) {
        setState(() => _favError = '$e');
      }
    } finally {
      if (mounted && reqId == _favRequestSeq) {
        setState(() => _favLoading = false);
      }
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
    ref.listen<HybridState>(hybridControllerProvider, (prev, next) {
      final wasLoggedIn = prev?.account.isLoggedIn ?? false;
      final isLoggedIn = next.account.isLoggedIn;
      final modeChanged = prev != null && prev.activeMode != next.activeMode;

      if (!wasLoggedIn && isLoggedIn) {
        _favCache.clear();
        setState(() {
          _folderId = '0';
          _page = 1;
          _favError = null;
        });
        _loadFavorites(forceRefresh: true);
      } else if (wasLoggedIn && !isLoggedIn) {
        _favCache.clear();
        setState(() {
          _favResult = null;
          _folders = const [];
          _folderId = '0';
          _page = 1;
          _favError = null;
        });
      } else if (modeChanged && isLoggedIn) {
        _favCache.clear();
        setState(() {
          _folderId = '0';
          _page = 1;
        });
        _loadFavorites(forceRefresh: true);
      }
    });

    final hybrid = ref.watch(hybridControllerProvider);

    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: const Text('书架'),
            backgroundColor: LiquidTokens.tintedGlassFill(context),
            border: Border(bottom: BorderSide(color: LiquidTokens.separator(context), width: 0.5)),
          ),
          CupertinoSliverRefreshControl(
            onRefresh: _tab == 'fav' ? () => _loadFavorites(forceRefresh: true) : _loadOffline,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: LiquidSegmentedPill<String>(
                value: _tab,
                items: const [
                  (value: 'fav', label: '云端收藏'),
                  (value: 'history', label: '阅读历史'),
                  (value: 'offline', label: '离线缓存'),
                ],
                onChanged: (v) {
                  setState(() => _tab = v);
                  if (v == 'fav' && _favResult == null) _loadFavorites();
                  if (v == 'offline') _loadOffline();
                },
              ),
            ),
          ),
          if (_tab == 'fav') ..._buildFavorites(context, hybrid)
          else if (_tab == 'history') ..._buildHistory(context, hybrid)
          else ..._buildOffline(context),
          const SliverToBoxAdapter(child: SizedBox(height: 112)),
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
              child: LiquidSolidCard(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.heart_circle_fill,
                      size: 48,
                      color: LiquidTokens.accentStrong(context),
                    ),
                    const SizedBox(height: 12),
                    const Text('登录后同步云端收藏', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text(
                      '无论处于局域网还是外出直连模式，均可直接登录 JM 账号浏览与管理收藏夹。',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: LiquidTokens.muted(context)),
                    ),
                    const SizedBox(height: 18),
                    LiquidSpringControl(
                      onTap: () async {
                        final ok = await showAccountLoginSheet(context, ref);
                        if (ok) _loadFavorites();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                        decoration: BoxDecoration(
                          color: LiquidTokens.scene(context),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          '立即登录',
                          style: TextStyle(color: CupertinoColors.white, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ];
    }

    final folders = _folders.isNotEmpty ? _folders : (_favResult?.folders ?? const <FavoriteFolder>[]);
    final albums = _favResult?.albums ?? const <ComicSummary>[];
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;

    return [
      if (folders.isNotEmpty)
        SliverToBoxAdapter(
          child: SizedBox(
            height: 38,
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
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: LiquidSegmentedPill<String>(
            value: _orderBy,
            items: const [
              (value: 'mr', label: '收藏时间'),
              (value: 'mp', label: '更新时间'),
            ],
            onChanged: (v) {
              setState(() {
                _orderBy = v;
                _page = 1;
              });
              _loadFavorites();
            },
          ),
        ),
      ),
      if (_favLoading)
        const SkeletonGridSliver(count: 6)
      else if (_favError != null)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('加载收藏失败：$_favError'),
                const SizedBox(height: 12),
                CupertinoButton.filled(
                  onPressed: () => _loadFavorites(forceRefresh: true),
                  child: const Text('重试'),
                ),
              ],
            ),
          ),
        )
      else if (albums.isEmpty)
        const SliverFillRemaining(
          hasScrollBody: false,
          child: Center(child: Text('收藏夹暂无漫画')),
        )
      else ...[
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
            child: LiquidPaginationBar(
              page: _page,
              pageCount: _favResult!.pageCount,
              onPageChange: (nextPage) {
                setState(() => _page = nextPage);
                _loadFavorites();
              },
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
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: LiquidSpringControl(
                  onTap: () => openReaderScreen(
                    context,
                    albumId: h.albumId,
                    photoId: h.photoId,
                    title: h.title,
                    initialPage: h.pageIndex,
                  ),
                  child: LiquidSolidCard(
                    borderRadius: 22,
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        ModernCoverImage(coverUrl: h.coverUrl, width: 56, height: 74, borderRadius: 12),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                h.title.isEmpty ? 'JM${h.albumId}' : h.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '读至第 ${h.pageIndex + 1} / ${h.totalPages} 页',
                                style: TextStyle(fontSize: 12, color: LiquidTokens.muted(ctx)),
                              ),
                              const SizedBox(height: 7),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: Container(
                                  height: 5,
                                  color: LiquidTokens.elevated(ctx),
                                  alignment: Alignment.centerLeft,
                                  child: FractionallySizedBox(
                                    widthFactor: pct,
                                    child: Container(color: LiquidTokens.accentStrong(ctx)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(CupertinoIcons.chevron_forward, size: 16, color: LiquidTokens.muted(ctx)),
                      ],
                    ),
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
              '暂无本地离线章节，可在作品详情页点击“缓存”',
              style: TextStyle(color: LiquidTokens.muted(context), fontSize: 13.5),
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
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: LiquidSolidCard(
                  borderRadius: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Icon(CupertinoIcons.folder_fill, color: LiquidTokens.accentStrong(ctx)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('章节 ID ${item.photoId}', style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                            Text(
                              '已缓存 ${item.pageCount} 页',
                              style: TextStyle(fontSize: 12, color: LiquidTokens.muted(ctx)),
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
    return LiquidSpringControl(
      onTap: onTap,
      child: Container(
        height: 36,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: active ? LiquidTokens.scene(context) : LiquidTokens.solid(context),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? LiquidTokens.scene(context) : LiquidTokens.separator(context),
          ),
        ),
        child: Text(
          label,
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: false,
            applyHeightToLastDescent: false,
          ),
          style: TextStyle(
            fontSize: 12.5,
            height: 1.1,
            fontWeight: FontWeight.w600,
            color: active ? CupertinoColors.white : LiquidTokens.muted(context),
          ),
        ),
      ),
    );
  }
}
