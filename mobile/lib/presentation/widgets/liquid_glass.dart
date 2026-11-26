import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/physics.dart';

import '../theme/liquid_glass_theme.dart';

enum LiquidGlassVariant { clear, tinted }

/// Liquid Glass operational surface with BackdropFilter + directional 1px specular rim.
class LiquidGlassSurface extends StatelessWidget {
  final Widget child;
  final LiquidGlassVariant variant;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final bool onDarkScene;
  final double? blurSigma;
  final double glintShiftX;

  const LiquidGlassSurface({
    super.key,
    required this.child,
    this.variant = LiquidGlassVariant.clear,
    this.borderRadius = LiquidTokens.radiusCard,
    this.padding,
    this.onDarkScene = false,
    this.blurSigma,
    this.glintShiftX = 0.0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidTokens.isDark(context) || onDarkScene;
    final sigma = blurSigma ?? (variant == LiquidGlassVariant.clear ? 14.0 : 20.0);
    final fillColor = variant == LiquidGlassVariant.tinted
        ? LiquidTokens.tintedGlassFill(context)
        : LiquidTokens.clearGlassFill(context, onDarkScene: onDarkScene);

    final effectiveBorderRadius = BorderRadius.circular(borderRadius);

    return Container(
      decoration: BoxDecoration(
        borderRadius: effectiveBorderRadius,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF132529).withValues(alpha: isDark ? 0.36 : 0.12),
            blurRadius: variant == LiquidGlassVariant.tinted ? 32 : 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: effectiveBorderRadius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
          child: CustomPaint(
            foregroundPainter: _LiquidRimPainter(
              radius: borderRadius,
              isDark: isDark,
              variant: variant,
              glintShiftX: glintShiftX,
            ),
            child: Container(
              padding: padding,
              color: fillColor,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class _LiquidRimPainter extends CustomPainter {
  final double radius;
  final bool isDark;
  final LiquidGlassVariant variant;
  final double glintShiftX;

  const _LiquidRimPainter({
    required this.radius,
    required this.isDark,
    required this.variant,
    required this.glintShiftX,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    final clampedRadius = radius.clamp(0.0, size.shortestSide / 2);
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect.deflate(0.5), Radius.circular(clampedRadius));

    // Directional 1px specular rim gradient (glint along top & lit edge)
    final topGlint = isDark
        ? CupertinoColors.white.withValues(alpha: variant == LiquidGlassVariant.clear ? 0.38 : 0.24)
        : CupertinoColors.white.withValues(alpha: variant == LiquidGlassVariant.clear ? 0.82 : 0.72);
    final sideRim = isDark
        ? CupertinoColors.white.withValues(alpha: 0.12)
        : CupertinoColors.white.withValues(alpha: 0.30);
    final bottomRim = isDark
        ? CupertinoColors.white.withValues(alpha: 0.06)
        : const Color(0xFF132529).withValues(alpha: 0.08);

    final rimPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..shader = LinearGradient(
        begin: Alignment(glintShiftX.clamp(-0.6, 0.6) - 0.15, -1.0),
        end: const Alignment(0.15, 1.0),
        colors: [topGlint, sideRim, bottomRim],
        stops: const [0.0, 0.45, 1.0],
      ).createShader(rect);

    canvas.drawRRect(rrect, rimPaint);

    // Subtle upper curvature sheen (keeps center flat & legible)
    final sheenRect = Rect.fromLTWH(0, 0, size.width, size.height * 0.35);
    final sheenPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          CupertinoColors.white.withValues(alpha: isDark ? 0.09 : 0.22),
          CupertinoColors.white.withValues(alpha: 0.0),
        ],
      ).createShader(sheenRect);

    canvas.save();
    canvas.clipRRect(rrect);
    canvas.drawRect(sheenRect, sheenPaint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LiquidRimPainter oldDelegate) =>
      oldDelegate.radius != radius ||
      oldDelegate.isDark != isDark ||
      oldDelegate.variant != variant ||
      oldDelegate.glintShiftX != glintShiftX;
}

/// Tactile press (110ms -> 0.96), drag-direction stretch, and 420ms spring release.
class LiquidSpringControl extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final bool enableDragStretch;

  const LiquidSpringControl({
    super.key,
    required this.child,
    this.onTap,
    this.enableDragStretch = false,
  });

  @override
  State<LiquidSpringControl> createState() => _LiquidSpringControlState();
}

class _LiquidSpringControlState extends State<LiquidSpringControl>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  double _scaleX = 1.0;
  double _scaleY = 1.0;
  Offset _dragOffset = Offset.zero;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController.unbounded(vsync: this, value: 1.0)
      ..addListener(() {
        if (!_pressed && mounted) {
          setState(() {
            _scaleX = _controller.value;
            _scaleY = _controller.value;
          });
        }
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDown() {
    _controller.stop();
    setState(() {
      _pressed = true;
      _scaleX = 0.96;
      _scaleY = 0.96;
      _dragOffset = Offset.zero;
    });
  }

  void _onRelease() {
    if (!_pressed) return;
    setState(() {
      _pressed = false;
      _dragOffset = Offset.zero;
    });
    final avgScale = (_scaleX + _scaleY) * 0.5;
    final sim = SpringSimulation(LiquidTokens.springPhysics, avgScale, 1.0, 0.0);
    _controller.animateWith(sim);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _onDown(),
      onTapUp: (_) {
        _onRelease();
        widget.onTap?.call();
      },
      onTapCancel: _onRelease,
      onPanUpdate: widget.enableDragStretch
          ? (details) {
              setState(() {
                _dragOffset += details.delta;
                final stretchX = (_dragOffset.dx.abs() / 360).clamp(0.0, 0.04);
                final stretchY = (_dragOffset.dy.abs() / 360).clamp(0.0, 0.03);
                _scaleX = 0.96 + stretchX - stretchY * 0.3;
                _scaleY = 0.96 + stretchY - stretchX * 0.3;
              });
            }
          : null,
      onPanEnd: widget.enableDragStretch ? (_) => _onRelease() : null,
      onPanCancel: widget.enableDragStretch ? _onRelease : null,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: LiquidTokens.pressDuration,
        curve: Curves.easeOut,
        child: Transform.translate(
          offset: Offset(
            (_dragOffset.dx * 0.08).clamp(-5.0, 5.0),
            (_dragOffset.dy * 0.06).clamp(-3.0, 3.0),
          ),
          child: Transform.scale(
            scaleX: _pressed ? _scaleX / 0.96 : _scaleX,
            scaleY: _pressed ? _scaleY / 0.96 : _scaleY,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// Level 3 Solid Content Card (warm paper #FCFCFA / dark #162328, 24px radius).
class LiquidSolidCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final Color? color;

  const LiquidSolidCard({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius = LiquidTokens.radiusCard,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidTokens.isDark(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? LiquidTokens.solid(context),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: LiquidTokens.separator(context)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF132529).withValues(alpha: isDark ? 0.36 : 0.06),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Floating capsule segmented control with spring-sliding glass thumb.
class LiquidSegmentedPill<T> extends StatelessWidget {
  final List<({T value, String label})> items;
  final T value;
  final ValueChanged<T> onChanged;
  final bool onDarkScene;

  const LiquidSegmentedPill({
    super.key,
    required this.items,
    required this.value,
    required this.onChanged,
    this.onDarkScene = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidTokens.isDark(context) || onDarkScene;
    final selectedIdx = items.indexWhere((e) => e.value == value).clamp(0, items.length - 1);

    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: onDarkScene
            ? CupertinoColors.white.withValues(alpha: 0.14)
            : (isDark
                ? const Color(0xFF1D2D33).withValues(alpha: 0.85)
                : const Color(0xFF202929).withValues(alpha: 0.06)),
        borderRadius: BorderRadius.circular(LiquidTokens.radiusPill),
        border: Border.all(
          color: onDarkScene
              ? CupertinoColors.white.withValues(alpha: 0.20)
              : LiquidTokens.separator(context),
        ),
      ),
      child: LayoutBuilder(
        builder: (ctx, constraints) {
          final itemWidth = constraints.maxWidth / items.length;
          return Stack(
            children: [
              AnimatedPositioned(
                duration: LiquidTokens.releaseDuration,
                curve: const Cubic(0.26, 1.35, 0.52, 1.0),
                left: selectedIdx * itemWidth,
                top: 0,
                bottom: 0,
                width: itemWidth,
                child: Container(
                  decoration: BoxDecoration(
                    color: onDarkScene
                        ? CupertinoColors.white.withValues(alpha: 0.24)
                        : (isDark ? const Color(0xFF25414A) : CupertinoColors.white),
                    borderRadius: BorderRadius.circular(LiquidTokens.radiusPill),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF132529).withValues(alpha: isDark ? 0.28 : 0.09),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  for (final item in items)
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => onChanged(item.value),
                        child: Center(
                          child: Text(
                            item.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: item.value == value ? FontWeight.w600 : FontWeight.w500,
                              color: onDarkScene
                                  ? (item.value == value
                                      ? CupertinoColors.white
                                      : CupertinoColors.white.withValues(alpha: 0.72))
                                  : (item.value == value
                                      ? LiquidTokens.ink(ctx)
                                      : LiquidTokens.muted(ctx)),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Floating Liquid Glass Capsule Bottom Navigation Bar with spring-sliding active pill.
class LiquidCapsuleNavBar extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<({IconData icon, IconData activeIcon, String label})> items;

  const LiquidCapsuleNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  State<LiquidCapsuleNavBar> createState() => _LiquidCapsuleNavBarState();
}

class _LiquidCapsuleNavBarState extends State<LiquidCapsuleNavBar> {
  double _glintShift = 0.0;

  @override
  Widget build(BuildContext context) {
    final isDark = LiquidTokens.isDark(context);
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottomInset > 0 ? bottomInset + 6 : 14),
      child: LiquidSpringControl(
        enableDragStretch: true,
        child: LiquidGlassSurface(
          variant: LiquidGlassVariant.clear,
          borderRadius: LiquidTokens.radiusPill,
          glintShiftX: _glintShift,
          padding: const EdgeInsets.all(5),
          child: SizedBox(
            height: 54,
            child: LayoutBuilder(
              builder: (ctx, constraints) {
                final tabWidth = constraints.maxWidth / widget.items.length;
                return GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onHorizontalDragUpdate: (details) {
                    final localX = details.localPosition.dx.clamp(0.0, constraints.maxWidth - 1);
                    setState(() => _glintShift = (localX / constraints.maxWidth) * 2 - 1);
                    final target = (localX / tabWidth).floor().clamp(0, widget.items.length - 1);
                    if (target != widget.currentIndex) {
                      widget.onTap(target);
                    }
                  },
                  onHorizontalDragEnd: (_) => setState(() => _glintShift = 0.0),
                  child: Stack(
                    children: [
                      AnimatedPositioned(
                        duration: LiquidTokens.releaseDuration,
                        curve: const Cubic(0.26, 1.32, 0.52, 1.0),
                        left: widget.currentIndex * tabWidth,
                        top: 0,
                        bottom: 0,
                        width: tabWidth,
                        child: Container(
                          decoration: BoxDecoration(
                            color: isDark
                                ? const Color(0xFF25414A).withValues(alpha: 0.92)
                                : CupertinoColors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(LiquidTokens.radiusPill),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF132529).withValues(alpha: isDark ? 0.34 : 0.11),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          for (int i = 0; i < widget.items.length; i++)
                            Expanded(
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () => widget.onTap(i),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      i == widget.currentIndex
                                          ? widget.items[i].activeIcon
                                          : widget.items[i].icon,
                                      size: 20,
                                      color: i == widget.currentIndex
                                          ? (isDark ? LiquidTokens.darkIce : LiquidTokens.lightScene)
                                          : LiquidTokens.muted(ctx),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      widget.items[i].label,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: i == widget.currentIndex ? FontWeight.w600 : FontWeight.w500,
                                        color: i == widget.currentIndex
                                            ? LiquidTokens.ink(ctx)
                                            : LiquidTokens.muted(ctx),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
