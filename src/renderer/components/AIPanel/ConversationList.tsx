import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAIStore, Conversation } from '../../stores';
import './ConversationList.css';

interface ConversationListProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = memo(({ conversation, isActive, onSelect, onDelete, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setIsEditing(true);
  }, [conversation.title]);

  const handleSave = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editTitle, conversation.title, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditTitle(conversation.title); setIsEditing(false); }
  }, [handleSave, conversation.title]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  const messageCount = conversation.messages.length - 1; // 减去初始消息
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage?.content?.slice(0, 50) || '';

  return (
    <div className={`conv-item ${isActive ? 'active' : ''}`} onClick={onSelect}>
      <div className="conv-item-icon">💬</div>
      <div className="conv-item-content">
        {isEditing ? (
          <input
            ref={inputRef}
            className="conv-item-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="conv-item-title" onDoubleClick={handleDoubleClick} title="双击重命名">
            {conversation.title}
          </div>
        )}
        <div className="conv-item-meta">
          <span className="conv-item-count">{messageCount} 条消息</span>
          <span className="conv-item-time">{new Date(conversation.createdAt).toLocaleDateString()}</span>
        </div>
        {preview && <div className="conv-item-preview">{preview}</div>}
      </div>
      <button className="conv-item-delete" onClick={handleDeleteClick} title="删除对话">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
          <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
      </button>
    </div>
  );
});

export const ConversationList: React.FC<ConversationListProps> = memo(({ isOpen, onClose }) => {
  const { conversations, activeConversationId, createConversation, switchConversation, deleteConversation, renameConversation, clearConversation } = useAIStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [isOpen, onClose]);

  const handleNew = useCallback(() => {
    createConversation();
    onClose();
  }, [createConversation, onClose]);

  const handleSelect = useCallback((id: string) => {
    switchConversation(id);
    onClose();
  }, [switchConversation, onClose]);

  const handleDelete = useCallback((id: string) => {
    if (conversations.length === 1) {
      clearConversation(id);
    } else {
      deleteConversation(id);
    }
  }, [conversations.length, deleteConversation, clearConversation]);

  const handleRename = useCallback((id: string, title: string) => {
    renameConversation(id, title);
  }, [renameConversation]);

  if (!isOpen) return null;

  return (
    <div className="conv-list-overlay">
      <div ref={panelRef} className="conv-list-panel">
        <div className="conv-list-header">
          <h3 className="conv-list-title">历史对话</h3>
          <div className="conv-list-actions">
            <button className="conv-list-new" onClick={handleNew} title="新建对话">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
              </svg>
              <span>新建</span>
            </button>
            <button className="conv-list-close" onClick={onClose} title="关闭">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="conv-list-body">
          {conversations.length === 0 ? (
            <div className="conv-list-empty">
              <span className="conv-list-empty-icon">💬</span>
              <span>没有历史对话</span>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={() => handleSelect(conv.id)}
                onDelete={() => handleDelete(conv.id)}
                onRename={(title) => handleRename(conv.id, title)}
              />
            ))
          )}
        </div>
        <div className="conv-list-footer">
          <span className="conv-list-count">{conversations.length} 个对话</span>
        </div>
      </div>
    </div>
  );
});
