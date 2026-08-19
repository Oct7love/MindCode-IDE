/**
 * M5 回归：CodeEditor 回调 ref + 程序化 setValue 抑制 + 每文件独立 model。
 * 不启动真实 Monaco；用可触发的假 editor/model 验证接线。
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";

type Listener = () => void;

interface FakeModel {
  getValue: () => string;
  setValue: (v: string) => void;
  isDisposed: () => boolean;
  dispose: () => void;
}

interface FakeEditor {
  getValue: () => string;
  setValue: (v: string) => void;
  getModel: () => FakeModel;
  setModel: (m: FakeModel) => void;
  getPosition: () => { lineNumber: number; column: number };
  getSelection: () => { isEmpty: () => boolean };
  onDidChangeCursorPosition: (
    cb: (e: { position: { lineNumber: number; column: number } }) => void,
  ) => {
    dispose: () => void;
  };
  onDidChangeModelContent: (cb: Listener) => { dispose: () => void };
  addCommand: (key: number, cb: () => void) => void;
  addAction: ReturnType<typeof vi.fn>;
  updateOptions: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  getScrolledVisiblePosition: () => { top: number; left: number; height: number };
  trigger: ReturnType<typeof vi.fn>;
  executeEdits: ReturnType<typeof vi.fn>;
}

interface EditorHarness {
  editor: FakeEditor;
  contentListeners: Listener[];
  saveHandler: (() => void) | null;
  fireUserEdit: (next: string) => void;
  fireSave: () => void;
}

const harness: { current: EditorHarness | null } = { current: null };

function createFakeModel(initial: string): FakeModel {
  let value = initial;
  let disposed = false;
  return {
    getValue: () => value,
    setValue: (v: string) => {
      value = v;
      harness.current?.contentListeners.forEach((l) => l());
    },
    isDisposed: () => disposed,
    dispose: () => {
      disposed = true;
    },
  };
}

vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/language/json/json.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/language/css/css.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/language/html/html.worker?worker", () => ({ default: vi.fn() }));
vi.mock("monaco-editor/esm/vs/language/typescript/ts.worker?worker", () => ({ default: vi.fn() }));

vi.mock("monaco-editor", () => {
  const KeyMod = { CtrlCmd: 2048 };
  const KeyCode = { KeyS: 49, KeyK: 41, Tab: 2, Escape: 9 };
  return {
    KeyMod,
    KeyCode,
    Range: class Range {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number,
      ) {}
    },
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      setModelLanguage: vi.fn(),
      createModel: (value: string) => createFakeModel(value),
      create: vi.fn((_el: unknown, opts?: { value?: string }) => {
        const contentListeners: Listener[] = [];
        let model = createFakeModel(opts?.value || "");
        let saveHandler: (() => void) | null = null;
        const editor: FakeEditor = {
          getValue: () => model.getValue(),
          setValue: (v: string) => {
            model.setValue(v);
          },
          getModel: () => model,
          setModel: (m: FakeModel) => {
            model = m;
          },
          getPosition: () => ({ lineNumber: 1, column: 1 }),
          getSelection: () => ({ isEmpty: () => true }),
          onDidChangeCursorPosition: (cb) => {
            cb({ position: { lineNumber: 1, column: 1 } });
            return { dispose: vi.fn() };
          },
          onDidChangeModelContent: (cb) => {
            contentListeners.push(cb);
            return { dispose: vi.fn() };
          },
          addCommand: (key, cb) => {
            if (key === KeyMod.CtrlCmd + KeyCode.KeyS || key === (KeyMod.CtrlCmd | KeyCode.KeyS)) {
              saveHandler = cb;
            }
          },
          addAction: vi.fn(),
          updateOptions: vi.fn(),
          dispose: vi.fn(),
          focus: vi.fn(),
          getScrolledVisiblePosition: () => ({ top: 0, left: 0, height: 18 }),
          trigger: vi.fn(),
          executeEdits: vi.fn(),
        };
        harness.current = {
          editor,
          contentListeners,
          get saveHandler() {
            return saveHandler;
          },
          fireUserEdit: (next: string) => {
            model.setValue(next);
          },
          fireSave: () => {
            saveHandler?.();
          },
        };
        return editor;
      }),
    },
    languages: { register: vi.fn() },
  };
});

vi.mock("../../../renderer/hooks/useLSP", () => ({
  useLSP: () => ({ connected: false, language: null, diagnostics: new Map() }),
}));

vi.mock("../../../renderer/services/streamingCompletionProvider", () => ({
  registerStreamingCompletionProvider: () => ({ dispose: vi.fn() }),
}));

vi.mock("../../../renderer/services/inlineCompletionProvider", () => ({
  triggerInlineCompletion: vi.fn(),
  acceptCompletionWord: vi.fn(),
  acceptCompletionLine: vi.fn(),
}));

vi.mock("../../../renderer/services/completionService", () => ({
  completionService: { getCompletion: vi.fn(), cancel: vi.fn() },
}));

vi.mock("../../../renderer/components/InlineEditWidget", () => ({
  InlineEditWidget: () => null,
}));

vi.mock("../../../renderer/utils/logger", () => ({
  createNamedLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { CodeEditor } from "../../../renderer/components/CodeEditor";

describe("CodeEditor M5 回调与抑制", () => {
  beforeEach(() => {
    harness.current = null;
  });

  it("内容变化始终调用最新的 onContentChange，而不是挂载时的闭包", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <CodeEditor file={{ path: "/ws/A.ts", content: "A0" }} onContentChange={first} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.current).toBeTruthy();

    act(() => {
      harness.current!.fireUserEdit("A1");
    });
    expect(first).toHaveBeenCalledWith("A1");

    rerender(<CodeEditor file={{ path: "/ws/A.ts", content: "A1" }} onContentChange={second} />);
    first.mockClear();
    second.mockClear();

    act(() => {
      harness.current!.fireUserEdit("A2");
    });
    expect(second).toHaveBeenCalledWith("A2");
    expect(first).not.toHaveBeenCalled();
  });

  it("Ctrl+S 走最新 onSave", async () => {
    const firstSave = vi.fn();
    const secondSave = vi.fn();
    const { rerender } = render(
      <CodeEditor file={{ path: "/ws/A.ts", content: "A0" }} onSave={firstSave} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    rerender(
      <CodeEditor
        file={{ path: "/ws/A.ts", content: "A0" }}
        onSave={secondSave}
        onContentChange={vi.fn()}
      />,
    );

    act(() => {
      harness.current!.editor.setValue("A-saved");
      harness.current!.contentListeners.length = 0;
      harness.current!.fireSave();
    });
    expect(secondSave).toHaveBeenCalledWith("A-saved");
    expect(firstSave).not.toHaveBeenCalled();
  });

  it("同一文件程序化更新 content 不回写 onContentChange（假 dirty 抑制）", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeEditor file={{ path: "/ws/A.ts", content: "orig" }} onContentChange={onChange} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    onChange.mockClear();

    rerender(
      <CodeEditor file={{ path: "/ws/A.ts", content: "from-parent" }} onContentChange={onChange} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(harness.current!.editor.getValue()).toBe("from-parent");
  });

  it("切到另一文件时切换独立 model，且 setModel 不触发 onContentChange", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeEditor file={{ path: "/ws/A.ts", content: "AAA" }} onContentChange={onChange} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const modelA = harness.current!.editor.getModel();

    onChange.mockClear();
    rerender(<CodeEditor file={{ path: "/ws/B.ts", content: "BBB" }} onContentChange={onChange} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).not.toHaveBeenCalled();
    const modelB = harness.current!.editor.getModel();
    expect(modelB).not.toBe(modelA);
    expect(modelB.getValue()).toBe("BBB");

    rerender(<CodeEditor file={{ path: "/ws/A.ts", content: "AAA" }} onContentChange={onChange} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.current!.editor.getModel()).toBe(modelA);
    expect(harness.current!.editor.getValue()).toBe("AAA");
  });
});
