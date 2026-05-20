"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  memo: string;
  onSave: (memo: string) => void;
}

type LineType = "text" | "checkbox" | "checkbox-checked" | "bullet";

function parseLineType(line: string): { type: LineType; content: string } {
  if (line.startsWith("- [x] ")) return { type: "checkbox-checked", content: line.slice(6) };
  if (line.startsWith("- [ ] ")) return { type: "checkbox", content: line.slice(6) };
  if (line.startsWith("• ")) return { type: "bullet", content: line.slice(2) };
  return { type: "text", content: line };
}

function lineToString(type: LineType, content: string): string {
  if (type === "checkbox") return "- [ ] " + content;
  if (type === "checkbox-checked") return "- [x] " + content;
  if (type === "bullet") return "• " + content;
  return content;
}

export function MemoSection({ memo, onSave }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(memo);
  const [saved, setSaved] = useState(false);
  const [focusedLine, setFocusedLine] = useState<number>(0);
  const [allSelected, setAllSelected] = useState(false);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setText(memo);
  }, [memo]);

  const hasMemo = memo.trim().length > 0;
  const lines = text ? text.split("\n") : [""];
  const parsedLines = lines.map(parseLineType);

  const updateLineContent = (idx: number, content: string) => {
    const newLines = [...lines];
    newLines[idx] = lineToString(parsedLines[idx].type, content);
    const joined = newLines.join("\n");
    if (joined.length <= 500) setText(joined);
    setAllSelected(false);
  };

  const toggleCheckbox = (idx: number) => {
    const parsed = parsedLines[idx];
    if (parsed.type !== "checkbox" && parsed.type !== "checkbox-checked") return;
    const newType: LineType = parsed.type === "checkbox" ? "checkbox-checked" : "checkbox";
    const newLines = [...lines];
    newLines[idx] = lineToString(newType, parsed.content);
    setText(newLines.join("\n"));
  };

  const handleLineKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const isMod = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl+A → 전체선택
    if (isMod && e.key === "a") {
      e.preventDefault();
      setAllSelected(true);
      // 모든 input 텍스트 선택 표시
      lineRefs.current.forEach((ref) => ref?.select());
      return;
    }

    // 전체선택 상태에서 키 입력 처리
    if (allSelected) {
      if (isMod && e.key === "c") {
        // 전체 복사
        e.preventDefault();
        navigator.clipboard.writeText(text);
        return;
      }
      if (isMod && e.key === "x") {
        // 전체 잘라내기
        e.preventDefault();
        navigator.clipboard.writeText(text);
        setText("");
        setAllSelected(false);
        setTimeout(() => lineRefs.current[0]?.focus(), 0);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setText("");
        setAllSelected(false);
        setTimeout(() => lineRefs.current[0]?.focus(), 0);
        return;
      }
      // 일반 문자 입력 → 전체 대체
      if (e.key.length === 1 && !isMod) {
        e.preventDefault();
        setText(e.key);
        setAllSelected(false);
        setTimeout(() => {
          const input = lineRefs.current[0];
          if (input) { input.focus(); input.setSelectionRange(1, 1); }
        }, 0);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const parsed = parsedLines[idx];
      let newLine = "";
      if (parsed.type === "checkbox" || parsed.type === "checkbox-checked") newLine = "- [ ] ";
      else if (parsed.type === "bullet") newLine = "• ";
      const newLines = [...lines];
      newLines.splice(idx + 1, 0, newLine);
      const joined = newLines.join("\n");
      if (joined.length <= 500) {
        setText(joined);
        setTimeout(() => {
          lineRefs.current[idx + 1]?.focus();
          setFocusedLine(idx + 1);
        }, 0);
      }
    } else if (e.key === "Backspace") {
      const parsed = parsedLines[idx];
      if (parsed.content === "" && parsed.type !== "text") {
        e.preventDefault();
        const newLines = [...lines];
        newLines[idx] = "";
        setText(newLines.join("\n"));
      } else if (parsed.content === "" && parsed.type === "text" && lines.length > 1) {
        e.preventDefault();
        const newLines = [...lines];
        newLines.splice(idx, 1);
        setText(newLines.join("\n"));
        const focusIdx = Math.max(0, idx - 1);
        setTimeout(() => {
          const input = lineRefs.current[focusIdx];
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            setFocusedLine(focusIdx);
          }
        }, 0);
      }
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      lineRefs.current[idx - 1]?.focus();
      setFocusedLine(idx - 1);
    } else if (e.key === "ArrowDown" && idx < lines.length - 1) {
      e.preventDefault();
      lineRefs.current[idx + 1]?.focus();
      setFocusedLine(idx + 1);
    }
  };

  const handleSave = () => {
    onSave(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClose = () => {
    if (text !== memo) {
      onSave(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setIsOpen(false);
    setAllSelected(false);
  };

  const insertPrefix = useCallback((prefix: string) => {
    const idx = focusedLine >= 0 && focusedLine < lines.length ? focusedLine : lines.length - 1;
    const parsed = parsedLines[idx];
    const newLines = [...lines];
    if (
      (prefix === "- [ ] " && (parsed.type === "checkbox" || parsed.type === "checkbox-checked")) ||
      (prefix === "• " && parsed.type === "bullet")
    ) {
      newLines[idx] = parsed.content;
    } else {
      newLines[idx] = prefix + parsed.content;
    }
    setText(newLines.join("\n"));
    setTimeout(() => { lineRefs.current[idx]?.focus(); }, 0);
  }, [focusedLine, lines, parsedLines]);

  return (
    <div className="px-4 pt-3">
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">
        {/* 헤더 — 고정 레이아웃 */}
        <button
          onClick={() => isOpen ? handleClose() : setIsOpen(true)}
          className="w-full flex items-center justify-between py-2 px-3 hover:bg-slate-800/40 transition-colors h-10"
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-xs text-slate-300 font-medium flex-shrink-0">메모장</span>
            {hasMemo && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/20 text-blue-400 font-bold flex-shrink-0">작성됨</span>
            )}
            {saved && <span className="text-[10px] text-green-400 flex-shrink-0">저장됨!</span>}
          </div>
          <svg className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 편집 영역 */}
        {isOpen && (
          <div className="px-3 pb-3 border-t border-slate-700/50">
            {/* 툴바 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => insertPrefix("- [ ] ")}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  체크박스
                </button>
                <button
                  onClick={() => insertPrefix("• ")}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  블릿
                </button>
              </div>
              {parsedLines.some((p) => p.type === "checkbox" || p.type === "checkbox-checked") && (
                <button
                  onClick={() => {
                    const allChecked = parsedLines
                      .filter((p) => p.type === "checkbox" || p.type === "checkbox-checked")
                      .every((p) => p.type === "checkbox-checked");
                    const targetType: LineType = allChecked ? "checkbox" : "checkbox-checked";
                    const newLines = lines.map((line, i) => {
                      const p = parsedLines[i];
                      if (p.type === "checkbox" || p.type === "checkbox-checked") {
                        return lineToString(targetType, p.content);
                      }
                      return line;
                    });
                    setText(newLines.join("\n"));
                  }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {parsedLines
                    .filter((p) => p.type === "checkbox" || p.type === "checkbox-checked")
                    .every((p) => p.type === "checkbox-checked")
                    ? "체크 해제"
                    : "전체 체크"}
                </button>
              )}
            </div>

            {/* 줄별 에디터 */}
            <div
              className="w-full bg-slate-900/50 rounded-lg px-3 py-2.5 border border-slate-700/50 focus-within:ring-2 focus-within:ring-blue-500 min-h-[100px] max-h-[300px] overflow-y-auto"
              onClick={() => setAllSelected(false)}
            >
              <div className="space-y-1">
                {parsedLines.map((parsed, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded px-1 -mx-1 transition-colors ${
                      allSelected ? "bg-blue-600/30" : ""
                    }`}
                  >
                    {(parsed.type === "checkbox" || parsed.type === "checkbox-checked") && (
                      <button
                        onClick={() => toggleCheckbox(i)}
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                          parsed.type === "checkbox-checked"
                            ? "bg-blue-600 border-blue-600"
                            : "border-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {parsed.type === "checkbox-checked" && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )}
                    {parsed.type === "bullet" && (
                      <span className="text-blue-400 text-xs flex-shrink-0">•</span>
                    )}
                    <input
                      ref={(el) => { lineRefs.current[i] = el; }}
                      value={parsed.content}
                      onChange={(e) => updateLineContent(i, e.target.value)}
                      onKeyDown={(e) => handleLineKeyDown(i, e)}
                      onFocus={() => { setFocusedLine(i); }}
                      onClick={() => setAllSelected(false)}
                      className={`flex-1 bg-transparent text-xs outline-none font-mono leading-relaxed ${
                        parsed.type === "checkbox-checked" ? "line-through text-slate-500" : "text-white"
                      }`}
                      placeholder={i === 0 && lines.length === 1 ? "메모를 입력하세요..." : ""}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 하단 */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-600">{text.length}/500</span>
              <button
                onClick={handleSave}
                disabled={text === memo}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  text !== memo
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
