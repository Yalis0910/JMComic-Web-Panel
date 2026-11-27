import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';
import { useAppStore, type CoverPrivacyMode, type ReaderMode, type ThemeMode } from '../../stores/useAppStore';
import { InsetGroup, InsetRow, LiquidSwitch, SegmentedControl } from '../../components/liquid/LiquidControls';

const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:', 'socks5h:', 'socks4:']);

function isValidProxyAddress(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    const parsed = new URL(normalized);
    if (!SUPPORTED_PROXY_PROTOCOLS.has(parsed.protocol.toLowerCase())) return false;
    if (!parsed.hostname) return false;
    const portNum = Number(parsed.port);
    return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const {
    theme,
    setTheme,
    readerMode,
    setReaderMode,
    preloadCount,
    setPreloadCount,
    fitWidth,
    setFitWidth,
    showThumbStrip,
    setShowThumbStrip,
    coverPrivacyMode,
    setCoverPrivacyMode,
    doublePageRtl,
    setDoublePageRtl,
    doublePageCoverOffset,
    setDoublePageCoverOffset,
    showToast,
  } = useAppStore();

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: domains, refetch: refetchDomains, isFetching: domainsFetching } = useQuery({
    queryKey: ['domains'],
    queryFn: api.getDomains,
  });

  const [clientImpl, setClientImpl] = useState<'api' | 'html'>('api');
  const [downloadDir, setDownloadDir] = useState('');
  const [dirRule, setDirRule] = useState('');
  const [threadCount, setThreadCount] = useState(4);
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(2);
  const [cacheDir, setCacheDir] = useState('');
  const [cacheMaxFiles, setCacheMaxFiles] = useState(5000);
  const [cacheMaxMb, setCacheMaxMb] = useState(2048);

  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [proxyTestMsg, setProxyTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [retryTimes, setRetryTimes] = useState(5);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (!settingsData) return;
    const p = settingsData.panel;
    setClientImpl((p.client_impl as 'api' | 'html') || 'api');
    setDownloadDir(p.download_dir || '');
    setDirRule(p.dir_rule || 'Bd_Aauthor_Atitle');
    setThreadCount(Number(p.image_thread_count || 4));
    setMaxConcurrentDownloads(Number(p.max_concurrent_downloads || 2));
    setCacheDir(p.image_cache_dir || '');
    setCacheMaxFiles(Number(p.image_cache_max_files || 5000));
    setCacheMaxMb(Number(p.image_cache_max_size_mb || 2048));
    setPinEnabled(Boolean(p.pin_enabled));

    const opt = settingsData.option || {};
    const optProxies = opt?.client?.postman?.meta_data?.proxies;
    const fallbackProxy =
      typeof optProxies === 'string'
        ? optProxies
        : optProxies && typeof optProxies === 'object'
          ? optProxies.https || optProxies.http || ''
          : '';
    setProxyUrl(p.proxy_url || fallbackProxy || '');
    setProxyUsername(p.proxy_username || '');
    setProxyPassword(p.proxy_password || '');
    setProxyEnabled(
      typeof p.proxy_enabled === 'boolean' ? p.proxy_enabled : Boolean(fallbackProxy),
    );
    setRetryTimes(Number(opt?.client?.retry_times ?? 5));
  }, [settingsData]);

  const saveServerMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        client_impl: clientImpl,
        download_dir: downloadDir,
        dir_rule: dirRule,
        image_thread_count: threadCount,
        max_concurrent_downloads: maxConcurrentDownloads,
        image_cache_dir: cacheDir,
        image_cache_max_files: cacheMaxFiles,
        image_cache_max_size_mb: cacheMaxMb,
      }),
    onSuccess: () => {
      showToast('服务端设置已保存并立即生效', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const proxyConfigReady = isValidProxyAddress(proxyUrl);

  const saveNetworkConfig = async (nextEnabled: boolean) => {
    const cleanProxy = proxyUrl.trim();
    const cleanUser = proxyUsername.trim();
    if (nextEnabled && !isValidProxyAddress(cleanProxy)) {
      throw new Error('请先填写完整有效的代理地址与端口后再开启');
    }
    const res = await api.updateSettings({
      proxy_enabled: nextEnabled && Boolean(cleanProxy),
      proxy_url: cleanProxy,
      proxy_username: cleanUser,
      proxy_password: proxyPassword,
    });
    if (!res?.panel || !('proxy_url' in res.panel)) {
      throw new Error('当前后端进程仍是旧版本，请先重启后端服务后再保存代理设置');
    }
    await api.updateOption({
      client: {
        retry_times: Math.max(0, Math.min(10, Number(retryTimes) || 0)),
      },
    });
  };

  const saveOptionMutation = useMutation({
    mutationFn: () => saveNetworkConfig(proxyConfigReady ? proxyEnabled : false),
    onSuccess: () => {
      if (!proxyConfigReady && proxyEnabled) {
        setProxyEnabled(false);
      }
      showToast('网络与代理配置已保存并同步至 option.yml', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const toggleProxyMutation = useMutation({
    mutationFn: (enabled: boolean) => saveNetworkConfig(enabled),
    onSuccess: (_, enabled) => {
      setProxyEnabled(enabled);
      showToast(enabled ? '已开启代理并立即生效' : '已关闭代理，当前使用直连', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const testProxyMutation = useMutation({
    mutationFn: () => {
      if (!proxyConfigReady) {
        throw new Error('请先填写完整有效的代理地址与端口后再测试');
      }
      return api.testProxy({
        proxy_url: proxyUrl.trim(),
        proxy_username: proxyUsername.trim(),
        proxy_password: proxyPassword,
      });
    },
    onSuccess: (res) => {
      setProxyTestMsg({ ok: Boolean(res.reachable), text: res.message });
      showToast(res.message, res.reachable ? 'success' : 'error');
    },
    onError: (err: Error) => {
      setProxyTestMsg({ ok: false, text: err.message });
      showToast(err.message, 'error');
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: api.clearCache,
    onSuccess: () => {
      showToast('图片磁盘缓存已清空', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ enabled, pin }: { enabled: boolean; pin?: string }) => api.configurePin(enabled, pin),
    onSuccess: (_, vars) => {
      setPinEnabled(vars.enabled);
      setNewPin('');
      showToast(vars.enabled ? '局域网 PIN 保护已开启' : '已关闭 PIN 保护', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const cacheStats = settingsData?.cache;

  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--liquid-accent)' }}>
          PREFERENCES · JMLIS
        </p>
        <h1 className="text-[32px] sm:text-[38px] font-medium tracking-[-0.03em] leading-[1.12]">
          系统设置
        </h1>
      </div>

      <InsetGroup title="外观与阅读器（本地即时生效）">
        <InsetRow
          label="外观主题"
          right={
            <SegmentedControl<ThemeMode>
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: '系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]}
            />
          }
        />
        <InsetRow
          label="默认阅读模式"
          right={
            <SegmentedControl<ReaderMode>
              value={readerMode}
              onChange={setReaderMode}
              options={[
                { value: 'vertical', label: '条漫' },
                { value: 'single-ltr', label: '单页' },
                { value: 'single-rtl', label: '日漫' },
                { value: 'double', label: '双页' },
              ]}
            />
          }
        />
        <InsetRow
          label="图片宽度自适应"
          right={<LiquidSwitch checked={fitWidth} onChange={setFitWidth} />}
        />
        <InsetRow
          label="显示缩略图导航"
          right={<LiquidSwitch checked={showThumbStrip} onChange={setShowThumbStrip} />}
        />
        <InsetRow
          label="封面隐私模式"
          sublabel="模糊模式支持点击封面临时预览"
          right={
            <SegmentedControl<CoverPrivacyMode>
              value={coverPrivacyMode || 'show'}
              onChange={setCoverPrivacyMode}
              options={[
                { value: 'show', label: '显示' },
                { value: 'blur', label: '模糊' },
                { value: 'hide', label: '隐藏' },
              ]}
            />
          }
        />
        <InsetRow
          label="双页日漫方向 (右→左)"
          right={<LiquidSwitch checked={doublePageRtl} onChange={setDoublePageRtl} />}
        />
        <InsetRow
          label="双页封面单独成页"
          sublabel="防止跨页拆错偶/奇数页"
          right={<LiquidSwitch checked={doublePageCoverOffset} onChange={setDoublePageCoverOffset} />}
        />
        <InsetRow
          label="预加载页数"
          isLast
          right={
            <input
              type="number"
              min={1}
              max={20}
              value={preloadCount}
              onChange={(e) => setPreloadCount(Number(e.target.value))}
              className="w-20 rounded-full px-3 py-1.5 text-right text-[14px] tabular-nums outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
      </InsetGroup>

      <InsetGroup title="服务端与下载配置" footer="更改后将自动同步至 option.yml 并重建客户端池。">
        <InsetRow
          label="协议通道"
          sublabel="APP 端接口信息更全；HTML 端支持副分类检索"
          right={
            <SegmentedControl<'api' | 'html'>
              value={clientImpl}
              onChange={setClientImpl}
              options={[
                { value: 'api', label: 'APP 端' },
                { value: 'html', label: '网页端' },
              ]}
            />
          }
        />
        <InsetRow
          label="下载目录"
          right={
            <input
              type="text"
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              className="w-48 sm:w-72 rounded-full px-3.5 py-1.5 text-[13.5px] outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="目录规则"
          right={
            <input
              type="text"
              value={dirRule}
              onChange={(e) => setDirRule(e.target.value)}
              className="w-48 sm:w-72 rounded-full px-3.5 py-1.5 text-[13.5px] outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="下载图片并发数"
          right={
            <input
              type="number"
              min={1}
              max={16}
              value={threadCount}
              onChange={(e) => setThreadCount(Number(e.target.value))}
              className="w-20 rounded-full px-3 py-1.5 text-right text-[14px] tabular-nums outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="下载队列最大并行任务数"
          sublabel="超出部分将进入排队等待"
          right={
            <input
              type="number"
              min={1}
              max={5}
              value={maxConcurrentDownloads}
              onChange={(e) => setMaxConcurrentDownloads(Number(e.target.value))}
              className="w-20 rounded-full px-3 py-1.5 text-right text-[14px] tabular-nums outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="缓存上限 (MB / 文件数)"
          sublabel={
            cacheStats
              ? `当前占用 ${cacheStats.size_mb} MB（${cacheStats.file_count} 个文件）`
              : undefined
          }
          right={
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cacheMaxMb}
                onChange={(e) => setCacheMaxMb(Number(e.target.value))}
                className="w-20 rounded-full px-3 py-1.5 text-right text-[13.5px] tabular-nums outline-none liquid-focus-ring"
                style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
              />
              <input
                type="number"
                value={cacheMaxFiles}
                onChange={(e) => setCacheMaxFiles(Number(e.target.value))}
                className="w-20 rounded-full px-3 py-1.5 text-right text-[13.5px] tabular-nums outline-none liquid-focus-ring"
                style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
              />
            </div>
          }
        />
        <InsetRow
          label="保存服务端配置"
          onClick={() => saveServerMutation.mutate()}
          right={
            <span className="text-[14px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
              {saveServerMutation.isPending ? '保存中...' : '保存'}
            </span>
          }
        />
        <InsetRow
          label="清空图片磁盘缓存"
          destructive
          isLast
          onClick={() => clearCacheMutation.mutate()}
        />
      </InsetGroup>

      <InsetGroup
        title="局域网访问保护 (PIN 锁)"
        footer="开启后局域网内浏览器与 App 均需输入 PIN 解锁接口，默认关闭。"
      >
        <InsetRow
          label="PIN 锁状态"
          sublabel={pinEnabled ? '已启用（已保护所有业务接口）' : '未启用'}
          right={
            pinEnabled ? (
              <button
                type="button"
                onClick={() => pinMutation.mutate({ enabled: false })}
                className="text-[14px] font-medium cursor-pointer"
                style={{ color: 'var(--liquid-danger)' }}
              >
                关闭保护
              </button>
            ) : undefined
          }
        />
        <div className="px-5 py-3.5 flex items-center gap-2.5">
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="设置至少 4 位数字 PIN..."
            className="flex-1 min-h-[42px] rounded-full px-4 py-2 text-[14px] outline-none liquid-focus-ring"
            style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
          />
          <button
            type="button"
            disabled={newPin.length < 4}
            onClick={() => pinMutation.mutate({ enabled: true, pin: newPin })}
            className="min-h-[42px] px-5 py-2 rounded-full text-[14px] font-medium text-white cursor-pointer disabled:opacity-40 liquid-tactile"
            style={{ backgroundColor: 'var(--liquid-scene)' }}
          >
            {pinEnabled ? '修改 PIN' : '开启'}
          </button>
        </div>
      </InsetGroup>

      <InsetGroup
        title="网络与代理配置 (option.yml)"
        footer="填写完整代理地址与端口后才能开启开关；开启后经代理访问，关闭则恢复直连并保留已填配置。支持 http://127.0.0.1:7890、socks5://127.0.0.1:7891 或 http://用户名:密码@代理IP:端口。"
      >
        <InsetRow
          label="启用服务端代理"
          sublabel={
            proxyEnabled && proxyConfigReady
              ? `已开启：${proxyUrl.trim()}`
              : proxyConfigReady
                ? '已关闭（当前直连，开启后走上方所填代理）'
                : '请先填写有效代理地址与端口后方可开启'
          }
          right={
            <LiquidSwitch
              checked={proxyEnabled}
              disabled={(!proxyConfigReady && !proxyEnabled) || toggleProxyMutation.isPending}
              onChange={(next) => {
                if (next && !proxyConfigReady) {
                  showToast('请先填写完整有效的代理地址与端口后再开启', 'error');
                  return;
                }
                toggleProxyMutation.mutate(next);
              }}
            />
          }
        />
        <InsetRow
          label="HTTP / SOCKS 代理地址"
          right={
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => {
                const val = e.target.value;
                setProxyUrl(val);
                setProxyTestMsg(null);
                if (!isValidProxyAddress(val) && proxyEnabled) {
                  setProxyEnabled(false);
                }
              }}
              placeholder="http://127.0.0.1:7890"
              className="w-48 sm:w-72 rounded-full px-3.5 py-1.5 text-[13.5px] outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="代理用户名（可选）"
          right={
            <input
              type="text"
              value={proxyUsername}
              onChange={(e) => {
                setProxyUsername(e.target.value);
                setProxyTestMsg(null);
              }}
              placeholder="无认证可留空"
              autoComplete="off"
              className="w-48 sm:w-72 rounded-full px-3.5 py-1.5 text-[13.5px] outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="代理密码（可选）"
          sublabel="单独填写可自动转义 @、: 等特殊字符"
          right={
            <div className="flex items-center gap-1.5">
              <input
                type={showProxyPassword ? 'text' : 'password'}
                value={proxyPassword}
                onChange={(e) => {
                  setProxyPassword(e.target.value);
                  setProxyTestMsg(null);
                }}
                placeholder="无认证可留空"
                autoComplete="new-password"
                className="w-40 sm:w-64 rounded-full px-3.5 py-1.5 text-[13.5px] outline-none liquid-focus-ring"
                style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
              />
              <button
                type="button"
                aria-label={showProxyPassword ? '隐藏代理密码' : '显示代理密码'}
                onClick={() => setShowProxyPassword((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full cursor-pointer liquid-tactile"
                style={{ backgroundColor: 'var(--liquid-fill-soft)', color: 'var(--liquid-muted)' }}
              >
                {showProxyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          }
        />
        <InsetRow
          label="请求重试次数"
          right={
            <input
              type="number"
              min={0}
              max={10}
              value={retryTimes}
              onChange={(e) => setRetryTimes(Number(e.target.value))}
              className="w-20 rounded-full px-3 py-1.5 text-right text-[14px] tabular-nums outline-none liquid-focus-ring"
              style={{ backgroundColor: 'var(--liquid-fill-soft)' }}
            />
          }
        />
        <InsetRow
          label="测试代理连通性"
          sublabel={
            proxyTestMsg
              ? proxyTestMsg.text
              : '验证所填代理能否经服务端访问禁漫接口'
          }
          onClick={() => {
            if (!testProxyMutation.isPending) {
              testProxyMutation.mutate();
            }
          }}
          right={
            <span
              className="text-[14px] font-semibold"
              style={{
                color: !proxyConfigReady
                  ? 'var(--liquid-muted)'
                  : proxyTestMsg
                    ? proxyTestMsg.ok
                      ? 'var(--liquid-accent)'
                      : 'var(--liquid-danger)'
                    : 'var(--liquid-accent)',
              }}
            >
              {testProxyMutation.isPending ? '测试中...' : '测试连通'}
            </span>
          }
        />
        <InsetRow
          label="保存网络与代理配置"
          isLast
          onClick={() => saveOptionMutation.mutate()}
          right={
            <span className="text-[14px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
              {saveOptionMutation.isPending ? '保存中...' : '保存'}
            </span>
          }
        />
      </InsetGroup>

      {domains && (
        <InsetGroup title="当前生效域名">
          <InsetRow label="APP API 域名" sublabel={domains.api_domains.join(', ')} />
          <InsetRow label="HTML 域名" sublabel={domains.html_domains.join(', ')} />
          <InsetRow
            label="重新获取最新可用域名"
            isLast
            onClick={() => refetchDomains()}
            right={
              <span className="text-[13.5px] font-semibold" style={{ color: 'var(--liquid-accent)' }}>
                {domainsFetching ? '检测中...' : '刷新'}
              </span>
            }
          />
        </InsetGroup>
      )}
    </div>
  );
}
