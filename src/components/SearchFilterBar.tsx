"use client";

import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { RegionName } from "@/types";
import { REGIONS } from "@/types";

const REGION_COLORS: Record<string, { bg: string; text: string; activeBg: string }> = {
  "콜헨": { bg: "bg-red-600/10", text: "text-red-400", activeBg: "bg-red-600" },
  "티르코네일": { bg: "bg-sky-600/10", text: "text-sky-400", activeBg: "bg-sky-600" },
  "두갈드아일": { bg: "bg-amber-600/10", text: "text-amber-400", activeBg: "bg-amber-600" },
  "던바튼": { bg: "bg-violet-600/10", text: "text-violet-400", activeBg: "bg-violet-600" },
  "가이레흐 언덕": { bg: "bg-pink-600/10", text: "text-pink-400", activeBg: "bg-pink-600" },
  "반호르": { bg: "bg-orange-600/10", text: "text-orange-400", activeBg: "bg-orange-600" },
  "이멘마하": { bg: "bg-cyan-600/10", text: "text-cyan-400", activeBg: "bg-cyan-600" },
  "캐시샵": { bg: "bg-fuchsia-600/10", text: "text-fuchsia-400", activeBg: "bg-fuchsia-600" },
};

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  regionFilter: RegionName | "all";
  onRegionChange: (r: RegionName | "all") => void;
}

export function SearchFilterBar({ searchQuery, onSearchChange, regionFilter, onRegionChange }: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilter = regionFilter !== "all";

  return (
    <div className="px-4 pt-3 space-y-2">
      {/* 검색 + 필터 버튼 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="카드 검색..."
            className="w-full bg-slate-800 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 border border-slate-700/50"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex-shrink-0 p-2.5 rounded-xl border transition-colors ${
            hasActiveFilter
              ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
              : showFilters
              ? "bg-slate-700 border-slate-600 text-slate-300"
              : "bg-slate-800 border-slate-700/50 text-slate-500 hover:text-slate-300"
          }`}
          title="필터"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-semibold">지역 필터</span>
            {hasActiveFilter && (
              <button
                onClick={() => onRegionChange("all")}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                초기화
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onRegionChange("all")}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                regionFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              전체
            </button>
            {REGIONS.map((r) => {
              const colors = REGION_COLORS[r];
              const isActive = regionFilter === r;
              return (
                <button
                  key={r}
                  onClick={() => onRegionChange(isActive ? "all" : r)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    isActive
                      ? `${colors.activeBg} text-white`
                      : `${colors.bg} ${colors.text} hover:opacity-80`
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 활성 필터 표시 */}
      {(hasActiveFilter || searchQuery) && !showFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400">
              &quot;{searchQuery}&quot;
              <button onClick={() => onSearchChange("")} className="hover:text-blue-300">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {hasActiveFilter && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ${REGION_COLORS[regionFilter]?.bg ?? "bg-blue-600/20"} ${REGION_COLORS[regionFilter]?.text ?? "text-blue-400"}`}>
              {regionFilter}
              <button onClick={() => onRegionChange("all")} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
