/**
 * ExtensionsPanel - 扩展管理面板
 *
 * 提供扩展搜索、安装/卸载、推荐列表等功能。
 * 数据来源于 Open VSX 市场。
 */
import React, { useState, useCallback, useEffect } from "react";
import { marketplaceService, type ExtensionInfo } from "../../core/plugins/marketplace";
import { ExtensionMarketplace } from "./ExtensionMarketplace";

/** 推荐列表显示的最大数量 */
const MAX_FEATURED_COUNT = 6;

export const ExtensionsPanel: React.FC = React.memo(() => {
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState<ExtensionInfo[]>([]);
  const [featured, setFeatured] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMarketplace, setShowMarketplace] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setInstalled(marketplaceService.getInstalled());
    const list = search
      ? await marketplaceService.search(search)
      : await marketplaceService.getFeatured();
    setFeatured(list.slice(0, MAX_FEATURED_COUNT));
    setIsLoading(false);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.install(ext.id);
    await loadData();
    setLoading(null);
  };

  const handleUninstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.uninstall(ext.id);
    await loadData();
    setLoading(null);
  };

  return (
    <div className="extensions-panel">
      <div className="ext-search-box">
        <input
          type="text"
          placeholder="Search extensions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ext-search-input"
        />
      </div>

      {installed.length > 0 && (
        <div className="ext-section">
          <div className="ext-section-title">Installed ({installed.length})</div>
          {installed.map((ext) => (
            <div key={ext.id} className="ext-item">
              <span className="ext-item-icon">{ext.icon || "📦"}</span>
              <div className="ext-item-info">
                <div className="ext-item-name">{ext.displayName}</div>
                <div className="ext-item-author">{ext.author}</div>
              </div>
              <button
                className="ext-item-btn uninstall"
                onClick={() => handleUninstall(ext)}
                disabled={loading === ext.id}
              >
                {loading === ext.id ? "..." : "×"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ext-section">
        <div className="ext-section-title">
          {search ? "Search Results" : "Recommended (Open VSX)"}
        </div>
        {isLoading ? (
          <div className="ext-item">
            <span className="ext-item-icon">⏳</span>
            <div className="ext-item-info">
              <div className="ext-item-name">Loading...</div>
            </div>
          </div>
        ) : featured.length === 0 ? (
          <div className="ext-item">
            <span className="ext-item-icon">📭</span>
            <div className="ext-item-info">
              <div className="ext-item-name">No results</div>
            </div>
          </div>
        ) : (
          featured.map((ext) => (
            <div key={ext.id} className="ext-item">
              <span className="ext-item-icon">
                {ext.iconUrl ? <img src={ext.iconUrl} alt="" className="ext-icon-img" /> : "📦"}
              </span>
              <div className="ext-item-info">
                <div className="ext-item-name">{ext.displayName}</div>
                <div className="ext-item-meta">
                  ⬇️{(ext.downloads / 1000).toFixed(0)}k ⭐{ext.rating.toFixed(1)}
                </div>
              </div>
              {ext.installed ? (
                <span className="ext-item-installed">✓</span>
              ) : (
                <button
                  className="ext-item-btn install"
                  onClick={() => handleInstall(ext)}
                  disabled={loading === ext.id}
                >
                  {loading === ext.id ? "..." : "Install"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <button className="ext-open-marketplace" onClick={() => setShowMarketplace(true)}>
        🏪 Open Marketplace
      </button>
      <ExtensionMarketplace isOpen={showMarketplace} onClose={() => loadData()} />
    </div>
  );
});

ExtensionsPanel.displayName = "ExtensionsPanel";
