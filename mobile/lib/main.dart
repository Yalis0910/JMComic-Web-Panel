import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/repositories/hybrid_controller.dart';
import 'presentation/explore/explore_screen.dart';
import 'presentation/home/home_screen.dart';
import 'presentation/settings/settings_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: JmHybridApp()));
}

class JmHybridApp extends ConsumerWidget {
  const JmHybridApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(hybridControllerProvider.select((s) => s.settings.darkMode));
    return CupertinoApp(
      title: 'JMComic',
      debugShowCheckedModeBanner: false,
      theme: CupertinoThemeData(
        brightness: dark ? Brightness.dark : Brightness.light,
        primaryColor: CupertinoColors.activeBlue,
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
        items: const [
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.compass), label: '探索'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.search), label: '排行/搜索'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.settings), label: '设置'),
        ],
      ),
      tabBuilder: (ctx, index) {
        return switch (index) {
          0 => const CupertinoTabView(builder: (_) => HomeScreen()),
          1 => const CupertinoTabView(builder: (_) => ExploreScreen()),
          _ => const CupertinoTabView(builder: (_) => SettingsScreen()),
        };
      },
    );
  }
}
