/**
 * PluginPanel - 插件管理面板
 * 显示已安装插件、启用/禁用
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getPluginManager, type PluginInstance } from '../../core/plugins';

export const PluginPanel: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const manager = getPluginManager();

  const refreshPlugins = useCallback(() => { setPlugins([...manager.listPlugins()]); }, []);

  useEffect(() => { refreshPlugins(); }, [refreshPlugins]);

  const handleToggle = async (pluginId: string, currentState: string) => {
    setLoading(true);
    if (currentState === 'active') await manager.deactivate(pluginId);
    else await manager.activate(pluginId);
    refreshPlugins();
    setLoading(false);
  };

  const handleInstall = async () => {
    const path = prompt('输入插件 manifest.json 路径:');
    if (path) { setLoading(true); await manager.install(path); refreshPlugins(); setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>🧩 插件</h3>
        <button onClick={handleInstall} disabled={loading} style={{ padding: '4px 8px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>安装</button>
      </div>

      {/* 插件列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {plugins.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无已安装插件</div>
        ) : (
          plugins.map(plugin => (
            <div key={plugin.manifest.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{plugin.manifest.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{plugin.manifest.id} v{plugin.manifest.version}</div>
                </div>
                <button onClick={() => handleToggle(plugin.manifest.id, plugin.state)} disabled={loading} style={{ padding: '4px 10px', background: plugin.state === 'active' ? '#22c55e' : 'var(--color-bg-hover)', color: plugin.state === 'active' ? '#fff' : 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                  {plugin.state === 'active' ? '已启用' : '启用'}
                </button>
              </div>
              {plugin.manifest.description && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>{plugin.manifest.description}</div>}
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
                权限: {plugin.manifest.permissions.join(', ') || '无'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PluginPanel;
