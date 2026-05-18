"use client";

import type { Character } from "@/types";

interface Props {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (char: Character) => void;
}

export function CharacterTabs({ characters, selectedId, onSelect, onAdd, onEdit }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide border-b border-slate-800/50">
      {characters.map((c) => {
        const active = c.id === selectedId;
        return (
          <div key={c.id} className="relative flex-shrink-0">
            <button
              onClick={() => onSelect(c.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all min-w-[80px] ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="font-bold">{c.name}</div>
              <div className="text-[10px] opacity-70">{c.subClass}</div>
            </button>
            {/* 수정 버튼 */}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(c); }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-[10px] text-slate-300 transition-colors"
              title="수정"
            >
              ✎
            </button>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="flex-shrink-0 rounded-xl border-2 border-dashed border-slate-600 px-5 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-blue-500 hover:text-blue-400"
      >
        + 캐릭터 추가
      </button>
    </div>
  );
}
