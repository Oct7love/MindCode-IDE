import { beforeEach, describe, expect, it } from "vitest";
import { useFileStore } from "../../../renderer/stores/useFileStore";
import {
  applyExternalDiskChange,
  rememberOwnWrite,
} from "../../../renderer/services/externalFileGuard";

describe("externalFileGuard", () => {
  beforeEach(() => {
    useFileStore.setState(useFileStore.getInitialState());
  });

  it("干净文件被外部修改时重载，不留 dirty", () => {
    useFileStore.getState().openFile({
      id: "a",
      path: "/A.ts",
      name: "A.ts",
      content: "local",
    });
    const result = applyExternalDiskChange("/A.ts", "disk");
    expect(result).toBe("reloaded");
    const file = useFileStore.getState().openFiles[0];
    expect(file.content).toBe("disk");
    expect(file.isDirty).toBe(false);
    expect(file.conflictDiskContent).toBeUndefined();
  });

  it("dirty 文件被外部修改时进入冲突，不覆盖本地缓冲", () => {
    useFileStore.getState().openFile({
      id: "a",
      path: "/A.ts",
      name: "A.ts",
      content: "base",
    });
    useFileStore.getState().updateFileContent("a", "mine");
    const result = applyExternalDiskChange("/A.ts", "theirs");
    expect(result).toBe("conflict");
    const file = useFileStore.getState().openFiles[0];
    expect(file.content).toBe("mine");
    expect(file.conflictDiskContent).toBe("theirs");
  });

  it("刚自己保存的写回不触发冲突", () => {
    useFileStore.getState().openFile({
      id: "a",
      path: "/A.ts",
      name: "A.ts",
      content: "saved",
    });
    rememberOwnWrite("/A.ts", 1000);
    const result = applyExternalDiskChange("/A.ts", "saved-echo", 1100);
    expect(result).toBe("ignored");
    expect(useFileStore.getState().openFiles[0].content).toBe("saved");
  });
});
