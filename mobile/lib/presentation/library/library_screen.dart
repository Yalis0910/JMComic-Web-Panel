import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
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

  List<OfflineChapterMeta> _offlineChapters = const [];
  bool _offlineLoading = false;

  List<LocalShelfModel> _shelves = const [];
  String _selectedShelfId = '';
  List<LocalShelfItemModel> _shelfItems = const [];
  bool _shelvesLoading = false;

  List<LocalLibraryItem> _lanLibrary = const [];
  bool _lanLibLoading = false;

  List<ServerDownloadTask> _dlTasks = const [];
  bool _dlLoading = false;

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

  Future<void> _loadShelves() async {
    if (ref.read(hybridControllerProvider).activeMode != ActiveMode.lanServer) return;
    setState(() => _shelvesLoading = true);
    try {
      final lan = ref.read(hybridControllerProvider.notifier).lanSource;
      final list = await lan.listShelves();
      final activeId = _selectedShelfId.isNotEmpty && list.any((s) => s.shelfId == _selectedShelfId)
          ? _selectedShelfId
          : (list.isNotEmpty ? list.first.shelfId : '');
      final items = activeId.isNotEmpty ? await lan.listShelfItems(activeId) : const <LocalShelfItemModel>[];
      if (mounted) {
        setState(() {
          _shelves = list;
          _selectedShelfId = activeId;
          _shelfItems = items;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _shelvesLoading = false);
    }
  }

  Future<void> _createShelf() async {
    final ctrl = TextEditingController();
    final name = await showCupertinoDialog<String>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('新建本地书单'),
        content: Padding(
          padding: const EdgeInsets.only(top: 10),
          child: CupertinoTextField(controller: ctrl, placeholder: '输入书单名称'),
        ),
        actions: [
          CupertinoDialogAction(child: const Text('取消'), onPressed: () => Navigator.pop(ctx)),
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('创建'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (name == null || name.isEmpty) return;
    final lan = ref.read(hybridControllerProvider.notifier).lanSource;
    final created = await lan.saveShelf(name);
    if (mounted) {
      setState(() => _selectedShelfId = created.shelfId);
      _loadShelves();
    }
  }

  Future<void> _loadLanLibrary({bool scan = false}) async {
    if (ref.read(hybridControllerProvider).activeMode != ActiveMode.lanServer) return;
    setState(() => _lanLibLoading = true);
    try {
      final lan = ref.read(hybridControllerProvider.notifier).lanSource;
      final items = scan ? await lan.scanLocalLibrary() : await lan.listLocalLibrary();
      if (mounted) setState(() => _lanLibrary = items);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _lanLibLoading = false);
    }
  }

  Future<void> _openLanLocalItem(LocalLibraryItem item) async {
    if (item.format == 'pdf') {
      showCupertinoDialog(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: Text(item.title),
          content: const Text('该本地项目为 PDF 文档，请通过 Web 端在线预览或导出。'),
          actions: [CupertinoDialogAction(child: const Text('好'), onPressed: () => Navigator.pop(ctx))],
        ),
      );
      return;
    }
    final lan = ref.read(hybridControllerProvider.notifier).lanSource;
    final eps = await lan.getLocalEpisodes(item.albumId);
    if (!mounted || eps.isEmpty) return;
    if (eps.length == 1) {
      openReaderScreen(
        context,
        albumId: item.albumId,
        photoId: eps.first.photoId,
        title: item.title,
        source: 'local',
        coverUrl: item.coverUrl,
        episodes: eps,
      );
      return;
    }
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => CupertinoActionSheet(
        title: Text(item.title),
        actions: [
          for (final ep in eps)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(ctx);
                openReaderScreen(
                  context,
                  albumId: item.albumId,
                  photoId: ep.photoId,
                  title: item.title,
                  source: 'local',
                  coverUrl: item.coverUrl,
                  episodes: eps,
                );
              },
              child: Text(ep.name.isEmpty ? '第 ${ep.index} 话' : ep.name),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDestructiveAction: true,
          onPressed: () => Navigator.pop(ctx),
          child: const Text('取消'),
        ),
      ),
    );
  }

  Future<void> _loadDownloads() async {
    if (ref.read(hybridControllerProvider).activeMode != ActiveMode.lanServer) return;
    setState(() => _dlLoading = true);
    try {
      final lan = ref.read(hybridControllerProvider.notifier).lanSource;
      final list = await lan.listServerDownloads();
      if (mounted) setState(() => _dlTasks = list);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _dlLoading = false);
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
    final isLan = hybrid.activeMode == ActiveMode.lanServer;
    final tabOptions = [
      (value: 'fav', label: '云端收藏'),
      if (isLan) (value: 'shelves', label: '本地书单'),
      (value: 'bookmarks', label: '书签'),
      (value: 'history', label: '阅读历史'),
      (value: 'offline', label: '离线缓存'),
      if (isLan) (value: 'lan_lib', label: '电脑书库'),
      if (isLan) (value: 'downloads', label: '下载队列'),
    ];
    final currentTab = tabOptions.any((t) => t.value == _tab) ? _tab : 'fav';

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
            onRefresh: () async {
              if (currentTab == 'fav') await _loadFavorites(forceRefresh: true);
              else if (currentTab == 'shelves') await _loadShelves();
              else if (currentTab == 'offline') await _loadOffline();
              else if (currentTab == 'lan_lib') await _loadLanLibrary(scan: true);
              else if (currentTab == 'downloads') await _loadDownloads();
            },
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 54,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                itemCount: tabOptions.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, i) {
                  final opt = tabOptions[i];
                  return _FolderPill(
                    label: opt.label,
                    active: currentTab == opt.value,
                    onTap: () {
                      setState(() => _tab = opt.value);
                      if (opt.value == 'fav' && _favResult == null) _loadFavorites();
                      if (opt.value == 'shelves') _loadShelves();
                      if (opt.value == 'offline') _loadOffline();
                      if (opt.value == 'lan_lib') _loadLanLibrary();
                      if (opt.value == 'downloads') _loadDownloads();
                    },
                  );
                },
              ),
            ),
          ),
          if (currentTab == 'fav') ..._buildFavorites(context, hybrid)
          else if (currentTab == 'shelves') ..._buildShelves(context)
          else if (currentTab == 'bookmarks') ..._buildBookmarks(context, hybrid)
          else if (currentTab == 'history') ..._buildHistory(context, hybrid)
          else if (currentTab == 'offline') ..._buildOffline(context)
          else if (currentTab == 'lan_lib') ..._buildLanLibrary(context)
          else ..._buildDownloads(context),
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
                  onTap: () => openAlbumDetailScreen(context, a.albumId),
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
                    source: h.source,
                    coverUrl: h.coverUrl,
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
                                '${h.source == 'local' ? '本地 · ' : ''}读至第 ${h.pageIndex + 1} / ${h.totalPages} 页',
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
                child: LiquidSpringControl(
                  onTap: () => openReaderScreen(
                    context,
                    albumId: item.albumId,
                    photoId: item.photoId,
                    title: item.albumTitle,
                    coverUrl: item.coverUrl,
                  ),
                  child: LiquidSolidCard(
                    borderRadius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        if (item.coverUrl.isNotEmpty) ...[
                          ModernCoverImage(coverUrl: item.coverUrl, width: 48, height: 64, borderRadius: 10),
                          const SizedBox(width: 12),
                        ] else ...[
                          Icon(CupertinoIcons.folder_fill, color: LiquidTokens.accentStrong(ctx)),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.albumTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${item.chapterTitle} · 已缓存 ${item.pageCount} 页 · 点击离线阅读',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
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
                ),
              );
            },
            childCount: _offlineChapters.length,
          ),
        ),
      ),
    ];
  }

  List<Widget> _buildBookmarks(BuildContext context, HybridState hybrid) {
    if (hybrid.bookmarks.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              '暂无阅读书签，可在阅读器右上角点击书签图标添加',
              style: TextStyle(color: LiquidTokens.muted(context), fontSize: 13.5),
            ),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.builder(
          itemCount: hybrid.bookmarks.length,
          itemBuilder: (ctx, idx) {
            final b = hybrid.bookmarks[idx];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LiquidSpringControl(
                onTap: () => openReaderScreen(
                  context,
                  albumId: b.albumId,
                  photoId: b.photoId,
                  title: b.title,
                  source: b.source,
                  coverUrl: b.coverUrl,
                  initialPage: b.pageIndex,
                ),
                child: LiquidSolidCard(
                  borderRadius: 20,
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      ModernCoverImage(coverUrl: b.coverUrl, width: 48, height: 64, borderRadius: 10),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              b.title.isEmpty ? 'JM${b.albumId}' : b.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${b.chapterTitle.isNotEmpty ? '${b.chapterTitle} · ' : ''}第 ${b.pageIndex + 1} 页',
                              style: TextStyle(fontSize: 12, color: LiquidTokens.muted(ctx)),
                            ),
                          ],
                        ),
                      ),
                      CupertinoButton(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        onPressed: () => ref.read(hybridControllerProvider.notifier).toggleBookmark(
                              albumId: b.albumId,
                              photoId: b.photoId,
                              source: b.source,
                              title: b.title,
                              pageIndex: b.pageIndex,
                            ),
                        child: const Icon(CupertinoIcons.trash, size: 18, color: CupertinoColors.systemRed),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  List<Widget> _buildShelves(BuildContext context) {
    if (_shelvesLoading) {
      return const [SliverFillRemaining(child: Center(child: CupertinoActivityIndicator()))];
    }
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (final s in _shelves) ...[
                        _FolderPill(
                          label: '${s.name} (${s.itemCount})',
                          active: s.shelfId == _selectedShelfId,
                          onTap: () async {
                            setState(() => _selectedShelfId = s.shelfId);
                            final items = await ref.read(hybridControllerProvider.notifier).lanSource.listShelfItems(s.shelfId);
                            if (mounted) setState(() => _shelfItems = items);
                          },
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
              ),
              CupertinoButton(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                onPressed: _createShelf,
                child: const Text('+ 新建'),
              ),
            ],
          ),
        ),
      ),
      if (_shelves.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text('暂无本地书单，点击右上角「+ 新建」', style: TextStyle(color: LiquidTokens.muted(context))),
          ),
        )
      else if (_shelfItems.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text('该书单暂无作品', style: TextStyle(color: LiquidTokens.muted(context))),
          ),
        )
      else
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
                final it = _shelfItems[idx];
                return ModernComicCard(
                  album: ComicSummary(
                    albumId: it.albumId,
                    title: it.title,
                    author: it.author,
                    tags: it.tags,
                    coverUrl: it.coverUrl,
                  ),
                  onTap: () => openAlbumDetailScreen(context, it.albumId),
                );
              },
              childCount: _shelfItems.length,
            ),
          ),
        ),
    ];
  }

  List<Widget> _buildLanLibrary(BuildContext context) {
    if (_lanLibLoading) {
      return const [SliverFillRemaining(child: Center(child: CupertinoActivityIndicator()))];
    }
    if (_lanLibrary.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('服务端本地书库暂无漫画', style: TextStyle(color: LiquidTokens.muted(context))),
                const SizedBox(height: 12),
                CupertinoButton.filled(
                  onPressed: () => _loadLanLibrary(scan: true),
                  child: const Text('扫描服务端目录'),
                ),
              ],
            ),
          ),
        ),
      ];
    }
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;
    return [
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
              final it = _lanLibrary[idx];
              return ModernComicCard(
                badge: it.format == 'zip' ? 'ZIP' : (it.format == 'pdf' ? 'PDF' : '${it.pageCount}P'),
                album: ComicSummary(
                  albumId: it.albumId,
                  title: it.title,
                  author: it.author.isNotEmpty ? it.author : '${(it.sizeBytes / 1024 / 1024).toStringAsFixed(1)} MB',
                  tags: it.tags,
                  coverUrl: it.coverUrl,
                ),
                onTap: () => _openLanLocalItem(it),
              );
            },
            childCount: _lanLibrary.length,
          ),
        ),
      ),
    ];
  }

  List<Widget> _buildDownloads(BuildContext context) {
    if (_dlLoading) {
      return const [SliverFillRemaining(child: Center(child: CupertinoActivityIndicator()))];
    }
    if (_dlTasks.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text('服务端下载队列为空', style: TextStyle(color: LiquidTokens.muted(context))),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.builder(
          itemCount: _dlTasks.length,
          itemBuilder: (ctx, idx) {
            final t = _dlTasks[idx];
            final active = t.status == 'running' || t.status == 'pending';
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LiquidSolidCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.title.isEmpty ? 'JM${t.albumId}' : t.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${t.status.toUpperCase()} · ${t.progress}% · ${t.completedCount}/${t.totalCount} 页',
                            style: TextStyle(fontSize: 12, color: LiquidTokens.muted(ctx)),
                          ),
                        ],
                      ),
                    ),
                    if (active)
                      CupertinoButton(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        onPressed: () async {
                          await ref.read(hybridControllerProvider.notifier).lanSource.cancelServerDownload(t.taskId);
                          _loadDownloads();
                        },
                        child: const Text('取消', style: TextStyle(fontSize: 13)),
                      )
                    else ...[
                      if (t.status == 'failed' || t.status == 'cancelled')
                        CupertinoButton(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          onPressed: () async {
                            await ref.read(hybridControllerProvider.notifier).lanSource.retryServerDownload(t.taskId);
                            _loadDownloads();
                          },
                          child: const Text('重试', style: TextStyle(fontSize: 13)),
                        ),
                      CupertinoButton(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        onPressed: () async {
                          await ref.read(hybridControllerProvider.notifier).lanSource.deleteServerDownload(t.taskId);
                          _loadDownloads();
                        },
                        child: const Icon(CupertinoIcons.trash, size: 17, color: CupertinoColors.systemRed),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
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
