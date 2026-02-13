import React, { useState, useCallback, useRef, useEffect } from "react";

interface SearchMatch {
  line: number;
  text: string;
  column: number;
}
interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}
interface Props {
  workspacePath: string | null;
  onOpenFile: (path: string, name: string) => void;
}

export const SearchPanel: React.FC<Props> = ({ workspacePath, onOpenFile }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showReplace, setShowReplace] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replacing, setReplacing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !workspacePath || !window.mindcode?.fs?.searchInFiles) {
        setResults([]);
        setTotalMatches(0);
        return;
      }
      setSearching(true);
      try {
        const res = await window.mindcode.fs.searchInFiles({
          workspacePath,
          query: q,
          maxResults: 200,
        });
        if (res?.success && res.data) {
          const map = new Map<string, SearchResult>();
          const items = Array.isArray(res.data) ? res.data : (res.data as any).results || [];
          for (const it of items) {
            const fp = it.filePath || it.file || "";
            if (!fp) continue;
            if (!map.has(fp)) map.set(fp, { filePath: fp, matches: [] });
            map
              .get(fp)!
              .matches.push({
                line: it.line || 0,
                text: it.text || it.lineContent || "",
                column: it.column || 0,
              });
          }
          const arr = Array.from(map.values());
          setResults(arr);
          setTotalMatches(items.length);
          setExpanded(new Set(arr.slice(0, 5).map((r) => r.filePath)));
        } else {
          setResults([]);
          setTotalMatches(0);
        }
      } catch {
        setResults([]);
      }
      setSearching(false);
    },
    [workspacePath],
  );

  const onChange = useCallback(
    (v: string) => {
      setQuery(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSearch(v), 300);
    },
    [doSearch],
  );

  const toggle = (fp: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(fp) ? n.delete(fp) : n.add(fp);
      return n;
    });

  const open = (fp: string) => {
    const name = fp.split(/[/\\]/).pop() || "file";
    onOpenFile(workspacePath ? (workspacePath + "/" + fp).replace(/\\/g, "/") : fp, name);
  };

  const hl = (t: string, q: string) => {
    if (!q) return t;
    try {
      const e = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const r = new RegExp("(" + e + ")", caseSensitive ? "g" : "gi");
      return t.split(r).map((p, i) =>
        r.test(p) ? (
          <span key={i} style={{ background: "rgba(255,200,0,0.3)", color: "#fff" }}>
            {p}
          </span>
        ) : (
          p
        ),
      );
    } catch {
      return t;
    }
  };

  // Replace in a single file
  const replaceInFile = useCallback(
    async (filePath: string) => {
      if (!workspacePath || !query || !window.mindcode?.fs) return;
      const fullPath = (workspacePath + "/" + filePath).replace(/\\/g, "/");
      const readRes = await window.mindcode.fs.readFile(fullPath);
      if (!readRes?.success || !readRes.data) return;
      const content = readRes.data as string;
      const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(esc, caseSensitive ? "g" : "gi");
      const newContent = content.replace(re, replaceText);
      if (newContent !== content) {
        await window.mindcode.fs.writeFile(fullPath, newContent);
      }
    },
    [workspacePath, query, replaceText, caseSensitive],
  );

  // Replace all
  const replaceAll = useCallback(async () => {
    if (!query || results.length === 0) return;
    setReplacing(true);
    for (const fr of results) {
      await replaceInFile(fr.filePath);
    }
    setReplacing(false);
    doSearch(query); // Refresh results
  }, [query, results, replaceInFile, doSearch]);

  if (!workspacePath)
    return (
      <div style={{ padding: 12, fontSize: 12, color: "#888", textAlign: "center" }}>
        Open a folder first
      </div>
    );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "var(--vscode-input-background, #1e1e1e)",
    color: "var(--vscode-input-foreground, #ccc)",
    border: "1px solid var(--vscode-input-border, #3a3a3a)",
    borderRadius: 3,
    padding: "4px 8px",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
          placeholder="Search in files..."
          style={inputStyle}
        />
        {showReplace && (
          <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={replaceAll}
              disabled={replacing || results.length === 0}
              title="Replace All"
              style={{
                background: "#0078d4",
                color: "#fff",
                border: "none",
                borderRadius: 2,
                padding: "3px 8px",
                fontSize: 11,
                cursor: "pointer",
                opacity: results.length === 0 ? 0.5 : 1,
              }}
            >
              {replacing ? "..." : "All"}
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
          <button
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle Replace"
            style={{
              background: showReplace ? "#0078d4" : "transparent",
              color: showReplace ? "#fff" : "#888",
              border: "1px solid #3a3a3a",
              borderRadius: 2,
              padding: "1px 6px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {showReplace ? "\u25B2" : "\u25BC"} Replace
          </button>
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            title="Match Case"
            style={{
              background: caseSensitive ? "#0078d4" : "transparent",
              color: caseSensitive ? "#fff" : "#888",
              border: "1px solid #3a3a3a",
              borderRadius: 2,
              padding: "1px 6px",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Aa
          </button>
          {totalMatches > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>
              {totalMatches} results in {results.length} files
            </span>
          )}
        </div>
      </div>
      {searching && (
        <div style={{ padding: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
          Searching...
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto", fontSize: 12 }}>
        {!searching && query && results.length === 0 && (
          <div style={{ padding: 12, color: "#888", textAlign: "center" }}>No results found</div>
        )}
        {results.map((fr) => (
          <div key={fr.filePath}>
            <div
              onClick={() => toggle(fr.filePath)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                cursor: "pointer",
                color: "#ccc",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.6 }}>
                {expanded.has(fr.filePath) ? "\u25BC" : "\u25B6"}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {fr.filePath.split(/[/\\]/).pop()}
              </span>
              <span style={{ color: "#666", fontSize: 10 }}>{fr.matches.length}</span>
            </div>
            {expanded.has(fr.filePath) &&
              fr.matches.map((m, i) => (
                <div
                  key={i}
                  onClick={() => open(fr.filePath)}
                  title={fr.filePath + ":" + m.line}
                  style={{
                    padding: "2px 8px 2px 24px",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#aaa",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: "#666", marginRight: 6, fontSize: 10 }}>{m.line}</span>
                  {hl(m.text.trim().slice(0, 120), query)}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};
