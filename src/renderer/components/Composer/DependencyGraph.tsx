/**
 * 依赖图可视化组件 - 简化版
 * 显示文件间依赖关系
 */

import React, { useMemo } from 'react';
import './DependencyGraph.css';

interface GraphNode { id: string; label: string; type: 'create' | 'modify' | 'delete'; risk: 'low' | 'medium' | 'high'; }
interface GraphEdge { source: string; target: string; type: 'depends' | 'imports'; }

interface DependencyGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode?: string;
  onNodeClick?: (nodeId: string) => void;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ nodes, edges, selectedNode, onNodeClick }) => {
  // 简单布局：圆形排列
  const layout = useMemo(() => {
    const cx = 200, cy = 150, r = 120;
    return nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      return { ...node, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [nodes]);

  // 构建节点映射
  const nodeMap = useMemo(() => new Map(layout.map(n => [n.id, n])), [layout]);

  const riskColors: Record<string, string> = { low: '#4caf50', medium: '#ff9800', high: '#f44336' };
  const typeIcons: Record<string, string> = { create: '+', modify: '~', delete: '-' };

  return (
    <div className="dependency-graph">
      <svg viewBox="0 0 400 300" className="graph-svg">
        {/* 边 */}
        {edges.map((edge, i) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          return (
            <g key={i}>
              <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={`graph-edge edge-${edge.type}`} markerEnd="url(#arrow)" />
            </g>
          );
        })}
        {/* 箭头标记 */}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="var(--text-secondary)" />
          </marker>
        </defs>
        {/* 节点 */}
        {layout.map((node) => (
          <g key={node.id} className={`graph-node ${selectedNode === node.id ? 'selected' : ''}`} onClick={() => onNodeClick?.(node.id)} style={{ cursor: 'pointer' }}>
            <circle cx={node.x} cy={node.y} r="24" fill={riskColors[node.risk]} opacity={0.2} stroke={riskColors[node.risk]} strokeWidth="2" />
            <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle" className="node-icon">{typeIcons[node.type]}</text>
            <text x={node.x} y={node.y + 38} textAnchor="middle" className="node-label">{node.label.split(/[/\\]/).pop()?.slice(0, 15)}</text>
          </g>
        ))}
      </svg>
      {/* 图例 */}
      <div className="graph-legend">
        <span><span className="legend-dot" style={{ background: '#4caf50' }} /> 低风险</span>
        <span><span className="legend-dot" style={{ background: '#ff9800' }} /> 中风险</span>
        <span><span className="legend-dot" style={{ background: '#f44336' }} /> 高风险</span>
      </div>
    </div>
  );
};

export default DependencyGraph;
