/**
 * VirtualFileTree - 虚拟化文件树
 *
 * 用 VirtualList 替代递归 TreeRow，将所有展开节点扁平化后
 * 只渲染可视窗口内的行，解决大项目（>1000 文件）DOM 节点爆炸问题。
 */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { VirtualList } from "./VirtualList";
import { AppIcons, getFileColor } from "./icons";
import type { TreeNode } from "../stores";

// 每行固定高度，与 CSS .tree-row 的 line-height 保持一致
const ITEM_HEIGHT = 24;
const INDENT_BASE = 8;
const INDENT_PER_LEVEL = 12;

export interface VirtualFileTreeProps {
  tree: TreeNode[];
  selected: string;
  contextMenuPath: string | null;
  onSelect: (path: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => void;
  onLoadChildren: (path: string) => Promise<TreeNode[]>;
  className?: string;
}

/** 扁平化后的单行数据 */
interface FlatNode {
  node: TreeNode;
  depth: number;
  isFolder: boolean;
  isOpen: boolean;
  isLoading: boolean;
}

/** 文件夹优先、同类型按名称字母序排序 */
function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 将树递归展开为有序扁平数组。
 * 仅当节点路径存在于 openPaths 时才递归其子节点。
 */
function flattenTree(
  nodes: TreeNode[],
  depth: number,
  openPaths: Set<string>,
  loadingPaths: Set<string>,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of sortNodes(nodes)) {
    const key = node.path || node.name;
    const isFolder = node.type === "folder";
    const isOpen = isFolder && openPaths.has(key);
    const isLoading = isFolder && loadingPaths.has(key);
    result.push({ node, depth, isFolder, isOpen, isLoading });
    if (isOpen && node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1, openPaths, loadingPaths));
    }
  }
  return result;
}

/** 收集 depth=0 的文件夹路径，用于初始化默认展开状态 */
function collectRootFolderKeys(nodes: TreeNode[]): string[] {
  return nodes.filter((n) => n.type === "folder").map((n) => n.path || n.name);
}

/** 单行渲染（memo 避免列表滚动时无关行重渲染） */
const TreeLine = React.memo(function TreeLine({
  flat,
  selected,
  contextMenuPath,
  onToggle,
  onSelect,
  onContextMenu,
}: {
  flat: FlatNode;
  selected: string;
  contextMenuPath: string | null;
  onToggle: (key: string) => void;
  onSelect: (path: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => void;
}) {
  const { node, depth, isFolder, isOpen, isLoading } = flat;
  const key = node.path || node.name;
  const paddingLeft = INDENT_BASE + depth * INDENT_PER_LEVEL;

  const handleClick = useCallback(() => {
    if (isFolder) onToggle(key);
    else onSelect(node.path || node.name, node.name);
  }, [isFolder, key, node.path, node.name, onToggle, onSelect]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, node.path || "", node.name, isFolder);
    },
    [node.path, node.name, isFolder, onContextMenu],
  );

  return (
    <div
      className={`tree-row${selected === node.path ? " selected" : ""}${contextMenuPath === node.path ? " context-active" : ""}`}
      style={{ paddingLeft }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <span className="tree-toggle">
        {isFolder &&
          (isLoading ? null : isOpen ? <AppIcons.ChevronDown16 /> : <AppIcons.ChevronRight16 />)}
      </span>
      <span className="tree-icon">
        {isFolder ? (
          isOpen ? (
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
  );
});

export const VirtualFileTree: React.FC<VirtualFileTreeProps> = React.memo(
  ({ tree, selected, contextMenuPath, onSelect, onContextMenu, onLoadChildren, className }) => {
    // 已展开文件夹的路径集合；depth=0 的文件夹默认展开
    const [openPaths, setOpenPaths] = useState<Set<string>>(
      () => new Set(collectRootFolderKeys(tree)),
    );
    // 正在异步加载子节点的路径集合
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

    // tree 根节点变化时（切换工作区）重置展开状态
    useEffect(() => {
      setOpenPaths(new Set(collectRootFolderKeys(tree)));
      setLoadingPaths(new Set());
    }, [tree]);

    const handleToggle = useCallback(
      (key: string) => {
        setOpenPaths((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
            return next;
          }
          next.add(key);
          // 需要懒加载时触发，不阻塞 UI
          const node = findNodeByKey(tree, key);
          if (node && (!node.children || node.children.length === 0)) {
            setLoadingPaths((lp) => new Set(lp).add(key));
            onLoadChildren(key)
              .then((children) => {
                node.children = children;
                // 强制重新扁平化（通过更新 loadingPaths 触发 memo 重算）
                setLoadingPaths((lp) => {
                  const nl = new Set(lp);
                  nl.delete(key);
                  return nl;
                });
              })
              .catch(() => {
                setLoadingPaths((lp) => {
                  const nl = new Set(lp);
                  nl.delete(key);
                  return nl;
                });
              });
          }
          return next;
        });
      },
      [tree, onLoadChildren],
    );

    // 扁平化结果随展开状态、加载状态变化重算
    const flatNodes = useMemo(
      () => flattenTree(tree, 0, openPaths, loadingPaths),
      [tree, openPaths, loadingPaths],
    );

    const renderItem = useCallback(
      (flat: FlatNode) => (
        <TreeLine
          flat={flat}
          selected={selected}
          contextMenuPath={contextMenuPath}
          onToggle={handleToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ),
      [selected, contextMenuPath, handleToggle, onSelect, onContextMenu],
    );

    return (
      <VirtualList
        items={flatNodes}
        itemHeight={ITEM_HEIGHT}
        renderItem={renderItem}
        overscan={8}
        className={className}
        style={{ flex: 1, minHeight: 0 }}
      />
    );
  },
);

VirtualFileTree.displayName = "VirtualFileTree";

/** 在树中按 path/name 查找节点（广度优先，避免深递归） */
function findNodeByKey(nodes: TreeNode[], key: string): TreeNode | undefined {
  const queue = [...nodes];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if ((node.path || node.name) === key) return node;
    if (node.children) queue.push(...node.children);
  }
  return undefined;
}
