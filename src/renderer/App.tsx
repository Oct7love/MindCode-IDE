import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import "./styles/mindcode-tokens.css";
import "./styles/main.css";
import "./styles/animations.css";
import "./styles/chat-tokens.css";
import "./styles/ai-panel.css";
import "./styles/components.css";
import "./styles/markdown.css";
import "./styles/editor.css";
import CodeEditor from "./components/CodeEditor";
import { CommandPalette } from "./components/CommandPalette";
import { FileContextMenu, InputDialog, ConfirmDialog } from "./components/FileContextMenu";
import { GitPanel } from "./components/GitPanel";
import { AIPanel } from "./components/AIPanel";
import { DiffEditorPanel } from "./components/DiffEditorPanel";
import { ComposerPanel } from "./components/ComposerPanel";
import { DebugPanel } from "./components/Debugger";
import { applyTheme, loadTheme, saveTheme } from "./utils/themes";
import { useZoom } from "./hooks/useZoom";
import { StatusBar } from "./components/StatusBar";
import { AIPanelErrorBoundary, EditorErrorBoundary } from "./components/ErrorBoundary";
import { TitleBar } from "./components/TitleBar";
import { marketplaceService } from "../core/plugins/marketplace";
import { preloadCriticalComponents, preloadAIComponents } from "./utils/lazyComponents";
import {
  markStartupPoint,
  deferNonCriticalResources,
  precompileMonacoLanguages,
} from "./services/startupOptimizer";
import { startPeriodicCleanup } from "./services/bugFixes";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsView } from "./components/SettingsView";

// Layout Components
import type { SidebarTab } from "./components/ActivityBar";
import { ActivityBar } from "./components/ActivityBar";
import { EditorTabs } from "./components/EditorTabs";
import { BottomPanel } from "./components/BottomPanel";
import { LanguageSelector } from "./components/LanguageSelector";

// Extracted Components
import { AppIcons } from "./components/icons";
import { VirtualFileTree } from "./components/VirtualFileTree";
import { WelcomePage } from "./components/WelcomePage";
import { ExtensionsPanel } from "./components/ExtensionsPanel";

// Hooks
import { useWorkspace } from "./hooks/useWorkspace";
import { useEditorFiles } from "./hooks/useEditorFiles";
import { usePanelLayout } from "./hooks/usePanelLayout";
import { useFileOperations } from "./hooks/useFileOperations";

// ==================== App ====================
const App: React.FC = () => {
  // --- Hooks ---
  const workspace = useWorkspace();
  const editor = useEditorFiles(workspace.workspaceRoot);
  const layout = usePanelLayout();
  const fileOps = useFileOperations(
    workspace.refreshFileTree,
    editor.openFile,
    editor.updateFilePath,
    editor.closeFilesStartingWith,
  );

  const { zoomPercent } = useZoom();
  const [tab, setTab] = useState<SidebarTab>("files");
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [_commandPaletteMode, setCommandPaletteMode] = useState<"files" | "commands" | "search">(
    "files",
  );
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [languageSelectorTarget, setLanguageSelectorTarget] = useState<string | null>(null);

  // --- Stable refs for IPC/keyboard callbacks (避免闭包过期) ---
  const openFileRef = useRef(editor.openFile);
  const saveFileRef = useRef(editor.saveFile);
  const closeFileRef = useRef(editor.closeFile);
  const activeFileRef = useRef(editor.activeFile);
  const activeFileIdRef = useRef(editor.activeFileId);
  const editorRefCurrent = useRef(editor.editorRef);
  const layoutRef = useRef(layout);
  const setTabRef = useRef(setTab);
  const editorRef = useRef(editor);
  const workspaceRef = useRef(workspace);
  const showCommandPaletteRef = useRef(showCommandPalette);
  const setShowCommandPaletteRef = useRef(setShowCommandPalette);
  const setCommandPaletteModeRef = useRef(setCommandPaletteMode);
  const setShowLanguageSelectorRef = useRef(setShowLanguageSelector);
  const setLanguageSelectorTargetRef = useRef(setLanguageSelectorTarget);

  useEffect(() => {
    openFileRef.current = editor.openFile;
    saveFileRef.current = editor.saveFile;
    closeFileRef.current = editor.closeFile;
    activeFileRef.current = editor.activeFile;
    activeFileIdRef.current = editor.activeFileId;
    editorRefCurrent.current = editor.editorRef;
    layoutRef.current = layout;
    setTabRef.current = setTab;
    editorRef.current = editor;
    workspaceRef.current = workspace;
    showCommandPaletteRef.current = showCommandPalette;
    setShowCommandPaletteRef.current = setShowCommandPalette;
    setCommandPaletteModeRef.current = setCommandPaletteMode;
    setShowLanguageSelectorRef.current = setShowLanguageSelector;
    setLanguageSelectorTargetRef.current = setLanguageSelectorTarget;
  });

  // --- Menu event listener ---
  useEffect(() => {
    if (!window.mindcode?.onMenuEvent) return;

    const cleanup = window.mindcode.onMenuEvent(async (event, data) => {
      switch (event) {
        case "menu:newFile": {
          const newId = editor.createNewFile();
          setLanguageSelectorTarget(newId);
          setShowLanguageSelector(true);
          break;
        }
        case "menu:openFile":
          if (typeof data === "string") {
            const fileName = data.split(/[/\\]/).pop() || "file";
            openFileRef.current(data, fileName);
          }
          break;
        case "menu:openFolder":
          if (typeof data === "string") {
            await workspace.openFolderByPath(data);
            editor.clearFiles();
          }
          break;
        case "menu:save": {
          const currentFile = activeFileRef.current;
          if (currentFile && editorRefCurrent.current?.current) {
            const content = editorRefCurrent.current.current.getValue();
            if (currentFile.isUntitled) {
              await editor.saveUntitledFile(currentFile, content, workspace.refreshFileTree);
            } else {
              saveFileRef.current(content);
            }
          }
          break;
        }
        case "menu:closeEditor":
          if (activeFileIdRef.current) closeFileRef.current(activeFileIdRef.current);
          break;
        case "menu:commandPalette":
          setCommandPaletteMode("commands");
          setShowCommandPalette(true);
          break;
        case "menu:goToFile":
          setCommandPaletteMode("files");
          setShowCommandPalette(true);
          break;
        case "menu:showExplorer":
          setTab("files");
          break;
        case "menu:showSearch":
          setTab("search");
          break;
        case "menu:showGit":
          setTab("git");
          break;
        case "menu:toggleTerminal":
          layout.setShowBottomPanel((prev) => !prev);
          layout.setBottomPanelTab("terminal");
          break;
        case "menu:toggleAI":
          layout.setShowAI((prev) => !prev);
          break;
        case "menu:findInFiles":
          setCommandPaletteMode("search");
          setShowCommandPalette(true);
          break;
      }
    });

    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Keyboard shortcuts (所有外部引用通过 ref 访问，依赖数组安全为空) ---
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const ly = layoutRef.current;

      if (ctrl && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteModeRef.current("files");
        setShowCommandPaletteRef.current(true);
        return;
      }
      if (ctrl && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setCommandPaletteModeRef.current("commands");
        setShowCommandPaletteRef.current(true);
        return;
      }
      if (ctrl && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setTabRef.current("search");
        ly.setSidebarCollapsed(false);
        return;
      }
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setTabRef.current("settings");
        ly.setSidebarCollapsed(false);
        return;
      }
      if (ctrl && e.shiftKey && e.key === "I") {
        e.preventDefault();
        ly.setShowComposer(true);
        return;
      }
      if (ctrl && e.key === "l") {
        e.preventDefault();
        ly.setShowAI((prev: boolean) => !prev);
        return;
      }
      if (ctrl && e.key === "b") {
        e.preventDefault();
        ly.setSidebarCollapsed((prev: boolean) => !prev);
        return;
      }
      if (ctrl && (e.key === "`" || e.key === "j")) {
        e.preventDefault();
        ly.setShowBottomPanel((prev: boolean) => !prev);
        ly.setBottomPanelTab("terminal");
        return;
      }
      if (e.key === "F5" && !ctrl && !e.shiftKey) {
        e.preventDefault();
        setTabRef.current("debug");
        return;
      }
      if (ctrl && e.key === "w") {
        e.preventDefault();
        if (activeFileIdRef.current) closeFileRef.current(activeFileIdRef.current);
        return;
      }
      if (ctrl && e.key === "s") {
        e.preventDefault();
        const currentFile = activeFileRef.current;
        if (!currentFile) return;
        const content = editorRefCurrent.current?.current?.getValue() || currentFile.content;
        if (currentFile.isUntitled) {
          await editorRef.current.saveUntitledFile(
            currentFile,
            content,
            workspaceRef.current.refreshFileTree,
          );
        } else {
          saveFileRef.current(content);
        }
        return;
      }
      if (ctrl && e.key === "n") {
        e.preventDefault();
        const newId = editorRef.current.createNewFile();
        setLanguageSelectorTargetRef.current(newId);
        setShowLanguageSelectorRef.current(true);
        return;
      }
      if (ctrl && e.shiftKey && e.key === "D") {
        e.preventDefault();
        ly.setShowDiffPanel((prev: boolean) => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (ly.showDiffPanel) {
          e.preventDefault();
          ly.closeDiffPanel();
          return;
        }
        if (showCommandPaletteRef.current) {
          e.preventDefault();
          setShowCommandPaletteRef.current(false);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // 所有引用通过 ref 访问，无需额外依赖

  // --- Command list ---
  const commands = useMemo(
    () => [
      {
        id: "file.open",
        label: "打开文件夹",
        keybinding: "Ctrl+O",
        handler: () => {
          workspace.handleOpenFolder();
        },
      },
      {
        id: "file.save",
        label: "保存文件",
        keybinding: "Ctrl+S",
        handler: () => {
          if (editor.activeFile && editor.editorRef.current)
            editor.saveFile(editor.editorRef.current.getValue());
        },
      },
      {
        id: "file.close",
        label: "关闭文件",
        keybinding: "Ctrl+W",
        handler: () => {
          if (editor.activeFileId) editor.closeFile(editor.activeFileId);
        },
      },
      {
        id: "ai.toggle",
        label: "打开/关闭 AI 面板",
        keybinding: "Ctrl+L",
        handler: () => layout.setShowAI((prev) => !prev),
      },
      {
        id: "search.files",
        label: "搜索文件",
        keybinding: "Ctrl+P",
        handler: () => {
          setCommandPaletteMode("files");
          setShowCommandPalette(true);
        },
      },
      {
        id: "search.content",
        label: "在文件中搜索",
        keybinding: "Ctrl+Shift+F",
        handler: () => {
          setCommandPaletteMode("search");
          setShowCommandPalette(true);
        },
      },
      { id: "view.explorer", label: "显示资源管理器", handler: () => setTab("files") },
      { id: "view.search", label: "显示搜索", handler: () => setTab("search") },
      { id: "view.git", label: "显示源代码管理", handler: () => setTab("git") },
      { id: "view.extensions", label: "显示扩展", handler: () => setTab("ext") },
      {
        id: "terminal.toggle",
        label: "打开/关闭底部面板",
        keybinding: "Ctrl+`",
        handler: () => layout.setShowBottomPanel((prev) => !prev),
      },
      {
        id: "terminal.new",
        label: "新建终端",
        handler: () => {
          layout.setShowBottomPanel(true);
          layout.setBottomPanelTab("terminal");
        },
      },
      { id: "debug.start", label: "启动调试", keybinding: "F5", handler: () => setTab("debug") },
    ],
    [
      workspace.handleOpenFolder,
      editor.activeFile,
      editor.activeFileId,
      editor.closeFile,
      editor.saveFile,
    ],
  );

  // --- Theme & startup ---
  useEffect(() => {
    let deferredTimer: ReturnType<typeof setTimeout> | undefined;

    const initTheme = async () => {
      if (document.readyState === "loading") {
        await new Promise((resolve) =>
          document.addEventListener("DOMContentLoaded", resolve, { once: true }),
        );
      }
      const themeId = await loadTheme();
      applyTheme(themeId);
      marketplaceService.initializeExtensions();
      markStartupPoint("theme_loaded");
      preloadCriticalComponents();
      startPeriodicCleanup();
      deferredTimer = setTimeout(() => {
        deferNonCriticalResources();
        precompileMonacoLanguages();
        preloadAIComponents();
        markStartupPoint("deferred_loaded");
      }, 1500);
    };
    initTheme();

    let cleanupIpc: (() => void) | undefined;
    if (window.mindcode?.onThemeChange) {
      cleanupIpc = window.mindcode.onThemeChange((themeId: string) => {
        if (themeId === "system") return;
        applyTheme(themeId);
        saveTheme(themeId);
      });
    }
    return () => {
      if (deferredTimer) clearTimeout(deferredTimer);
      if (cleanupIpc) cleanupIpc();
    };
  }, []);

  // --- Drop handler (for opening folders by drag) ---
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fileOps.setIsDragging(false);

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            const file = item.getAsFile();
            const filePath = (file as File & { path?: string })?.path;
            if (filePath) {
              await workspace.openFolderByPath(filePath);
              editor.clearFiles();
              return;
            }
          }
        }
      }

      const files = e.dataTransfer.files;
      const firstFilePath = (files[0] as File & { path?: string })?.path;
      if (files.length > 0 && firstFilePath) {
        editor.openFile(firstFilePath, files[0].name);
      }
    },
    [workspace, editor, fileOps],
  );

  // --- Render ---
  const { activeFile, openFiles } = editor;
  const selected = activeFile?.path || "";

  return (
    <div className="workbench">
      <TitleBar
        title="MindCode"
        subtitle={
          workspace.workspaceRoot ? workspace.workspaceRoot.split(/[/\\]/).pop() : undefined
        }
        onSearchClick={() => setShowCommandPalette(true)}
      />

      <div className="main-layout">
        {/* Activity Bar */}
        <ActivityBar tab={tab} onTabChange={setTab} />

        {/* Sidebar */}
        {!layout.sidebarCollapsed && (
          <div
            className="sidebar"
            onDragEnter={fileOps.handleDragEnter}
            onDragLeave={fileOps.handleDragLeave}
            onDragOver={fileOps.handleDragOver}
            onDrop={handleDrop}
            style={{ position: "relative", width: layout.sidebarWidth }}
          >
            <div className="sidebar-title">
              {tab === "files" && "Explorer"}
              {tab === "search" && "Search"}
              {tab === "git" && "Source Control"}
              {tab === "debug" && "Run and Debug"}
              {tab === "ext" && "Extensions"}
              {tab === "settings" && "Settings"}
            </div>
            <div className="sidebar-body">
              {tab === "files" && (
                <>
                  <div
                    className="tree-header"
                    style={{ cursor: "pointer" }}
                    onClick={workspace.handleOpenFolder}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (workspace.workspaceRoot) {
                        fileOps.handleContextMenu(
                          e,
                          workspace.workspaceRoot,
                          workspace.workspaceName,
                          true,
                        );
                      }
                    }}
                    title="点击打开文件夹"
                  >
                    <span className="tree-header-icon">
                      <AppIcons.ChevronDown16 />
                    </span>
                    <span className="tree-header-label">{workspace.workspaceName}</span>
                    <button
                      className="tree-header-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        workspace.handleOpenFolder();
                      }}
                      title="打开文件夹"
                    >
                      <AppIcons.Folder16 />
                    </button>
                  </div>
                  <VirtualFileTree
                    tree={workspace.fileTree}
                    selected={selected}
                    contextMenuPath={
                      fileOps.contextMenu.isOpen ? fileOps.contextMenu.targetPath : null
                    }
                    onSelect={editor.openFile}
                    onContextMenu={fileOps.handleContextMenu}
                    onLoadChildren={workspace.loadDirectory}
                  />
                </>
              )}
              {tab === "git" && <GitPanel workspacePath={workspace.workspaceRoot} />}
              {tab === "search" && (
                <SearchPanel workspacePath={workspace.workspaceRoot} onOpenFile={editor.openFile} />
              )}
              {tab === "debug" && <DebugPanel />}
              {tab === "ext" && <ExtensionsPanel />}
              {tab === "settings" && <SettingsView workspacePath={workspace.workspaceRoot} />}
            </div>
            {fileOps.isDragging && (
              <div className="drop-zone-overlay">
                <div className="drop-zone-icon">
                  <AppIcons.Folder16 />
                </div>
                <div className="drop-zone-text">拖拽文件夹到此处打开</div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar Resizer */}
        {!layout.sidebarCollapsed && (
          <div
            className={`sidebar-resizer${layout.isResizingSidebar ? " resizing" : ""}`}
            onMouseDown={layout.handleSidebarResizeStart}
          />
        )}

        {/* Editor Area */}
        <div className="editor-area">
          <EditorTabs
            openFiles={openFiles}
            activeFileId={editor.activeFileId}
            onSwitchFile={editor.switchFile}
            onCloseFile={editor.closeFile}
          />

          <div
            className="editor-content"
            style={{
              flex: layout.showBottomPanel
                ? `1 1 calc(100% - ${layout.bottomPanelHeight}px)`
                : "1 1 100%",
            }}
          >
            {activeFile ? (
              <EditorErrorBoundary>
                <CodeEditor
                  file={{ path: activeFile.path, content: activeFile.content }}
                  onContentChange={editor.updateFileContent}
                  onSave={editor.saveFile}
                  onCursorPositionChange={(line, column) => setCursorPosition({ line, column })}
                  workspacePath={workspace.workspaceRoot}
                />
              </EditorErrorBoundary>
            ) : (
              <WelcomePage
                onOpenAI={() => layout.setShowAI(true)}
                onQuickOpen={() => setShowCommandPalette(true)}
                onOpenTerminal={() => {
                  layout.setShowBottomPanel(true);
                  layout.setBottomPanelTab("terminal");
                }}
                onOpenFolder={workspace.handleOpenFolder}
                onOpenRecentFolder={async (path: string) => {
                  await workspace.openFolderByPath(path);
                  editor.clearFiles();
                }}
              />
            )}
          </div>

          {/* Bottom Panel */}
          {layout.showBottomPanel && (
            <BottomPanel
              height={layout.bottomPanelHeight}
              activeTab={layout.bottomPanelTab}
              workspacePath={workspace.workspaceRoot || ""}
              isVisible={layout.showBottomPanel}
              onTabChange={layout.setBottomPanelTab}
              onClose={() => layout.setShowBottomPanel(false)}
              onResizeStart={layout.handleBottomPanelResizeStart}
              onOpenFile={editor.openFile}
            />
          )}

          {/* Diff Editor Panel */}
          {layout.showDiffPanel && layout.diffData && (
            <div className="bottom-panel diff-panel" style={{ height: layout.diffPanelHeight }}>
              <DiffEditorPanel
                originalPath={layout.diffData.path}
                originalContent={layout.diffData.originalContent}
                modifiedContent={layout.diffData.modifiedContent}
                language={layout.diffData.language}
                isVisible={layout.showDiffPanel}
                onApply={async (content) => {
                  const result = await window.mindcode?.fs?.writeFile?.(
                    layout.diffData!.path,
                    content,
                  );
                  if (result?.success) {
                    const file = openFiles.find((f) => f.path === layout.diffData!.path);
                    if (file) {
                      editor.setOpenFiles((prev) =>
                        prev.map((f) =>
                          f.path === layout.diffData!.path ? { ...f, content, isDirty: false } : f,
                        ),
                      );
                    }
                    layout.closeDiffPanel();
                  }
                }}
                onReject={layout.closeDiffPanel}
                onClose={layout.closeDiffPanel}
              />
            </div>
          )}
        </div>

        {/* AI Panel */}
        {layout.showAI && (
          <div style={{ position: "relative", height: "100%", display: "flex" }}>
            <div
              className="ai-panel-resizer"
              onMouseDown={layout.handleAIResizeStart}
              style={{
                position: "absolute",
                left: -2,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: "ew-resize",
                background: "transparent",
                zIndex: 1000,
              }}
            />
            <AIPanelErrorBoundary>
              <AIPanel
                onClose={() => layout.setShowAI(false)}
                width={layout.aiPanelWidth}
                isResizing={layout.isResizingAI}
              />
            </AIPanelErrorBoundary>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        workspaceRoot={workspace.workspaceRoot}
        activeFile={activeFile}
        zoomPercent={zoomPercent}
        cursorPosition={cursorPosition}
        onLanguageChange={(id, lang) => editor.setFileLanguage(id, lang)}
      />

      {!layout.showAI && (
        <button className="chat-fab" onClick={() => layout.setShowAI(true)}>
          <AppIcons.Chat16 />
        </button>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commands}
      />

      {/* File Context Menu */}
      <FileContextMenu
        isOpen={fileOps.contextMenu.isOpen}
        position={fileOps.contextMenu.position}
        targetPath={fileOps.contextMenu.targetPath}
        targetName={fileOps.contextMenu.targetName}
        isFolder={fileOps.contextMenu.isFolder}
        isWorkspaceRoot={fileOps.contextMenu.targetPath === workspace.workspaceRoot}
        onClose={fileOps.closeContextMenu}
        onNewFile={fileOps.handleNewFile}
        onNewFolder={fileOps.handleNewFolder}
        onRename={fileOps.handleRename}
        onDelete={fileOps.handleDelete}
        onCopy={fileOps.handleCopy}
        onPaste={fileOps.handlePaste}
        hasCopiedPath={!!fileOps.copiedPath}
      />

      {/* Dialogs */}
      <InputDialog
        isOpen={fileOps.inputDialog.isOpen}
        title={fileOps.inputDialog.title}
        placeholder={fileOps.inputDialog.placeholder}
        defaultValue={fileOps.inputDialog.defaultValue}
        confirmText={fileOps.inputDialog.confirmText}
        onConfirm={fileOps.inputDialog.onConfirm}
        onCancel={fileOps.closeInputDialog}
      />
      <ConfirmDialog
        isOpen={fileOps.confirmDialog.isOpen}
        title={fileOps.confirmDialog.title}
        message={fileOps.confirmDialog.message}
        confirmText="删除"
        danger={true}
        onConfirm={fileOps.confirmDialog.onConfirm}
        onCancel={fileOps.closeConfirmDialog}
      />

      {/* Language Selector */}
      <LanguageSelector
        isOpen={showLanguageSelector}
        targetFileId={languageSelectorTarget}
        onSelect={(langId, ext) => {
          if (languageSelectorTarget) {
            editor.setOpenFiles((prev) =>
              prev.map((f) => {
                if (f.id !== languageSelectorTarget) return f;
                const baseName = f.name.replace(/\.[^.]+$/, "");
                return {
                  ...f,
                  language: langId,
                  name: `${baseName}${ext}`,
                  path: `${baseName}${ext}`,
                };
              }),
            );
          }
          setShowLanguageSelector(false);
          setLanguageSelectorTarget(null);
        }}
        onClose={() => {
          setShowLanguageSelector(false);
          setLanguageSelectorTarget(null);
        }}
      />

      {/* Composer Panel */}
      <ComposerPanel
        isOpen={layout.showComposer}
        onClose={() => layout.setShowComposer(false)}
        workspacePath={workspace.workspaceRoot || undefined}
      />
    </div>
  );
};

export default App;
