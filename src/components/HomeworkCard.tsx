"use client";

import { useState, useRef, useEffect } from "react";
import type { HomeworkItem, ScopeType } from "@/types";

interface Props {
  item: HomeworkItem;
  onToggle: (id: string, checkIndex: number) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<HomeworkItem, "title" | "reward" | "totalCount" | "scope">>) => void;
  showPeriodLabel?: boolean;
}

export function HomeworkCard({ item, onToggle, onToggleFavorite, onUpdate, showPeriodLabel }: Props) {
  const totalCount = item.totalCount || 1;
  const completedCount = item.completedCount || 0;
  const fullyDone = completedCount >= totalCount;
  const scope: ScopeType = item.scope || "character";
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editReward, setEditReward] = useState(item.reward);
  const [editTotalCount, setEditTotalCount] = useState(totalCount);
  const [editScope, setEditScope] = useState<ScopeType>(scope);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (onUpdate) {
      const updates: Partial<Pick<HomeworkItem, "title" | "reward" | "totalCount" | "scope">> = {};
      if (editTitle !== item.title) updates.title = editTitle;
      if (editReward !== item.reward) updates.reward = editReward;
      if (editTotalCount !== totalCount) updates.totalCount = editTotalCount;
      if (editScope !== scope) updates.scope = editScope;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditReward(item.reward);
    setEditTotalCount(totalCount);
    setEditScope(scope);
    setEditing(false);
  };

  return (
    <div
      className={`rounded-2xl p-4 transition-all duration-200 ${
        fullyDone ? "bg-slate-800/40 opacity-50" : "bg-slate-800"
      }`}
    >
      {editing ? (
        /* ── 수정 모드 ── */
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`flex-shrink-0 text-lg mt-0.5 transition-all ${
              item.isFavorite ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {item.isFavorite ? "★" : "☆"}
          </button>
          <div className="flex-1 min-w-0 space-y-2">
            <input
              ref={titleRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-slate-700 text-white text-[15px] font-medium rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="숙제 이름"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">🎁</span>
              <input
                type="text"
                value={editReward}
                onChange={(e) => setEditReward(e.target.value)}
                className="flex-1 bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="보상"
              />
            </div>
            {/* 범위 설정 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">범위</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-600">
                <button
                  onClick={() => setEditScope("character")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    editScope === "character"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  캐릭터
                </button>
                <button
                  onClick={() => setEditScope("server")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    editScope === "server"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  서버
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">체크박스</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditTotalCount(Math.max(1, editTotalCount - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center transition-colors text-lg font-bold"
                  >
                    -
                  </button>
                  <span className="text-white text-sm font-semibold w-6 text-center">{editTotalCount}</span>
                  <button
                    onClick={() => setEditTotalCount(Math.min(10, editTotalCount + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center transition-colors text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── 보기 모드 ── */
        <div className="flex items-start gap-3">
          {/* 즐겨찾기 */}
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`flex-shrink-0 text-lg mt-0.5 transition-all ${
              item.isFavorite ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {item.isFavorite ? "★" : "☆"}
          </button>

          {/* 타이틀 + 보상 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {showPeriodLabel && (
                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  item.period === "daily"
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-purple-600/20 text-purple-400"
                }`}>
                  {item.period === "daily" ? "일일" : "주간"}
                </span>
              )}
              {scope === "server" && (
                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-600/20 text-teal-400">
                  서버
                </span>
              )}
              <p
                className={`text-[15px] font-medium leading-snug ${
                  fullyDone ? "line-through text-slate-500" : "text-white"
                }`}
              >
                {item.title}
              </p>
            </div>
            <p
              className={`text-xs mt-1 ${
                fullyDone ? "line-through text-slate-600" : "text-slate-400"
              }`}
            >
              🎁 {item.reward}
            </p>
          </div>

          {/* 체크박스 + 수정 아이콘 */}
          <div className="flex items-start gap-2 flex-shrink-0 mt-0.5">
            <div className="flex flex-wrap justify-end gap-1.5" style={{ maxWidth: `${4 * 28 + 3 * 6}px` }}>
              {Array.from({ length: totalCount }, (_, i) => {
                const checked = i < completedCount;
                return (
                  <button
                    key={i}
                    onClick={() => onToggle(item.id, i)}
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                      checked
                        ? scope === "server" ? "bg-teal-600 border-teal-600" : "bg-blue-600 border-blue-600"
                        : "border-slate-600 hover:border-blue-500"
                    }`}
                  >
                    {checked && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {onUpdate && (
              <button
                onClick={() => setEditing(true)}
                className="text-slate-600 hover:text-slate-400 transition-colors mt-1"
                title="수정"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
