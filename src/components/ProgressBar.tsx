"use client";

import { useState } from "react";
import { AppConfirmModal } from "@/components/AppConfirmModal";

interface CategoryProgress {
  label: string;
  done: number;
  total: number;
  pct: number;
  color: string;
}

interface Props {
  done: number;
  total: number;
  pct: number;
  favoriteOnly: boolean;
  onFavoriteToggle: (v: boolean) => void;
  onReset: () => void;
  visibleAllDone?: boolean;
  visibleToggleDisabled?: boolean;
  onSetVisibleCompleted?: (completed: boolean) => void;
  categories?: CategoryProgress[];
}

export function ProgressBar({
  done,
  total,
  pct,
  favoriteOnly,
  onFavoriteToggle,
  onReset,
  visibleAllDone = false,
  visibleToggleDisabled = false,
  onSetVisibleCompleted,
  categories,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showVisibleConfirm, setShowVisibleConfirm] = useState(false);
  const nextVisibleCompleted = !visibleAllDone;
  const visibleToggleLabel = visibleAllDone ? "전체 해제" : "전체 체크";

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          전체 진행도
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm font-bold text-blue-400">
            {done} / {total} ({pct}%)
          </span>
          {/* 즐겨찾기 스위치 토글 */}
          <button
            onClick={() => onFavoriteToggle(!favoriteOnly)}
            className="flex items-center gap-1.5"
            title={favoriteOnly ? "전체 보기" : "즐겨찾기만 보기"}
          >
            <span className={`text-sm transition-all ${favoriteOnly ? "text-yellow-400" : "text-slate-600"}`}>
              ★
            </span>
            <div
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                favoriteOnly ? "bg-yellow-500" : "bg-slate-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  favoriteOnly ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>
          {onSetVisibleCompleted && (
            <button
              type="button"
              onClick={() => setShowVisibleConfirm(true)}
              disabled={visibleToggleDisabled}
              className="flex h-10 items-center rounded-lg border border-blue-500/50 px-2.5 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-400 hover:text-blue-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
            >
              {visibleToggleLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex h-10 items-center rounded-lg border border-slate-700 px-2.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            체크 초기화
          </button>
        </div>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 드롭다운: 개별 진행도 */}
      {expanded && categories && categories.length > 0 && (
        <div className="mt-3 space-y-2.5 pl-1">
          {categories.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{cat.label}</span>
                <span className="text-xs font-semibold text-slate-400">
                  {cat.done} / {cat.total} ({cat.pct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${cat.color}`}
                  style={{ width: `${cat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showResetConfirm && (
        <AppConfirmModal
          open={showResetConfirm}
          title="숙제 리스트 체크박스를 초기화 하시겠습니까?"
          confirmLabel="초기화"
          variant="danger"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            onReset();
            setShowResetConfirm(false);
          }}
        />
      )}

      {showVisibleConfirm && onSetVisibleCompleted && (
        <AppConfirmModal
          open={showVisibleConfirm}
          title={
            nextVisibleCompleted
              ? "현재 화면의 체크박스를 모두 완료 처리하시겠습니까?"
              : "현재 화면의 체크박스를 모두 해제하시겠습니까?"
          }
          confirmLabel={nextVisibleCompleted ? "전체 체크" : "전체 해제"}
          variant={nextVisibleCompleted ? "primary" : "danger"}
          onCancel={() => setShowVisibleConfirm(false)}
          onConfirm={() => {
            onSetVisibleCompleted(nextVisibleCompleted);
            setShowVisibleConfirm(false);
          }}
        />
      )}
    </div>
  );
}
