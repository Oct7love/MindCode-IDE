/**
 * ConversationManager - AI 会话管理
 * 历史记录、导出、搜索
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

export interface Message { role: 'user' | 'assistant' | 'system'; content: string; timestamp: number; }
export interface Conversation { id: string; title: string; messages: Message[]; createdAt: number; updatedAt: number; }

const STORAGE_KEY = 'mindcode_conversations';

interface ConversationManagerProps { isOpen: boolean; onClose: () => void; onLoad: (conversation: Conversation) => void; currentConversation?: Conversation; onSave: (conversation: Conversation) => void; }

export const ConversationManager: React.FC<ConversationManagerProps> = ({ isOpen, onClose, onLoad, currentConversation, onSave }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // 加载会话
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setConversations(JSON.parse(stored));
  }, [isOpen]);

  // 保存会话列表
  const saveConversations = useCallback((newConversations: Conversation[]) => {
    setConversations(newConversations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConversations));
  }, []);

  // 保存当前会话
  const handleSaveCurrent = useCallback(() => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    const exists = conversations.find(c => c.id === currentConversation.id);
    if (exists) {
      saveConversations(conversations.map(c => c.id === currentConversation.id ? { ...currentConversation, updatedAt: Date.now() } : c));
    } else {
      saveConversations([{ ...currentConversation, updatedAt: Date.now() }, ...conversations]);
    }
  }, [currentConversation, conversations, saveConversations]);

  // 删除会话
  const deleteConversation = useCallback((id: string) => {
    saveConversations(conversations.filter(c => c.id !== id));
    if (selected === id) setSelected(null);
  }, [conversations, selected, saveConversations]);

  // 导出会话
  const exportConversation = useCallback((conversation: Conversation) => {
    const content = conversation.messages.map(m => `### ${m.role === 'user' ? '用户' : 'AI'}\n${m.content}`).join('\n\n---\n\n');
    const markdown = `# ${conversation.title}\n\n> 创建: ${new Date(conversation.createdAt).toLocaleString('zh-CN')}\n\n${content}`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${conversation.title}.md`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // 导出全部
  const exportAll = useCallback(() => {
    const json = JSON.stringify(conversations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mindcode-conversations-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [conversations]);

  // 搜索过滤
  const filtered = useMemo(() => {
    if (!search) return conversations;
    const lower = search.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(lower) || c.messages.some(m => m.content.toLowerCase().includes(lower)));
  }, [conversations, search]);

  // 预览会话
  const preview = useMemo(() => conversations.find(c => c.id === selected), [conversations, selected]);

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '80vw', maxWidth: 900, height: '70vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>💬 会话历史</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSaveCurrent} disabled={!currentConversation?.messages.length} style={{ padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: currentConversation?.messages.length ? 1 : 0.5 }}>保存当前</button>
            <button onClick={exportAll} disabled={conversations.length === 0} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>导出全部</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索会话..." style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 会话列表 */}
          <div style={{ width: 280, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无会话记录</div>
            ) : filtered.map(conv => (
              <div key={conv.id} onClick={() => setSelected(conv.id)} style={{ padding: '12px', cursor: 'pointer', background: selected === conv.id ? 'var(--color-bg-hover)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <span>{conv.messages.length} 条消息</span>
                  <span>{formatTime(conv.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 预览 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {preview ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{preview.title}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onLoad(preview)} style={{ padding: '6px 12px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>加载</button>
                    <button onClick={() => exportConversation(preview)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>导出</button>
                    <button onClick={() => deleteConversation(preview.id)} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>删除</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                  {preview.messages.map((msg, idx) => (
                    <div key={idx} style={{ marginBottom: 16, padding: 12, background: msg.role === 'user' ? 'var(--color-bg-base)' : 'var(--color-bg-hover)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{msg.role === 'user' ? '👤 用户' : '🤖 AI'}</div>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content.slice(0, 500)}{msg.content.length > 500 ? '...' : ''}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>选择会话查看详情</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 辅助函数
export function saveConversation(conversation: Conversation): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const conversations: Conversation[] = stored ? JSON.parse(stored) : [];
  const idx = conversations.findIndex(c => c.id === conversation.id);
  if (idx >= 0) conversations[idx] = conversation;
  else conversations.unshift(conversation);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 100)));
}

export function createConversation(title?: string): Conversation {
  return { id: `conv-${Date.now()}`, title: title || `会话 ${new Date().toLocaleString('zh-CN')}`, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export default ConversationManager;
