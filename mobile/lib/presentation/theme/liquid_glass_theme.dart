import 'package:flutter/cupertino.dart';

/// StyleKit Liquid Glass design tokens for JMlis Mobile.
class LiquidTokens {
  LiquidTokens._();

  // Light Palette (Warm Paper & Deep Sea)
  static const Color lightPaper = Color(0xFFF3F2ED);
  static const Color lightSolid = Color(0xFFFCFCFA);
  static const Color lightElevated = Color(0xFFE9ECE8);
  static const Color lightInk = Color(0xFF202929);
  static const Color lightMuted = Color(0xFF4C5D57);
  static const Color lightScene = Color(0xFF25414A);
  static const Color lightSceneDeep = Color(0xFF172B32);
  static const Color lightSaltMist = Color(0xFFE4EFEB);
  static const Color lightIce = Color(0xFFC7E4E5);
  static const Color lightFocus = Color(0xFF557B79);

  // Dark Palette (Deep Sea Night)
  static const Color darkCanvas = Color(0xFF0E1619);
  static const Color darkSolid = Color(0xFF162328);
  static const Color darkElevated = Color(0xFF1D2D33);
  static const Color darkInk = Color(0xFFEEF4F2);
  static const Color darkMuted = Color(0xFF9AB0AA);
  static const Color darkScene = Color(0xFF1C343D);
  static const Color darkSceneDeep = Color(0xFF0B1418);
  static const Color darkIce = Color(0xFFC7E4E5);
  static const Color darkFocus = Color(0xFF7EB3B0);

  // Semantic
  static const Color successLight = Color(0xFF2A7B62);
  static const Color successDark = Color(0xFF45B692);
  static const Color dangerLight = Color(0xFFC53D43);
  static const Color dangerDark = Color(0xFFE56B6F);

  // Radii & Spacing
  static const double radiusPill = 999.0;
  static const double radiusCard = 24.0;
  static const double radiusCover = 16.0;
  static const double radiusSheet = 28.0;

  // Motion
  static const Duration pressDuration = Duration(milliseconds: 110);
  static const Duration releaseDuration = Duration(milliseconds: 420);
  static const SpringDescription springPhysics = SpringDescription(
    mass: 1.0,
    stiffness: 320.0,
    damping: 20.0,
  );

  static bool isDark(BuildContext context) =>
      CupertinoTheme.brightnessOf(context) == Brightness.dark;

  static Color canvas(BuildContext context) =>
      isDark(context) ? darkCanvas : lightPaper;

  static Color solid(BuildContext context) =>
      isDark(context) ? darkSolid : lightSolid;

  static Color elevated(BuildContext context) =>
      isDark(context) ? darkElevated : lightElevated;

  static Color ink(BuildContext context) =>
      isDark(context) ? darkInk : lightInk;

  static Color muted(BuildContext context) =>
      isDark(context) ? darkMuted : lightMuted;

  static Color scene(BuildContext context) =>
      isDark(context) ? darkScene : lightScene;

  static Color accent(BuildContext context) =>
      isDark(context) ? darkFocus : lightFocus;

  static Color accentStrong(BuildContext context) =>
      isDark(context) ? darkIce : lightScene;

  static Color accentSoft(BuildContext context) => isDark(context)
      ? darkIce.withValues(alpha: 0.14)
      : lightFocus.withValues(alpha: 0.14);

  static Color separator(BuildContext context) => isDark(context)
      ? const Color(0x18E4EFEB)
      : const Color(0x17202929);

  static Color clearGlassFill(BuildContext context, {bool onDarkScene = false}) {
    if (onDarkScene) {
      return const Color(0xFF0F1920).withValues(alpha: 0.28);
    }
    return isDark(context)
        ? const Color(0xFF16242A).withValues(alpha: 0.56)
        : const Color(0xFFF7F8F5).withValues(alpha: 0.58);
  }

  static Color tintedGlassFill(BuildContext context) => isDark(context)
      ? const Color(0xFF111D25).withValues(alpha: 0.88)
      : const Color(0xFFEFF5F2).withValues(alpha: 0.88);
}
