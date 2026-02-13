import React, { useRef, useCallback } from "react";
import { AppIcons, getFileColor } from "./icons";

interface EditorFile {
  id: string;
  name: string;
  path: string;
  isDirty?: boolean;
  isPreview?: boolean;
  originalPath?: string;
}

interface EditorTabsProps {
  openFiles: EditorFile[];
  activeFileId: string | null;
  onSwitchFile: (id: string) => void;
  onCloseFile: (id: string, e?: React.MouseEvent) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openFiles,
  activeFileId,
  onSwitchFile,
  onCloseFile,
}) => {
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const handleTabsWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsScrollRef.current && e.deltaY !== 0) {
      e.preventDefault();
      tabsScrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div className="tabs-wrapper">
      <div className="tabs-scroll" ref={tabsScrollRef} onWheel={handleTabsWheel}>
        {openFiles.length === 0 ? (
          <div className="tab active">
            <span className="tab-icon" style={{ color: "#b48ead" }}>
              <AppIcons.Sparkle16 />
            </span>
            <span className="tab-label">Welcome</span>
          </div>
        ) : (
          openFiles.map((file) => (
            <div
              key={file.id}
              className={`tab${file.id === activeFileId ? " active" : ""}${file.isDirty ? " modified" : ""}${file.isPreview ? " preview" : ""}`}
              onClick={() => onSwitchFile(file.id)}
              title={file.isPreview ? `预览: ${file.originalPath || file.path}` : file.path}
            >
              <span className="tab-icon">
                {file.isPreview ? (
                  <svg viewBox="0 0 16 16" fill="#9966cc" width="14" height="14">
                    <path d="M8 3.5c-4 0-7 4-7 4.5s3 4.5 7 4.5 7-4 7-4.5-3-4.5-7-4.5zm0 7a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill={getFileColor(file.name)} width="14" height="14">
                    <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z" />
                  </svg>
                )}
              </span>
              <span className="tab-label">{file.name}</span>
              <button className="tab-close" onClick={(e) => onCloseFile(file.id, e)}>
                <AppIcons.Close16 />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
