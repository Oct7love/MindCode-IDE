import React, { useState } from 'react';
import { ExplorerIcon, SearchIcon, GitBranchIcon, ExtensionIcon, SettingsIcon, FolderIcon, FolderOpenIcon, FileIcon, ChevronRightIcon, ChevronDownIcon } from './icons';
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

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'git' | 'extensions'>('explorer');

  return (
    <div className="sidebar">
      <div className="activity-bar">
        <div className="activity-icons">
          <button
            className={`activity-icon ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
            title="资源管理器"
          >
            <ExplorerIcon size={24} />
          </button>
          <button
            className={`activity-icon ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
            title="搜索"
          >
            <SearchIcon size={24} />
          </button>
          <button
            className={`activity-icon ${activeTab === 'git' ? 'active' : ''}`}
            onClick={() => setActiveTab('git')}
            title="源代码管理"
          >
            <GitBranchIcon size={24} />
          </button>
          <button
            className={`activity-icon ${activeTab === 'extensions' ? 'active' : ''}`}
            onClick={() => setActiveTab('extensions')}
            title="扩展"
          >
            <ExtensionIcon size={24} />
          </button>
        </div>
        <div className="activity-bottom">
          <button className="activity-icon" title="设置">
            <SettingsIcon size={24} />
          </button>
        </div>
      </div>

      <div className="sidebar-panel">
        <div className="panel-header">
          <span className="panel-title">资源管理器</span>
        </div>
        <div className="panel-content">
          <div className="section">
            <div className="section-header">
              <ChevronDownIcon size={10} />
              <span>MINDCODE</span>
            </div>
            <div className="file-tree">
              {mockFiles.map((node, i) => (
                <FileTreeItem key={`${node.name}-${i}`} node={node} depth={0} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
