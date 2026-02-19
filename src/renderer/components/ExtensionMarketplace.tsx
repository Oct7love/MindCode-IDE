/**
 * 扩展市场组件 - 浏览/搜索/安装/权限确认
 */

import React, { useState, useEffect, useCallback } from "react";
import { marketplaceService, type ExtensionInfo } from "../../core/plugins/marketplace";
import "./ExtensionMarketplace.css";

/** 权限描述映射 */
const PERMISSION_LABELS: Record<string, { label: string; risk: "low" | "medium" | "high" }> = {
  "fs.read": { label: "读取文件", risk: "low" },
  "fs.write": { label: "写入文件", risk: "medium" },
  editor: { label: "编辑器操作", risk: "low" },
  workspace: { label: "工作区访问", risk: "low" },
  terminal: { label: "终端命令执行", risk: "high" },
  git: { label: "Git 操作", risk: "medium" },
  network: { label: "网络请求", risk: "medium" },
  ai: { label: "AI API 调用", risk: "medium" },
};

interface ExtensionMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 安装前权限确认对话框 */
const PermissionConfirmDialog: React.FC<{
  ext: ExtensionInfo;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ ext, onConfirm, onCancel }) => {
  // 从缓存或 fallback 推断权限（市场扩展无 manifest.permissions）
  const permissions = (ext as unknown as { permissions?: string[] }).permissions || ["editor"];
  const hasHighRisk = permissions.some((p) => PERMISSION_LABELS[p]?.risk === "high");

  return (
    <div className="ext-confirm-overlay" onClick={onCancel}>
      <div className="ext-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>🔒 权限确认</h3>
        <p className="ext-confirm-name">
          安装 <strong>{ext.displayName}</strong> (v{ext.version}) by {ext.author}
        </p>
        <div className="ext-confirm-perms">
          <p>此扩展请求以下权限：</p>
          <ul>
            {permissions.map((p) => {
              const info = PERMISSION_LABELS[p] || { label: p, risk: "low" };
              return (
                <li key={p} className={`ext-perm-item risk-${info.risk}`}>
                  <span className="ext-perm-icon">
                    {info.risk === "high" ? "⚠️" : info.risk === "medium" ? "🔶" : "✅"}
                  </span>
                  <span>{info.label}</span>
                  {info.risk === "high" && <span className="ext-perm-warn">高风险</span>}
                </li>
              );
            })}
          </ul>
        </div>
        {hasHighRisk && (
          <div className="ext-confirm-warning">
            ⚠️ 此扩展请求了高风险权限，请确认你信任此扩展的来源。
          </div>
        )}
        <div className="ext-confirm-actions">
          <button className="ext-btn cancel" onClick={onCancel}>
            取消
          </button>
          <button className="ext-btn install" onClick={onConfirm}>
            确认安装
          </button>
        </div>
      </div>
    </div>
  );
};

export const ExtensionMarketplace: React.FC<ExtensionMarketplaceProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<"marketplace" | "installed">("marketplace");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [installed, setInstalled] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmExt, setConfirmExt] = useState<ExtensionInfo | null>(null);
  const [updates, setUpdates] = useState<Map<string, string>>(new Map());
  const categories = marketplaceService.getCategories();

  const loadExtensions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = search
        ? await marketplaceService.search(search, category)
        : await marketplaceService.getByCategory(category);
      setExtensions(list);
      setInstalled(marketplaceService.getInstalled());
    } catch (err) {
      console.error("[Marketplace] 加载失败:", err);
    }
    setIsLoading(false);
  }, [search, category]);

  useEffect(() => {
    if (isOpen) loadExtensions();
  }, [isOpen, loadExtensions]);

  // 打开已安装标签页时检查更新
  useEffect(() => {
    if (isOpen && tab === "installed" && installed.length > 0) {
      marketplaceService
        .checkUpdates()
        .then((result) => {
          const map = new Map<string, string>();
          result.forEach((u) => map.set(u.id, u.latest));
          setUpdates(map);
        })
        .catch(() => {});
    }
  }, [isOpen, tab, installed.length]);

  // 安装前弹出权限确认
  const handleInstallClick = (ext: ExtensionInfo) => {
    setConfirmExt(ext);
  };

  const handleConfirmInstall = async () => {
    if (!confirmExt) return;
    setConfirmExt(null);
    setLoading(confirmExt.id);
    await marketplaceService.install(confirmExt.id);
    loadExtensions();
    setLoading(null);
  };

  const handleUninstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.uninstall(ext.id);
    loadExtensions();
    setLoading(null);
  };

  const handleToggle = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.setEnabled(ext.id, !ext.enabled);
    loadExtensions();
    setLoading(null);
  };

  const handleUpdate = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.update(ext.id);
    loadExtensions();
    setLoading(null);
    setUpdates((prev) => {
      const n = new Map(prev);
      n.delete(ext.id);
      return n;
    });
  };

  if (!isOpen) return null;

  const displayList = tab === "installed" ? installed : extensions;

  return (
    <div className="ext-marketplace-overlay" onClick={onClose}>
      <div className="ext-marketplace" onClick={(e) => e.stopPropagation()}>
        {/* 权限确认弹窗 */}
        {confirmExt && (
          <PermissionConfirmDialog
            ext={confirmExt}
            onConfirm={handleConfirmInstall}
            onCancel={() => setConfirmExt(null)}
          />
        )}

        {/* 头部 */}
        <div className="ext-header">
          <h2>🧩 扩展市场</h2>
          <button className="ext-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* 标签切换 */}
        <div className="ext-tabs">
          <button
            className={`ext-tab ${tab === "marketplace" ? "active" : ""}`}
            onClick={() => setTab("marketplace")}
          >
            🏪 市场
          </button>
          <button
            className={`ext-tab ${tab === "installed" ? "active" : ""}`}
            onClick={() => setTab("installed")}
          >
            📦 已安装 ({installed.length})
          </button>
        </div>

        {/* 搜索和分类 */}
        {tab === "marketplace" && (
          <div className="ext-filters">
            <input
              className="ext-search"
              placeholder="🔍 搜索扩展..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="ext-categories">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`ext-category ${category === cat.id ? "active" : ""}`}
                  onClick={() => setCategory(cat.id)}
                >
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
              {[1, 2, 3, 4].map((i) => (
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
            <div className="ext-empty">
              {tab === "installed" ? "暂无已安装扩展" : "未找到匹配的扩展"}
            </div>
          ) : (
            displayList.map((ext) => (
              <div key={ext.id} className="ext-card">
                <div className="ext-icon">
                  {ext.iconUrl ? (
                    <img
                      src={ext.iconUrl}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: 4 }}
                    />
                  ) : (
                    "📦"
                  )}
                </div>
                <div className="ext-info">
                  <div className="ext-title">
                    <span className="ext-name">{ext.displayName}</span>
                    <span className="ext-version">v{ext.version}</span>
                    {ext.installed && <span className="ext-installed-badge">已安装</span>}
                    {updates.has(ext.id) && (
                      <span className="ext-update-badge">有更新 v{updates.get(ext.id)}</span>
                    )}
                  </div>
                  <div className="ext-author">by {ext.author}</div>
                  <div className="ext-desc">{ext.description}</div>
                  <div className="ext-meta">
                    <span>⬇️ {(ext.downloads / 1000).toFixed(0)}k</span>
                    <span>⭐ {ext.rating}</span>
                    <span className="ext-tags">
                      {ext.tags.slice(0, 3).map((t) => (
                        <span key={t} className="ext-tag">
                          {t}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="ext-actions">
                  {ext.installed ? (
                    <>
                      {updates.has(ext.id) && (
                        <button
                          className="ext-btn update"
                          onClick={() => handleUpdate(ext)}
                          disabled={loading === ext.id}
                        >
                          {loading === ext.id ? "更新中..." : "更新"}
                        </button>
                      )}
                      <button
                        className={`ext-btn ${ext.enabled ? "enabled" : "disabled"}`}
                        onClick={() => handleToggle(ext)}
                        disabled={loading === ext.id}
                      >
                        {ext.enabled ? "✓ 已启用" : "○ 已禁用"}
                      </button>
                      <button
                        className="ext-btn uninstall"
                        onClick={() => handleUninstall(ext)}
                        disabled={loading === ext.id}
                      >
                        卸载
                      </button>
                    </>
                  ) : (
                    <button
                      className="ext-btn install"
                      onClick={() => handleInstallClick(ext)}
                      disabled={loading === ext.id}
                    >
                      {loading === ext.id ? "安装中..." : "安装"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="ext-footer">💡 提示：安装扩展前请确认权限需求，高风险权限需要特别注意</div>
      </div>
    </div>
  );
};

export default ExtensionMarketplace;
