/**
 * 磁盘被外部修改时：干净缓冲可重载；dirty 缓冲进入冲突，绝不静默覆盖。
 */
import { useFileStore } from "../stores/useFileStore";
import { wasOwnWrite } from "./ownWriteMemory";

export { rememberOwnWrite } from "./ownWriteMemory";

export function applyExternalDiskChange(
  path: string,
  diskContent: string,
  now = Date.now(),
): "ignored" | "reloaded" | "conflict" {
  if (wasOwnWrite(path, now)) {
    return "ignored";
  }
  const store = useFileStore.getState();
  const file = store.openFiles.find(
    (f) => f.path === path && !f.isUntitled && !f.isPreview,
  );
  if (!file) return "ignored";
  if (diskContent === file.content) return "ignored";
  if (!file.isDirty) {
    store.reloadFromDisk(file.id, diskContent);
    return "reloaded";
  }
  store.setConflict(file.id, diskContent);
  return "conflict";
}
