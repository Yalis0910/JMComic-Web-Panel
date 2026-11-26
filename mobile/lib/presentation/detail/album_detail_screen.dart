import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../explore/explore_screen.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/comic_widgets.dart';
import '../widgets/liquid_glass.dart';

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
        var folderId = '0';
        if (src.supportsWebOnlyFilters) {
          final favPage = await src.getFavorites(page: 1).catchError((_) => const FavoritePageResult());
          if (favPage.folders.isNotEmpty && mounted) {
            final chosen = await showCupertinoModalPopup<String>(
              context: context,
              builder: (ctx) => CupertinoActionSheet(
                title: const Text('选择收藏夹'),
                actions: [
                  CupertinoActionSheetAction(
                    onPressed: () => Navigator.pop(ctx, '0'),
                    child: const Text('默认收藏夹'),
                  ),
                  for (final f in favPage.folders)
                    CupertinoActionSheetAction(
                      onPressed: () => Navigator.pop(ctx, f.folderId),
                      child: Text(f.name),
                    ),
                ],
                cancelButton: CupertinoActionSheetAction(
                  isDestructiveAction: true,
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('取消'),
                ),
              ),
            );
            if (chosen == null) {
              if (mounted) setState(() => _favBusy = false);
              return;
            }
            folderId = chosen;
          }
        }
        await src.addFavorite(widget.albumId, folderId: folderId);
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

  Future<void> _openPostComment({CommentItemModel? replyTo}) async {
    final src = ref.read(hybridControllerProvider.notifier).activeSource;
    if (!src.supportsPostingComments) {
      showCupertinoDialog(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: const Text('暂不支持直连发表评论'),
          content: const Text('当前处于直连模式，仅支持浏览评论。如需发表评论或回复请切换至局域网服务端模式。'),
          actions: [CupertinoDialogAction(child: const Text('知道了'), onPressed: () => Navigator.pop(ctx))],
        ),
      );
      return;
    }

    final ctrl = TextEditingController();
    var spoiler = false;
    final sent = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => CupertinoAlertDialog(
          title: Text(replyTo != null ? '回复 @${replyTo.username.isEmpty ? "匿名读者" : replyTo.username}' : '发表评论'),
          content: Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CupertinoTextField(
                  controller: ctrl,
                  placeholder: '写下你的评论（需服务端已登录 JM 账号）',
                  maxLines: 3,
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('包含剧透', style: TextStyle(fontSize: 13)),
                    CupertinoSwitch(
                      value: spoiler,
                      onChanged: (v) => setDialogState(() => spoiler = v),
                    ),
                  ],
                ),
              ],
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
                await src.postComment(
                  widget.albumId,
                  txt,
                  commentId: replyTo?.cid,
                  spoiler: spoiler,
                );
                if (ctx.mounted) Navigator.pop(ctx, true);
              },
            ),
          ],
        ),
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
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: _loading
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : d == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('加载失败${_error != null ? ": $_error" : ""}'),
                      const SizedBox(height: 12),
                      CupertinoButton.filled(onPressed: _load, child: const Text('重试')),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    ListView(
                      physics: const BouncingScrollPhysics(),
                      padding: EdgeInsets.fromLTRB(
                        16,
                        MediaQuery.of(context).padding.top + 12,
                        16,
                        bottomInset + 104,
                      ),
                      children: [
                        // Deep Sea Scenic Hero Banner + Clear Glass Back Pill
                        ClipRRect(
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
                              if (hybrid.settings.showCovers)
                                Positioned.fill(
                                  child: Opacity(
                                    opacity: 0.28,
                                    child: ImageFiltered(
                                      imageFilter: ImageFilter.blur(sigmaX: 26, sigmaY: 26),
                                      child: ModernCoverImage(
                                        coverUrl: d.coverUrl,
                                        fallbacks: d.coverFallbacks,
                                        borderRadius: 0,
                                      ),
                                    ),
                                  ),
                                ),
                              Padding(
                                padding: const EdgeInsets.all(18),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    LiquidSpringControl(
                                      onTap: () => Navigator.of(context).pop(),
                                      child: const LiquidGlassSurface(
                                        variant: LiquidGlassVariant.clear,
                                        onDarkScene: true,
                                        borderRadius: 999,
                                        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(CupertinoIcons.back, size: 16, color: CupertinoColors.white),
                                            SizedBox(width: 4),
                                            Text(
                                              '返回',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                color: CupertinoColors.white,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(18),
                                            border: Border.all(
                                              color: CupertinoColors.white.withValues(alpha: 0.28),
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: CupertinoColors.black.withValues(alpha: 0.36),
                                                blurRadius: 20,
                                                offset: const Offset(0, 10),
                                              ),
                                            ],
                                          ),
                                          child: ModernCoverImage(
                                            coverUrl: d.coverUrl,
                                            fallbacks: d.coverFallbacks,
                                            width: 116,
                                            height: 160,
                                            borderRadius: 17,
                                          ),
                                        ),
                                        const SizedBox(width: 15),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: CupertinoColors.white.withValues(alpha: 0.14),
                                                  borderRadius: BorderRadius.circular(999),
                                                ),
                                                child: Text(
                                                  'JM${d.albumId}',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w700,
                                                    color: LiquidTokens.lightIce,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              Text(
                                                d.title,
                                                style: const TextStyle(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w600,
                                                  height: 1.25,
                                                  color: CupertinoColors.white,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                [
                                                  '${d.views} 阅读',
                                                  '${d.likes} 喜欢',
                                                  if (d.pubDate.isNotEmpty && d.pubDate != '0') '发布 ${d.pubDate}',
                                                ].join(' · '),
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: CupertinoColors.white.withValues(alpha: 0.78),
                                                ),
                                              ),
                                              if (d.authors.isNotEmpty || d.works.isNotEmpty || d.actors.isNotEmpty) ...[
                                                const SizedBox(height: 10),
                                                Wrap(
                                                  spacing: 6,
                                                  runSpacing: 6,
                                                  children: [
                                                    for (final a in d.authors)
                                                      GestureDetector(
                                                        onTap: () => Navigator.of(context).push(
                                                          CupertinoPageRoute(
                                                            builder: (_) => ExploreScreen(
                                                              initialQuery: a,
                                                              initialSearchType: 'author',
                                                            ),
                                                          ),
                                                        ),
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(
                                                            horizontal: 10,
                                                            vertical: 4,
                                                          ),
                                                          decoration: BoxDecoration(
                                                            color: LiquidTokens.lightIce.withValues(alpha: 0.22),
                                                            borderRadius: BorderRadius.circular(999),
                                                          ),
                                                          child: Text(
                                                            '作者: $a',
                                                            style: const TextStyle(
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600,
                                                              color: LiquidTokens.lightSaltMist,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    for (final w in d.works)
                                                      GestureDetector(
                                                        onTap: () => Navigator.of(context).push(
                                                          CupertinoPageRoute(
                                                            builder: (_) => ExploreScreen(
                                                              initialQuery: w,
                                                              initialSearchType: 'work',
                                                            ),
                                                          ),
                                                        ),
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(
                                                            horizontal: 10,
                                                            vertical: 4,
                                                          ),
                                                          decoration: BoxDecoration(
                                                            color: const Color(0x3393C5FD),
                                                            borderRadius: BorderRadius.circular(999),
                                                          ),
                                                          child: Text(
                                                            '原作: $w',
                                                            style: const TextStyle(
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600,
                                                              color: CupertinoColors.white,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    for (final act in d.actors)
                                                      GestureDetector(
                                                        onTap: () => Navigator.of(context).push(
                                                          CupertinoPageRoute(
                                                            builder: (_) => ExploreScreen(
                                                              initialQuery: act,
                                                              initialSearchType: 'actor',
                                                            ),
                                                          ),
                                                        ),
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(
                                                            horizontal: 10,
                                                            vertical: 4,
                                                          ),
                                                          decoration: BoxDecoration(
                                                            color: const Color(0x33F4A2A6),
                                                            borderRadius: BorderRadius.circular(999),
                                                          ),
                                                          child: Text(
                                                            '角色: $act',
                                                            style: const TextStyle(
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600,
                                                              color: CupertinoColors.white,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (d.tags.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 7,
                            runSpacing: 7,
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
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: LiquidTokens.solid(context),
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(color: LiquidTokens.separator(context)),
                                      ),
                                      child: Text('#$t', style: const TextStyle(fontSize: 12)),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                        if (d.description.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          LiquidSolidCard(
                            padding: const EdgeInsets.all(16),
                            child: Text(
                              d.description,
                              style: TextStyle(
                                fontSize: 13.5,
                                height: 1.55,
                                color: LiquidTokens.muted(context),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '章节列表 (${d.episodes.length})',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                            ),
                            GestureDetector(
                              onTap: () => setState(() => _epReverse = !_epReverse),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                decoration: BoxDecoration(
                                  color: LiquidTokens.solid(context),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: LiquidTokens.separator(context)),
                                ),
                                child: Text(
                                  _epReverse ? '倒序' : '正序',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: LiquidTokens.accentStrong(context),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        LiquidSolidCard(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              for (int i = 0; i < episodes.length; i++) ...[
                                CupertinoListTile(
                                  title: Text('第 ${episodes[i].index} 话 ${episodes[i].name}'),
                                  trailing: const CupertinoListTileChevron(),
                                  onTap: () => openReaderScreen(
                                    context,
                                    albumId: d.albumId,
                                    photoId: episodes[i].photoId,
                                    title: d.title,
                                  ),
                                ),
                                if (i < episodes.length - 1)
                                  Container(height: 0.7, color: LiquidTokens.separator(context)),
                              ],
                            ],
                          ),
                        ),
                        if (d.related.isNotEmpty) ...[
                          const SizedBox(height: 24),
                          const Text('相关推荐', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 220,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: d.related.take(10).length,
                              separatorBuilder: (_, __) => const SizedBox(width: 12),
                              itemBuilder: (ctx, i) {
                                final rel = d.related[i];
                                return SizedBox(
                                  width: 132,
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
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '热门评论 (${d.commentCount})',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                            ),
                            GestureDetector(
                              onTap: _openPostComment,
                              child: Text(
                                '写评论',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: LiquidTokens.accentStrong(context),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (_comments.isEmpty)
                          LiquidSolidCard(
                            padding: const EdgeInsets.all(20),
                            child: Center(
                              child: Text('暂无评论', style: TextStyle(color: LiquidTokens.muted(context))),
                            ),
                          )
                        else
                          for (final c in _comments.take(15))
                            CommentCardTile(
                              comment: c,
                              onReply: () => _openPostComment(replyTo: c),
                            ),
                      ],
                    ),
                    // Floating Liquid Glass Action Dock at bottom
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: bottomInset > 0 ? bottomInset + 6 : 14,
                      child: LiquidGlassSurface(
                        variant: LiquidGlassVariant.tinted,
                        borderRadius: 999,
                        padding: const EdgeInsets.all(6),
                        child: Row(
                          children: [
                            Expanded(
                              child: LiquidSpringControl(
                                onTap: d.episodes.isEmpty
                                    ? null
                                    : () => openReaderScreen(
                                          context,
                                          albumId: d.albumId,
                                          photoId: historyMatch?.photoId ?? d.episodes.first.photoId,
                                          title: d.title,
                                          initialPage: historyMatch?.pageIndex ?? 0,
                                        ),
                                child: Container(
                                  height: 46,
                                  decoration: BoxDecoration(
                                    color: LiquidTokens.scene(context),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    historyMatch != null ? '继续阅读 (第${historyMatch.pageIndex + 1}页)' : '开始阅读',
                                    style: const TextStyle(
                                      color: CupertinoColors.white,
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            LiquidSpringControl(
                              onTap: _favBusy ? null : _toggleFavorite,
                              child: Container(
                                height: 46,
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(
                                  color: LiquidTokens.solid(context),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: LiquidTokens.separator(context)),
                                ),
                                child: Icon(
                                  _isFavorite ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                                  size: 20,
                                  color: _isFavorite
                                      ? CupertinoColors.systemRed
                                      : LiquidTokens.muted(context),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            LiquidSpringControl(
                              onTap: _caching ? null : _cacheFirstChapter,
                              child: Container(
                                height: 46,
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(
                                  color: LiquidTokens.solid(context),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: LiquidTokens.separator(context)),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  _caching ? '缓存中' : '缓存',
                                  style: TextStyle(
                                    color: LiquidTokens.accentStrong(context),
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
