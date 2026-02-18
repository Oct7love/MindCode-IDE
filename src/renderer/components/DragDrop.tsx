/**
 * DragDrop - 拖放支持组件
 */

import React, { useState, useRef, useCallback } from "react";

// ============ 文件拖放区域 ============

interface FileDropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: string[];
  children: React.ReactNode;
  className?: string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onDrop,
  accept,
  children,
  className = "",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const filtered = accept
      ? files.filter((f) => accept.some((ext) => f.name.toLowerCase().endsWith(ext)))
      : files;
    if (filtered.length) onDrop(filtered);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 bg-[var(--color-accent-primary)] bg-opacity-20 border-2 border-dashed border-[var(--color-accent-primary)] flex items-center justify-center z-50">
          <div className="text-[var(--color-accent-primary)] text-lg font-medium">
            拖放文件到这里
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 可拖拽列表 ============

interface DraggableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
  direction?: "horizontal" | "vertical";
}

export function DraggableList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  direction = "vertical",
}: DraggableListProps<T>): React.ReactElement {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) setDropIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newItems = [...items];
      const [removed] = newItems.splice(dragIndex, 1);
      newItems.splice(dropIndex, 0, removed);
      onReorder(newItems);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"}`}>
      {items.map((item, index) => (
        <div
          key={keyExtractor(item)}
          draggable
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver(index)}
          onDragEnd={handleDragEnd}
          className={`${dropIndex === index ? (direction === "horizontal" ? "border-l-2 border-[var(--color-accent-primary)]" : "border-t-2 border-[var(--color-accent-primary)]") : ""}`}
        >
          {renderItem(item, index, dragIndex === index)}
        </div>
      ))}
    </div>
  );
}

// ============ 可拖拽标签 ============

export interface Tab {
  id: string;
  title: string;
  icon?: React.ReactNode;
  dirty?: boolean;
  pinned?: boolean;
}

interface DraggableTabsProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onReorder: (tabs: Tab[]) => void;
  onSplit?: (id: string, direction: "left" | "right" | "up" | "down") => void;
}

export const DraggableTabs: React.FC<DraggableTabsProps> = ({
  tabs,
  activeId,
  onSelect,
  onClose,
  onReorder,
  onSplit,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragId && dragId !== id) setDropId(id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId || !dropId || dragId === dropId) return;
    const newTabs = [...tabs];
    const dragIdx = newTabs.findIndex((t) => t.id === dragId);
    const dropIdx = newTabs.findIndex((t) => t.id === dropId);
    const [removed] = newTabs.splice(dragIdx, 1);
    newTabs.splice(dropIdx, 0, removed);
    onReorder(newTabs);
    setDragId(null);
    setDropId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDropId(null);
  };

  return (
    <div
      className="flex items-center overflow-x-auto bg-[var(--color-bg-secondary)]"
      onDrop={handleDrop}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable={!tab.pinned}
          onDragStart={handleDragStart(tab.id)}
          onDragOver={handleDragOver(tab.id)}
          onDragEnd={handleDragEnd}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-[var(--color-border)] cursor-pointer select-none transition-colors
            ${activeId === tab.id ? "bg-[var(--color-bg-primary)]" : "hover:bg-[var(--color-bg-hover)]"}
            ${dragId === tab.id ? "opacity-50" : ""}
            ${dropId === tab.id ? "border-l-2 border-l-[var(--color-accent-primary)]" : ""}`}
        >
          {tab.icon && <span className="text-sm">{tab.icon}</span>}
          <span className="text-sm max-w-[120px] truncate">{tab.title}</span>
          {tab.dirty && <span className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)]" />}
          {tab.pinned && <span className="text-xs">📌</span>}
          {!tab.pinned && onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ============ 分屏容器 ============

export type SplitDirection = "horizontal" | "vertical";

interface SplitPaneProps {
  direction: SplitDirection;
  first: React.ReactNode;
  second: React.ReactNode;
  initialRatio?: number;
  minSize?: number;
  onRatioChange?: (ratio: number) => void;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  direction,
  first,
  second,
  initialRatio = 0.5,
  minSize = 100,
  onRatioChange,
}) => {
  const [ratio, setRatio] = useState(initialRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos =
        direction === "horizontal"
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height;
      const minRatio = minSize / (direction === "horizontal" ? rect.width : rect.height);
      const newRatio = Math.max(minRatio, Math.min(1 - minRatio, pos));
      setRatio(newRatio);
      onRatioChange?.(newRatio);
    },
    [isDragging, direction, minSize, onRatioChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const firstStyle =
    direction === "horizontal" ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` };
  const secondStyle =
    direction === "horizontal"
      ? { width: `${(1 - ratio) * 100}%` }
      : { height: `${(1 - ratio) * 100}%` };

  return (
    <div
      ref={containerRef}
      className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"} h-full w-full`}
    >
      <div style={firstStyle} className="overflow-hidden">
        {first}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 bg-[var(--color-border)] hover:bg-[var(--color-accent-primary)] transition-colors ${direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"} ${isDragging ? "bg-[var(--color-accent-primary)]" : ""}`}
      />
      <div style={secondStyle} className="overflow-hidden">
        {second}
      </div>
    </div>
  );
};

export default { FileDropZone, DraggableList, DraggableTabs, SplitPane };
