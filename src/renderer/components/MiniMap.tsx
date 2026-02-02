/**
 * MiniMap - 代码缩略图/导航
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface MiniMapProps { content: string; visibleStartLine: number; visibleEndLine: number; totalLines: number; highlightLines?: number[]; bookmarks?: number[]; errors?: number[]; warnings?: number[]; onNavigate: (line: number) => void; }

export const MiniMap: React.FC<MiniMapProps> = ({ content, visibleStartLine, visibleEndLine, totalLines, highlightLines = [], bookmarks = [], errors = [], warnings = [], onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const drawMiniMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = container.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    const lineHeight = Math.max(1, height / totalLines);
    const lines = content.split('\n');

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
    ctx.fillRect(0, 0, width, height);

    lines.forEach((line, i) => { // 绘制代码行
      const y = i * lineHeight;
      const indent = line.search(/\S|$/);
      const contentLen = Math.min(line.trim().length, 60);
      if (contentLen > 0) {
        ctx.fillStyle = 'rgba(180, 180, 180, 0.4)';
        ctx.fillRect(indent * 0.5 + 2, y, contentLen * 0.8, Math.max(1, lineHeight - 0.5));
      }
    });

    errors.forEach(line => { ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; ctx.fillRect(0, (line - 1) * lineHeight, 3, lineHeight); }); // 错误标记
    warnings.forEach(line => { ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'; ctx.fillRect(0, (line - 1) * lineHeight, 3, lineHeight); }); // 警告标记
    bookmarks.forEach(line => { ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'; ctx.fillRect(width - 3, (line - 1) * lineHeight, 3, lineHeight); }); // 书签标记
    highlightLines.forEach(line => { ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; ctx.fillRect(0, (line - 1) * lineHeight, width, lineHeight); }); // 高亮行

    const viewportY = (visibleStartLine - 1) * lineHeight;  // 可视区域
    const viewportHeight = (visibleEndLine - visibleStartLine + 1) * lineHeight;
    ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.fillRect(0, viewportY, width, viewportHeight);
    ctx.strokeStyle = 'rgba(0, 122, 204, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, viewportY + 0.5, width - 1, viewportHeight - 1);
  }, [content, visibleStartLine, visibleEndLine, totalLines, highlightLines, bookmarks, errors, warnings]);

  useEffect(() => { drawMiniMap(); }, [drawMiniMap]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const line = Math.floor((y / rect.height) * totalLines) + 1;
    onNavigate(Math.max(1, Math.min(line, totalLines)));
  }, [totalLines, onNavigate]);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => { if (isDragging) handleClick(e); }, [isDragging, handleClick]);

  return (
    <div ref={containerRef} className="w-[60px] h-full bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] cursor-pointer" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseMove={handleMouseMove} onClick={handleClick}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default MiniMap;
