/**
 * usePanelLayout - 面板布局管理 Hook
 *
 * 负责：侧边栏、底部面板、AI 面板、Diff 面板的尺寸、折叠、拖拽
 */
import { useState, useCallback, useEffect } from "react";

interface DiffData {
  path: string;
  originalContent: string;
  modifiedContent: string;
  language?: string;
}

/** 面板尺寸约束常量 */
const SIDEBAR_DEFAULT_WIDTH = 200;
const SIDEBAR_MIN_WIDTH = 120;
const SIDEBAR_MAX_WIDTH = 480;
const AI_PANEL_DEFAULT_WIDTH = 380;
const AI_PANEL_MIN_WIDTH = 280;
const AI_PANEL_MAX_WIDTH = 800;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 250;
const BOTTOM_PANEL_MIN_HEIGHT = 100;
const BOTTOM_PANEL_MAX_HEIGHT = 600;
const DIFF_PANEL_DEFAULT_HEIGHT = 300;
/** ActivityBar 宽度（像素），用于计算侧边栏偏移 */
const ACTIVITY_BAR_WIDTH = 48;

export function usePanelLayout() {
  // 侧边栏
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // AI 面板
  const [showAI, setShowAI] = useState(true);
  const [aiPanelWidth, setAiPanelWidth] = useState(AI_PANEL_DEFAULT_WIDTH);
  const [isResizingAI, setIsResizingAI] = useState(false);

  // 底部面板
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_HEIGHT);
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<"terminal" | "diagnostics">("terminal");

  // Diff 面板
  const [showDiffPanel, setShowDiffPanel] = useState(false);
  const [diffPanelHeight, setDiffPanelHeight] = useState(DIFF_PANEL_DEFAULT_HEIGHT);
  const [diffData, setDiffData] = useState<DiffData | null>(null);

  // Composer 面板
  const [showComposer, setShowComposer] = useState(false);

  // 侧边栏拖动调整宽度
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - ACTIVITY_BAR_WIDTH;
      setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSidebar]);

  // AI 面板拖动调整大小
  const handleAIResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingAI(true);
  }, []);

  useEffect(() => {
    if (!isResizingAI) return;

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setAiPanelWidth(Math.max(AI_PANEL_MIN_WIDTH, Math.min(AI_PANEL_MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingAI(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingAI]);

  // 底部面板拖动
  const handleBottomPanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingBottomPanel(true);
      const startY = e.clientY;
      const startHeight = bottomPanelHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        setBottomPanelHeight(
          Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.min(BOTTOM_PANEL_MAX_HEIGHT, startHeight + delta)),
        );
      };

      const handleMouseUp = () => {
        setIsResizingBottomPanel(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [bottomPanelHeight],
  );

  // 关闭 Diff 面板
  const closeDiffPanel = useCallback(() => {
    setShowDiffPanel(false);
    setDiffData(null);
  }, []);

  // 打开 Diff 面板
  const openDiffPanel = useCallback((data: DiffData) => {
    setDiffData(data);
    setShowDiffPanel(true);
  }, []);

  return {
    // 侧边栏
    sidebarWidth,
    sidebarCollapsed,
    setSidebarCollapsed,
    isResizingSidebar,
    handleSidebarResizeStart,

    // AI 面板
    showAI,
    setShowAI,
    aiPanelWidth,
    isResizingAI,
    handleAIResizeStart,

    // 底部面板
    showBottomPanel,
    setShowBottomPanel,
    bottomPanelHeight,
    isResizingBottomPanel,
    bottomPanelTab,
    setBottomPanelTab,
    handleBottomPanelResizeStart,

    // Diff 面板
    showDiffPanel,
    setShowDiffPanel,
    diffPanelHeight,
    diffData,
    setDiffData,
    closeDiffPanel,
    openDiffPanel,

    // Composer 面板
    showComposer,
    setShowComposer,
  };
}
