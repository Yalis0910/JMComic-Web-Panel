import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../reader/reader_screen.dart';

class AlbumDetailScreen extends ConsumerStatefulWidget {
  final String albumId;
  const AlbumDetailScreen({super.key, required this.albumId});

  @override
  ConsumerState<AlbumDetailScreen> createState() => _AlbumDetailScreenState();
}

class _AlbumDetailScreenState extends ConsumerState<AlbumDetailScreen> {
  ComicDetail? _detail;
  List<CommentItemModel> _comments = const [];
  bool _loading = true;
  bool _caching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      final d = await src.getAlbumDetail(widget.albumId);
      final c = await src.getComments(widget.albumId).catchError((_) => const <CommentItemModel>[]);
      if (mounted) {
        setState(() {
          _detail = d;
          _comments = c;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _cacheFirstChapter() async {
    final d = _detail;
    if (d == null || d.episodes.isEmpty || _caching) return;
    setState(() => _caching = true);
    try {
      final ctrl = ref.read(hybridControllerProvider.notifier);
      final imgs = await ctrl.activeSource.getChapterImages(d.episodes.first.photoId);
      await ctrl.cacheChapterOffline(d.episodes.first.photoId, imgs);
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: const Text('离线缓存完成'),
            content: Text('已缓存 ${imgs.length} 页到本地手机存储'),
            actions: [
              CupertinoDialogAction(child: const Text('好'), onPressed: () => Navigator.pop(ctx)),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _caching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _detail;
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(d?.title ?? 'JM${widget.albumId}', maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      child: _loading
          ? const Center(child: CupertinoActivityIndicator())
          : d == null
              ? const Center(child: Text('加载失败'))
              : SafeArea(
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Image.network(d.coverUrl, width: 120, height: 164, fit: BoxFit.cover),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(d.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                Text(
                                  'JM${d.albumId} · ${d.views} 阅读 · ${d.likes} 喜欢',
                                  style: const TextStyle(fontSize: 12.5, color: CupertinoColors.secondaryLabel),
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: d.tags
                                      .take(8)
                                      .map(
                                        (t) => Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: CupertinoColors.systemGrey5,
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: Text('#$t', style: const TextStyle(fontSize: 11.5)),
                                        ),
                                      )
                                      .toList(),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: CupertinoButton.filled(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              onPressed: d.episodes.isEmpty
                                  ? null
                                  : () => Navigator.of(context).push(
                                        CupertinoPageRoute(
                                          builder: (_) => ReaderScreen(
                                            albumId: d.albumId,
                                            photoId: d.episodes.first.photoId,
                                            title: d.title,
                                          ),
                                        ),
                                      ),
                              child: const Text('开始阅读'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          CupertinoButton(
                            color: CupertinoColors.systemGrey5,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            onPressed: _caching ? null : _cacheFirstChapter,
                            child: Text(
                              _caching ? '缓存中...' : '离线缓存',
                              style: const TextStyle(color: CupertinoColors.activeBlue, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      CupertinoListSection.insetGrouped(
                        header: Text('章节 (${d.episodes.length})'),
                        margin: EdgeInsets.zero,
                        children: d.episodes
                            .map(
                              (ep) => CupertinoListTile(
                                title: Text('第 ${ep.index} 话 ${ep.name}'),
                                trailing: const CupertinoListTileChevron(),
                                onTap: () => Navigator.of(context).push(
                                  CupertinoPageRoute(
                                    builder: (_) => ReaderScreen(
                                      albumId: d.albumId,
                                      photoId: ep.photoId,
                                      title: d.title,
                                    ),
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                      if (_comments.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        CupertinoListSection.insetGrouped(
                          header: Text('热门评论 (${_comments.length})'),
                          margin: EdgeInsets.zero,
                          children: _comments
                              .take(10)
                              .map(
                                (c) => CupertinoListTile(
                                  title: Text(c.username, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                  subtitle: Text(c.content, maxLines: 4, overflow: TextOverflow.ellipsis),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
