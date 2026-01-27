/**
 * useComposerState - 输入框状态管理
 * 处理输入内容、自动增高、快捷键、@提及触发
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface ComposerStateOptions {
  onSend: (input: string) => void;
  onStop: () => void;
  onPickerOpen: (pos: { x: number; y: number }) => void;
  isLoading: boolean;
}

export function useComposerState(options: ComposerStateOptions) {
  const { onSend, onStop, onPickerOpen, isLoading } = options;
  const [input, setInput] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Enter 发送（Shift+Enter 换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input);
        setInput('');
      }
    }
    // Escape 停止
    if (e.key === 'Escape' && isLoading) {
      onStop();
    }
    // @ 触发上下文选择器
    if (e.key === '@' && !showPicker) {
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) {
        onPickerOpen({ x: rect.left, y: rect.top - 330 });
      }
      setTimeout(() => setShowPicker(true), 50);
    }
  }, [input, isLoading, showPicker, onSend, onStop, onPickerOpen]);

  // 输入变化处理
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    // @ 触发上下文选择器
    if (value.endsWith('@') && !showPicker) {
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) {
        onPickerOpen({ x: rect.left, y: rect.top - 330 });
      }
      setShowPicker(true);
    }
  }, [showPicker, onPickerOpen]);

  // 发送处理
  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  }, [input, onSend]);

  // 关闭选择器时移除尾部 @
  const closePicker = useCallback(() => {
    setShowPicker(false);
    setInput(prev => prev.replace(/@$/, ''));
  }, []);

  return {
    input,
    setInput,
    textareaRef,
    showPicker,
    setShowPicker,
    closePicker,
    handleKeyDown,
    handleInputChange,
    handleSend
  };
}
