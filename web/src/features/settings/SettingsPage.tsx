import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAppStore, type ReaderMode, type ThemeMode } from '../../stores/useAppStore';
import { InsetGroup, InsetRow, IosSwitch, SegmentedControl } from '../../components/ios/IosControls';

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
    showToast,
  } = useAppStore();

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: domains } = useQuery({
    queryKey: ['domains'],
    queryFn: api.getDomains,
  });

  const [clientImpl, setClientImpl] = useState<'api' | 'html'>('api');
  const [downloadDir, setDownloadDir] = useState('');
  const [dirRule, setDirRule] = useState('');
  const [threadCount, setThreadCount] = useState(4);
  const [cacheDir, setCacheDir] = useState('');
  const [cacheMaxFiles, setCacheMaxFiles] = useState(5000);
  const [cacheMaxMb, setCacheMaxMb] = useState(2048);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (!settingsData) return;
    const p = settingsData.panel;
    setClientImpl((p.client_impl as 'api' | 'html') || 'api');
    setDownloadDir(p.download_dir || '');
    setDirRule(p.dir_rule || 'Bd_Aauthor_Atitle');
    setThreadCount(Number(p.image_thread_count || 4));
    setCacheDir(p.image_cache_dir || '');
    setCacheMaxFiles(Number(p.image_cache_max_files || 5000));
    setCacheMaxMb(Number(p.image_cache_max_size_mb || 2048));
    setPinEnabled(Boolean(p.pin_enabled));
  }, [settingsData]);

  const saveServerMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        client_impl: clientImpl,
        download_dir: downloadDir,
        dir_rule: dirRule,
        image_thread_count: threadCount,
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
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-[34px] font-bold tracking-tight leading-tight">设置</h1>

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
          right={<IosSwitch checked={fitWidth} onChange={setFitWidth} />}
        />
        <InsetRow
          label="显示缩略图导航"
          right={<IosSwitch checked={showThumbStrip} onChange={setShowThumbStrip} />}
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
              className="w-20 rounded-lg px-2.5 py-1 text-right text-[14px] tabular-nums outline-none"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
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
              className="w-48 sm:w-72 rounded-lg px-2.5 py-1 text-[13.5px] outline-none"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
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
              className="w-48 sm:w-72 rounded-lg px-2.5 py-1 text-[13.5px] outline-none"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
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
              className="w-20 rounded-lg px-2.5 py-1 text-right text-[14px] tabular-nums outline-none"
              style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
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
                className="w-20 rounded-lg px-2 py-1 text-right text-[13.5px] tabular-nums outline-none"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              />
              <input
                type="number"
                value={cacheMaxFiles}
                onChange={(e) => setCacheMaxFiles(Number(e.target.value))}
                className="w-20 rounded-lg px-2 py-1 text-right text-[13.5px] tabular-nums outline-none"
                style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
              />
            </div>
          }
        />
        <InsetRow
          label="保存服务端配置"
          onClick={() => saveServerMutation.mutate()}
          right={
            <span className="text-[14px] font-semibold" style={{ color: 'var(--ios-blue)' }}>
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
                style={{ color: 'var(--ios-red)' }}
              >
                关闭保护
              </button>
            ) : undefined
          }
        />
        <div className="px-4 py-3 flex items-center gap-2">
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="设置至少 4 位数字 PIN..."
            className="flex-1 rounded-xl px-3 py-2 text-[14px] outline-none"
            style={{ backgroundColor: 'var(--ios-fill-tertiary)' }}
          />
          <button
            type="button"
            disabled={newPin.length < 4}
            onClick={() => pinMutation.mutate({ enabled: true, pin: newPin })}
            className="px-4 py-2 rounded-xl text-[14px] font-medium text-white cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: 'var(--ios-blue)' }}
          >
            {pinEnabled ? '修改 PIN' : '开启'}
          </button>
        </div>
      </InsetGroup>

      {domains && (
        <InsetGroup title="当前生效域名">
          <InsetRow label="APP API 域名" sublabel={domains.api_domains.join(', ')} />
          <InsetRow label="HTML 域名" sublabel={domains.html_domains.join(', ')} isLast />
        </InsetGroup>
      )}
    </div>
  );
}
