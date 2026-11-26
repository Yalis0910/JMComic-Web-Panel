import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/comic_widgets.dart';
import '../widgets/liquid_glass.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  final String? initialQuery;
  final String? initialSearchType;

  const ExploreScreen({
    super.key,
    this.initialQuery,
    this.initialSearchType,
  });

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  static const _tabs = [
    (value: 'ranking', label: '排行榜'),
    (value: 'filter', label: '分类筛选'),
    (value: 'week', label: '每周必看'),
    (value: 'forum', label: '讨论区'),
  ];

  static const _rankTypes = [
    (value: 'day', label: '日榜'),
    (value: 'week', label: '周榜'),
    (value: 'month', label: '月榜'),
    (value: 'all', label: '总榜'),
    (value: 'likes', label: '最多爱心'),
    (value: 'latest', label: '最新'),
  ];

  static const _searchTypes = [
    (id: 'all', label: '全部'),
    (id: 'author', label: '作者'),
    (id: 'tag', label: '标签'),
    (id: 'work', label: '作品'),
    (id: 'actor', label: '角色'),
  ];

  static const _timeRanges = [
    (value: 'a', label: '全部'),
    (value: 't', label: '今天'),
    (value: 'w', label: '本周'),
    (value: 'm', label: '本月'),
  ];

  late final TextEditingController _searchCtrl;
  String _tab = 'ranking';
  String _rankType = 'day';
  String _category = '0';
  String _subCategory = '';
  String _orderBy = 'mv';
  String _timeRange = 'a';
  String _searchType = 'all';
  String _searchOrderBy = 'mr';
  String _query = '';
  int _page = 1;
  int _pageCount = 1;
  int _pageSize = 80;

  List<CategoryOptionItem> _categories = CategoryMetaResult.fallbackCategories;
  Map<String, List<SubCategoryOptionItem>> _subCategoriesMap = CategoryMetaResult.fallbackSubCategories;

  WeekMetaResult _weekMeta = const WeekMetaResult();
  String _weekCatId = '';
  String _weekTypeId = 'manga';

  List<ComicSummary> _items = const [];
  List<CommentItemModel> _forumItems = const [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery?.trim() ?? '';
    _searchType = widget.initialSearchType ?? 'all';
    _searchCtrl = TextEditingController(text: _query);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCategoriesMeta();
      if (_query.isNotEmpty) {
        _doSearch(_query);
      } else {
        _loadActiveTab();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCategoriesMeta() async {
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final meta = await src.getCategoriesMeta();
      if (mounted && meta.categories.isNotEmpty) {
        setState(() {
          _categories = meta.categories;
          if (meta.subCategories.isNotEmpty) {
            _subCategoriesMap = meta.subCategories;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _loadActiveTab() async {
    if (_query.isNotEmpty) {
      return _doSearch(_query, page: _page);
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      if (_tab == 'ranking') {
        final res = await src.getRanking(_rankType, page: _page, category: _category);
        if (mounted) {
          setState(() {
            _items = res.albums;
            _pageCount = res.pageCount;
            _pageSize = res.pageSize;
          });
        }
      } else if (_tab == 'filter') {
        final res = await src.getCategoryFilter(
          page: _page,
          time: _timeRange,
          orderBy: _orderBy,
          category: _category,
          subCategory: src.supportsWebOnlyFilters && _subCategory.isNotEmpty ? _subCategory : null,
        );
        if (mounted) {
          setState(() {
            _items = res.albums;
            _pageCount = res.pageCount;
            _pageSize = res.pageSize;
          });
        }
      } else if (_tab == 'week') {
        var meta = _weekMeta;
        if (meta.categories.isEmpty) {
          meta = await src.getWeekMeta();
        }
        final catId = _weekCatId.isNotEmpty
            ? _weekCatId
            : (meta.categories.isNotEmpty ? meta.categories.first.id : '');
        final typeId = _weekTypeId;
        final list = catId.isNotEmpty
            ? await src.getWeekFilter(catId, typeId: typeId)
            : const <ComicSummary>[];
        if (mounted) {
          setState(() {
            _weekMeta = meta;
            if (_weekCatId.isEmpty && catId.isNotEmpty) _weekCatId = catId;
            _items = list;
            _pageCount = 1;
          });
        }
      } else if (_tab == 'forum') {
        final list = await src.getForumComments(page: _page);
        if (mounted) {
          setState(() {
            _forumItems = list;
            _pageCount = list.isEmpty ? _page : _page + 1;
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doSearch(String q, {int page = 1}) async {
    final clean = q.trim();
    if (clean.isEmpty) {
      setState(() {
        _query = '';
        _page = 1;
      });
      return _loadActiveTab();
    }
    setState(() {
      _query = clean;
      _page = page;
      _loading = true;
      _error = null;
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final res = await src.search(
        clean,
        type: _searchType,
        page: page,
        orderBy: _searchOrderBy,
        time: _timeRange,
        category: src.supportsWebOnlyFilters ? _category : '0',
        subCategory: src.supportsWebOnlyFilters && _subCategory.isNotEmpty ? _subCategory : null,
      );
      if (mounted) {
        setState(() {
          _items = res.albums;
          _pageCount = res.pageCount;
          _pageSize = res.pageSize;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _buildPillChip({
    required String label,
    required bool active,
    required VoidCallback onTap,
    bool compact = false,
  }) {
    return LiquidSpringControl(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 15, vertical: compact ? 6 : 8),
        decoration: BoxDecoration(
          color: active ? LiquidTokens.scene(context) : LiquidTokens.solid(context),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? LiquidTokens.scene(context) : LiquidTokens.separator(context),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: compact ? 12 : 13,
            fontWeight: FontWeight.w600,
            color: active ? CupertinoColors.white : LiquidTokens.muted(context),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<HybridState>(hybridControllerProvider, (prev, next) {
      if (prev != null && prev.activeMode != next.activeMode) {
        _loadCategoriesMeta();
        _loadActiveTab();
      }
    });
    final activeMode = ref.watch(hybridControllerProvider.select((s) => s.activeMode));
    final webOnly = activeMode == ActiveMode.lanServer;
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;
    final subCats = webOnly ? (_subCategoriesMap[_category] ?? const <SubCategoryOptionItem>[]) : const <SubCategoryOptionItem>[];

    final filterOrders = [
      (value: 'mv', label: '最多观看'),
      (value: 'tf', label: '最多点赞'),
      (value: 'mr', label: '最新'),
      (value: 'mp', label: '页数'),
      if (webOnly) ...[
        (value: 'tr', label: '评分'),
        (value: 'md', label: '评论'),
      ],
    ];

    final searchOrders = [
      (value: 'mr', label: '最新'),
      (value: 'mv', label: '观看'),
      (value: 'tf', label: '点赞'),
      (value: 'mp', label: '页数'),
      if (webOnly) ...[
        (value: 'tr', label: '评分'),
        (value: 'md', label: '评论'),
      ],
    ];

    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: const Text('排行与分类'),
            backgroundColor: LiquidTokens.tintedGlassFill(context),
            border: Border(bottom: BorderSide(color: LiquidTokens.separator(context), width: 0.5)),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LiquidGlassSurface(
                    variant: LiquidGlassVariant.tinted,
                    borderRadius: 999,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: Row(
                      children: [
                        Icon(CupertinoIcons.search, size: 17, color: LiquidTokens.muted(context)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: CupertinoTextField.borderless(
                            controller: _searchCtrl,
                            placeholder: '搜索漫画名、JM 车号、作者、标签...',
                            placeholderStyle: TextStyle(color: LiquidTokens.muted(context), fontSize: 14),
                            style: TextStyle(color: LiquidTokens.ink(context), fontSize: 14.5),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            textInputAction: TextInputAction.search,
                            onSubmitted: (val) => _doSearch(val),
                          ),
                        ),
                        if (_searchCtrl.text.isNotEmpty || _query.isNotEmpty)
                          GestureDetector(
                            onTap: () {
                              _searchCtrl.clear();
                              _doSearch('');
                            },
                            child: Icon(
                              CupertinoIcons.clear_circled_solid,
                              size: 18,
                              color: LiquidTokens.muted(context),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_query.isNotEmpty) ...[
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _searchTypes.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final t = _searchTypes[i];
                          return _buildPillChip(
                            label: t.label,
                            active: _searchType == t.id,
                            onTap: () {
                              setState(() => _searchType = t.id);
                              _doSearch(_query);
                            },
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 34,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          for (final o in searchOrders) ...[
                            _buildPillChip(
                              label: o.label,
                              active: _searchOrderBy == o.value,
                              compact: true,
                              onTap: () {
                                setState(() => _searchOrderBy = o.value);
                                _doSearch(_query);
                              },
                            ),
                            const SizedBox(width: 7),
                          ],
                          for (final tm in _timeRanges) ...[
                            _buildPillChip(
                              label: tm.label,
                              active: _timeRange == tm.value,
                              compact: true,
                              onTap: () {
                                setState(() => _timeRange = tm.value);
                                _doSearch(_query);
                              },
                            ),
                            const SizedBox(width: 7),
                          ],
                        ],
                      ),
                    ),
                  ] else ...[
                    LiquidSegmentedPill<String>(
                      value: _tab,
                      items: _tabs,
                      onChanged: (v) {
                        setState(() {
                          _tab = v;
                          _page = 1;
                        });
                        _loadActiveTab();
                      },
                    ),
                    const SizedBox(height: 12),
                    if (_tab == 'ranking') ...[
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _rankTypes.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final r = _rankTypes[i];
                            return _buildPillChip(
                              label: r.label,
                              active: _rankType == r.value,
                              onTap: () {
                                setState(() {
                                  _rankType = r.value;
                                  _page = 1;
                                });
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _categories.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final c = _categories[i];
                            return _buildPillChip(
                              label: c.label,
                              active: _category == c.value,
                              onTap: () {
                                setState(() {
                                  _category = c.value;
                                  _subCategory = '';
                                  _page = 1;
                                });
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                    ] else if (_tab == 'filter') ...[
                      SizedBox(
                        height: 34,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: filterOrders.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 7),
                          itemBuilder: (_, i) {
                            final o = filterOrders[i];
                            return _buildPillChip(
                              label: o.label,
                              active: _orderBy == o.value,
                              compact: true,
                              onTap: () {
                                setState(() {
                                  _orderBy = o.value;
                                  _page = 1;
                                });
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 9),
                      SizedBox(
                        height: 34,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _timeRanges.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 7),
                          itemBuilder: (_, i) {
                            final tm = _timeRanges[i];
                            return _buildPillChip(
                              label: tm.label,
                              active: _timeRange == tm.value,
                              compact: true,
                              onTap: () {
                                setState(() {
                                  _timeRange = tm.value;
                                  _page = 1;
                                });
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 9),
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _categories.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final c = _categories[i];
                            return _buildPillChip(
                              label: c.label,
                              active: _category == c.value,
                              onTap: () {
                                setState(() {
                                  _category = c.value;
                                  _subCategory = '';
                                  _page = 1;
                                });
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                      if (subCats.isNotEmpty) ...[
                        const SizedBox(height: 9),
                        SizedBox(
                          height: 32,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              _buildPillChip(
                                label: '全部子分类',
                                active: _subCategory.isEmpty,
                                compact: true,
                                onTap: () {
                                  setState(() {
                                    _subCategory = '';
                                    _page = 1;
                                  });
                                  _loadActiveTab();
                                },
                              ),
                              for (final sc in subCats) ...[
                                const SizedBox(width: 7),
                                _buildPillChip(
                                  label: sc.name,
                                  active: _subCategory == sc.slug,
                                  compact: true,
                                  onTap: () {
                                    setState(() {
                                      _subCategory = sc.slug;
                                      _page = 1;
                                    });
                                    _loadActiveTab();
                                  },
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                      if (!webOnly) ...[
                        const SizedBox(height: 8),
                        Text(
                          '直连模式使用 APP 接口；切换局域网模式可解锁二级子分类与评分/评论排序',
                          style: TextStyle(fontSize: 11.5, color: LiquidTokens.muted(context)),
                        ),
                      ],
                    ] else if (_tab == 'week' && _weekMeta.categories.isNotEmpty) ...[
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _weekMeta.categories.take(20).length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final wc = _weekMeta.categories[i];
                            return _buildPillChip(
                              label: wc.title,
                              active: _weekCatId == wc.id,
                              compact: true,
                              onTap: () {
                                setState(() => _weekCatId = wc.id);
                                _loadActiveTab();
                              },
                            );
                          },
                        ),
                      ),
                      if (_weekMeta.types.isNotEmpty) ...[
                        const SizedBox(height: 9),
                        SizedBox(
                          height: 34,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _weekMeta.types.length,
                            separatorBuilder: (_, __) => const SizedBox(width: 8),
                            itemBuilder: (_, i) {
                              final wt = _weekMeta.types[i];
                              return _buildPillChip(
                                label: wt.title,
                                active: _weekTypeId == wt.id,
                                compact: true,
                                onTap: () {
                                  setState(() => _weekTypeId = wt.id);
                                  _loadActiveTab();
                                },
                              );
                            },
                          ),
                        ),
                      ],
                    ],
                  ],
                ],
              ),
            ),
          ),
          if (_loading)
            const SkeletonGridSliver(count: 6)
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败：$_error', textAlign: TextAlign.center),
                      const SizedBox(height: 14),
                      LiquidSpringControl(
                        onTap: _loadActiveTab,
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
          else if (_query.isEmpty && _tab == 'forum') ...[
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, idx) {
                    final c = _forumItems[idx];
                    return CommentCardTile(
                      comment: c,
                      onOpenAlbum: c.albumId.isNotEmpty
                          ? () => Navigator.of(context).push(
                                CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: c.albumId)),
                              )
                          : null,
                    );
                  },
                  childCount: _forumItems.length,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CupertinoButton(
                      onPressed: _page <= 1
                          ? null
                          : () {
                              setState(() => _page--);
                              _loadActiveTab();
                            },
                      child: const Text('上一页'),
                    ),
                    Text('第 $_page 页'),
                    CupertinoButton(
                      onPressed: _forumItems.length < 10
                          ? null
                          : () {
                              setState(() => _page++);
                              _loadActiveTab();
                            },
                      child: const Text('下一页'),
                    ),
                  ],
                ),
              ),
            ),
          ] else ...[
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
                    final a = _items[idx];
                    return ModernComicCard(
                      album: a,
                      rank: (_query.isEmpty && _tab == 'ranking') ? (_page - 1) * _pageSize + idx + 1 : null,
                      onTap: () => Navigator.of(context).push(
                        CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: a.albumId)),
                      ),
                    );
                  },
                  childCount: _items.length,
                ),
              ),
            ),
            if ((_query.isNotEmpty || _tab != 'week') && _pageCount > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 18),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CupertinoButton(
                        onPressed: _page <= 1
                            ? null
                            : () {
                                setState(() => _page--);
                                _loadActiveTab();
                              },
                        child: const Text('上一页'),
                      ),
                      Text('$_page / $_pageCount'),
                      CupertinoButton(
                        onPressed: _page >= _pageCount
                            ? null
                            : () {
                                setState(() => _page++);
                                _loadActiveTab();
                              },
                        child: const Text('下一页'),
                      ),
                    ],
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
