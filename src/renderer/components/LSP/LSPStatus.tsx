/**
 * LSP 状态指示器
 * 显示当前语言的LSP服务器状态
 */

import React, { useState, useEffect } from 'react';
import { lspClients } from '../../services/lspProviders';
import type { LSPClientState } from '../../../core/lsp/types';
import './LSPStatus.css';

interface LSPStatusProps {
  currentLanguage?: string;
}

export const LSPStatus: React.FC<LSPStatusProps> = ({ currentLanguage = 'typescript' }) => {
  const [state, setState] = useState<LSPClientState>('stopped');
  const [capabilities, setCapabilities] = useState<any>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    // 获取客户端状态
    const client = lspClients.get(currentLanguage);
    if (client) {
      setState(client.getState());
      const info = client.getInfo();
      setCapabilities(info.capabilities);
    } else {
      setState('stopped');
      setCapabilities(null);
    }

    // 定期更新状态
    const interval = setInterval(() => {
      const client = lspClients.get(currentLanguage);
      if (client) {
        setState(client.getState());
        const info = client.getInfo();
        setCapabilities(info.capabilities);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentLanguage]);

  const getStateIcon = () => {
    switch (state) {
      case 'running':
        return '●'; // 绿色圆点
      case 'starting':
        return '◐'; // 加载中
      case 'error':
        return '⚠'; // 错误
      case 'stopped':
      default:
        return '○'; // 灰色空心圆
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'running':
        return 'var(--vscode-testing-iconPassed)';
      case 'starting':
        return 'var(--vscode-testing-iconQueued)';
      case 'error':
        return 'var(--vscode-testing-iconFailed)';
      case 'stopped':
      default:
        return 'var(--vscode-descriptionForeground)';
    }
  };

  const getStateText = () => {
    switch (state) {
      case 'running':
        return 'LSP Active';
      case 'starting':
        return 'LSP Starting...';
      case 'error':
        return 'LSP Error';
      case 'stopped':
      default:
        return 'LSP Inactive';
    }
  };

  const hasCapability = (cap: string) => {
    return capabilities && capabilities[cap];
  };

  return (
    <div 
      className="lsp-status"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span 
        className="lsp-status-icon" 
        style={{ color: getStateColor() }}
        title={getStateText()}
      >
        {getStateIcon()}
      </span>
      <span className="lsp-status-text">{currentLanguage}</span>

      {hover && state === 'running' && (
        <div className="lsp-status-tooltip">
          <div className="lsp-tooltip-title">LSP Capabilities</div>
          <div className="lsp-tooltip-capabilities">
            <div className={hasCapability('completionProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('completionProvider') ? '✓' : '✗'} Completion
            </div>
            <div className={hasCapability('hoverProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('hoverProvider') ? '✓' : '✗'} Hover
            </div>
            <div className={hasCapability('definitionProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('definitionProvider') ? '✓' : '✗'} Go to Definition
            </div>
            <div className={hasCapability('referencesProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('referencesProvider') ? '✓' : '✗'} Find References
            </div>
            <div className={hasCapability('documentSymbolProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('documentSymbolProvider') ? '✓' : '✗'} Document Symbols
            </div>
            <div className={hasCapability('documentFormattingProvider') ? 'cap-active' : 'cap-inactive'}>
              {hasCapability('documentFormattingProvider') ? '✓' : '✗'} Formatting
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
