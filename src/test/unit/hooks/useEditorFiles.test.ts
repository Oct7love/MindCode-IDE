/**
 * M5 回归测试：useEditorFiles 编辑器状态完整性（P0-4 数据安全的状态层不变量）。
 *
 * 这些不变量保证：只要 CodeEditor 永远调用「当前 active 的 action」（M5 对陈旧闭包的修复），
 * 编辑器的内容/dirty/保存就不会串到别的 tab。CodeEditor 的 ref/suppress 接线由类型检查+构建+e2e 兜底。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorFiles } from "../../../renderer/hooks/useEditorFiles";
import { useFileStore } from "../../../renderer/stores";

// 每个测试前重置 store（useEditorFiles 会读 store 的 preview 文件）+ fs mock。
beforeEach(() => {
  useFileStore.setState(useFileStore.getInitialState());
  const fs = window.mindcode!.fs as unknown as {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
  };
  fs.readFile.mockReset();
  fs.writeFile.mockReset();
  // 默认：readFile 返回按路径命名的内容；writeFile 成功。
  fs.readFile.mockImplementation(async (p: string) => ({ success: true, data: `content-of:${p}` }));
  fs.writeFile.mockResolvedValue({ success: true });
});

function setup() {
  return renderHook(() => useEditorFiles("/ws"));
}

describe("useEditorFiles · 打开/切换/编辑不串 tab (P0-4 核心)", () => {
  it("打开 A→改 A→切 B→切回 A：A 的未保存内容仍在，且改动只落在当前 active", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    await act(async () => {
      await result.current.openFile("/ws/B.ts", "B.ts");
    });
    const idB = result.current.activeFileId!;
    expect(idB).not.toBe(idA);

    // 在 B active 时编辑 → 只改 B，不碰 A
    act(() => result.current.updateFileContent("B-edited"));
    expect(result.current.openFiles.find((f) => f.id === idB)!.content).toBe("B-edited");
    expect(result.current.openFiles.find((f) => f.id === idA)!.content).toBe("content-of:/ws/A.ts");

    // 切回 A、改 A → 只改 A
    act(() => result.current.switchFile(idA));
    act(() => result.current.updateFileContent("A-edited"));
    expect(result.current.openFiles.find((f) => f.id === idA)!.content).toBe("A-edited");
    // B 未被污染
    expect(result.current.openFiles.find((f) => f.id === idB)!.content).toBe("B-edited");
  });

  it("A/B 都改，保存 A 只写 A.path 且不影响 B 的 dirty", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    act(() => result.current.updateFileContent("A-edited"));
    await act(async () => {
      await result.current.openFile("/ws/B.ts", "B.ts");
    });
    const idB = result.current.activeFileId!;
    act(() => result.current.updateFileContent("B-edited"));

    // 切回 A 保存 A
    act(() => result.current.switchFile(idA));
    await act(async () => {
      await result.current.saveFile("A-edited");
    });
    const fs = window.mindcode!.fs as unknown as { writeFile: ReturnType<typeof vi.fn> };
    // 只写了 A.path，内容是 A 的
    expect(fs.writeFile).toHaveBeenCalledWith("/ws/A.ts", "A-edited");
    expect(fs.writeFile).not.toHaveBeenCalledWith("/ws/B.ts", expect.anything());
    // A 不脏、B 仍脏
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(false);
    expect(result.current.openFiles.find((f) => f.id === idB)!.isDirty).toBe(true);
  });

  it("重新打开已打开文件不会覆盖内存未保存 buffer（只切 active，不读盘覆盖）", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    act(() => result.current.updateFileContent("A-unsaved"));
    const fs = window.mindcode!.fs as unknown as { readFile: ReturnType<typeof vi.fn> };
    const readsBefore = fs.readFile.mock.calls.length;

    // 再次 openFile 同一路径
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    // 未再次读盘、内容未被覆盖
    expect(fs.readFile.mock.calls.length).toBe(readsBefore);
    expect(result.current.openFiles.find((f) => f.id === idA)!.content).toBe("A-unsaved");
  });
});

describe("useEditorFiles · dirty 基线准确 (M5 新增)", () => {
  it("改动后再改回原内容 → 不再 dirty", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    const original = "content-of:/ws/A.ts";
    act(() => result.current.updateFileContent("changed"));
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(true);
    act(() => result.current.updateFileContent(original));
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(false);
  });

  it("保存后 dirty 归零，且基线更新（保存内容再次输入相同不脏）", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    act(() => result.current.updateFileContent("v2"));
    await act(async () => {
      await result.current.saveFile("v2");
    });
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(false);
    act(() => result.current.updateFileContent("v2"));
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(false);
  });
});

describe("useEditorFiles · 保存全部只存 dirty (M5 新增)", () => {
  it("saveAllFiles 只写 dirty 文件并清其 dirty", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    await act(async () => {
      await result.current.openFile("/ws/B.ts", "B.ts");
    });
    const idB = result.current.activeFileId!;
    await act(async () => {
      await result.current.openFile("/ws/C.ts", "C.ts");
    });
    // 只改 A 和 C，B 保持干净
    act(() => result.current.switchFile(idA));
    act(() => result.current.updateFileContent("A2"));
    const idC = result.current.openFiles.find((f) => f.path === "/ws/C.ts")!.id;
    act(() => result.current.switchFile(idC));
    act(() => result.current.updateFileContent("C2"));

    const fs = window.mindcode!.fs as unknown as { writeFile: ReturnType<typeof vi.fn> };
    fs.writeFile.mockClear();
    await act(async () => {
      await result.current.saveAllFiles();
    });
    const written = fs.writeFile.mock.calls.map((c) => c[0]);
    expect(written).toContain("/ws/A.ts");
    expect(written).toContain("/ws/C.ts");
    expect(written).not.toContain("/ws/B.ts");
    expect(result.current.openFiles.find((f) => f.id === idA)!.isDirty).toBe(false);
    expect(result.current.openFiles.find((f) => f.id === idC)!.isDirty).toBe(false);
    expect(result.current.openFiles.find((f) => f.id === idB)!.isDirty).toBe(false);
  });
});

describe("useEditorFiles · 关闭 dirty tab 有保护 (M5 新增)", () => {
  it("closeFile 对 dirty 文件返回 requiresConfirm=true 且不立即移除", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    act(() => result.current.updateFileContent("dirty"));

    let res: { closed: boolean; requiresConfirm: boolean } | undefined;
    act(() => {
      res = result.current.closeFile(idA);
    });
    expect(res!.requiresConfirm).toBe(true);
    expect(res!.closed).toBe(false);
    // 文件仍在（未静默丢弃）
    expect(result.current.openFiles.find((f) => f.id === idA)).toBeTruthy();
  });

  it("closeFile 对干净文件直接关闭；force=true 可强制关闭 dirty", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    const idA = result.current.activeFileId!;
    // 干净：直接关
    let res1: { closed: boolean } | undefined;
    act(() => {
      res1 = result.current.closeFile(idA);
    });
    expect(res1!.closed).toBe(true);
    expect(result.current.openFiles.length).toBe(0);

    // dirty + force
    await act(async () => {
      await result.current.openFile("/ws/B.ts", "B.ts");
    });
    const idB = result.current.activeFileId!;
    act(() => result.current.updateFileContent("dirty"));
    let res2: { closed: boolean } | undefined;
    act(() => {
      res2 = result.current.closeFile(idB, { force: true });
    });
    expect(res2!.closed).toBe(true);
    expect(result.current.openFiles.find((f) => f.id === idB)).toBeFalsy();
  });
});

describe("useEditorFiles · 文件 id 唯一 (M5 新增)", () => {
  it("同一时刻连续打开多个文件 id 不碰撞", async () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    try {
      const { result } = setup();
      await act(async () => {
        await result.current.openFile("/ws/A.ts", "A.ts");
        await result.current.openFile("/ws/B.ts", "B.ts");
        await result.current.openFile("/ws/C.ts", "C.ts");
      });
      const ids = result.current.openFiles.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("useEditorFiles · 与 useFileStore 不存在分叉", () => {
  it("hook 与 store 的 openFiles/activeFileId/content 始终同一份", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    act(() => result.current.updateFileContent("A-edit"));
    expect(result.current.openFiles).toEqual(useFileStore.getState().openFiles);
    expect(result.current.activeFileId).toBe(useFileStore.getState().activeFileId);
    expect(useFileStore.getState().openFiles[0].content).toBe("A-edit");
  });

  it("搜索再次打开同一路径只切 active，不覆盖 buffer、不读盘", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    act(() => result.current.updateFileContent("unsaved"));
    const fs = window.mindcode!.fs as unknown as { readFile: ReturnType<typeof vi.fn> };
    const reads = fs.readFile.mock.calls.length;
    await act(async () => {
      await result.current.openFile("/ws/A.ts", "A.ts");
    });
    expect(fs.readFile.mock.calls.length).toBe(reads);
    expect(result.current.openFiles).toHaveLength(1);
    expect(result.current.openFiles[0].content).toBe("unsaved");
  });

  it("预览 tab 再切一次即 pin，随后与普通文件同一套状态", () => {
    const { result } = setup();
    act(() => {
      useFileStore.getState().openPreviewFile("/ws/gen.ts", "preview-body", "ai", "typescript");
    });
    const preview = result.current.openFiles.find((f) => f.isPreview);
    expect(preview).toBeTruthy();
    expect(result.current.activeFileId).toBe(preview!.id);
    act(() => result.current.switchFile(preview!.id));
    const pinned = result.current.openFiles.find((f) => f.id === preview!.id);
    expect(pinned?.isPreview).toBe(false);
    expect(pinned?.content).toBe("preview-body");
    expect(useFileStore.getState().openFiles.find((f) => f.id === preview!.id)?.isPreview).toBe(
      false,
    );
  });
});
