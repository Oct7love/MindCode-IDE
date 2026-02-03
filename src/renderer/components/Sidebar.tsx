import React, { useState } from 'react';
import { ExplorerIcon, SearchIcon, GitBranchIcon, ExtensionIcon, SettingsIcon, FolderIcon, FolderOpenIcon, FileIcon, ChevronRightIcon, ChevronDownIcon } from './icons';
import { ExtensionMarketplace } from './ExtensionMarketplace';
import { marketplaceService, type ExtensionInfo } from '../../core/plugins/marketplace';
import './Sidebar.css';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  expanded?: boolean;
}

const mockFiles: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    expanded: true,
    children: [
      { name: 'main', type: 'folder', children: [
        { name: 'index.ts', type: 'file' },
        { name: 'preload.ts', type: 'file' },
      ]},
      { name: 'renderer', type: 'folder', expanded: true, children: [
        { name: 'App.tsx', type: 'file' },
        { name: 'main.tsx', type: 'file' },
      ]},
      { name: 'core', type: 'folder', children: [
        { name: 'ai', type: 'folder', children: [] },
      ]},
    ]
  },
  { name: 'package.json', type: 'file' },
  { name: 'tsconfig.json', type: 'file' },
  { name: 'vite.config.ts', type: 'file' },
];

const FileTreeItem: React.FC<{ node: FileNode; depth: number }> = ({ node, depth }) => {
  const [expanded, setExpanded] = useState(node.expanded ?? false);

  const getFileColor = (name: string): string => {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return '#3178c6';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return '#f7df1e';
    if (name.endsWith('.json')) return '#cbcb41';
    if (name.endsWith('.css')) return '#563d7c';
    if (name.endsWith('.html')) return '#e34c26';
    return '#8b8b8b';
  };

  return (
    <>
      <div
        className={`file-item ${node.type}`}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
        onClick={() => node.type === 'folder' && setExpanded(!expanded)}
      >
        {node.type === 'folder' && (
          <span className="chevron">
            {expanded ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />}
          </span>
        )}
        {node.type === 'folder' ? (
          expanded ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />
        ) : (
          <FileIcon size={16} color={getFileColor(node.name)} />
        )}
        <span className="file-name">{node.name}</span>
      </div>
      {node.type === 'folder' && expanded && node.children?.map((child, i) => (
        <FileTreeItem key={`${child.name}-${i}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
};

// 扩展面板组件
const ExtensionsPanel: React.FC<{ onOpenMarketplace: () => void }> = ({ onOpenMarketplace }) => {
  const [search, setSearch] = useState('');
  const [installed, setInstalled] = useState<ExtensionInfo[]>([]);
  const [featured, setFeatured] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  React.useEffect(() => {
    setInstalled(marketplaceService.getInstalled());
    setFeatured(marketplaceService.getFeatured().slice(0, 5));
  }, []);

  const handleInstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.install(ext.id);
    setInstalled(marketplaceService.getInstalled());
    setFeatured(marketplaceService.getFeatured().slice(0, 5));
    setLoading(null);
  };

  const handleUninstall = async (ext: ExtensionInfo) => {
    setLoading(ext.id);
    await marketplaceService.uninstall(ext.id);
    setInstalled(marketplaceService.getInstalled());
    setFeatured(marketplaceService.getFeatured().slice(0, 5));
    setLoading(null);
  };

  const filteredFeatured = search ? marketplaceService.search(search).slice(0, 8) : featured;

  return (
    <>
      <div className="panel-header"><span className="panel-title">扩展</span></div>
      <div className="panel-content extensions-panel">
        {/* 搜索框 */}
        <div className="ext-search-box">
          <input type="text" placeholder="在市场中搜索扩展..." value={search} onChange={e => setSearch(e.target.value)} className="ext-search-input" />
        </div>

        {/* 已安装 */}
        {installed.length > 0 && (
          <div className="ext-section">
            <div className="ext-section-title">已安装 ({installed.length})</div>
            {installed.map(ext => (
              <div key={ext.id} className="ext-item">
                <span className="ext-item-icon">{ext.icon || '📦'}</span>
                <div className="ext-item-info">
                  <div className="ext-item-name">{ext.displayName}</div>
                  <div className="ext-item-author">{ext.author}</div>
                </div>
                <button className="ext-item-btn uninstall" onClick={() => handleUninstall(ext)} disabled={loading === ext.id}>{loading === ext.id ? '...' : '×'}</button>
              </div>
            ))}
          </div>
        )}

        {/* 推荐/搜索结果 */}
        <div className="ext-section">
          <div className="ext-section-title">{search ? '搜索结果' : '推荐'}</div>
          {filteredFeatured.map(ext => (
            <div key={ext.id} className="ext-item">
              <span className="ext-item-icon">{ext.icon || '📦'}</span>
              <div className="ext-item-info">
                <div className="ext-item-name">{ext.displayName}</div>
                <div className="ext-item-meta">⬇️{(ext.downloads/1000).toFixed(0)}k ⭐{ext.rating}</div>
              </div>
              {ext.installed ? (
                <span className="ext-item-installed">✓</span>
              ) : (
                <button className="ext-item-btn install" onClick={() => handleInstall(ext)} disabled={loading === ext.id}>{loading === ext.id ? '...' : '安装'}</button>
              )}
            </div>
          ))}
        </div>

        {/* 打开完整市场 */}
        <button className="ext-open-marketplace" onClick={onOpenMarketplace}>🏪 打开扩展市场</button>
      </div>
    </>
  );
};

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'git' | 'extensions'>('explorer');
  const [showMarketplace, setShowMarketplace] = useState(false);

  const panelTitles = { explorer: '资源管理器', search: '搜索', git: '源代码管理', extensions: '扩展' };

  return (
    <div className="sidebar">
      <div className="activity-bar">
        <div className="activity-icons">
          <button className={`activity-icon ${activeTab === 'explorer' ? 'active' : ''}`} onClick={() => setActiveTab('explorer')} title="资源管理器 (Ctrl+Shift+E)"><ExplorerIcon size={24} /></button>
          <button className={`activity-icon ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')} title="搜索 (Ctrl+Shift+F)"><SearchIcon size={24} /></button>
          <button className={`activity-icon ${activeTab === 'git' ? 'active' : ''}`} onClick={() => setActiveTab('git')} title="源代码管理 (Ctrl+Shift+G)"><GitBranchIcon size={24} /></button>
          <button className={`activity-icon ${activeTab === 'extensions' ? 'active' : ''}`} onClick={() => setActiveTab('extensions')} title="扩展 (Ctrl+Shift+X)"><ExtensionIcon size={24} /></button>
        </div>
        <div className="activity-bottom">
          <button className="activity-icon" title="设置"><SettingsIcon size={24} /></button>
        </div>
      </div>

      <div className="sidebar-panel">
        {activeTab === 'extensions' ? (
          <ExtensionsPanel onOpenMarketplace={() => setShowMarketplace(true)} />
        ) : (
          <>
            <div className="panel-header"><span className="panel-title">{panelTitles[activeTab]}</span></div>
            <div className="panel-content">
              {activeTab === 'explorer' && (
                <div className="section">
                  <div className="section-header"><ChevronDownIcon size={10} /><span>MINDCODE</span></div>
                  <div className="file-tree">{mockFiles.map((node, i) => <FileTreeItem key={`${node.name}-${i}`} node={node} depth={0} />)}</div>
                </div>
              )}
              {activeTab === 'search' && (
                <div className="search-panel">
                  <input type="text" placeholder="搜索..." className="search-input" />
                  <div className="search-options"><label><input type="checkbox" /> 区分大小写</label><label><input type="checkbox" /> 全词匹配</label><label><input type="checkbox" /> 正则表达式</label></div>
                </div>
              )}
              {activeTab === 'git' && (
                <div className="git-panel">
                  <div className="git-message"><textarea placeholder="提交消息..." rows={3}></textarea></div>
                  <button className="git-commit-btn">✓ 提交</button>
                  <div className="git-section"><div className="git-section-title">更改</div><div className="git-empty">暂无更改</div></div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 扩展市场弹窗 */}
      <ExtensionMarketplace isOpen={showMarketplace} onClose={() => setShowMarketplace(false)} />
    </div>
  );
};

export default Sidebar;
