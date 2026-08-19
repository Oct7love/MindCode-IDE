/**
 * M5 E2E：编辑器切 tab 缓冲隔离、保存路径、dirty、关闭确认、undo 独立。
 * 需要先 npm run build。
 */
import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { launchApp, closeApp } from "./helpers";

let app: ElectronApplication;
let page: Page;
let workspace: string;

async function openFileFromTree(fileName: string): Promise<void> {
  const node = page.locator(`[data-testid="tree-node-${fileName}"]`);
  await expect(node).toBeVisible({ timeout: 15000 });
  await node.click();
  await expect(page.locator(`[data-testid="editor-tab-${fileName}"]`)).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('[data-testid="code-editor"]')).toBeVisible({ timeout: 10000 });
  await page.locator(".monaco-editor").first().click();
}

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function typeInEditor(text: string): Promise<void> {
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.type(text, { delay: 20 });
}

async function readEditorText(): Promise<string> {
  return page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll(".monaco-editor .view-line"));
    return lines.map((el) => el.textContent || "").join("\n");
  });
}

test.setTimeout(60_000);

test.beforeAll(async () => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mindcode-m5-"));
  fs.writeFileSync(path.join(workspace, "A.txt"), "AAA-original", "utf8");
  fs.writeFileSync(path.join(workspace, "B.txt"), "BBB-original", "utf8");

  ({ app, page } = await launchApp());
  await page.evaluate((ws) => {
    localStorage.setItem("mindcode.workspace", ws);
  }, workspace);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('[data-testid="tree-node-A.txt"]')).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  await closeApp(app);
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

test.describe("编辑器切 tab 数据完整性", () => {
  test("A/B 缓冲互不污染，保存只写当前文件，切 tab 不制造假 dirty", async () => {
    await openFileFromTree("A.txt");
    await typeInEditor("-A-EDIT");
    await expect(page.locator('[data-testid="editor-tab-A.txt"]')).toHaveAttribute(
      "data-dirty",
      "true",
    );

    await openFileFromTree("B.txt");
    await expect(page.locator('[data-testid="editor-tab-A.txt"]')).toHaveAttribute(
      "data-dirty",
      "true",
    );
    await expect(page.locator('[data-testid="editor-tab-B.txt"]')).toHaveAttribute(
      "data-dirty",
      "false",
    );
    await typeInEditor("-B-EDIT");
    await expect(page.locator('[data-testid="editor-tab-B.txt"]')).toHaveAttribute(
      "data-dirty",
      "true",
    );

    await page.locator('[data-testid="editor-tab-A.txt"]').click();
    await page.locator(".monaco-editor").first().click();
    const textA = await readEditorText();
    expect(textA.replace(/\s/g, "")).toContain("AAA-original-A-EDIT".replace(/\s/g, ""));

    await page.locator('[data-testid="editor-tab-B.txt"]').click();
    await page.locator(".monaco-editor").first().click();
    const textB = await readEditorText();
    expect(textB.replace(/\s/g, "")).toContain("BBB-original-B-EDIT".replace(/\s/g, ""));

    await page.locator('[data-testid="editor-tab-A.txt"]').click();
    await page.locator(".monaco-editor").first().click();
    await page.keyboard.press(`${mod}+s`);
    await expect
      .poll(() => fs.readFileSync(path.join(workspace, "A.txt"), "utf8"), { timeout: 8000 })
      .toContain("AAA-original-A-EDIT");
    expect(fs.readFileSync(path.join(workspace, "B.txt"), "utf8")).toBe("BBB-original");

    await expect(page.locator('[data-testid="editor-tab-A.txt"]')).toHaveAttribute(
      "data-dirty",
      "false",
    );
    await expect(page.locator('[data-testid="editor-tab-B.txt"]')).toHaveAttribute(
      "data-dirty",
      "true",
    );
  });

  test("程序化来回切换不把干净文件标脏", async () => {
    await page.locator('[data-testid="editor-tab-A.txt"]').click();
    await page.locator('[data-testid="editor-tab-B.txt"]').click();
    await page.locator('[data-testid="editor-tab-A.txt"]').click();
    await page.locator('[data-testid="editor-tab-B.txt"]').click();
    await expect(page.locator('[data-testid="editor-tab-A.txt"]')).toHaveAttribute(
      "data-dirty",
      "false",
    );
  });

  test("关闭 dirty tab 弹出确认，取消则文件仍打开", async () => {
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/未保存/);
      await dialog.dismiss();
    });
    await page.locator('[data-testid="editor-tab-close-B.txt"]').click();
    await expect(page.locator('[data-testid="editor-tab-B.txt"]')).toBeVisible();
  });

  test("A/B undo 历史互相独立", async () => {
    await page.locator('[data-testid="editor-tab-B.txt"]').click();
    await page.locator(".monaco-editor").first().click();
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(200);
    const afterUndoB = await readEditorText();
    expect(afterUndoB.replace(/\s/g, "")).not.toContain("-B-EDIT".replace(/\s/g, ""));

    await page.locator('[data-testid="editor-tab-A.txt"]').click();
    await page.locator(".monaco-editor").first().click();
    const afterUndoA = await readEditorText();
    expect(afterUndoA.replace(/\s/g, "")).toContain("AAA-original-A-EDIT".replace(/\s/g, ""));
  });
});
