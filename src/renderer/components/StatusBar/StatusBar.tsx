import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFileStore, SUPPORTED_LANGUAGES, EditorFile } from '../../stores';
import { EncodingPicker } from '../EncodingPicker';
import './StatusBar.css';

interface StatusBarProps {
  workspaceRoot: string | null;
  activeFile: EditorFile | undefined;
  zoomPercent: number;
  cursorPosition: { line: number; column: number };
  onLanguageChange: (fileId: string, language: string) => void;
}

interface GitInfo {
  branch: string;
  staged: number;
  unstaged: number;
  isRepo: boolean;
}

interface IndentSettings {
  type: 'spaces' | 'tabs';
  size: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  workspaceRoot,
  activeFile,
  zoomPercent,
  cursorPosition,
  onLanguageChange,
}) => {
  const { setFileEncoding } = useFileStore();
  const [gitInfo, setGitInfo] = useState<GitInfo>({ branch: '', staged: 0, unstaged: 0, isRepo: false });
  const [showIndentPicker, setShowIndentPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [indent, setIndent] = useState<IndentSettings>({ type: 'spaces', size: 2 });
  const [langFilter, setLangFilter] = useState('');
  const indentRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // 获取 Git 信息
  const fetchGitInfo = useCallback(async () => {
    if (!workspaceRoot) { setGitInfo({ branch: '', staged: 0, unstaged: 0, isRepo: false }); return; }
    try {
      const isRepoRes = await window.mindcode?.git?.isRepo(workspaceRoot);
      if (!isRepoRes?.data) { setGitInfo({ branch: '', staged: 0, unstaged: 0, isRepo: false }); return; }
      
      const [branchRes, statusRes] = await Promise.all([
        window.mindcode?.git?.currentBranch(workspaceRoot),
        window.mindcode?.git?.status(workspaceRoot),
      ]);
      
      const branch = branchRes?.data || 'HEAD';
      const files = statusRes?.data || [];
      const staged = files.filter((f: any) => f.staged).length;
      const unstaged = files.filter((f: any) => !f.staged).length;
      
      setGitInfo({ branch, staged, unstaged, isRepo: true });
    } catch { setGitInfo({ branch: '', staged: 0, unstaged: 0, isRepo: false }); }
  }, [workspaceRoot]);

  // 定时刷新 Git 信息
  useEffect(() => {
    fetchGitInfo();
    const interval = setInterval(fetchGitInfo, 5000); // 每 5 秒刷新
    return () => clearInterval(interval);
  }, [fetchGitInfo]);

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (indentRef.current && !indentRef.current.contains(e.target as Node)) setShowIndentPicker(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangPicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取语言显示名称
  const getLanguageDisplayName = (fileName: string): string => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    const lang = SUPPORTED_LANGUAGES.find(l => l.ext === ext);
    return lang?.name || 'Plain Text';
  };

  const currentLang = activeFile ? getLanguageDisplayName(activeFile.name) : 'Plain Text';
  const currentLangId = activeFile?.language || SUPPORTED_LANGUAGES.find(l => l.ext === '.' + activeFile?.name.split('.').pop())?.id || 'plaintext';

  const filteredLangs = SUPPORTED_LANGUAGES.filter(l => 
    l.name.toLowerCase().includes(langFilter.toLowerCase()) || l.id.includes(langFilter.toLowerCase())
  );

  return (
    <div className="statusbar">
      {/* 左侧：Git 信息 */}
      <div className="statusbar-left">
        {gitInfo.isRepo ? (
          <>
            <span className="status-item status-item-git" title={`当前分支: ${gitInfo.branch}`}>
              <span className="git-icon">⎇</span> {gitInfo.branch || 'HEAD'}
            </span>
            <span className="status-item" title={`未暂存: ${gitInfo.unstaged}, 已暂存: ${gitInfo.staged}`}>
              <span className="git-unstaged">○ {gitInfo.unstaged}</span>
              <span className="git-staged">△ {gitInfo.staged}</span>
            </span>
          </>
        ) : (
          <span className="status-item status-item-dim">无 Git 仓库</span>
        )}
      </div>

      {/* 右侧：文件信息 */}
      <div className="statusbar-right">
        {/* 行列信息 */}
        <span className="status-item" title="光标位置">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>

        {/* 缩进设置 */}
        <div ref={indentRef} className="status-item-wrapper">
          <span 
            className="status-item status-item-clickable" 
            onClick={() => setShowIndentPicker(!showIndentPicker)}
            title="点击更改缩进设置"
          >
            {indent.type === 'spaces' ? 'Spaces' : 'Tabs'}: {indent.size}
          </span>
          {showIndentPicker && (
            <div className="statusbar-picker indent-picker">
              <div className="picker-section">
                <div className="picker-label">缩进类型</div>
                <div className="picker-options">
                  <button className={indent.type === 'spaces' ? 'active' : ''} onClick={() => setIndent({ ...indent, type: 'spaces' })}>Spaces</button>
                  <button className={indent.type === 'tabs' ? 'active' : ''} onClick={() => setIndent({ ...indent, type: 'tabs' })}>Tabs</button>
                </div>
              </div>
              <div className="picker-section">
                <div className="picker-label">缩进大小</div>
                <div className="picker-options">
                  {[2, 4, 8].map(size => (
                    <button key={size} className={indent.size === size ? 'active' : ''} onClick={() => setIndent({ ...indent, size })}>{size}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 编码选择器 */}
        <EncodingPicker
          currentEncoding={activeFile?.encoding || 'utf8'}
          onSelect={(enc) => activeFile && setFileEncoding(activeFile.id, enc)}
        />

        {/* 语言选择器 */}
        <div ref={langRef} className="status-item-wrapper">
          <span 
            className="status-item status-item-clickable" 
            onClick={() => { setShowLangPicker(!showLangPicker); setLangFilter(''); }}
            title="点击更改语言模式"
          >
            {currentLang}
          </span>
          {showLangPicker && (
            <div className="statusbar-picker lang-picker">
              <input
                type="text"
                placeholder="搜索语言..."
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
                autoFocus
                className="picker-search"
              />
              <div className="picker-list">
                {filteredLangs.map(lang => (
                  <div
                    key={lang.id}
                    className={`picker-item ${lang.id === currentLangId ? 'active' : ''}`}
                    onClick={() => {
                      if (activeFile) onLanguageChange(activeFile.id, lang.id);
                      setShowLangPicker(false);
                    }}
                  >
                    <span className="lang-name">{lang.name}</span>
                    <span className="lang-ext">{lang.ext}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 缩放 */}
        <span className="status-item" title="Ctrl+Shift++ 放大, Ctrl+Shift+- 缩小">
          🔍 {zoomPercent}%
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
