import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late TextEditingController _urlCtrl;
  late TextEditingController _tokenCtrl;

  @override
  void initState() {
    super.initState();
    final s = ref.read(hybridControllerProvider).settings;
    _urlCtrl = TextEditingController(text: s.serverUrl);
    _tokenCtrl = TextEditingController(text: s.panelToken);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hybridControllerProvider);
    final ctrl = ref.read(hybridControllerProvider.notifier);

    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          const CupertinoSliverNavigationBar(largeTitle: Text('设置')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  CupertinoListSection.insetGrouped(
                    header: const Text('混合模式策略'),
                    footer: Text(
                      state.activeMode == ActiveMode.lanServer
                          ? '当前状态：已连接局域网服务端（支持进度同步与服务器缓存）'
                          : '当前状态：手机直连禁漫（外出脱离局域网自动切换）',
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: SizedBox(
                          width: double.infinity,
                          child: CupertinoSlidingSegmentedControl<ConnectionPreference>(
                            groupValue: state.settings.preference,
                            children: const {
                              ConnectionPreference.auto: Text('自动切换'),
                              ConnectionPreference.lanOnly: Text('仅局域网'),
                              ConnectionPreference.directOnly: Text('仅直连'),
                            },
                            onValueChanged: (pref) {
                              if (pref != null) {
                                ctrl.updateSettings(state.settings.copyWith(preference: pref));
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                  CupertinoListSection.insetGrouped(
                    header: const Text('局域网服务端地址'),
                    children: [
                      CupertinoTextFormFieldRow(
                        prefix: const Text('地址'),
                        controller: _urlCtrl,
                        placeholder: 'http://192.168.1.10:8800',
                      ),
                      CupertinoTextFormFieldRow(
                        prefix: const Text('Token'),
                        controller: _tokenCtrl,
                        placeholder: '可选（开启 PIN 时填写）',
                      ),
                      CupertinoListTile(
                        title: const Text('保存并探测连接', style: TextStyle(color: CupertinoColors.activeBlue)),
                        onTap: () => ctrl.updateSettings(
                          state.settings.copyWith(
                            serverUrl: _urlCtrl.text.trim(),
                            panelToken: _tokenCtrl.text.trim(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  CupertinoListSection.insetGrouped(
                    header: const Text('外观'),
                    children: [
                      CupertinoListTile(
                        title: const Text('深色模式'),
                        trailing: CupertinoSwitch(
                          value: state.settings.darkMode,
                          onChanged: (v) => ctrl.updateSettings(state.settings.copyWith(darkMode: v)),
                        ),
                      ),
                    ],
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
