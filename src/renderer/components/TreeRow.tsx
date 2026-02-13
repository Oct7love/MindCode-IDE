/**
 * TreeRow - 文件树行组件
 *
 * 负责渲染单个文件/文件夹节点，支持：
 * - 懒加载子目录（按需加载）
 * - 选中态 / 右键菜单高亮
 * - 递归渲染子节点
 */
import React, { useState, useEffect, useCallback } from "react";
import { AppIcons, getFileColor } from "./icons";
import type { TreeNode } from "../stores";

export interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selected: string;
  contextMenuPath: string | null;
  onSelect: (path: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => void;
  onLoadChildren: (path: string) => Promise<TreeNode[]>;
}

/** 树行缩进基准（px），depth 乘以此值作为 paddingLeft 增量 */
const TREE_INDENT_BASE = 8;
const TREE_INDENT_PER_LEVEL = 12;

export const TreeRow: React.FC<TreeRowProps> = React.memo(
  ({ node, depth, selected, contextMenuPath, onSelect, onContextMenu, onLoadChildren }) => {
    const [open, setOpen] = useState(depth < 1);
    const [loading, setLoading] = useState(false);
    const [children, setChildren] = useState<TreeNode[] | undefined>(node.children);
    const isFolder = node.type === "folder";
    const hasLoadedChildren = children !== undefined && children.length > 0;
    const needsLoad = isFolder && !hasLoadedChildren && open;

    useEffect(() => {
      if (needsLoad && !loading) {
        setLoading(true);
        onLoadChildren(node.path || "")
          .then((loadedChildren) => {
            setChildren(loadedChildren);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    }, [needsLoad, loading, node.path, onLoadChildren]);

    const handleClick = useCallback(() => {
      if (isFolder) setOpen(!open);
      else onSelect(node.path || node.name, node.name);
    }, [isFolder, open, node.path, node.name, onSelect]);

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node.path || "", node.name, isFolder);
      },
      [node.path, node.name, isFolder, onContextMenu],
    );

    const paddingLeft = TREE_INDENT_BASE + depth * TREE_INDENT_PER_LEVEL;

    return (
      <>
        <div
          className={`tree-row${selected === node.path ? " selected" : ""}${contextMenuPath === node.path ? " context-active" : ""}`}
          style={{ paddingLeft }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className="tree-toggle">
            {isFolder && (open ? <AppIcons.ChevronDown16 /> : <AppIcons.ChevronRight16 />)}
          </span>
          <span className="tree-icon">
            {isFolder ? (
              open ? (
                <AppIcons.FolderOpen16 />
              ) : (
                <AppIcons.Folder16 />
              )
            ) : (
              <AppIcons.File16 color={getFileColor(node.name)} />
            )}
          </span>
          <span className="tree-label">{node.name}</span>
        </div>
        {isFolder && open && loading && (
          <div
            className="tree-row-loading"
            style={{ paddingLeft: TREE_INDENT_BASE + (depth + 1) * TREE_INDENT_PER_LEVEL }}
          >
            <div className="tree-row-loading-spinner" />
            <span>Loading...</span>
          </div>
        )}
        {isFolder &&
          open &&
          !loading &&
          children?.map((c, i) => (
            <TreeRow
              key={(c.path || c.name) + i}
              node={c}
              depth={depth + 1}
              selected={selected}
              contextMenuPath={contextMenuPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onLoadChildren={onLoadChildren}
            />
          ))}
      </>
    );
  },
);

TreeRow.displayName = "TreeRow";
