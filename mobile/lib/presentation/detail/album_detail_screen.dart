import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../explore/explore_screen.dart';
import '../reader/reader_screen.dart';
import '../widgets/comic_widgets.dart';

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
  bool _favBusy = false;
  bool _isFavorite = false;
  bool _epReverse = false;
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
      final d = await src.getAlbumDetail(widget.albumId);
      final c = await src.getComments(widget.albumId).catchError((_) => const <CommentItemModel>[]);
      if (mounted) {
        setState(() {
          _detail = d;
          _isFavorite = d.isFavorite;
          _comments = c;
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

  Future<void> _toggleFavorite() async {
    if (_favBusy) return;
    final hybrid = ref.read(hybridControllerProvider);
    if (!hybrid.account.isLoggedIn) {
      final ok = await showAccountLoginSheet(context, ref);
      if (!ok) return;
    }

    setState(() => _favBusy = true);
    try {
      final src = ref.read(hybridControllerProvider.notifier).activeSource;
      if (_isFavorite) {
        await src.removeFavorite(widget.albumId);
        if (mounted) setState(() => _isFavorite = false);
      } else {
        await src.addFavorite(widget.albumId);
        if (mounted) setState(() => _isFavorite = true);
      }
    } catch (e) {
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: const Text('收藏操作失败'),
            content: Text('$e'.replaceFirst('Exception: ', '')),
            actions: [CupertinoDialogAction(child: const Text('好'), onPressed: () => Navigator.pop(ctx))],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _favBusy = false);
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

  Future<void> _openPostComment() async {
    final src = ref.read(hybridControllerProvider.notifier).activeSource;
    if (!src.supportsPostingComments) {
      showCupertinoDialog(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: const Text('暂不支持直连发表评论'),
          content: const Text('当前处于直连模式，仅支持浏览评论。如需发表评论请切换至局域网服务端模式。'),
          actions: [CupertinoDialogAction(child: const Text('知道了'), onPressed: () => Navigator.pop(ctx))],
        ),
      );
      return;
    }

    final ctrl = TextEditingController();
    final sent = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('发表评论'),
        content: Padding(
          padding: const EdgeInsets.only(top: 10),
          child: CupertinoTextField(
            controller: ctrl,
            placeholder: '写下你的评论（需服务端已登录 JM 账号）',
            maxLines: 3,
          ),
        ),
        actions: [
          CupertinoDialogAction(child: const Text('取消'), onPressed: () => Navigator.pop(ctx, false)),
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('发送'),
            onPressed: () async {
              final txt = ctrl.text.trim();
              if (txt.isEmpty) return;
              await src.postComment(widget.albumId, txt);
              if (ctx.mounted) Navigator.pop(ctx, true);
            },
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (sent == true) {
      final refreshed = await src.getComments(widget.albumId).catchError((_) => _comments);
      if (mounted) setState(() => _comments = refreshed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _detail;
    final hybrid = ref.watch(hybridControllerProvider);
    HistoryRecord? historyMatch;
    for (final h in hybrid.history) {
      if (h.albumId == widget.albumId) {
        historyMatch = h;
        break;
      }
    }
    final episodes = d == null
        ? const <ComicEpisode>[]
        : (_epReverse ? d.episodes.reversed.toList() : d.episodes);

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(d?.title ?? 'JM${widget.albumId}', maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      child: _loading
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : d == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败${_error != null ? ": $_error" : ""}'),
                      const SizedBox(height: 10),
                      CupertinoButton.filled(onPressed: _load, child: const Text('重试')),
                    ],
                  ),
                )
              : SafeArea(
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      // 沉浸式氛围毛玻璃头部卡片
                      ClipRRect(
                        borderRadius: BorderRadius.circular(22),
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: ModernCoverImage(
                                coverUrl: d.coverUrl,
                                fallbacks: d.coverFallbacks,
                                borderRadius: 0,
                              ),
                            ),
                            Positioned.fill(
                              child: BackdropFilter(
                                filter: ImageFilter.blur(sigmaX: 26, sigmaY: 26),
                                child: Container(
                                  color: JmlisColors.card(context).withValues(alpha: 0.78),
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(22),
                                border: Border.all(color: JmlisColors.border(context)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ModernCoverImage(
                                    coverUrl: d.coverUrl,
                                    fallbacks: d.coverFallbacks,
                                    width: 118,
                                    height: 162,
                                    borderRadius: 14,
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: JmlisColors.accentSoft(context),
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            'JM${d.albumId}',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: JmlisColors.accent(context),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(d.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.25)),
                                        const SizedBox(height: 6),
                                        Text(
                                          '${d.views} 阅读 · ${d.likes} 喜欢',
                                          style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(context)),
                                        ),
                                        if (d.authors.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 6,
                                            children: d.authors
                                                .map(
                                                  (a) => GestureDetector(
                                                    onTap: () => Navigator.of(context).push(
                                                      CupertinoPageRoute(
                                                        builder: (_) => ExploreScreen(
                                                          initialQuery: a,
                                                          initialSearchType: 'author',
                                                        ),
                                                      ),
                                                    ),
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                      decoration: BoxDecoration(
                                                        color: JmlisColors.accentSoft(context),
                                                        borderRadius: BorderRadius.circular(999),
                                                      ),
                                                      child: Text(
                                                        '作者: $a',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.w600,
                                                          color: JmlisColors.accent(context),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                )
                                                .toList(),
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
                      if (d.tags.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: d.tags
                              .take(12)
                              .map(
                                (t) => GestureDetector(
                                  onTap: () => Navigator.of(context).push(
                                    CupertinoPageRoute(
                                      builder: (_) => ExploreScreen(
                                        initialQuery: t,
                                        initialSearchType: 'tag',
                                      ),
                                    ),
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: JmlisColors.card(context),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: JmlisColors.border(context)),
                                    ),
                                    child: Text('#$t', style: const TextStyle(fontSize: 11.5)),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      if (d.description.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: JmlisColors.card(context),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: JmlisColors.border(context)),
                          ),
                          child: Text(
                            d.description,
                            style: TextStyle(fontSize: 13, height: 1.5, color: JmlisColors.secondaryText(context)),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: CupertinoButton(
                              color: JmlisColors.accent(context),
                              borderRadius: BorderRadius.circular(14),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              onPressed: d.episodes.isEmpty
                                  ? null
                                  : () => Navigator.of(context).push(
                                        CupertinoPageRoute(
                                          builder: (_) => ReaderScreen(
                                            albumId: d.albumId,
                                            photoId: historyMatch?.photoId ?? d.episodes.first.photoId,
                                            title: d.title,
                                            initialPage: historyMatch?.pageIndex ?? 0,
                                          ),
                                        ),
                                      ),
                              child: Text(
                                historyMatch != null ? '继续阅读 (第${historyMatch.pageIndex + 1}页)' : '开始阅读',
                                style: const TextStyle(color: CupertinoColors.white, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          CupertinoButton(
                            color: JmlisColors.card(context),
                            borderRadius: BorderRadius.circular(14),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            onPressed: _favBusy ? null : _toggleFavorite,
                            child: Icon(
                              _isFavorite ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                              size: 20,
                              color: _isFavorite ? CupertinoColors.systemPink : JmlisColors.secondaryText(context),
                            ),
                          ),
                          const SizedBox(width: 8),
                          CupertinoButton(
                            color: JmlisColors.card(context),
                            borderRadius: BorderRadius.circular(14),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            onPressed: _caching ? null : _cacheFirstChapter,
                            child: Text(
                              _caching ? '缓存中' : '缓存',
                              style: TextStyle(color: JmlisColors.accent(context), fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('章节列表 (${d.episodes.length})', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          GestureDetector(
                            onTap: () => setState(() => _epReverse = !_epReverse),
                            child: Text(
                              _epReverse ? '倒序' : '正序',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: JmlisColors.accent(context)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      CupertinoListSection.insetGrouped(
                        margin: EdgeInsets.zero,
                        children: episodes
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
                      if (d.related.isNotEmpty) ...[
                        const SizedBox(height: 22),
                        const Text('相关推荐', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 210,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: d.related.take(10).length,
                            separatorBuilder: (_, __) => const SizedBox(width: 10),
                            itemBuilder: (ctx, i) {
                              final rel = d.related[i];
                              return SizedBox(
                                width: 122,
                                child: ModernComicCard(
                                  album: rel,
                                  onTap: () => Navigator.of(context).push(
                                    CupertinoPageRoute(builder: (_) => AlbumDetailScreen(albumId: rel.albumId)),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('热门评论 (${d.commentCount})', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          GestureDetector(
                            onTap: _openPostComment,
                            child: Text(
                              '写评论',
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: JmlisColors.accent(context)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (_comments.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: JmlisColors.card(context),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: JmlisColors.border(context)),
                          ),
                          child: Center(
                            child: Text('暂无评论', style: TextStyle(color: JmlisColors.secondaryText(context))),
                          ),
                        )
                      else
                        for (final c in _comments.take(15)) CommentCardTile(comment: c),
                    ],
                  ),
                ),
    );
  }
}
