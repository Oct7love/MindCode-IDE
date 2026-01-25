import React, { useState, useEffect, useCallback } from 'react';

interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

interface GitPanelProps {
  workspacePath: string | null;
}

// 状态图标
const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    modified: '#e2c08d',
    added: '#89d185',
    deleted: '#f14c4c',
    renamed: '#4ec9b0',
    untracked: '#73c991',
    conflicted: '#f48771',
  };
  const labels: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: 'U',
    conflicted: '!',
  };
  return (
    <span style={{ color: colors[status] || '#888', fontWeight: 600, fontSize: 11, marginLeft: 'auto', paddingRight: 8 }}>
      {labels[status] || '?'}
    </span>
  );
};

export const GitPanel: React.FC<GitPanelProps> = ({ workspacePath }) => {
  const [isRepo, setIsRepo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState('');
  const [stagedFiles, setStagedFiles] = useState<GitFile[]>([]);
  const [changedFiles, setChangedFiles] = useState<GitFile[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);

  // 刷新 Git 状态
  const refreshStatus = useCallback(async () => {
    if (!workspacePath || !window.mindcode?.git) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 检查是否是 Git 仓库
      const repoResult = await window.mindcode.git.isRepo(workspacePath);
      if (!repoResult.success || !repoResult.data) {
        setIsRepo(false);
        setLoading(false);
        return;
      }
      setIsRepo(true);

      // 获取当前分支
      const branchResult = await window.mindcode.git.currentBranch(workspacePath);
      if (branchResult.success && branchResult.data) {
        setBranch(branchResult.data);
      }

      // 获取文件状态
      const statusResult = await window.mindcode.git.status(workspacePath);
      if (statusResult.success && statusResult.data) {
        const staged = statusResult.data.filter(f => f.staged);
        const unstaged = statusResult.data.filter(f => !f.staged);
        setStagedFiles(staged as GitFile[]);
        setChangedFiles(unstaged as GitFile[]);
      }
    } catch (err) {
      console.error('Git status error:', err);
    }
    setLoading(false);
  }, [workspacePath]);

  // 初始加载
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 暂存文件
  const stageFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    await window.mindcode.git.stage(workspacePath, [filePath]);
    refreshStatus();
  };

  // 暂存所有
  const stageAll = async () => {
    if (!workspacePath || !window.mindcode?.git) return;
    const paths = changedFiles.map(f => f.path);
    if (paths.length > 0) {
      await window.mindcode.git.stage(workspacePath, paths);
      refreshStatus();
    }
  };

  // 取消暂存
  const unstageFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    await window.mindcode.git.unstage(workspacePath, [filePath]);
    refreshStatus();
  };

  // 取消暂存所有
  const unstageAll = async () => {
    if (!workspacePath || !window.mindcode?.git) return;
    const paths = stagedFiles.map(f => f.path);
    if (paths.length > 0) {
      await window.mindcode.git.unstage(workspacePath, paths);
      refreshStatus();
    }
  };

  // 放弃修改
  const discardFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    if (confirm(`确定要放弃对 ${filePath} 的修改吗？`)) {
      await window.mindcode.git.discard(workspacePath, filePath);
      refreshStatus();
    }
  };

  // 提交
  const commit = async () => {
    if (!workspacePath || !window.mindcode?.git || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      const result = await window.mindcode.git.commit(workspacePath, commitMessage.trim());
      if (result.success) {
        setCommitMessage('');
        refreshStatus();
      } else {
        alert(`提交失败: ${result.error}`);
      }
    } catch (err: any) {
      alert(`提交失败: ${err.message}`);
    }
    setCommitting(false);
  };

  if (loading) {
    return (
      <div className="git-panel">
        <div className="git-loading">加载中...</div>
      </div>
    );
  }

  if (!workspacePath) {
    return (
      <div className="git-panel">
        <div className="git-empty">请先打开一个文件夹</div>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="git-panel">
        <div className="git-empty">
          <p>当前文件夹不是 Git 仓库</p>
          <button
            className="git-init-btn"
            onClick={async () => {
              if (window.mindcode?.terminal) {
                await window.mindcode.terminal.execute('git init', workspacePath);
                refreshStatus();
              }
            }}
          >
            初始化仓库
          </button>
        </div>
      </div>
    );
  }

  const totalChanges = stagedFiles.length + changedFiles.length;

  return (
    <div className="git-panel">
      {/* 分支信息 */}
      <div className="git-branch">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0z"/>
        </svg>
        <span>{branch || 'main'}</span>
        <button className="git-refresh-btn" onClick={refreshStatus} title="刷新">
          ↻
        </button>
      </div>

      {/* 提交输入框 */}
      <div className="git-commit-box">
        <input
          type="text"
          className="git-commit-input"
          placeholder="提交信息"
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit()}
        />
        <button
          className="git-commit-btn"
          onClick={commit}
          disabled={committing || !commitMessage.trim() || stagedFiles.length === 0}
          title={stagedFiles.length === 0 ? '没有暂存的更改' : '提交'}
        >
          {committing ? '...' : '✓'}
        </button>
      </div>

      {/* 暂存的更改 */}
      {stagedFiles.length > 0 && (
        <div className="git-section">
          <div className="git-section-header">
            <span>暂存的更改</span>
            <span className="git-count">{stagedFiles.length}</span>
            <button className="git-action-btn" onClick={unstageAll} title="取消全部暂存">−</button>
          </div>
          <div className="git-file-list">
            {stagedFiles.map(file => (
              <div key={file.path} className="git-file-item">
                <span className="git-file-name" title={file.path}>
                  {file.path.split(/[/\\]/).pop()}
                </span>
                <StatusIcon status={file.status} />
                <button className="git-file-action" onClick={() => unstageFile(file.path)} title="取消暂存">−</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 更改 */}
      {changedFiles.length > 0 && (
        <div className="git-section">
          <div className="git-section-header">
            <span>更改</span>
            <span className="git-count">{changedFiles.length}</span>
            <button className="git-action-btn" onClick={stageAll} title="暂存全部">+</button>
          </div>
          <div className="git-file-list">
            {changedFiles.map(file => (
              <div key={file.path} className="git-file-item">
                <span className="git-file-name" title={file.path}>
                  {file.path.split(/[/\\]/).pop()}
                </span>
                <StatusIcon status={file.status} />
                <button className="git-file-action" onClick={() => stageFile(file.path)} title="暂存">+</button>
                {file.status !== 'untracked' && (
                  <button className="git-file-action" onClick={() => discardFile(file.path)} title="放弃更改">↩</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无更改 */}
      {totalChanges === 0 && (
        <div className="git-empty">没有更改</div>
      )}
    </div>
  );
};

export default GitPanel;
