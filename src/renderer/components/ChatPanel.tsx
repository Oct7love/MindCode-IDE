import React, { useState, useRef, useEffect } from "react";
import { CloseIcon, TrashIcon, SendIcon, UserIcon, BotIcon, LinkIcon, UploadIcon } from "./icons";
import "./ChatPanel.css";

// 图标别名
const AIIcon = BotIcon;
const AtIcon = LinkIcon;
const AttachIcon = UploadIcon;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "你好！我是 MindCode AI 助手。我可以帮助你编写代码、解释代码、修复 bug 等。有什么可以帮你的吗？",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `收到你的消息："${userMessage.content}"\n\n这是一个演示响应。实际使用时将连接到 ${selectedModel.toUpperCase()} API 获取真实回复。`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "对话已清空。有什么可以帮你的吗？",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <AIIcon size={18} color="var(--accent)" />
          <span>AI 助手</span>
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="claude">Claude</option>
            <option value="openai">GPT-4</option>
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" onClick={clearChat} title="新对话">
            <TrashIcon size={16} />
          </button>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? <UserIcon size={18} /> : <AIIcon size={18} />}
            </div>
            <div className="message-body">
              <div className="message-header">
                <span className="message-role">{msg.role === "user" ? "你" : "AI"}</span>
                <span className="message-time">{msg.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="message-text">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">
              <AIIcon size={18} />
            </div>
            <div className="message-body">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="context-bar">
          <button className="context-btn">
            <AtIcon size={14} />
            <span>引用</span>
          </button>
          <button className="context-btn">
            <AttachIcon size={14} />
            <span>附件</span>
          </button>
        </div>
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
