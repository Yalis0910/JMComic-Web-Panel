import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:socks5_proxy/socks_client.dart';

import 'jm_crypto.dart';

class ParsedProxyConfig {
  final String scheme;
  final String host;
  final int port;
  final String username;
  final String password;

  const ParsedProxyConfig({
    required this.scheme,
    required this.host,
    required this.port,
    this.username = '',
    this.password = '',
  });

  bool get isSocks5 => scheme == 'socks5' || scheme == 'socks5h';
  bool get hasAuth => username.isNotEmpty || password.isNotEmpty;
}

String _safeDecodeComponent(String raw) {
  try {
    return Uri.decodeComponent(raw);
  } catch (_) {
    return raw;
  }
}

ParsedProxyConfig? parseProxyConfig(
  String rawUrl, {
  String username = '',
  String password = '',
}) {
  final trimmed = rawUrl.trim();
  if (trimmed.isEmpty) return null;
  final normalized = trimmed.contains('://') ? trimmed : 'http://$trimmed';
  final uri = Uri.tryParse(normalized);
  if (uri == null) return null;

  final scheme = uri.scheme.toLowerCase();
  const allowedSchemes = {'http', 'https', 'socks5', 'socks5h'};
  if (!allowedSchemes.contains(scheme)) return null;

  final host = uri.host.trim();
  if (host.isEmpty || !uri.hasPort || uri.port < 1 || uri.port > 65535) {
    return null;
  }

  var resolvedUser = username.trim();
  var resolvedPass = password;
  if (resolvedUser.isEmpty && resolvedPass.isEmpty && uri.userInfo.isNotEmpty) {
    final sep = uri.userInfo.indexOf(':');
    if (sep >= 0) {
      resolvedUser = _safeDecodeComponent(uri.userInfo.substring(0, sep));
      resolvedPass = _safeDecodeComponent(uri.userInfo.substring(sep + 1));
    } else {
      resolvedUser = _safeDecodeComponent(uri.userInfo);
    }
  }

  return ParsedProxyConfig(
    scheme: scheme,
    host: host,
    port: uri.port,
    username: resolvedUser,
    password: resolvedPass,
  );
}

class _TrackedHttpClient {
  final WeakReference<HttpClient> ref;
  final SecurityContext? context;

  _TrackedHttpClient(HttpClient client, this.context) : ref = WeakReference(client);
}

/// 全局网络代理管理器：支持 HTTP(含账密认证) 与 SOCKS5，关闭时直连并自动绕过局域网地址。
class AppProxyManager {
  AppProxyManager._();

  static final AppProxyManager instance = AppProxyManager._();

  static const _kProxyEnabled = 'hybrid_proxy_enabled';
  static const _kProxyUrl = 'hybrid_proxy_url';
  static const _kProxyUsername = 'hybrid_proxy_username';
  static const _kProxyPassword = 'hybrid_proxy_password';
  static const _kServerUrl = 'hybrid_server_url';

  bool _enabled = false;
  ParsedProxyConfig? _activeProxy;
  String _lanHost = '';
  bool _overridesInstalled = false;
  final List<_TrackedHttpClient> _clients = [];

  bool get isProxyActive => _enabled && _activeProxy != null;

  void installGlobalOverrides() {
    if (_overridesInstalled) return;
    _overridesInstalled = true;
    HttpOverrides.global = _AppProxyHttpOverrides(this);
  }

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    applySettings(
      enabled: prefs.getBool(_kProxyEnabled) ?? false,
      proxyUrl: prefs.getString(_kProxyUrl) ?? '',
      username: prefs.getString(_kProxyUsername) ?? '',
      password: prefs.getString(_kProxyPassword) ?? '',
      lanServerUrl: prefs.getString(_kServerUrl) ?? '',
    );
    installGlobalOverrides();
  }

  void applySettings({
    required bool enabled,
    required String proxyUrl,
    String username = '',
    String password = '',
    String lanServerUrl = '',
  }) {
    _lanHost = Uri.tryParse(lanServerUrl.trim())?.host.toLowerCase() ?? '';
    _activeProxy = parseProxyConfig(
      proxyUrl,
      username: username,
      password: password,
    );
    _enabled = enabled && _activeProxy != null;
    installGlobalOverrides();

    _clients.removeWhere((entry) {
      final client = entry.ref.target;
      if (client == null) return true;
      _configureClient(client, context: entry.context);
      return false;
    });
  }

  HttpClient attachClient(HttpClient client, {SecurityContext? context}) {
    _configureClient(client, context: context);
    _clients.add(_TrackedHttpClient(client, context));
    return client;
  }

  bool _shouldBypass(Uri uri) {
    final host = uri.host.toLowerCase();
    if (host.isEmpty) return true;
    if (host == 'localhost' || host == '::1' || host.endsWith('.local')) {
      return true;
    }
    if (_lanHost.isNotEmpty && host == _lanHost) {
      return true;
    }
    final ip = InternetAddress.tryParse(host);
    if (ip == null) return false;
    if (ip.type == InternetAddressType.IPv4) {
      final b = ip.rawAddress;
      if (b[0] == 127 || b[0] == 10 || b[0] == 0) return true;
      if (b[0] == 192 && b[1] == 168) return true;
      if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;
      if (b[0] == 169 && b[1] == 254) return true;
    } else if (ip.type == InternetAddressType.IPv6) {
      if (ip.isLoopback || ip.isLinkLocal) return true;
    }
    return false;
  }

  void _configureClient(HttpClient client, {SecurityContext? context}) {
    final cfg = isProxyActive ? _activeProxy : null;
    _applyProxyConfig(client, cfg, context: context, respectLanBypass: true);
  }

  void _applyProxyConfig(
    HttpClient client,
    ParsedProxyConfig? cfg, {
    SecurityContext? context,
    bool respectLanBypass = true,
  }) {
    bool shouldBypass(Uri uri) => respectLanBypass && _shouldBypass(uri);

    if (cfg == null) {
      client.connectionFactory = null;
      client.authenticateProxy = null;
      client.findProxy = (uri) => 'DIRECT';
      return;
    }

    if (cfg.isSocks5) {
      client.authenticateProxy = null;
      client.findProxy = (uri) => 'DIRECT';
      client.connectionFactory = (Uri uri, String? proxyHost, int? proxyPort) async {
        final targetPort = uri.port;
        if (shouldBypass(uri)) {
          if (uri.scheme == 'https') {
            final sec = SecureSocket.connect(uri.host, targetPort, context: context);
            return ConnectionTask.fromSocket(
              sec,
              () => sec.then((s) => s.close().ignore(), onError: (_) {}).ignore(),
            );
          }
          return Socket.startConnect(uri.host, targetPort);
        }

        final proxyIp = InternetAddress.tryParse(cfg.host) ??
            (await InternetAddress.lookup(cfg.host)).first;
        final settings = ProxySettings(
          proxyIp,
          cfg.port,
          username: cfg.hasAuth ? cfg.username : null,
          password: cfg.hasAuth ? cfg.password : null,
        );
        final clientFuture = SocksTCPClient.connect(
          [settings],
          InternetAddress(uri.host, type: InternetAddressType.unix),
          targetPort,
        );
        if (uri.scheme == 'https') {
          final Future<SecureSocket> secFuture =
              (await clientFuture).secure(uri.host, context: context);
          return ConnectionTask.fromSocket(
            secFuture,
            () => secFuture.then((s) => s.close().ignore(), onError: (_) {}).ignore(),
          );
        }
        return ConnectionTask.fromSocket(
          clientFuture,
          () => clientFuture.then((s) => s.close().ignore(), onError: (_) {}).ignore(),
        );
      };
      return;
    }

    client.connectionFactory = null;
    final formattedHost =
        cfg.host.contains(':') && !cfg.host.startsWith('[') ? '[${cfg.host}]' : cfg.host;
    final directive = 'PROXY $formattedHost:${cfg.port}';
    client.findProxy = (uri) => shouldBypass(uri) ? 'DIRECT' : directive;

    if (cfg.hasAuth) {
      client.addProxyCredentials(
        cfg.host,
        cfg.port,
        '',
        HttpClientBasicCredentials(cfg.username, cfg.password),
      );
      client.authenticateProxy = (host, port, scheme, realm) async {
        final cred = scheme.toLowerCase() == 'digest'
            ? HttpClientDigestCredentials(cfg.username, cfg.password)
            : HttpClientBasicCredentials(cfg.username, cfg.password);
        client.addProxyCredentials(host, port, realm ?? '', cred);
        return true;
      };
    } else {
      client.authenticateProxy = null;
    }
  }

  /// 使用临时独立 HttpClient 测试给定代理配置连通性，不改动当前全局开关。
  Future<({bool reachable, bool jmReachable, int latencyMs, String message})> probeProxy(
    ParsedProxyConfig cfg,
  ) async {
    const jmTargets = [
      'https://www.cdnbtd.cc/setting',
      'https://www.cdngwc.cc/setting',
    ];
    const fallbackTarget = 'https://www.gstatic.com/generate_204';
    final targets = [...jmTargets, fallbackTarget];

    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 7);
    _applyProxyConfig(client, cfg, respectLanBypass: false);

    String lastError = '无响应';
    try {
      for (var i = 0; i < targets.length; i++) {
        final target = targets[i];
        final isJm = i < jmTargets.length;
        final sw = Stopwatch()..start();
        try {
          final req = await client.getUrl(Uri.parse(target)).timeout(const Duration(seconds: 8));
          req.headers.set(
            HttpHeaders.userAgentHeader,
            'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
          );
          if (isJm) {
            final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
            final auth = JmCrypto.buildHeadersAuth(ts);
            req.headers.set('token', auth.token);
            req.headers.set('tokenparam', auth.tokenparam);
          }
          final resp = await req.close().timeout(const Duration(seconds: 8));
          await resp.drain<void>();
          sw.stop();
          final status = resp.statusCode;
          if (status == 407) {
            return (
              reachable: false,
              jmReachable: false,
              latencyMs: sw.elapsedMilliseconds,
              message: '代理认证失败 (HTTP 407)，请检查代理用户名与密码',
            );
          }
          if (status >= 200 && status < 400) {
            if (isJm) {
              return (
                reachable: true,
                jmReachable: true,
                latencyMs: sw.elapsedMilliseconds,
                message: '代理连通正常，已成功访问禁漫接口 (${sw.elapsedMilliseconds}ms · HTTP $status)',
              );
            }
            return (
              reachable: true,
              jmReachable: false,
              latencyMs: sw.elapsedMilliseconds,
              message: '代理已连通 (${sw.elapsedMilliseconds}ms · HTTP $status)，但禁漫接口暂不可达（$lastError）',
            );
          }
          lastError = 'HTTP $status';
        } catch (e) {
          sw.stop();
          lastError = '$e'.replaceFirst('Exception: ', '');
        }
      }
      return (
        reachable: false,
        jmReachable: false,
        latencyMs: 0,
        message: '代理连接失败：$lastError',
      );
    } finally {
      client.close(force: true);
    }
  }
}

class _AppProxyHttpOverrides extends HttpOverrides {
  final AppProxyManager manager;

  _AppProxyHttpOverrides(this.manager);

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    return manager.attachClient(client, context: context);
  }
}
