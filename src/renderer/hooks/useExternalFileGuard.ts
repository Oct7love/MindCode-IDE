import { useEffect } from "react";
import { applyExternalDiskChange } from "../services/externalFileGuard";

export function useExternalFileGuard(): void {
  useEffect(() => {
    const api = window.mindcode?.onFileSystemChange;
    if (!api) return;
    const stop = api((data) => {
      const path = data.filePath;
      if (!path) return;
      if (data.type !== "write" && data.type !== "change") return;
      void window.mindcode?.fs.readFile(path).then((res) => {
        if (res.success && typeof res.data === "string") {
          applyExternalDiskChange(path, res.data);
        }
      });
    });
    return stop;
  }, []);
}
