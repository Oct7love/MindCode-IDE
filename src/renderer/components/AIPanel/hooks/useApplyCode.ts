/**
 * useApplyCode - 代码应用 Hook
 * 
 * 简化版：直接应用代码，无需预览弹窗
 * 类似 Cursor 的 Accept 行为
 */
import { useState, useCallback } from 'react';
import { 
  cleanCodeForApply,
  detectFilePath,
  getExtensionForLanguage 
} from '../utils/applyService';
import { useFileStore } from '../../../stores';

interface UseApplyCodeReturn {
  /** 直接应用代码 */
  applyCode: (code: string, filePath: string | null, language: string, contextText?: string) => Promise<boolean>;
  /** 是否正在应用 */
  isApplying: boolean;
  /** 应用成功消息 */
  successMessage: string | null;
  /** 错误信息 */
  error: string | null;
  /** 清除消息 */
  clearMessages: () => void;
}

export function useApplyCode(): UseApplyCodeReturn {
  const [isApplying, setIsApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { workspaceRoot, openFile, updateFileContent, getActiveFile, openFiles } = useFileStore();

  /**
   * 清除消息
   */
  const clearMessages = useCallback(() => {
    setSuccessMessage(null);
    setError(null);
  }, []);

  /**
   * 直接应用代码（Cursor 风格）
   */
  const applyCode = useCallback(async (
    code: string, 
    filePath: string | null, 
    language: string,
    contextText?: string
  ): Promise<boolean> => {
    setIsApplying(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // 1. 检测文件路径
      let targetPath = filePath;
      if (!targetPath) {
        targetPath = detectFilePath(code, language, contextText);
      }
      
      // 2. 如果仍然没有路径，尝试使用当前活动文件
      if (!targetPath) {
        const activeFile = getActiveFile();
        if (activeFile && !activeFile.path.includes('[Preview]')) {
          targetPath = activeFile.path;
        }
      }
      
      // 3. 如果还是没有，生成一个新文件路径
      if (!targetPath) {
        const ext = getExtensionForLanguage(language);
        targetPath = `untitled-${Date.now()}.${ext}`;
      }
      
      // 4. 清理代码（移除文件路径注释）
      const cleanedCode = cleanCodeForApply(code);
      
      // 5. 构建完整路径
      const fullPath = targetPath.startsWith('/') || targetPath.match(/^[a-zA-Z]:/)
        ? targetPath
        : workspaceRoot 
          ? `${workspaceRoot}/${targetPath}`
          : targetPath;
      
      // 6. 写入文件
      if (window.mindcode?.fs?.writeFile) {
        const result = await window.mindcode.fs.writeFile(fullPath, cleanedCode);
        if (!result.success) {
          throw new Error(result.error || '写入文件失败');
        }
      }
      
      // 7. 在编辑器中打开文件
      const fileName = fullPath.split(/[/\\]/).pop() || 'untitled';
      
      // 检查文件是否已在编辑器中打开
      const existingFile = openFiles.find(f => f.path === fullPath);
      if (existingFile) {
        // 如果文件已打开，更新其内容
        updateFileContent(existingFile.id, cleanedCode);
      }
      
      // 打开或切换到文件
      openFile({
        id: existingFile?.id || `file_${Date.now()}`,
        path: fullPath,
        name: fileName,
        content: cleanedCode,
        language: language,
        isDirty: false,
      });
      
      setSuccessMessage(`已应用到 ${fileName}`);
      console.log('[ApplyCode] Applied:', fullPath);
      
      // 3秒后清除成功消息
      setTimeout(() => setSuccessMessage(null), 3000);
      
      return true;
      
    } catch (err: any) {
      setError(err.message || '应用代码失败');
      console.error('[ApplyCode] Error:', err);
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [workspaceRoot, getActiveFile, openFile, openFiles, updateFileContent]);

  return {
    applyCode,
    isApplying,
    successMessage,
    error,
    clearMessages,
  };
}

export default useApplyCode;
