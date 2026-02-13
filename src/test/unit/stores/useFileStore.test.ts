import { describe, it, expect, beforeEach } from "vitest";
import { useFileStore } from "@stores/useFileStore";
import type { EditorFile } from "@stores/useFileStore";

const act = <T>(fn: () => T): T => fn();

const makeFile = (id: string, path: string, name?: string): EditorFile => ({
  id,
  path,
  name: name ?? path.split(/[/\\]/).pop()!,
  content: `// ${id}`,
  language: "typescript",
});

beforeEach(() => {
  useFileStore.setState(useFileStore.getInitialState());
});

describe("useFileStore", () => {
  describe("初始状态", () => {
    it("workspaceRoot 为 null", () => {
      expect(useFileStore.getState().workspaceRoot).toBeNull();
    });

    it("openFiles 为空数组", () => {
      expect(useFileStore.getState().openFiles).toEqual([]);
    });

    it("activeFileId 为 null", () => {
      expect(useFileStore.getState().activeFileId).toBeNull();
    });
  });

  describe("setWorkspace", () => {
    it("设置工作区并重置打开文件", () => {
      // 先打开一个文件
      act(() => useFileStore.getState().openFile(makeFile("f1", "/a.ts")));
      expect(useFileStore.getState().openFiles).toHaveLength(1);

      act(() => useFileStore.getState().setWorkspace("/new/root", "MyProject"));
      const state = useFileStore.getState();
      expect(state.workspaceRoot).toBe("/new/root");
      expect(state.workspaceName).toBe("MyProject");
      expect(state.openFiles).toHaveLength(0);
      expect(state.activeFileId).toBeNull();
    });

    it("未指定 name 时从路径提取", () => {
      act(() => useFileStore.getState().setWorkspace("D:\\Projects\\Demo"));
      expect(useFileStore.getState().workspaceName).toBe("Demo");
    });
  });

  describe("openFile", () => {
    it("打开新文件并设为活动", () => {
      const file = makeFile("f1", "/src/index.ts");
      act(() => useFileStore.getState().openFile(file));

      const state = useFileStore.getState();
      expect(state.openFiles).toHaveLength(1);
      expect(state.activeFileId).toBe("f1");
      expect(state.selectedPath).toBe("/src/index.ts");
    });

    it("重复打开同路径文件只切换不重复添加", () => {
      const file1 = makeFile("f1", "/src/index.ts");
      const file2 = makeFile("f2", "/src/index.ts"); // 同路径不同 id

      act(() => useFileStore.getState().openFile(file1));
      act(() => useFileStore.getState().openFile(file2));

      const state = useFileStore.getState();
      expect(state.openFiles).toHaveLength(1);
      // 应切换到已有的 f1
      expect(state.activeFileId).toBe("f1");
    });
  });

  describe("closeFile", () => {
    it("关闭当前文件后自动切到相邻文件", () => {
      const f1 = makeFile("f1", "/a.ts");
      const f2 = makeFile("f2", "/b.ts");
      const f3 = makeFile("f3", "/c.ts");

      act(() => useFileStore.getState().openFile(f1));
      act(() => useFileStore.getState().openFile(f2));
      act(() => useFileStore.getState().openFile(f3));
      // 当前 active 是 f3
      act(() => useFileStore.getState().setActiveFile("f2"));

      act(() => useFileStore.getState().closeFile("f2"));
      const state = useFileStore.getState();
      expect(state.openFiles).toHaveLength(2);
      // 关闭 f2 (index=1)，应切到 newFiles[min(1, 1)] = f3
      expect(state.activeFileId).toBeTruthy();
      expect(state.openFiles.find((f) => f.id === "f2")).toBeUndefined();
    });

    it("关闭所有文件后 activeFileId 为 null", () => {
      act(() => useFileStore.getState().openFile(makeFile("f1", "/a.ts")));
      act(() => useFileStore.getState().closeFile("f1"));
      expect(useFileStore.getState().activeFileId).toBeNull();
    });
  });

  describe("updateFileContent", () => {
    it("更新内容并标记 isDirty", () => {
      const file = makeFile("f1", "/a.ts");
      act(() => useFileStore.getState().openFile(file));
      act(() => useFileStore.getState().updateFileContent("f1", "新内容"));

      const updated = useFileStore.getState().openFiles.find((f) => f.id === "f1");
      expect(updated?.content).toBe("新内容");
      expect(updated?.isDirty).toBe(true);
    });
  });

  describe("markFileSaved", () => {
    it("清除 isDirty 标记", () => {
      const file = makeFile("f1", "/a.ts");
      act(() => useFileStore.getState().openFile(file));
      act(() => useFileStore.getState().updateFileContent("f1", "changed"));
      expect(useFileStore.getState().openFiles[0].isDirty).toBe(true);

      act(() => useFileStore.getState().markFileSaved("f1"));
      expect(useFileStore.getState().openFiles[0].isDirty).toBe(false);
    });
  });

  describe("createNewFile", () => {
    it("创建 Untitled 文件并设为活动", () => {
      const id = act(() => useFileStore.getState().createNewFile("typescript"));
      const state = useFileStore.getState();

      expect(state.activeFileId).toBe(id);
      const file = state.openFiles.find((f) => f.id === id);
      expect(file).toBeDefined();
      expect(file?.isUntitled).toBe(true);
      expect(file?.name).toMatch(/^Untitled-\d+\.ts$/);
      expect(file?.language).toBe("typescript");
      expect(file?.content).toBe("");
    });

    it("多次创建编号递增", () => {
      act(() => useFileStore.getState().createNewFile());
      act(() => useFileStore.getState().createNewFile());
      const names = useFileStore.getState().openFiles.map((f) => f.name);
      expect(names).toContain("Untitled-1.txt");
      expect(names).toContain("Untitled-2.txt");
    });
  });
});
