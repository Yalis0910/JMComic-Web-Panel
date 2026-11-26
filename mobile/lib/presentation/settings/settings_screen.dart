import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../widgets/comic_widgets.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late TextEditingController _urlCtrl;
  late TextEditingController _tokenCtrl;
  bool _checkingIn = false;

  @override
  void initState() {
    super.initState();
    final s = ref.read(hybridControllerProvider).settings;
    _urlCtrl = TextEditingController(text: s.serverUrl);
    _tokenCtrl = TextEditingController(text: s.panelToken);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _tokenCtrl.dispose();
    super.dispose();
  }

  Future<void> _doCheckin() async {
    if (_checkingIn) return;
    setState(() => _checkingIn = true);
    try {
      final res = await ref.read(hybridControllerProvider.notifier).dailyCheckin();
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: Text(res.alreadyCheckedIn ? '今日已签到' : '签到成功'),
            content: Text(res.message),
            actions: [CupertinoDialogAction(child: const Text('好'), onPressed: () => Navigator.pop(ctx))],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: const Text('签到失败'),
            content: Text('$e'.replaceFirst('Exception: ', '')),
            actions: [CupertinoDialogAction(child: const Text('好'), onPressed: () => Navigator.pop(ctx))],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hybridControllerProvider);
    final ctrl = ref.read(hybridControllerProvider.notifier);
    final acc = state.account;

    return CupertinoPageScaffold(
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          const CupertinoSliverNavigationBar(largeTitle: Text('我的与设置')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // 账号卡片（支持直连 & 局域网双模式登录）
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: JmlisColors.card(context),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: JmlisColors.border(context)),
                    ),
                    child: acc.isLoggedIn
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: JmlisColors.accent(context),
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      acc.username.substring(0, 1).toUpperCase(),
                                      style: const TextStyle(
                                        color: CupertinoColors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text(
                                                acc.username,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                                              ),
                                            ),
                                            if (acc.levelName.isNotEmpty) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: JmlisColors.accentSoft(context),
                                                  borderRadius: BorderRadius.circular(999),
                                                ),
                                                child: Text(
                                                  'Lv.${acc.level} ${acc.levelName}',
                                                  style: TextStyle(
                                                    fontSize: 10.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: JmlisColors.accent(context),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '金币 ${acc.coin} · ${state.activeMode == ActiveMode.lanServer ? "局域网同步" : "直连会话"}',
                                          style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(context)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: CupertinoButton(
                                      color: JmlisColors.accent(context),
                                      borderRadius: BorderRadius.circular(12),
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                      onPressed: _checkingIn ? null : _doCheckin,
                                      child: Text(
                                        _checkingIn ? '签到中...' : '每日签到',
                                        style: const TextStyle(color: CupertinoColors.white, fontSize: 14, fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  CupertinoButton(
                                    color: JmlisColors.elevated(context),
                                    borderRadius: BorderRadius.circular(12),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    onPressed: () => ctrl.logout(),
                                    child: const Text(
                                      '退出登录',
                                      style: TextStyle(color: CupertinoColors.systemRed, fontSize: 14, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          )
                        : Row(
                            children: [
                              Container(
                                width: 46,
                                height: 46,
                                decoration: BoxDecoration(
                                  color: JmlisColors.accentSoft(context),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(CupertinoIcons.person_fill, color: JmlisColors.accent(context)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('未登录 JM 账号', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                    Text(
                                      '支持外出直连与局域网模式登录',
                                      style: TextStyle(fontSize: 12, color: JmlisColors.secondaryText(context)),
                                    ),
                                  ],
                                ),
                              ),
                              CupertinoButton(
                                color: JmlisColors.accent(context),
                                borderRadius: BorderRadius.circular(999),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                onPressed: () => showAccountLoginSheet(context, ref),
                                child: const Text(
                                  '登录',
                                  style: TextStyle(color: CupertinoColors.white, fontSize: 13.5, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                  ),
                  const SizedBox(height: 16),
                  CupertinoListSection.insetGrouped(
                    header: const Text('混合模式策略'),
                    footer: Text(
                      state.activeMode == ActiveMode.lanServer
                          ? '当前状态：已连接局域网服务端（支持进度同步、发表评论与服务器缓存）'
                          : '当前状态：手机直连禁漫（外出自动直连，支持登录、收藏与签到）',
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
                        title: Text(
                          '保存并探测连接',
                          style: TextStyle(color: JmlisColors.accent(context), fontWeight: FontWeight.w600),
                        ),
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
                    header: const Text('外观与关于'),
                    children: [
                      CupertinoListTile(
                        title: const Text('深色模式'),
                        trailing: CupertinoSwitch(
                          value: state.settings.darkMode,
                          onChanged: (v) => ctrl.updateSettings(state.settings.copyWith(darkMode: v)),
                        ),
                      ),
                      CupertinoListTile(
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.asset('assets/icon/app_icon.png', width: 28, height: 28),
                        ),
                        title: const Text('JMlis'),
                        subtitle: const Text('v2.0.0 · 跨平台双模式漫画阅读器'),
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
