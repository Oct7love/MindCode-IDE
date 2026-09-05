/**
 * Open VSX 市场 IPC：主进程代理，渲染进程不得直连外网。
 */
import { ipcMain } from "electron";
import { type IPCContext, validateSender, IPC_ERROR } from "./types";
import { logger } from "../../core/logger";
import {
  buildExtensionUrl,
  buildSearchUrl,
  fetchAllowedJson,
  isSafeIdPart,
  MARKETPLACE_ERROR,
  sanitizeExtension,
  sanitizeSearchResult,
  validateSearchParams,
  type SearchParams,
} from "../marketplace/open-vsx";

const log = logger.child("Marketplace");

export function registerMarketplaceHandlers(ctx: IPCContext): void {
  ipcMain.handle("marketplace:search", async (event, raw: SearchParams) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: IPC_ERROR.UNAUTHORIZED };
    }
    const parsed = validateSearchParams(raw || { query: "" });
    if (!parsed.ok) {
      return { success: false, error: parsed.error, errorCode: parsed.errorCode };
    }
    const fetched = await fetchAllowedJson(buildSearchUrl(parsed.value));
    if (!fetched.ok) {
      log.warn("search failed", { error: fetched.error, code: fetched.errorCode });
      return { success: false, error: fetched.error, errorCode: fetched.errorCode };
    }
    return { success: true, data: sanitizeSearchResult(fetched.data) };
  });

  ipcMain.handle(
    "marketplace:getExtension",
    async (event, id: { namespace?: string; name?: string }) => {
      if (!validateSender(event, ctx)) {
        return { success: false, error: "Unauthorized sender", errorCode: IPC_ERROR.UNAUTHORIZED };
      }
      const namespace = id?.namespace || "";
      const name = id?.name || "";
      const url = buildExtensionUrl(namespace, name);
      if (!url || !isSafeIdPart(namespace) || !isSafeIdPart(name)) {
        return {
          success: false,
          error: "invalid extension id",
          errorCode: MARKETPLACE_ERROR.INVALID_PARAM,
        };
      }
      const fetched = await fetchAllowedJson(url);
      if (!fetched.ok) {
        log.warn("getExtension failed", { namespace, name, error: fetched.error });
        return { success: false, error: fetched.error, errorCode: fetched.errorCode };
      }
      const ext = sanitizeExtension(fetched.data);
      if (!ext) {
        return {
          success: false,
          error: "invalid extension payload",
          errorCode: MARKETPLACE_ERROR.BAD_JSON,
        };
      }
      return { success: true, data: ext };
    },
  );

  log.info("Open VSX 市场 IPC 已注册");
}
