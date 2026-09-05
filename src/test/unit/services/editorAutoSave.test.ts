/**
 * autoSave：显式 fileId + generation；切 tab / 保存中再编辑不得写错或清错 dirty。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorAutoSave } from "../../../renderer/services/editorAutoSave";

interface FileRec {
  path: string;
  content: string;
  generation: number;
  isUntitled?: boolean;
}

describe("EditorAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(files: Record<string, FileRec>) {
    const saves: Array<{ fileId: string; path: string; content: string }> = [];
    const save = vi.fn(async (fileId: string, path: string, content: string) => {
      saves.push({ fileId, path, content });
      return true;
    });
    const svc = new EditorAutoSave({
      delayMs: 1000,
      isEnabled: () => true,
      getFile: (id) => files[id],
      save,
    });
    return { svc, saves, save, files };
  }

  it("到期后按调度时的 fileId/path 保存，不跟当前 active", async () => {
    const { svc, saves, files } = setup({
      a: { path: "/A.ts", content: "A1", generation: 1 },
      b: { path: "/B.ts", content: "B0", generation: 0 },
    });
    svc.noteEdit({ fileId: "a", path: "/A.ts", content: "A1", generation: 1 });
    files.a = { path: "/A.ts", content: "A1", generation: 1 };
    await vi.advanceTimersByTimeAsync(1000);
    expect(saves).toEqual([{ fileId: "a", path: "/A.ts", content: "A1" }]);
  });

  it("关闭文件后取消 timer，不会再写盘", async () => {
    const files: Record<string, FileRec> = {
      a: { path: "/A.ts", content: "A1", generation: 1 },
    };
    const { svc, saves } = setup(files);
    svc.noteEdit({ fileId: "a", path: "/A.ts", content: "A1", generation: 1 });
    svc.cancel("a");
    delete files.a;
    await vi.advanceTimersByTimeAsync(2000);
    expect(saves).toEqual([]);
  });

  it("保存过程中再次编辑则重新调度最新 generation", async () => {
    const files: Record<string, FileRec> = {
      a: { path: "/A.ts", content: "A1", generation: 1 },
    };
    const save = vi.fn(async (_id: string, _path: string, content: string) => {
      if (content === "A1") {
        files.a = { path: "/A.ts", content: "A2", generation: 2 };
      }
      return true;
    });
    const svc = new EditorAutoSave({
      delayMs: 1000,
      isEnabled: () => true,
      getFile: (id) => files[id],
      save,
    });
    svc.noteEdit({ fileId: "a", path: "/A.ts", content: "A1", generation: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenNthCalledWith(1, "a", "/A.ts", "A1");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("a", "/A.ts", "A2");
  });

  it("workspace 切换 cancelAll 后不再保存", async () => {
    const { svc, saves } = setup({
      a: { path: "/A.ts", content: "A1", generation: 1 },
    });
    svc.noteEdit({ fileId: "a", path: "/A.ts", content: "A1", generation: 1 });
    svc.cancelAll();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saves).toEqual([]);
  });
});
