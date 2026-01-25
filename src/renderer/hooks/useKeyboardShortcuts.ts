import { useEffect } from 'react';
import { useUIStore, useFileStore, useAIStore } from '../stores';

export function useKeyboardShortcuts() {
  const { openCommandPalette, closeCommandPalette, showCommandPalette, toggleAIPanel, toggleTerminal } = useUIStore();
  const { activeFileId, closeFile, getActiveFile, openFiles } = useFileStore();
  const { createConversation } = useAIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      
      if (ctrl && e.key === 'p' && !e.shiftKey) { // Ctrl+P - 快速打开文件
        e.preventDefault();
        openCommandPalette('files');
        return;
      }
      if (ctrl && e.shiftKey && e.key === 'P') { // Ctrl+Shift+P - 命令面板
        e.preventDefault();
        openCommandPalette('commands');
        return;
      }
      if (ctrl && e.shiftKey && e.key === 'F') { // Ctrl+Shift+F - 全局搜索
        e.preventDefault();
        openCommandPalette('search');
        return;
      }
      if (ctrl && e.key === 'l') { // Ctrl+L - 打开/关闭 AI 面板
        e.preventDefault();
        toggleAIPanel();
        return;
      }
      if (ctrl && e.key === '`') { // Ctrl+` - 打开/关闭终端
        e.preventDefault();
        toggleTerminal();
        return;
      }
      if (ctrl && e.key === 'j') { // Ctrl+J - 打开/关闭终端（备选）
        e.preventDefault();
        toggleTerminal();
        return;
      }
      if (ctrl && e.key === 'w') { // Ctrl+W - 关闭当前文件
        e.preventDefault();
        if (activeFileId) closeFile(activeFileId);
        return;
      }
      if (ctrl && e.key === 'n') { // Ctrl+N - 新建对话
        e.preventDefault();
        createConversation();
        return;
      }
      if (e.key === 'Escape' && showCommandPalette) { // Escape - 关闭命令面板
        e.preventDefault();
        closeCommandPalette();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, showCommandPalette, openCommandPalette, closeCommandPalette, toggleAIPanel, toggleTerminal, closeFile, createConversation]);
}
