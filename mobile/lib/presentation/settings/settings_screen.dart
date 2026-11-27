import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_proxy.dart';
import '../../data/models/comic_models.dart';
import '../../data/repositories/hybrid_controller.dart';
import '../../data/sources/comic_data_source.dart';
import '../theme/liquid_glass_theme.dart';
import '../widgets/comic_widgets.dart';
import '../widgets/liquid_glass.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late TextEditingController _urlCtrl;
  late TextEditingController _tokenCtrl;
  late TextEditingController _proxyUrlCtrl;
  late TextEditingController _proxyUserCtrl;
  late TextEditingController _proxyPassCtrl;
  bool _obscureProxyPass = true;
  bool _testingProxy = false;
  bool _checkingIn = false;

  @override
  void initState() {
    super.initState();
    final s = ref.read(hybridControllerProvider).settings;
    _urlCtrl = TextEditingController(text: s.serverUrl);
    _tokenCtrl = TextEditingController(text: s.panelToken);
    _proxyUrlCtrl = TextEditingController(text: s.proxyUrl);
    _proxyUserCtrl = TextEditingController(text: s.proxyUsername);
    _proxyPassCtrl = TextEditingController(text: s.proxyPassword);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _tokenCtrl.dispose();
    _proxyUrlCtrl.dispose();
    _proxyUserCtrl.dispose();
    _proxyPassCtrl.dispose();
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

  Future<void> _openDailyCalendar() async {
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => _DailyCalendarSheet(
        onCheckin: () async {
          final res = await ref.read(hybridControllerProvider.notifier).dailyCheckin();
          return res;
        },
        loadDaily: () => ref.read(hybridControllerProvider.notifier).getDailyInfo(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hybridControllerProvider);
    final ctrl = ref.read(hybridControllerProvider.notifier);
    final acc = state.account;

    ref.listen<HybridSettings>(
      hybridControllerProvider.select((s) => s.settings),
      (prev, next) {
        if (prev?.serverUrl != next.serverUrl && _urlCtrl.text.isEmpty) {
          _urlCtrl.text = next.serverUrl;
        }
        if (prev?.panelToken != next.panelToken && _tokenCtrl.text.isEmpty) {
          _tokenCtrl.text = next.panelToken;
        }
        if (prev?.proxyUrl != next.proxyUrl && _proxyUrlCtrl.text.isEmpty) {
          _proxyUrlCtrl.text = next.proxyUrl;
        }
        if (prev?.proxyUsername != next.proxyUsername && _proxyUserCtrl.text.isEmpty) {
          _proxyUserCtrl.text = next.proxyUsername;
        }
        if (prev?.proxyPassword != next.proxyPassword && _proxyPassCtrl.text.isEmpty) {
          _proxyPassCtrl.text = next.proxyPassword;
        }
      },
    );

    return CupertinoPageScaffold(
      backgroundColor: LiquidTokens.canvas(context),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            largeTitle: const Text('我的与设置'),
            backgroundColor: LiquidTokens.tintedGlassFill(context),
            border: Border(bottom: BorderSide(color: LiquidTokens.separator(context), width: 0.5)),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 112),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 账号卡片
                  LiquidSolidCard(
                    padding: const EdgeInsets.all(18),
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
                                      color: LiquidTokens.scene(context),
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
                                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                                              ),
                                            ),
                                            if (acc.levelName.isNotEmpty) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: LiquidTokens.accentSoft(context),
                                                  borderRadius: BorderRadius.circular(999),
                                                ),
                                                child: Text(
                                                  'Lv.${acc.level} ${acc.levelName}',
                                                  style: TextStyle(
                                                    fontSize: 10.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: LiquidTokens.accentStrong(context),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '金币 ${acc.coin} · ${state.activeMode == ActiveMode.lanServer ? "局域网同步" : "直连会话"}',
                                          style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: LiquidSpringControl(
                                      onTap: _checkingIn ? null : _doCheckin,
                                      child: Container(
                                        height: 44,
                                        decoration: BoxDecoration(
                                          color: LiquidTokens.scene(context),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          _checkingIn ? '签到中...' : '每日签到',
                                          style: const TextStyle(
                                            color: CupertinoColors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  LiquidSpringControl(
                                    onTap: _openDailyCalendar,
                                    child: Container(
                                      height: 44,
                                      padding: const EdgeInsets.symmetric(horizontal: 14),
                                      decoration: BoxDecoration(
                                        color: LiquidTokens.elevated(context),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        '签到日历',
                                        style: TextStyle(
                                          color: LiquidTokens.accentStrong(context),
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  LiquidSpringControl(
                                    onTap: () => ctrl.logout(),
                                    child: Container(
                                      height: 44,
                                      padding: const EdgeInsets.symmetric(horizontal: 18),
                                      decoration: BoxDecoration(
                                        color: LiquidTokens.elevated(context),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      alignment: Alignment.center,
                                      child: const Text(
                                        '退出登录',
                                        style: TextStyle(
                                          color: CupertinoColors.systemRed,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
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
                                  color: LiquidTokens.accentSoft(context),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  CupertinoIcons.person_fill,
                                  color: LiquidTokens.accentStrong(context),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('未登录 JM 账号', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                                    Text(
                                      '支持外出直连与局域网模式登录',
                                      style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                                    ),
                                  ],
                                ),
                              ),
                              LiquidSpringControl(
                                onTap: () => showAccountLoginSheet(context, ref),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: LiquidTokens.scene(context),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    '登录',
                                    style: TextStyle(
                                      color: CupertinoColors.white,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 8),
                    child: Text(
                      '混合模式策略',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: LiquidTokens.muted(context)),
                    ),
                  ),
                  LiquidSolidCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        LiquidSegmentedPill<ConnectionPreference>(
                          value: state.settings.preference,
                          items: const [
                            (value: ConnectionPreference.auto, label: '自动切换'),
                            (value: ConnectionPreference.lanOnly, label: '仅局域网'),
                            (value: ConnectionPreference.directOnly, label: '仅直连'),
                          ],
                          onChanged: (pref) => ctrl.updateSettings(state.settings.copyWith(preference: pref)),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          state.activeMode == ActiveMode.lanServer
                              ? '当前状态：已连接局域网服务端（支持进度同步、发表评论与服务器缓存）'
                              : '当前状态：手机直连禁漫（外出自动直连，支持登录、收藏与签到）',
                          style: TextStyle(fontSize: 12, height: 1.45, color: LiquidTokens.muted(context)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 8),
                    child: Text(
                      '局域网服务端地址',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: LiquidTokens.muted(context)),
                    ),
                  ),
                  LiquidSolidCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        CupertinoTextFormFieldRow(
                          prefix: const Text('地址'),
                          controller: _urlCtrl,
                          placeholder: 'http://192.168.1.10:8800',
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        CupertinoTextFormFieldRow(
                          prefix: const Text('Token'),
                          controller: _tokenCtrl,
                          placeholder: '可选（开启 PIN 时填写）',
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        CupertinoListTile(
                          title: Text(
                            state.probing ? '正在探测连接...' : '保存并探测连接',
                            style: TextStyle(
                              color: LiquidTokens.accentStrong(context),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          onTap: () async {
                            await ctrl.updateSettings(
                              state.settings.copyWith(
                                serverUrl: _urlCtrl.text.trim(),
                                panelToken: _tokenCtrl.text.trim(),
                              ),
                            );
                            final probe = await ctrl.probeAndSwitch();
                            if (!mounted) return;
                            showCupertinoDialog(
                              context: this.context,
                              builder: (ctx) => CupertinoAlertDialog(
                                title: Text(probe.lanReachable ? '连接成功' : '探测结果'),
                                content: Text(probe.message),
                                actions: [
                                  CupertinoDialogAction(
                                    child: const Text('好'),
                                    onPressed: () => Navigator.pop(ctx),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 8),
                    child: Text(
                      'App 网络代理（直连模式）',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: LiquidTokens.muted(context)),
                    ),
                  ),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _proxyUrlCtrl,
                    builder: (context, proxyVal, _) {
                      final parsedProxy = parseProxyConfig(
                        proxyVal.text,
                        username: _proxyUserCtrl.text,
                        password: _proxyPassCtrl.text,
                      );
                      final proxyReady = parsedProxy != null;
                      final switchChecked = state.settings.proxyEnabled && proxyReady;
                      return LiquidSolidCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            CupertinoListTile(
                              title: const Text('启用 App 代理'),
                              subtitle: Text(
                                state.settings.proxyEnabled && parsedProxy != null
                                    ? '已开启：${parsedProxy.scheme}://${parsedProxy.host}:${parsedProxy.port}（内网自动直连）'
                                    : proxyReady
                                        ? '已关闭（当前直连，已填代理配置已保留）'
                                        : '请先填写完整代理地址与端口后再开启',
                              ),
                              onTap: proxyReady
                                  ? null
                                  : () {
                                      showCupertinoDialog(
                                        context: context,
                                        builder: (ctx) => CupertinoAlertDialog(
                                          title: const Text('未填写完整配置'),
                                          content: const Text(
                                            '请先填写完整有效的代理地址与端口（如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7891）后再开启代理开关。',
                                          ),
                                          actions: [
                                            CupertinoDialogAction(
                                              child: const Text('好'),
                                              onPressed: () => Navigator.pop(ctx),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                              trailing: CupertinoSwitch(
                                value: switchChecked,
                                onChanged: !proxyReady
                                    ? null
                                    : (nextEnabled) async {
                                        await ctrl.updateSettings(
                                          state.settings.copyWith(
                                            proxyEnabled: nextEnabled,
                                            proxyUrl: _proxyUrlCtrl.text.trim(),
                                            proxyUsername: _proxyUserCtrl.text.trim(),
                                            proxyPassword: _proxyPassCtrl.text,
                                          ),
                                        );
                                      },
                              ),
                            ),
                            Container(height: 0.7, color: LiquidTokens.separator(context)),
                            CupertinoTextFormFieldRow(
                              prefix: const Text('代理地址'),
                              controller: _proxyUrlCtrl,
                              placeholder: 'http://127.0.0.1:7890',
                              keyboardType: TextInputType.url,
                              autocorrect: false,
                            ),
                            Container(height: 0.7, color: LiquidTokens.separator(context)),
                            CupertinoTextFormFieldRow(
                              prefix: const Text('用户名'),
                              controller: _proxyUserCtrl,
                              placeholder: '可选（无认证留空）',
                              autocorrect: false,
                            ),
                            Container(height: 0.7, color: LiquidTokens.separator(context)),
                            Row(
                              children: [
                                Expanded(
                                  child: CupertinoTextFormFieldRow(
                                    prefix: const Text('密码'),
                                    controller: _proxyPassCtrl,
                                    obscureText: _obscureProxyPass,
                                    placeholder: '可选（自动处理特殊字符）',
                                    autocorrect: false,
                                  ),
                                ),
                                CupertinoButton(
                                  padding: const EdgeInsets.only(right: 12),
                                  minimumSize: const Size(32, 32),
                                  onPressed: () => setState(() => _obscureProxyPass = !_obscureProxyPass),
                                  child: Icon(
                                    _obscureProxyPass ? CupertinoIcons.eye : CupertinoIcons.eye_slash,
                                    size: 18,
                                    color: LiquidTokens.muted(context),
                                  ),
                                ),
                              ],
                            ),
                            Container(height: 0.7, color: LiquidTokens.separator(context)),
                            CupertinoListTile(
                              title: Text(
                                _testingProxy ? '正在测试代理连通性...' : '测试代理连通',
                                style: TextStyle(
                                  color: proxyReady
                                      ? LiquidTokens.accentStrong(context)
                                      : LiquidTokens.muted(context),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              trailing: _testingProxy ? const CupertinoActivityIndicator() : null,
                              onTap: _testingProxy
                                  ? null
                                  : () async {
                                      final parsed = parseProxyConfig(
                                        _proxyUrlCtrl.text,
                                        username: _proxyUserCtrl.text,
                                        password: _proxyPassCtrl.text,
                                      );
                                      if (parsed == null) {
                                        showCupertinoDialog(
                                          context: this.context,
                                          builder: (ctx) => CupertinoAlertDialog(
                                            title: const Text('无法测试'),
                                            content: const Text(
                                              '请先填写完整有效的代理地址与端口（如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7891）后再测试。',
                                            ),
                                            actions: [
                                              CupertinoDialogAction(
                                                child: const Text('好'),
                                                onPressed: () => Navigator.pop(ctx),
                                              ),
                                            ],
                                          ),
                                        );
                                        return;
                                      }
                                      setState(() => _testingProxy = true);
                                      final res = await AppProxyManager.instance.probeProxy(parsed);
                                      if (!mounted) return;
                                      setState(() => _testingProxy = false);
                                      showCupertinoDialog(
                                        context: this.context,
                                        builder: (ctx) => CupertinoAlertDialog(
                                          title: Text(res.reachable ? '测试通过' : '连通失败'),
                                          content: Text(res.message),
                                          actions: [
                                            CupertinoDialogAction(
                                              child: const Text('好'),
                                              onPressed: () => Navigator.pop(ctx),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                            ),
                            Container(height: 0.7, color: LiquidTokens.separator(context)),
                            CupertinoListTile(
                              title: Text(
                                '保存代理配置',
                                style: TextStyle(
                                  color: LiquidTokens.accentStrong(context),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              onTap: () async {
                                final rawUrl = _proxyUrlCtrl.text.trim();
                                final parsed = parseProxyConfig(
                                  rawUrl,
                                  username: _proxyUserCtrl.text,
                                  password: _proxyPassCtrl.text,
                                );
                                if (rawUrl.isNotEmpty && parsed == null) {
                                  showCupertinoDialog(
                                    context: context,
                                    builder: (ctx) => CupertinoAlertDialog(
                                      title: const Text('代理地址格式无效'),
                                      content: const Text(
                                        '请使用 http://IP:端口 或 socks5://IP:端口（需包含 1-65535 有效端口），或 http://用户名:密码@代理IP:端口。',
                                      ),
                                      actions: [
                                        CupertinoDialogAction(
                                          child: const Text('好'),
                                          onPressed: () => Navigator.pop(ctx),
                                        ),
                                      ],
                                    ),
                                  );
                                  return;
                                }
                                final ParsedProxyConfig? activeProxy =
                                    state.settings.proxyEnabled ? parsed : null;
                                await ctrl.updateSettings(
                                  state.settings.copyWith(
                                    proxyEnabled: activeProxy != null,
                                    proxyUrl: rawUrl,
                                    proxyUsername: _proxyUserCtrl.text.trim(),
                                    proxyPassword: _proxyPassCtrl.text,
                                  ),
                                );
                                if (!mounted) return;
                                showCupertinoDialog(
                                  context: this.context,
                                  builder: (ctx) => CupertinoAlertDialog(
                                    title: const Text('代理配置已保存'),
                                    content: Text(
                                      activeProxy != null
                                          ? '已启用代理：${activeProxy.scheme}://${activeProxy.host}:${activeProxy.port}'
                                          : '配置已保存；当前代理开关为关闭状态（仍走直连）。',
                                    ),
                                    actions: [
                                      CupertinoDialogAction(
                                        child: const Text('好'),
                                        onPressed: () => Navigator.pop(ctx),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: Text(
                      '支持 HTTP（含 Basic/Digest 账密认证）与 SOCKS5 代理，也支持直接粘贴 http://用户名:密码@代理IP:端口；关闭开关将恢复直连并保留配置。LAN 服务端与内网地址自动直连。',
                      style: TextStyle(fontSize: 11.5, height: 1.45, color: LiquidTokens.muted(context)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 8),
                    child: Text(
                      '外观与关于',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: LiquidTokens.muted(context)),
                    ),
                  ),
                  LiquidSolidCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('外观主题', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                              const SizedBox(height: 8),
                              LiquidSegmentedPill<AppThemeMode>(
                                value: state.settings.themeMode,
                                items: const [
                                  (value: AppThemeMode.system, label: '跟随系统'),
                                  (value: AppThemeMode.light, label: '浅色'),
                                  (value: AppThemeMode.dark, label: '深色'),
                                ],
                                onChanged: (m) => ctrl.updateSettings(state.settings.copyWith(themeMode: m)),
                              ),
                            ],
                          ),
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('封面隐私模式', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                              const SizedBox(height: 2),
                              Text(
                                '模糊模式支持点击封面临时预览',
                                style: TextStyle(fontSize: 12, color: LiquidTokens.muted(context)),
                              ),
                              const SizedBox(height: 8),
                              LiquidSegmentedPill<CoverPrivacyMode>(
                                value: state.settings.coverPrivacyMode,
                                items: const [
                                  (value: CoverPrivacyMode.show, label: '显示'),
                                  (value: CoverPrivacyMode.blur, label: '模糊'),
                                  (value: CoverPrivacyMode.hide, label: '隐藏'),
                                ],
                                onChanged: (p) => ctrl.updateSettings(state.settings.copyWith(coverPrivacyMode: p)),
                              ),
                            ],
                          ),
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('默认阅读模式', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                              const SizedBox(height: 8),
                              LiquidSegmentedPill<MobileReaderMode>(
                                value: state.settings.readerMode,
                                items: const [
                                  (value: MobileReaderMode.vertical, label: '条漫'),
                                  (value: MobileReaderMode.singleLtr, label: '左→右'),
                                  (value: MobileReaderMode.singleRtl, label: '日漫'),
                                  (value: MobileReaderMode.doublePage, label: '双页'),
                                ],
                                onChanged: (rm) => ctrl.updateSettings(state.settings.copyWith(readerMode: rm)),
                              ),
                            ],
                          ),
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        CupertinoListTile(
                          title: const Text('阅读器预加载页数'),
                          subtitle: const Text('提前下载并解密后续页面，减少翻页等待'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CupertinoButton(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                onPressed: state.settings.preloadCount <= 1
                                    ? null
                                    : () => ctrl.updateSettings(
                                          state.settings.copyWith(preloadCount: state.settings.preloadCount - 1),
                                        ),
                                child: const Icon(CupertinoIcons.minus_circle, size: 22),
                              ),
                              SizedBox(
                                width: 28,
                                child: Text(
                                  '${state.settings.preloadCount}',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                              ),
                              CupertinoButton(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                onPressed: state.settings.preloadCount >= 20
                                    ? null
                                    : () => ctrl.updateSettings(
                                          state.settings.copyWith(preloadCount: state.settings.preloadCount + 1),
                                        ),
                                child: const Icon(CupertinoIcons.plus_circle, size: 22),
                              ),
                            ],
                          ),
                        ),
                        Container(height: 0.7, color: LiquidTokens.separator(context)),
                        CupertinoListTile(
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.asset('assets/icon/app_icon.png', width: 28, height: 28),
                          ),
                          title: const Text('JMlis'),
                          subtitle: const Text('v2.1.0 · Liquid Glass 跨平台漫画阅读器'),
                        ),
                      ],
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

class _DailyCalendarSheet extends StatefulWidget {
  final Future<DailyCheckinInfo> Function() loadDaily;
  final Future<CheckinResult> Function() onCheckin;

  const _DailyCalendarSheet({required this.loadDaily, required this.onCheckin});

  @override
  State<_DailyCalendarSheet> createState() => _DailyCalendarSheetState();
}

class _DailyCalendarSheetState extends State<_DailyCalendarSheet> {
  DailyCheckinInfo? _info;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _toast;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final info = await widget.loadDaily();
      if (mounted) setState(() => _info = info);
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doSign() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _toast = null;
    });
    try {
      final res = await widget.onCheckin();
      if (mounted) {
        setState(() => _toast = res.message);
      }
      await _fetch();
    } catch (e) {
      if (mounted) {
        setState(() => _toast = '$e'.replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;
    return ClipRRect(
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
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    info?.eventName ?? '每日签到日历',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(32, 32),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('完成'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: Center(child: CupertinoActivityIndicator()),
                )
              else if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text('加载失败：$_error', style: const TextStyle(color: CupertinoColors.systemRed)),
                )
              else if (info != null) ...[
                LiquidSolidCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '本月已打卡 ${info.streakDays} 天',
                            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                          ),
                          if (info.progressText.isNotEmpty)
                            Text(
                              '进度 ${info.progressText}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: LiquidTokens.accentStrong(context),
                              ),
                            ),
                        ],
                      ),
                      if (info.threeDaysCoin.isNotEmpty || info.sevenDaysCoin.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          [
                            if (info.threeDaysCoin.isNotEmpty)
                              '满3天 +${info.threeDaysCoin}金币/+${info.threeDaysExp}经验',
                            if (info.sevenDaysCoin.isNotEmpty)
                              '满7天 +${info.sevenDaysCoin}金币/+${info.sevenDaysExp}经验',
                          ].join(' · '),
                          style: TextStyle(fontSize: 11.5, color: LiquidTokens.muted(context)),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 240),
                  child: GridView.builder(
                    shrinkWrap: true,
                    itemCount: info.days.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      mainAxisSpacing: 6,
                      crossAxisSpacing: 6,
                      childAspectRatio: 1,
                    ),
                    itemBuilder: (ctx, idx) {
                      final d = info.days[idx];
                      final isSigned = d.signed == true;
                      return Container(
                        decoration: BoxDecoration(
                          color: isSigned
                              ? LiquidTokens.scene(ctx)
                              : LiquidTokens.solid(ctx),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: d.bonus
                                ? LiquidTokens.accentStrong(ctx)
                                : LiquidTokens.separator(ctx),
                            width: d.bonus ? 1.5 : 0.8,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              d.label.isNotEmpty ? d.label : '${d.day}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSigned ? CupertinoColors.white : LiquidTokens.ink(ctx),
                              ),
                            ),
                            if (isSigned)
                              const Icon(CupertinoIcons.check_mark, size: 10, color: CupertinoColors.white)
                            else if (d.bonus)
                              Text(
                                '奖',
                                style: TextStyle(fontSize: 9, color: LiquidTokens.accentStrong(ctx)),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                if (_toast != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    _toast!,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: LiquidTokens.accentStrong(context)),
                  ),
                ],
                const SizedBox(height: 14),
                LiquidSpringControl(
                  onTap: (_busy || info.checkedInToday) ? null : _doSign,
                  child: Container(
                    height: 46,
                    decoration: BoxDecoration(
                      color: info.checkedInToday
                          ? LiquidTokens.elevated(context)
                          : LiquidTokens.scene(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      info.checkedInToday
                          ? '今日已完成打卡'
                          : (_busy ? '签到中...' : '立即打卡签到'),
                      style: TextStyle(
                        color: info.checkedInToday ? LiquidTokens.muted(context) : CupertinoColors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14.5,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
