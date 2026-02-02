export { AIPanel } from './AIPanel';
export { ChatView } from './ChatView';
export { UnifiedChatView } from './UnifiedChatView';
export { ContextChip } from './ContextChip';
export { ContextPicker } from './ContextPicker';
export { MessageItem } from './MessageItem';
export { ModelPicker, MODELS, TOOL_CAPABLE_MODELS } from './ModelPicker';
export { QuickActions } from './QuickActions';
export { ConversationList } from './ConversationList';

// Phase 2 新增组件
export { ChatHeader } from './ChatHeader';
export { ConfirmDialog } from './ConfirmDialog';
export { QueueIndicator } from './QueueIndicator';
export { EmptyState } from './EmptyState';

// Phase 3 消息组件
export { MessageList } from './MessageList';
export { MessageBubble } from './MessageBubble';
export { AssistantMessage } from './AssistantMessage';
export { UserMessage } from './UserMessage';
export { MessageActions } from './MessageActions';

// Phase 4 Composer + 输入组件
export { ChatComposer } from './ChatComposer';
export { ModeSelector } from './ModeSelector';
export { SendButton } from './SendButton';

// 新增组件导出
export { CodeBlock } from './CodeBlock';
export { ToolBlock } from './ToolBlock';
export type { ToolStatus } from './ToolBlock';
export { WriteFileToolBlock } from './WriteFileToolBlock';
export { ActionBar } from './ActionBar';
export type { ActionType, ActionState } from './ActionBar';
export { DiffBlock } from './DiffBlock';
export type { DiffLineType } from './DiffBlock';
export { TypingIndicator } from './TypingIndicator';
export { CopyFeedback, useCopyFeedback, copyToClipboard } from './CopyFeedback';

// Copy 功能组件导出
export { CopyButton } from './CopyButton';
export { CopyMenu } from './CopyMenu';
export { MessageContextMenu } from './MessageContextMenu';
export type { ContextMenuPosition } from './MessageContextMenu';

// Copy Service 导出
export { 
  copyToClipboard as copyToClipboardService,
  copyMessage,
  copyCode,
  copyAllCodeBlocks,
  serializeToPlainText,
  serializeToMarkdown,
  extractCodeBlocks
} from './utils/copyService';
export type { CopyFormat, CopyResult, ParsedContent } from './utils/copyService';

// Hooks 导出
export { useChatEngine, useComposerState, useScrollAnchor, useCopyWithFeedback, useApplyCode, useMultiFileChanges } from './hooks';
export type { CopyState, CopyFeedback as CopyFeedbackState, UseCopyWithFeedbackReturn, PendingChange } from './hooks';

// Thinking UI 组件导出
export { ThinkingUI, ThinkingHeader, ThoughtSummary, TraceTimeline } from './ThinkingUI';
export type { ThinkingUIOutput, TraceEvent as ThinkingTraceEvent } from './ThinkingUI';

// Diff Preview 组件导出
export { DiffPreview } from './DiffPreview';
export type { DiffPreviewProps } from './DiffPreview';

// Multi File Changes 组件导出
export { MultiFileChanges } from './MultiFileChanges';
export type { FileChange } from './MultiFileChanges';

// Apply Service 导出
export { detectFilePath, cleanCodeForApply, getExtensionForLanguage } from './utils/applyService';

export type { AIMode, ContextItem, ToolCallStatus, QueuedMessage } from '../../stores';
export type { ModelInfo } from './ModelPicker';
