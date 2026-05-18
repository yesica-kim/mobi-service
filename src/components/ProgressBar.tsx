"use client";

interface Props {
  done: number;
  total: number;
  pct: number;
  favoriteOnly: boolean;
  onFavoriteToggle: (v: boolean) => void;
}

export function ProgressBar({ done, total, pct, favoriteOnly, onFavoriteToggle }: Props) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-300">전체 진행도</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-blue-400">
            {done} / {total} ({pct}%)
          </span>
          {/* 즐겨찾기 토글 */}
          <button
            onClick={() => onFavoriteToggle(!favoriteOnly)}
            className={`text-lg transition-all ${
              favoriteOnly ? "text-yellow-400 scale-110" : "text-slate-600 hover:text-slate-400"
            }`}
            title={favoriteOnly ? "전체 보기" : "즐겨찾기만 보기"}
          >
            ★
          </button>
        </div>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
