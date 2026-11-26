import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/repositories/hybrid_controller.dart';
import 'presentation/explore/explore_screen.dart';
import 'presentation/home/home_screen.dart';
import 'presentation/library/library_screen.dart';
import 'presentation/settings/settings_screen.dart';
import 'presentation/widgets/comic_widgets.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: JmlisApp()));
}

class JmlisApp extends ConsumerWidget {
  const JmlisApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(hybridControllerProvider.select((s) => s.settings.darkMode));
    return CupertinoApp(
      title: 'JMlis',
      debugShowCheckedModeBanner: false,
      theme: CupertinoThemeData(
        brightness: dark ? Brightness.dark : Brightness.light,
        primaryColor: dark ? const Color(0xFF6366F1) : const Color(0xFF4F46E5),
        scaffoldBackgroundColor: dark ? const Color(0xFF090B12) : const Color(0xFFF4F5F9),
        barBackgroundColor: dark
            ? const Color(0xCC0F121D)
            : const Color(0xCCFFFFFF),
      ),
      home: const _RootTabScaffold(),
    );
  }
}

class _RootTabScaffold extends StatelessWidget {
  const _RootTabScaffold();

  @override
  Widget build(BuildContext context) {
    return CupertinoTabScaffold(
      tabBar: CupertinoTabBar(
        backgroundColor: JmlisColors.isDark(context)
            ? const Color(0xD90F121D)
            : const Color(0xD9FFFFFF),
        activeColor: JmlisColors.accent(context),
        items: const [
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.sparkles), label: '探索'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.search), label: '排行/搜索'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.collections), label: '书架'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.person_crop_circle), label: '我的'),
        ],
      ),
      tabBuilder: (ctx, index) {
        return switch (index) {
          0 => CupertinoTabView(builder: (_) => const HomeScreen()),
          1 => CupertinoTabView(builder: (_) => const ExploreScreen()),
          2 => CupertinoTabView(builder: (_) => const LibraryScreen()),
          _ => CupertinoTabView(builder: (_) => const SettingsScreen()),
        };
      },
    );
  }
}
