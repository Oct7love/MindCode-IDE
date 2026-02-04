/**
 * 扩展市场组件 - 浏览/搜索/安装扩展
 */

import React, { useState, useEffect, useCallback } from 'react';
import { marketplaceService, type ExtensionInfo } from '../../core/plugins/marketplace';
import './ExtensionMarketplace.css';

interface ExtensionMarketplaceProps { isOpen: boolean; onClose: () => void; }

export const ExtensionMarketplace: React.FC<ExtensionMarketplaceProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [installed, setInstalled] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const categories = marketplaceService.getCategories();

  // 加载扩展列表（异步）
  const loadExtensions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = search ? await marketplaceService.search(search, category) : await marketplaceService.getByCategory(category);
      setExtensions(list);
      setInstalled(marketplaceService.getInstalled());
    } catch (err) { console.error('[Marketplace] 加载失败:', err); }
    setIsLoading(false);
  }, [search, category]);

  useEffect(() => { if (isOpen) loadExtensions(); }, [isOpen, loadExtensions]);

  // 安装扩展
  const handleInstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.install(ext.id);
    loadExtensions();
    setLoading(null);
  };

  // 卸载扩展
  const handleUninstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.uninstall(ext.id);
    loadExtensions();
    setLoading(null);
  };

  // 启用/禁用
  const handleToggle = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.setEnabled(ext.id, !ext.enabled);
    loadExtensions();
    setLoading(null);
  };

  if (!isOpen) return null;

  const displayList = tab === 'installed' ? installed : extensions;

  return (
    <div className="ext-marketplace-overlay" onClick={onClose}>
      <div className="ext-marketplace" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="ext-header">
          <h2>🧩 扩展市场</h2>
          <button className="ext-close" onClick={onClose}>×</button>
        </div>

        {/* 标签切换 */}
        <div className="ext-tabs">
          <button className={`ext-tab ${tab === 'marketplace' ? 'active' : ''}`} onClick={() => setTab('marketplace')}>🏪 市场</button>
          <button className={`ext-tab ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>📦 已安装 ({installed.length})</button>
        </div>

        {/* 搜索和分类 */}
        {tab === 'marketplace' && (
          <div className="ext-filters">
            <input className="ext-search" placeholder="🔍 搜索扩展..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="ext-categories">
              {categories.map(cat => (
                <button key={cat.id} className={`ext-category ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id)}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 扩展列表 */}
        <div className="ext-list">
          {isLoading ? (
            <div className="ext-skeleton">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="ext-skeleton-card">
                  <div className="ext-skeleton-icon" />
                  <div className="ext-skeleton-content">
                    <div className="ext-skeleton-title" />
                    <div className="ext-skeleton-desc" />
                    <div className="ext-skeleton-meta" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div className="ext-empty">{tab === 'installed' ? '暂无已安装扩展' : '未找到匹配的扩展'}</div>
          ) : (
            displayList.map(ext => (
              <div key={ext.id} className="ext-card">
                <div className="ext-icon">{ext.iconUrl ? <img src={ext.iconUrl} alt="" style={{ width: 36, height: 36, borderRadius: 4 }} /> : '📦'}</div>
                <div className="ext-info">
                  <div className="ext-title">
                    <span className="ext-name">{ext.displayName}</span>
                    <span className="ext-version">v{ext.version}</span>
                    {ext.installed && <span className="ext-installed-badge">已安装</span>}
                  </div>
                  <div className="ext-author">by {ext.author}</div>
                  <div className="ext-desc">{ext.description}</div>
                  <div className="ext-meta">
                    <span>⬇️ {(ext.downloads / 1000).toFixed(0)}k</span>
                    <span>⭐ {ext.rating}</span>
                    <span className="ext-tags">{ext.tags.slice(0, 3).map(t => <span key={t} className="ext-tag">{t}</span>)}</span>
                  </div>
                </div>
                <div className="ext-actions">
                  {ext.installed ? (
                    <>
                      <button className={`ext-btn ${ext.enabled ? 'enabled' : 'disabled'}`} onClick={() => handleToggle(ext)} disabled={loading === ext.id}>
                        {ext.enabled ? '✓ 已启用' : '○ 已禁用'}
                      </button>
                      <button className="ext-btn uninstall" onClick={() => handleUninstall(ext)} disabled={loading === ext.id}>卸载</button>
                    </>
                  ) : (
                    <button className="ext-btn install" onClick={() => handleInstall(ext)} disabled={loading === ext.id}>
                      {loading === ext.id ? '安装中...' : '安装'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="ext-footer">
          💡 提示：安装扩展后可能需要重启 MindCode 才能生效
        </div>
      </div>
    </div>
  );
};

export default ExtensionMarketplace;
