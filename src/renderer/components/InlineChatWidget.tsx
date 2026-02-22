/**
 * MindCode - 内联对话组件 (Ctrl+I)
 * Cursor 风格的代码内对话气泡，支持直接在光标位置与 AI 对话
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import * as monaco from "monaco-editor";
import "./InlineChatWidget.css";

interface InlineChatWidgetProps {
  editor: monaco.editor.IStandaloneCodeEditor;
  isOpen: boolean;
  position: { lineNumber: number; column: number };
  onClose: () => void;
  onInsertCode: (code: string, position: { lineNumber: number; column: number }) => void;
}

export const InlineChatWidget: React.FC<InlineChatWidgetProps> = ({
  editor,
  isOpen,
  position,
  onClose,
  onInsertCode,
}) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    [],
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // 计算 widget 位置
  const [widgetPos, setWidgetPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!isOpen || !editor) return;
    const coords = editor.getScrolledVisiblePosition(
      new monaco.Position(position.lineNumber, position.column),
    );
    if (coords) {
      const container = editor.getDomNode()?.getBoundingClientRect();
      if (container)
        setWidgetPos({
          top: container.top + coords.top + coords.height,
          left: container.left + coords.left,
        });
    }
    inputRef.current?.focus();
    setMessages([]);
    setInput("");
    setStreamingContent("");
  }, [isOpen, position, editor]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  // 滚动到底部
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  // 获取上下文代码
  const getContextCode = useCallback(() => {
    const model = editor.getModel();
    if (!model) return "";
    const start = Math.max(1, position.lineNumber - 20);
    const end = Math.min(model.getLineCount(), position.lineNumber + 20);
    const lines: string[] = [];
    for (let i = start; i <= end; i++) lines.push(model.getLineContent(i));
    return lines.join("\n");
  }, [editor, position]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setStreamingContent("");

    const contextCode = getContextCode();
    const systemPrompt = `你是代码助手，用户在代码的第 ${position.lineNumber} 行位置提问。

上下文代码：
\`\`\`
${contextCode}
\`\`\`

光标位置：第 ${position.lineNumber} 行，第 ${position.column} 列

回答用户问题。如果用户要求生成代码，直接提供代码，并说明用户可以点击"插入"按钮将代码插入到当前位置。`;

    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMsg },
    ];

    if (window.mindcode?.ai?.chatStream) {
      window.mindcode.ai.chatStream("claude-sonnet-4-5-20250929", allMessages, {
        onToken: (token) => setStreamingContent((prev) => prev + token),
        onComplete: (result) => {
          setMessages((prev) => [...prev, { role: "assistant", content: result }]);
          setStreamingContent("");
          setIsStreaming(false);
        },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: "assistant", content: `错误: ${err}` }]);
          setIsStreaming(false);
        },
      });
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: "AI 服务不可用" }]);
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, position, getContextCode]);

  // 从消息中提取代码
  const extractCode = (content: string): string | null => {
    const match = content.match(/```[\w]*\n?([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  // 插入代码
  const handleInsert = useCallback(
    (content: string) => {
      const code = extractCode(content);
      if (code) onInsertCode(code, position);
    },
    [position, onInsertCode],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={widgetRef}
      className="inline-chat-widget"
      style={{ position: "fixed", top: widgetPos.top, left: widgetPos.left }}
    >
      <div className="inline-chat-header">
        <span className="inline-chat-icon">💬</span>
        <span className="inline-chat-title">AI 对话</span>
        <span className="inline-chat-position">
          L{position.lineNumber}:C{position.column}
        </span>
        <button className="inline-chat-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div ref={messagesRef} className="inline-chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`inline-chat-message inline-chat-message--${m.role}`}>
            <div className="inline-chat-message-content">{m.content}</div>
            {m.role === "assistant" && extractCode(m.content) && (
              <button className="inline-chat-insert-btn" onClick={() => handleInsert(m.content)}>
                📥 插入代码
              </button>
            )}
          </div>
        ))}
        {streamingContent && (
          <div className="inline-chat-message inline-chat-message--assistant streaming">
            <div className="inline-chat-message-content">
              {streamingContent}
              <span className="streaming-cursor" />
            </div>
          </div>
        )}
      </div>
      <div className="inline-chat-input-area">
        <textarea
          ref={inputRef}
          className="inline-chat-input"
          placeholder="输入问题或指令..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isStreaming}
        />
        <button
          className="inline-chat-send"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          {isStreaming ? "..." : "发送"}
        </button>
      </div>
      <div className="inline-chat-hints">
        <kbd>Enter</kbd> 发送 <kbd>Shift+Enter</kbd> 换行 <kbd>Esc</kbd> 关闭
      </div>
    </div>
  );
};

export default InlineChatWidget;
