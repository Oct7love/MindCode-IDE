/**
 * WorkspaceTrust - 工作区信任对话框
 */

import React, { useState } from 'react';

interface WorkspaceTrustProps { workspacePath: string; onTrust: (trusted: boolean) => void; onClose: () => void; }

export const WorkspaceTrust: React.FC<WorkspaceTrustProps> = ({ workspacePath, onTrust, onClose }) => {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleTrust = (trusted: boolean) => {
    if (rememberChoice) {
      const trustedPaths = JSON.parse(localStorage.getItem('mindcode-trusted-workspaces') || '[]');
      if (trusted && !trustedPaths.includes(workspacePath)) { trustedPaths.push(workspacePath); localStorage.setItem('mindcode-trusted-workspaces', JSON.stringify(trustedPaths)); }
    }
    onTrust(trusted);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-[500px] bg-[var(--color-bg-elevated)] rounded-lg shadow-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[var(--color-warning-bg)] rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">是否信任此工作区？</h2>
              <p className="text-sm text-[var(--color-text-muted)]">信任工作区将启用所有功能</p>
            </div>
          </div>

          <div className="bg-[var(--color-bg-base)] rounded-lg p-3 mb-4">
            <p className="text-sm text-[var(--color-text-secondary)] font-mono break-all">{workspacePath}</p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-success)]">✓</span>
              <div>
                <p className="text-sm font-medium">信任模式</p>
                <p className="text-xs text-[var(--color-text-muted)]">启用任务运行、终端、调试、扩展等完整功能</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-warning)]">⚠</span>
              <div>
                <p className="text-sm font-medium">受限模式</p>
                <p className="text-xs text-[var(--color-text-muted)]">禁用可能执行代码的功能，仅允许浏览和编辑文件</p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer mb-4">
            <input type="checkbox" checked={rememberChoice} onChange={e => setRememberChoice(e.target.checked)} className="w-4 h-4 rounded" />
            <span>记住此工作区的选择</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-[var(--color-bg-base)] border-t border-[var(--color-border)]">
          <button onClick={() => handleTrust(false)} className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">受限模式</button>
          <button onClick={() => handleTrust(true)} className="px-4 py-2 text-sm rounded bg-[var(--color-accent-primary)] text-white hover:opacity-90">信任工作区</button>
        </div>
      </div>
    </div>
  );
};

export function checkWorkspaceTrust(workspacePath: string): boolean {
  const trustedPaths = JSON.parse(localStorage.getItem('mindcode-trusted-workspaces') || '[]');
  return trustedPaths.includes(workspacePath);
}

export default WorkspaceTrust;
