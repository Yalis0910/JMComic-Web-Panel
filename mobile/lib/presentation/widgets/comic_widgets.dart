import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../detail/album_detail_screen.dart';
import '../reader/reader_screen.dart';
import '../theme/liquid_glass_theme.dart';
import 'liquid_glass.dart';

Future<void> openAlbumDetailScreen(BuildContext context, String albumId) {
  return Navigator.of(context, rootNavigator: true).push(
    CupertinoPageRoute(
      builder: (_) => AlbumDetailScreen(albumId: albumId),
    ),
  );
}

Future<void> openReaderScreen(
  BuildContext context, {
  required String albumId,
  required String photoId,
  required String title,
  String source = 'online',
  String coverUrl = '',
  int initialPage = 0,
  List<ComicEpisode> episodes = const [],
}) {
  return Navigator.of(context, rootNavigator: true).push(
    CupertinoPageRoute(
      builder: (_) => ReaderScreen(
        albumId: albumId,
        photoId: photoId,
        title: title,
        source: source,
        coverUrl: coverUrl,
        initialPage: initialPage,
        initialEpisodes: episodes,
      ),
    ),
  );
}

class JmlisColors {
  static bool isDark(BuildContext context) => LiquidTokens.isDark(context);
  static Color canvas(BuildContext context) => LiquidTokens.canvas(context);
  static Color card(BuildContext context) => LiquidTokens.solid(context);
  static Color elevated(BuildContext context) => LiquidTokens.elevated(context);
  static Color border(BuildContext context) => LiquidTokens.separator(context);
  static Color accent(BuildContext context) => LiquidTokens.accentStrong(context);
  static Color accentSoft(BuildContext context) => LiquidTokens.accentSoft(context);
  static Color secondaryText(BuildContext context) => LiquidTokens.muted(context);
}

class ModernCoverImage extends ConsumerStatefulWidget {
  final String coverUrl;
  final List<String> fallbacks;
  final Map<String, String> headers;
  final double borderRadius;
  final double? width;
  final double? height;
  final BoxFit fit;
  final bool allowPreview;
  final bool tapToPreview;

  const ModernCoverImage({
    super.key,
    required this.coverUrl,
    this.fallbacks = const [],
    this.headers = const {},
    this.borderRadius = 16,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.allowPreview = true,
    this.tapToPreview = false,
  });

  @override
  ConsumerState<ModernCoverImage> createState() => _ModernCoverImageState();
}

class _ModernCoverImageState extends ConsumerState<ModernCoverImage> {
  int _urlIndex = 0;
  bool _tempReveal = false;
  CoverPrivacyMode? _lastPrivacy;

  @override
  void didUpdateWidget(covariant ModernCoverImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.coverUrl != widget.coverUrl) {
      _urlIndex = 0;
      _tempReveal = false;
    }
  }

  List<String> get _candidates => [
        if (widget.coverUrl.isNotEmpty) widget.coverUrl,
        ...widget.fallbacks.where((u) => u.isNotEmpty),
      ];

  @override
  Widget build(BuildContext context) {
    final privacy = ref.watch(hybridControllerProvider.select((s) => s.settings.coverPrivacyMode));
    if (_lastPrivacy != null && _lastPrivacy != privacy && _tempReveal) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _tempReveal = false);
      });
    }
    _lastPrivacy = privacy;

    if (privacy == CoverPrivacyMode.hide) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(widget.borderRadius),
        child: Container(
          width: widget.width,
          height: widget.height,
          color: LiquidTokens.elevated(context),
          alignment: Alignment.center,
          child: Icon(
            CupertinoIcons.eye_slash,
            size: 24,
            color: LiquidTokens.muted(context),
          ),
        ),
      );
    }

    final urls = _candidates;
    final hasImage = _urlIndex < urls.length;
    final isBlurred = privacy == CoverPrivacyMode.blur && !_tempReveal && hasImage;
    final showPreviewToggle = widget.allowPreview &&
        (widget.width == null || widget.width! >= 72) &&
        privacy == CoverPrivacyMode.blur &&
        hasImage;

    Widget child = !hasImage
        ? Container(
            width: widget.width,
            height: widget.height,
            color: LiquidTokens.elevated(context),
            alignment: Alignment.center,
            child: Icon(
              CupertinoIcons.book_fill,
              size: 26,
              color: LiquidTokens.muted(context),
            ),
          )
        : Image.network(
            urls[_urlIndex],
            width: widget.width,
            height: widget.height,
            fit: widget.fit,
            headers: widget.headers.isEmpty ? null : widget.headers,
            loadingBuilder: (ctx, imgChild, progress) {
              if (progress == null) return imgChild;
              return Container(
                width: widget.width,
                height: widget.height,
                color: LiquidTokens.elevated(ctx),
                alignment: Alignment.center,
                child: const CupertinoActivityIndicator(radius: 10),
              );
            },
            errorBuilder: (ctx, _, __) {
              if (_urlIndex + 1 < urls.length) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) setState(() => _urlIndex++);
                });
              }
              return Container(
                width: widget.width,
                height: widget.height,
                color: LiquidTokens.elevated(ctx),
                alignment: Alignment.center,
                child: Icon(
                  CupertinoIcons.book,
                  size: 24,
                  color: LiquidTokens.muted(ctx),
                ),
              );
            },
          );

    if (isBlurred) {
      child = ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: child,
      );
    }

    if (showPreviewToggle) {
      child = Stack(
        fit: StackFit.passthrough,
        children: [
          if (widget.tapToPreview)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _tempReveal = !_tempReveal),
              child: child,
            )
          else
            child,
          Positioned(
            right: 7,
            bottom: 8,
            child: Semantics(
              button: true,
              label: isBlurred ? '临时预览封面' : '恢复模糊封面',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _tempReveal = !_tempReveal),
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F1920).withValues(alpha: 0.62),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: CupertinoColors.white.withValues(alpha: 0.36),
                      width: 0.7,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    isBlurred ? CupertinoIcons.eye : CupertinoIcons.eye_slash,
                    size: 14,
                    color: CupertinoColors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: child,
    );
  }
}

/// Solid Reading Card with Clear Glass cover chips.
class ModernComicCard extends StatelessWidget {
  final ComicSummary album;
  final int? rank;
  final String? badge;
  final VoidCallback onTap;

  const ModernComicCard({
    super.key,
    required this.album,
    this.rank,
    this.badge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return LiquidSpringControl(
      onTap: onTap,
      child: LiquidSolidCard(
        borderRadius: 22,
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ModernCoverImage(
                    coverUrl: album.coverUrl,
                    fallbacks: album.coverFallbacks,
                    headers: album.coverHeaders,
                    borderRadius: 15,
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 44,
                    child: IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(15)),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              const Color(0x000F1920),
                              const Color(0xFF0F1920).withValues(alpha: 0.62),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (rank != null)
                    Positioned(
                      top: 7,
                      left: 7,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: rank == 1
                              ? const Color(0xFFB5751C)
                              : rank == 2
                                  ? const Color(0xFF4C5D57)
                                  : rank == 3
                                      ? const Color(0xFF8C5824)
                                      : const Color(0xFF0F1920).withValues(alpha: 0.66),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: CupertinoColors.white.withValues(alpha: 0.36),
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          '#$rank',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: CupertinoColors.white,
                          ),
                        ),
                      ),
                    ),
                  if (badge != null && badge!.isNotEmpty)
                    Positioned(
                      top: 7,
                      right: 7,
                      child: LiquidGlassSurface(
                        variant: LiquidGlassVariant.clear,
                        onDarkScene: true,
                        borderRadius: 999,
                        blurSigma: 8,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        child: Text(
                          badge!,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: CupertinoColors.white,
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    left: 7,
                    right: 7,
                    bottom: 7,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F1920).withValues(alpha: 0.52),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: CupertinoColors.white.withValues(alpha: 0.25),
                              width: 0.6,
                            ),
                          ),
                          child: Text(
                            'JM${album.albumId}',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w600,
                              color: CupertinoColors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                album.title.isEmpty ? 'JM${album.albumId}' : album.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  height: 1.25,
                  color: LiquidTokens.ink(context),
                ),
              ),
            ),
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 2),
              child: Text(
                album.author.isNotEmpty
                    ? album.author
                    : (album.category.isNotEmpty ? album.category : '精选漫画'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, color: LiquidTokens.muted(context)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SkeletonGridSliver extends StatelessWidget {
  final int count;
  const SkeletonGridSliver({super.key, this.count = 6});

  @override
  Widget build(BuildContext context) {
    final crossCount = MediaQuery.of(context).size.width >= 680 ? 3 : 2;
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossCount,
          mainAxisSpacing: 14,
          crossAxisSpacing: 12,
          childAspectRatio: 0.60,
        ),
        delegate: SliverChildBuilderDelegate(
          (ctx, _) => LiquidSolidCard(
            borderRadius: 22,
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: LiquidTokens.elevated(ctx),
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  height: 12,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: LiquidTokens.elevated(ctx),
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  height: 10,
                  width: 72,
                  decoration: BoxDecoration(
                    color: LiquidTokens.elevated(ctx),
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
              ],
            ),
          ),
          childCount: count,
        ),
      ),
    );
  }
}

class CommentCardTile extends StatelessWidget {
  final CommentItemModel comment;
  final VoidCallback? onReply;
  final VoidCallback? onOpenAlbum;
  const CommentCardTile({
    super.key,
    required this.comment,
    this.onReply,
    this.onOpenAlbum,
  });

  static const _avatarPalette = [
    Color(0xFF25414A),
    Color(0xFF355B63),
    Color(0xFF557B79),
    Color(0xFF3E6B66),
    Color(0xFF4A5E6D),
  ];

  @override
  Widget build(BuildContext context) {
    final c = comment;
    final name = c.username.isEmpty ? '匿名读者' : c.username;
    final avatarColor = _avatarPalette[name.hashCode.abs() % _avatarPalette.length];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: LiquidSolidCard(
        borderRadius: 22,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(color: avatarColor, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: Text(
                    name.substring(0, 1).toUpperCase(),
                    style: const TextStyle(color: CupertinoColors.white, fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (c.levelName.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: LiquidTokens.accentSoft(context),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                c.levelName,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: LiquidTokens.accentStrong(context),
                                ),
                              ),
                            ),
                          ],
                          if (c.spoiler) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFB5751C).withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                '剧透',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFB5751C),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (c.addtime.isNotEmpty)
                        Text(
                          c.addtime,
                          style: TextStyle(fontSize: 11, color: LiquidTokens.muted(context)),
                        ),
                    ],
                  ),
                ),
                if ((int.tryParse(c.likes) ?? 0) > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: LiquidTokens.elevated(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(CupertinoIcons.hand_thumbsup_fill, size: 11, color: LiquidTokens.muted(context)),
                        const SizedBox(width: 4),
                        Text(c.likes, style: TextStyle(fontSize: 11, color: LiquidTokens.muted(context))),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              c.content.isEmpty ? '（空评论）' : c.content,
              style: const TextStyle(fontSize: 14, height: 1.5),
            ),
            if (c.replies.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: LiquidTokens.elevated(context),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: c.replies
                      .map(
                        (r) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: '${r.username.isEmpty ? '匿名' : r.username}：',
                                  style: TextStyle(fontWeight: FontWeight.w600, color: LiquidTokens.accentStrong(context)),
                                ),
                                TextSpan(text: r.content),
                              ],
                            ),
                            style: const TextStyle(fontSize: 12.5, height: 1.45),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
            if (onReply != null || (onOpenAlbum != null && c.albumId.isNotEmpty)) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (onOpenAlbum != null && c.albumId.isNotEmpty)
                    GestureDetector(
                      onTap: onOpenAlbum,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                        decoration: BoxDecoration(
                          color: LiquidTokens.accentSoft(context),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '查看 JM${c.albumId} →',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: LiquidTokens.accentStrong(context),
                          ),
                        ),
                      ),
                    ),
                  if (onOpenAlbum != null && c.albumId.isNotEmpty && onReply != null)
                    const SizedBox(width: 8),
                  if (onReply != null)
                    GestureDetector(
                      onTap: onReply,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                        decoration: BoxDecoration(
                          color: LiquidTokens.elevated(context),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(CupertinoIcons.reply, size: 12, color: LiquidTokens.muted(context)),
                            const SizedBox(width: 4),
                            Text(
                              '回复',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: LiquidTokens.muted(context),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

Future<bool> showAccountLoginSheet(BuildContext context, WidgetRef ref) async {
  final result = await showCupertinoModalPopup<bool>(
    context: context,
    builder: (ctx) => _AccountLoginSheet(ref: ref),
  );
  return result == true;
}

class _AccountLoginSheet extends StatefulWidget {
  final WidgetRef ref;
  const _AccountLoginSheet({required this.ref});

  @override
  State<_AccountLoginSheet> createState() => _AccountLoginSheetState();
}

class _AccountLoginSheetState extends State<_AccountLoginSheet> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final u = _userCtrl.text.trim();
    final p = _passCtrl.text;
    if (u.isEmpty || p.isEmpty) {
      setState(() => _error = '请输入用户名和密码');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.ref.read(hybridControllerProvider.notifier).login(u, p);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = '$e'.replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = widget.ref.read(hybridControllerProvider).activeMode;
    final modeLabel = mode == ActiveMode.lanServer ? '局域网服务端登录' : '手机直连 APP 登录';

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(LiquidTokens.radiusSheet)),
        child: LiquidGlassSurface(
          variant: LiquidGlassVariant.tinted,
          borderRadius: LiquidTokens.radiusSheet,
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: LiquidTokens.separator(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.asset('assets/icon/app_icon.png', width: 40, height: 40),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('登录 JM 账号', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                          Text(
                            '当前通道：$modeLabel（支持云端收藏与签到）',
                            style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                CupertinoTextField(
                  controller: _userCtrl,
                  placeholder: '用户名或邮箱',
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  decoration: BoxDecoration(
                    color: LiquidTokens.solid(context),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: LiquidTokens.separator(context)),
                  ),
                ),
                const SizedBox(height: 10),
                CupertinoTextField(
                  controller: _passCtrl,
                  placeholder: '密码',
                  obscureText: true,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  decoration: BoxDecoration(
                    color: LiquidTokens.solid(context),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: LiquidTokens.separator(context)),
                  ),
                  onSubmitted: (_) => _submit(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    _error!,
                    style: const TextStyle(color: CupertinoColors.systemRed, fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: 18),
                LiquidSpringControl(
                  onTap: _submitting ? null : _submit,
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: LiquidTokens.scene(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    alignment: Alignment.center,
                    child: _submitting
                        ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                        : const Text(
                            '登录',
                            style: TextStyle(color: CupertinoColors.white, fontWeight: FontWeight.w600, fontSize: 15),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LiquidPaginationBar extends StatefulWidget {
  final int page;
  final int? pageCount;
  final bool hasNext;
  final ValueChanged<int> onPageChange;

  const LiquidPaginationBar({
    super.key,
    required this.page,
    this.pageCount,
    this.hasNext = true,
    required this.onPageChange,
  });

  @override
  State<LiquidPaginationBar> createState() => _LiquidPaginationBarState();
}

class _LiquidPaginationBarState extends State<LiquidPaginationBar> {
  late final TextEditingController _jumpCtrl;

  @override
  void initState() {
    super.initState();
    _jumpCtrl = TextEditingController(text: '${widget.page}');
  }

  @override
  void didUpdateWidget(covariant LiquidPaginationBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page != widget.page) {
      _jumpCtrl.text = '${widget.page}';
    }
  }

  @override
  void dispose() {
    _jumpCtrl.dispose();
    super.dispose();
  }

  void _submitJump() {
    final parsed = int.tryParse(_jumpCtrl.text.trim());
    if (parsed == null || parsed < 1) {
      _jumpCtrl.text = '${widget.page}';
      return;
    }
    final maxPage = widget.pageCount;
    final target = (maxPage != null && maxPage > 0) ? parsed.clamp(1, maxPage) : parsed;
    _jumpCtrl.text = '$target';
    FocusScope.of(context).unfocus();
    if (target != widget.page) {
      widget.onPageChange(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxPage = widget.pageCount;
    final canPrev = widget.page > 1;
    final canNext = (maxPage != null && maxPage > 0) ? widget.page < maxPage : widget.hasNext;
    final pageText = (maxPage != null && maxPage > 0) ? '${widget.page} / $maxPage' : '第 ${widget.page} 页';

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CupertinoButton(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                onPressed: canPrev ? () => widget.onPageChange(widget.page - 1) : null,
                child: const Text('上一页'),
              ),
              Text(
                pageText,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: LiquidTokens.ink(context),
                ),
              ),
              CupertinoButton(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                onPressed: canNext ? () => widget.onPageChange(widget.page + 1) : null,
                child: const Text('下一页'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 68,
                height: 34,
                child: CupertinoTextField(
                  controller: _jumpCtrl,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.go,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: LiquidTokens.ink(context)),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: LiquidTokens.solid(context),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: LiquidTokens.separator(context)),
                  ),
                  onSubmitted: (_) => _submitJump(),
                ),
              ),
              const SizedBox(width: 8),
              LiquidSpringControl(
                onTap: _submitJump,
                child: Container(
                  height: 34,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: LiquidTokens.accentSoft(context),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '跳转',
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
        ],
      ),
    );
  }
}
