"use client";

import type { ServerName } from "@/types";

/** 서버별 컬러 */
const SERVER_COLORS: Record<string, string> = {
  몰리: "bg-red-500",
  알리사: "bg-sky-400",
  메이븐: "bg-emerald-500",
  라사: "bg-green-400",
  칼릭스: "bg-orange-400",
  데이안: "bg-pink-400",
  아이라: "bg-violet-400",
  던컨: "bg-yellow-400",
};

interface Props {
  servers: ServerName[];
  selected: ServerName | null;
  onChange: (s: ServerName) => void;
}

export function ServerTabs({ servers, selected, onChange }: Props) {
  if (servers.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 scrollbar-hide">
      {servers.map((s) => {
        const active = s === selected;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              active
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
