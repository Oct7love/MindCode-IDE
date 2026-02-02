/**
 * StatusBar 组件测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '../../renderer/components/StatusBarEnhanced';

describe('StatusBar', () => {
  it('renders cursor position', () => {
    render(<StatusBar cursorPosition={{ line: 10, column: 5 }} />);
    expect(screen.getByText(/Ln 10, Col 5/)).toBeInTheDocument();
  });

  it('renders language mode', () => {
    render(<StatusBar language="TypeScript" />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('renders encoding', () => {
    render(<StatusBar encoding="UTF-8" />);
    expect(screen.getByText('UTF-8')).toBeInTheDocument();
  });

  it('renders git branch', () => {
    render(<StatusBar gitBranch="main" />);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('renders git status with changes', () => {
    render(<StatusBar gitBranch="feature" gitStatus={{ changed: 3, staged: 1 }} />);
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText(/~3/)).toBeInTheDocument();
  });

  it('renders problems count', () => {
    render(<StatusBar problems={{ errors: 2, warnings: 5 }} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders selection info', () => {
    render(<StatusBar cursorPosition={{ line: 1, column: 1 }} selection={{ lines: 3, chars: 50 }} />);
    expect(screen.getByText(/50 selected/)).toBeInTheDocument();
  });

  it('renders custom items', () => {
    const items = [{ id: 'test', content: 'Test Item', position: 'left' as const }];
    render(<StatusBar items={items} />);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('handles item click', () => {
    const onClick = vi.fn();
    const items = [{ id: 'clickable', content: 'Click Me', position: 'right' as const, onClick }];
    render(<StatusBar items={items} />);
    fireEvent.click(screen.getByText('Click Me'));
    expect(onClick).toHaveBeenCalled();
  });
});
