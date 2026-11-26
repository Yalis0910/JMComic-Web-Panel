import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
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
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;
    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: const Text('排行与搜索'),
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
                            onSubmitted: _doSearch,
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
                      height: 38,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _searchTypes.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (ctx, i) {
                          final t = _searchTypes[i];
                          final active = _searchType == t.id;
                          return LiquidSpringControl(
                            onTap: () {
                              setState(() => _searchType = t.id);
                              _doSearch(_query);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: active ? LiquidTokens.scene(ctx) : LiquidTokens.solid(ctx),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: active ? LiquidTokens.scene(ctx) : LiquidTokens.separator(ctx),
                                ),
                              ),
                              child: Text(
                                t.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: active ? CupertinoColors.white : LiquidTokens.muted(ctx),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ] else ...[
                    LiquidSegmentedPill<String>(
                      value: _rankType,
                      items: const [
                        (value: 'day', label: '日榜'),
                        (value: 'week', label: '周榜'),
                        (value: 'month', label: '月榜'),
                      ],
                      onChanged: (v) {
                        setState(() => _rankType = v);
                        _loadRanking();
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 38,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _categories.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (ctx, i) {
                          final c = _categories[i];
                          final active = _category == c.id;
                          return LiquidSpringControl(
                            onTap: () {
                              setState(() => _category = c.id);
                              _loadRanking();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: active ? LiquidTokens.scene(ctx) : LiquidTokens.solid(ctx),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: active ? LiquidTokens.scene(ctx) : LiquidTokens.separator(ctx),
                                ),
                              ),
                              child: Text(
                                c.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: active ? CupertinoColors.white : LiquidTokens.muted(ctx),
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
                        onTap: _query.isNotEmpty ? () => _doSearch(_query) : _loadRanking,
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
          const SliverToBoxAdapter(child: SizedBox(height: 112)),
        ],
      ),
    );
  }
}
