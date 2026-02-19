/**
 * SearchEngine 服务测试
 */

import { describe, it, expect } from "vitest";
import { searchEngine } from "../../renderer/services/searchEngine";

describe("SearchEngine", () => {
  describe("searchInContent", () => {
    const content = `function hello() {
  console.log("Hello World");
  return "hello";
}

const hello = "greeting";`;

    it("finds simple matches", () => {
      const matches = searchEngine.searchInContent(content, "hello");
      // hello 出现 4 次：function hello(), "Hello World", "hello", const hello
      expect(matches.length).toBe(4);
    });

    it("respects case sensitivity", () => {
      const matches = searchEngine.searchInContent(content, "Hello", { caseSensitive: true });
      expect(matches.length).toBe(1);
      expect(matches[0].line).toBe(2);
    });

    it("supports whole word matching", () => {
      const matches = searchEngine.searchInContent(content, "hello", { wholeWord: true });
      // \bhello\b 匹配所有 4 处（引号不是 word char，所以 \b 仍然生效）
      expect(matches.length).toBe(4);
    });

    it("supports regex", () => {
      const matches = searchEngine.searchInContent(content, "hello|Hello", { regex: true });
      expect(matches.length).toBe(4);
    });

    it("returns correct line and column", () => {
      const matches = searchEngine.searchInContent(content, "console");
      expect(matches[0].line).toBe(2);
      expect(matches[0].column).toBe(3);
    });

    it("includes context", () => {
      const matches = searchEngine.searchInContent(content, "World");
      expect(matches[0].before).toContain("Hello");
      expect(matches[0].after).toContain('"');
    });
  });

  describe("replaceInContent", () => {
    it("replaces all occurrences", () => {
      const content = "foo bar foo baz foo";
      const result = searchEngine.replaceInContent(content, "foo", "qux");
      expect(result).toBe("qux bar qux baz qux");
    });

    it("respects case sensitivity", () => {
      const content = "Foo foo FOO";
      const result = searchEngine.replaceInContent(content, "foo", "bar", { caseSensitive: true });
      expect(result).toBe("Foo bar FOO");
    });

    it("supports whole word", () => {
      const content = "food foo foobar";
      const result = searchEngine.replaceInContent(content, "foo", "bar", { wholeWord: true });
      expect(result).toBe("food bar foobar");
    });

    it("supports regex replacement", () => {
      const content = "hello123 world456";
      const result = searchEngine.replaceInContent(content, "\\d+", "X", { regex: true });
      expect(result).toBe("helloX worldX");
    });
  });

  describe("fuzzyMatch", () => {
    it("matches exact string", () => {
      const result = searchEngine.fuzzyMatch("test", "test.ts");
      expect(result.match).toBe(true);
    });

    it("matches partial string", () => {
      const result = searchEngine.fuzzyMatch("ap", "App.tsx");
      expect(result.match).toBe(true);
    });

    it("returns indices of matched characters", () => {
      const result = searchEngine.fuzzyMatch("abc", "aXbXcX");
      expect(result.match).toBe(true);
      expect(result.indices).toEqual([0, 2, 4]);
    });

    it("scores boundary matches higher", () => {
      const result1 = searchEngine.fuzzyMatch("ap", "App.tsx");
      const result2 = searchEngine.fuzzyMatch("ap", "xapx");
      expect(result1.score).toBeGreaterThan(result2.score);
    });

    it("scores consecutive matches higher", () => {
      const result1 = searchEngine.fuzzyMatch("abc", "abcdef");
      const result2 = searchEngine.fuzzyMatch("abc", "aXbXcX");
      expect(result1.score).toBeGreaterThan(result2.score);
    });

    it("returns false for non-matches", () => {
      const result = searchEngine.fuzzyMatch("xyz", "abc");
      expect(result.match).toBe(false);
    });
  });
});
