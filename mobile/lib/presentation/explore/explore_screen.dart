import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../detail/album_detail_screen.dart';
import '../widgets/comic_widgets.dart';

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
  static const _categories = [
    (id: '0', label: '全部'),
    (id: 'doujin', label: '同人'),
    (id: 'single', label: '单行本'),
    (id: 'short', label: '短篇'),
    (id: 'hanman', label: '韩漫'),
    (id: 'meiman', label: '美漫'),
    (id: 'another', label: '其他'),
  ];

  static const _searchTypes = [
    (id: 'all', label: '全部'),
    (id: 'author', label: '作者'),
    (id: 'tag', label: '标签'),
    (id: 'work', label: '作品'),
    (id: 'actor', label: '角色'),
  ];

  late final TextEditingController _searchCtrl;
  String _rankType = 'day';
  String _category = '0';
  String _searchType = 'all';
  String _query = '';
  List<ComicSummary> _items = const [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery?.trim() ?? '';
    _searchType = widget.initialSearchType ?? 'all';
    _searchCtrl = TextEditingController(text: _query);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_query.isNotEmpty) {
        _doSearch(_query);
      } else {
        _loadRanking();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRanking() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final res = await src.getRanking(_rankType, category: _category);
      if (mounted) setState(() => _items = res);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doSearch(String q) async {
    final clean = q.trim();
    if (clean.isEmpty) {
      setState(() => _query = '');
      return _loadRanking();
    }
    setState(() {
      _query = clean;
      _loading = true;
      _error = null;
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final res = await src.search(clean, type: _searchType);
      if (mounted) setState(() => _items = res);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          const CupertinoSliverNavigationBar(largeTitle: Text('排行与搜索')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CupertinoSearchTextField(
                    controller: _searchCtrl,
                    placeholder: '搜索漫画名、JM 车号、作者、标签...',
                    onSubmitted: _doSearch,
                    onSuffixTap: () {
                      _searchCtrl.clear();
                      _doSearch('');
                    },
                  ),
                  const SizedBox(height: 12),
                  if (_query.isNotEmpty) ...[
                    SizedBox(
                      height: 34,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _searchTypes.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (ctx, i) {
                          final t = _searchTypes[i];
                          final active = _searchType == t.id;
                          return GestureDetector(
                            onTap: () {
                              setState(() => _searchType = t.id);
                              _doSearch(_query);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: active ? JmlisColors.accent(ctx) : JmlisColors.card(ctx),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: active ? JmlisColors.accent(ctx) : JmlisColors.border(ctx),
                                ),
                              ),
                              child: Text(
                                t.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: active ? CupertinoColors.white : JmlisColors.secondaryText(ctx),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ] else ...[
                    SizedBox(
                      width: double.infinity,
                      child: CupertinoSlidingSegmentedControl<String>(
                        groupValue: _rankType,
                        children: const {
                          'day': Text('日榜'),
                          'week': Text('周榜'),
                          'month': Text('月榜'),
                        },
                        onValueChanged: (v) {
                          if (v != null) {
                            setState(() => _rankType = v);
                            _loadRanking();
                          }
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 34,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _categories.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (ctx, i) {
                          final c = _categories[i];
                          final active = _category == c.id;
                          return GestureDetector(
                            onTap: () {
                              setState(() => _category = c.id);
                              _loadRanking();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: active ? JmlisColors.accent(ctx) : JmlisColors.card(ctx),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: active ? JmlisColors.accent(ctx) : JmlisColors.border(ctx),
                                ),
                              ),
                              child: Text(
                                c.label,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: active ? CupertinoColors.white : JmlisColors.secondaryText(ctx),
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
          ),
          if (_loading)
            const SkeletonGridSliver(count: 9)
          else if (_error != null)
            SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败：$_error', textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      CupertinoButton.filled(
                        onPressed: _query.isNotEmpty ? () => _doSearch(_query) : _loadRanking,
                        child: const Text('重试'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
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
                    final a = _items[idx];
                    return ModernComicCard(
                      album: a,
                      rank: _query.isEmpty ? idx + 1 : null,
                      onTap: () => Navigator.of(context).push(
                        CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: a.albumId)),
                      ),
                    );
                  },
                  childCount: _items.length,
                ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 36)),
        ],
      ),
    );
  }
}
