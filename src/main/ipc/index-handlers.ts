/**
 * Code Indexing IPC Handlers
 *
 * 处理代码索引的创建、搜索、符号查找等操作。
 */
import { ipcMain } from "electron";
import { type IndexService, createIndexService, type SymbolKind } from "../../core/indexing";
import type { IPCContext } from "./types";

let indexService: IndexService | null = null;

async function getOrCreateIndexService(): Promise<IndexService> {
  if (!indexService) {
    indexService = createIndexService();
    await indexService.initialize();
  }
  return indexService;
}

export function registerIndexHandlers(ctx: IPCContext): void {
  const mainWindow = ctx.getMainWindow;

  ipcMain.handle("index:indexWorkspace", async (_event, workspacePath: string) => {
    try {
      const service = await getOrCreateIndexService();

      service.on("onProgress", (progress) => {
        mainWindow()?.webContents.send("index:progress", progress);
      });
      service.on("onFileIndexed", (filePath, symbolCount) => {
        mainWindow()?.webContents.send("index:fileIndexed", { filePath, symbolCount });
      });
      service.on("onError", (_error: Error, _filePath?: string) => {
        // Error logged internally by index service
      });
      service.on("onComplete", (stats) => {
        mainWindow()?.webContents.send("index:complete", stats);
      });

      service.indexDirectory(workspacePath).catch(() => {
        // Indexing errors handled by event listeners
      });

      return { success: true, message: "Indexing started" };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:getProgress", async () => {
    if (!indexService) return { status: "idle", totalFiles: 0, indexedFiles: 0 };
    return indexService.getProgress();
  });

  ipcMain.handle("index:getStats", async () => {
    if (!indexService)
      return {
        totalFiles: 0,
        totalSymbols: 0,
        totalCallRelations: 0,
        totalDependencies: 0,
        totalChunks: 0,
      };
    return indexService.getStats();
  });

  ipcMain.handle(
    "index:search",
    async (
      _event,
      query: {
        query: string;
        type?: "symbol" | "semantic" | "hybrid";
        limit?: number;
        fileFilter?: string[];
        kindFilter?: string[];
      },
    ) => {
      try {
        const service = await getOrCreateIndexService();
        const results = await service.searchCode({
          query: query.query,
          type: query.type || "hybrid",
          limit: query.limit || 20,
          fileFilter: query.fileFilter,
          kindFilter: query.kindFilter as SymbolKind[],
        });
        return { success: true, data: results };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle("index:searchSymbols", async (_event, name: string, limit?: number) => {
    try {
      const service = await getOrCreateIndexService();
      const symbols = await service.searchSymbols(name, limit || 20);
      return { success: true, data: symbols };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:getFileSymbols", async (_event, filePath: string) => {
    try {
      const service = await getOrCreateIndexService();
      const symbols = await service.getFileSymbols(filePath);
      return { success: true, data: symbols };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:findDefinition", async (_event, symbolName: string) => {
    try {
      const service = await getOrCreateIndexService();
      const definition = await service.findDefinition(symbolName);
      return { success: true, data: definition };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:findReferences", async (_event, symbolId: string) => {
    try {
      const service = await getOrCreateIndexService();
      const references = await service.findReferences(symbolId);
      return { success: true, data: references };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:getRelatedCode", async (_event, query: string, limit?: number) => {
    try {
      const service = await getOrCreateIndexService();
      const related = await service.getRelatedCode(query, limit || 10);
      return { success: true, data: related };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("index:cancel", async () => {
    if (indexService) {
      indexService.cancelIndexing();
      return { success: true };
    }
    return { success: false, error: "No indexing in progress" };
  });

  ipcMain.handle("index:clear", async () => {
    if (indexService) {
      indexService.clearIndex();
      return { success: true };
    }
    return { success: false, error: "Index service not initialized" };
  });
}
