/**
 * DiffEditor - Monaco Diff 编辑器组件
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as monaco from "monaco-editor";

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  originalTitle?: string;
  modifiedTitle?: string;
  readOnly?: boolean;
  renderSideBySide?: boolean;
  onModifiedChange?: (value: string) => void;
  onAccept?: (value: string) => void;
  onReject?: () => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({
  original,
  modified,
  language = "typescript",
  originalTitle = "Original",
  modifiedTitle = "Modified",
  readOnly = false,
  renderSideBySide = true,
  onModifiedChange,
  onAccept,
  onReject,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  // 通过 ref 访问回调，避免闭包过期
  const onModifiedChangeRef = useRef(onModifiedChange);
  useEffect(() => {
    onModifiedChangeRef.current = onModifiedChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      readOnly,
      renderSideBySide,
      enableSplitViewResizing: true,
      originalEditable: false,
      renderOverviewRuler: true,
      diffWordWrap: "on",
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: "'Fira Code', Consolas, monospace",
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
    });
    const originalModel = monaco.editor.createModel(original, language);
    const modifiedModel = monaco.editor.createModel(modified, language);
    editor.setModel({ original: originalModel, modified: modifiedModel });
    editorRef.current = editor;

    const updateChanges = () => {
      const changes = editor.getLineChanges();
      setChangeCount(changes?.length ?? 0);
    };
    // 显式存储 disposable 以确保清理
    const contentDisposable = modifiedModel.onDidChangeContent(() => {
      onModifiedChangeRef.current?.(modifiedModel.getValue());
      updateChanges();
    });
    updateChanges();

    return () => {
      contentDisposable.dispose();
      editor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 更新内容
    const model = editorRef.current?.getModel();
    if (model && model.original.getValue() !== original) model.original.setValue(original);
    if (model && model.modified.getValue() !== modified) model.modified.setValue(modified);
  }, [original, modified]);

  const navigateChange = useCallback((direction: "prev" | "next") => {
    const changes = editorRef.current?.getLineChanges();
    if (!changes?.length) return;
    const modifiedEditor = editorRef.current?.getModifiedEditor();
    const currentLine = modifiedEditor?.getPosition()?.lineNumber ?? 1;
    const targetChange =
      direction === "next"
        ? (changes.find((c) => c.modifiedStartLineNumber > currentLine) ?? changes[0])
        : ([...changes].reverse().find((c) => c.modifiedStartLineNumber < currentLine) ??
          changes[changes.length - 1]);
    modifiedEditor?.revealLineInCenter(targetChange.modifiedStartLineNumber);
    modifiedEditor?.setPosition({ lineNumber: targetChange.modifiedStartLineNumber, column: 1 });
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="flex items-center justify-between p-2 border-b border-[var(--color-border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="text-[var(--color-text-muted)]">{originalTitle}</span>
          <span className="text-[var(--color-text-muted)]">↔</span>
          <span className="text-[var(--color-text-muted)]">{modifiedTitle}</span>
          <span className="px-2 py-0.5 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded text-xs">
            {changeCount} changes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateChange("prev")}
            className="px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded text-xs"
            title="上一个"
          >
            ↑ Prev
          </button>
          <button
            onClick={() => navigateChange("next")}
            className="px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded text-xs"
            title="下一个"
          >
            ↓ Next
          </button>
          {onReject && (
            <button
              onClick={onReject}
              className="px-3 py-1 bg-[var(--color-error)] text-white rounded text-xs hover:opacity-80"
            >
              Reject
            </button>
          )}
          {onAccept && (
            <button
              onClick={() => onAccept(editorRef.current?.getModel()?.modified.getValue() ?? "")}
              className="px-3 py-1 bg-[var(--color-success)] text-white rounded text-xs hover:opacity-80"
            >
              Accept
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
};

export default DiffEditor;
