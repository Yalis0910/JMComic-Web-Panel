import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../detail/album_detail_screen.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _rankType = 'day';
  String _query = '';
  List<ComicSummary> _items = const [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRanking());
  }

  Future<void> _loadRanking() async {
    setState(() => _loading = true);
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final res = await src.getRanking(_rankType);
      if (mounted) setState(() => _items = res);
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
    });
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final res = await src.search(clean);
      if (mounted) setState(() => _items = res);
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
                children: [
                  CupertinoSearchTextField(
                    controller: _searchCtrl,
                    placeholder: '搜索漫画名、车号、作者...',
                    onSubmitted: _doSearch,
                    onSuffixTap: () {
                      _searchCtrl.clear();
                      _doSearch('');
                    },
                  ),
                  if (_query.isEmpty) ...[
                    const SizedBox(height: 12),
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
                  ],
                ],
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(child: Center(child: CupertinoActivityIndicator()))
          else
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
                    final a = _items[idx];
                    return GestureDetector(
                      onTap: () => Navigator.of(context).push(
                        CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: a.albumId)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(a.coverUrl, fit: BoxFit.cover, width: double.infinity),
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            a.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                          ),
                        ],
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
