import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/network/app_proxy.dart';
import 'data/repositories/hybrid_controller.dart';
import 'data/sources/comic_data_source.dart';
import 'presentation/explore/explore_screen.dart';
import 'presentation/home/home_screen.dart';
import 'presentation/library/library_screen.dart';
import 'presentation/settings/settings_screen.dart';
import 'presentation/theme/liquid_glass_theme.dart';
import 'presentation/widgets/liquid_glass.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppProxyManager.instance.loadFromPrefs();
  runApp(const ProviderScope(child: JmlisApp()));
}

class JmlisApp extends ConsumerWidget {
  const JmlisApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(hybridControllerProvider.select((s) => s.settings.themeMode));
    final platformDark = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    final dark = switch (themeMode) {
      AppThemeMode.dark => true,
      AppThemeMode.light => false,
      AppThemeMode.system => platformDark,
    };
    return CupertinoApp(
      title: 'JMlis',
      debugShowCheckedModeBanner: false,
      theme: CupertinoThemeData(
        brightness: dark ? Brightness.dark : Brightness.light,
        primaryColor: dark ? LiquidTokens.darkIce : LiquidTokens.lightScene,
        scaffoldBackgroundColor: dark ? LiquidTokens.darkCanvas : LiquidTokens.lightPaper,
        barBackgroundColor: dark
            ? const Color(0xCC111D25)
            : const Color(0xCCE4EFEB),
      ),
      home: const _RootTabScaffold(),
    );
  }
}

class _RootTabScaffold extends StatefulWidget {
  const _RootTabScaffold();

  @override
  State<_RootTabScaffold> createState() => _RootTabScaffoldState();
}

class _RootTabScaffoldState extends State<_RootTabScaffold> {
  int _index = 0;

  static const _tabs = [
    (icon: CupertinoIcons.sparkles, activeIcon: CupertinoIcons.sparkles, label: '探索'),
    (icon: CupertinoIcons.search, activeIcon: CupertinoIcons.search, label: '排行'),
    (icon: CupertinoIcons.collections, activeIcon: CupertinoIcons.collections_solid, label: '书架'),
    (icon: CupertinoIcons.person_crop_circle, activeIcon: CupertinoIcons.person_crop_circle_fill, label: '我的'),
  ];

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: Stack(
        children: [
          for (int i = 0; i < 4; i++)
            TickerMode(
              enabled: i == _index,
              child: Offstage(
                offstage: i != _index,
                child: switch (i) {
                  0 => CupertinoTabView(
                      key: const ValueKey('tab_0'),
                      builder: (_) => HomeScreen(
                        onOpenExplore: () => setState(() => _index = 1),
                        onOpenSettings: () => setState(() => _index = 3),
                      ),
                    ),
                  1 => CupertinoTabView(
                      key: const ValueKey('tab_1'),
                      builder: (_) => const ExploreScreen(),
                    ),
                  2 => CupertinoTabView(
                      key: const ValueKey('tab_2'),
                      builder: (_) => const LibraryScreen(),
                    ),
                  _ => CupertinoTabView(
                      key: const ValueKey('tab_3'),
                      builder: (_) => const SettingsScreen(),
                    ),
                },
              ),
            ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: LiquidCapsuleNavBar(
              currentIndex: _index,
              items: _tabs,
              onTap: (next) => setState(() => _index = next),
            ),
          ),
        ],
      ),
    );
  }
}
