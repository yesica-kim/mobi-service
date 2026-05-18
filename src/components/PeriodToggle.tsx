"use client";

import type { TabType } from "@/types";

interface Props {
  active: TabType;
  onChange: (p: TabType) => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "daily", label: "일일 숙제" },
  { key: "weekly", label: "주간 숙제" },
  { key: "purchase", label: "구매" },
  { key: "trade", label: "물물교환" },
  { key: "scroll", label: "임무게시판" },
];

export function PeriodToggle({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 mx-4 p-1 rounded-xl bg-slate-800/80 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-shrink-0 flex-1 min-w-fit rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
            active === tab.key
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
