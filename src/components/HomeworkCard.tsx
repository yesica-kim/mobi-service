"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppConfirmModal } from "@/components/AppConfirmModal";
import type { HomeworkItem, ScopeType } from "@/types";

/** reward 문자열을 태그 배열로 파싱 (콤마 구분) */
function rewardToTags(reward: string): string[] {
  if (!reward || reward === "-") return [];
  return reward.split(",").map((s) => s.trim()).filter(Boolean);
}

/** 태그 배열을 reward 문자열로 합치기 */
function tagsToReward(tags: string[]): string {
  return tags.length > 0 ? tags.join(", ") : "-";
}

interface Props {
  item: HomeworkItem;
  onToggle: (id: string, checkIndex: number) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<HomeworkItem, "title" | "reward" | "totalCount" | "scope">>) => void;
  onDelete?: (id: string) => void;
  onEditRequest?: (item: HomeworkItem) => void;
  showPeriodLabel?: boolean;
}

export function HomeworkCard({ item, onToggle, onToggleFavorite, onUpdate, onDelete, onEditRequest, showPeriodLabel }: Props) {
  const totalCount = item.totalCount || 1;
  const completedCount = item.completedCount || 0;
  const fullyDone = completedCount >= totalCount;
  const scope: ScopeType = item.scope || "character";
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editRewardTags, setEditRewardTags] = useState<string[]>(rewardToTags(item.reward));
  const [rewardInput, setRewardInput] = useState("");
  const [editTotalCount, setEditTotalCount] = useState(totalCount);
  const [editScope, setEditScope] = useState<ScopeType>(scope);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (onUpdate) {
      const updates: Partial<Pick<HomeworkItem, "title" | "reward" | "totalCount" | "scope">> = {};
      if (editTitle !== item.title) updates.title = editTitle;
      const newReward = tagsToReward(editRewardTags);
      if (newReward !== item.reward) updates.reward = newReward;
      if (editTotalCount !== totalCount) updates.totalCount = editTotalCount;
      if (editScope !== scope) updates.scope = editScope;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditRewardTags(rewardToTags(item.reward));
    setRewardInput("");
    setEditTotalCount(totalCount);
    setEditScope(scope);
    setEditing(false);
  };

  const addRewardTag = () => {
    const val = rewardInput.trim();
    if (val && !editRewardTags.includes(val)) {
      setEditRewardTags([...editRewardTags, val]);
    }
    setRewardInput("");
  };

  const removeRewardTag = (idx: number) => {
    setEditRewardTags(editRewardTags.filter((_, i) => i !== idx));
  };

  const rewardTags = rewardToTags(item.reward);
  const handleProgressToggle = () => {
    const nextIndex = completedCount >= totalCount ? 0 : completedCount;
    onToggle(item.id, nextIndex);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl py-4 pl-2 pr-4 transition-all duration-200 ${
        fullyDone ? "bg-slate-800/40 opacity-50" : "bg-slate-800"
      }`}
    >
      {editing ? (
        /* ── 수정 모드 ── */
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg transition-all ${
              item.isFavorite ? "text-yellow-400 hover:bg-slate-700/70" : "text-slate-600 hover:bg-slate-700/70 hover:text-slate-400"
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
            {/* 보상 태그 입력 */}
            <div>
              <span className="text-xs text-slate-500 mb-1 block">보상</span>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {editRewardTags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 border border-slate-500/40 text-slate-300 text-[11px] px-2 py-1 rounded-lg">
                    {tag}
                    <button onClick={() => removeRewardTag(idx)} className="text-slate-500 hover:text-red-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={rewardInput}
                onChange={(e) => setRewardInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRewardTag(); } }}
                placeholder="보상 입력 후 Enter"
                className="w-full bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
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
                  >-</button>
                  <span className="text-white text-sm font-semibold w-6 text-center">{editTotalCount}</span>
                  <button
                    onClick={() => setEditTotalCount(Math.min(20, editTotalCount + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center transition-colors text-lg font-bold"
                  >+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors">취소</button>
                <button onClick={handleSave} className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">저장</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── 보기 모드 ── */
        <>
          <div className="space-y-3 lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  {...attributes}
                  {...listeners}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
                  title="드래그하여 순서 변경"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </button>
                <button
                  onClick={() => onToggleFavorite(item.id)}
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl leading-none transition-all ${
                    item.isFavorite ? "text-yellow-400 hover:bg-slate-700/70" : "text-slate-600 hover:bg-slate-700/70 hover:text-slate-400"
                  }`}
                >
                  {item.isFavorite ? "★" : "☆"}
                </button>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {onUpdate && (
                  <button onClick={() => onEditRequest ? onEditRequest(item) : setEditing(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 transition-colors" title="수정">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => setShowDeleteConfirm(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-700/70 hover:text-red-400 transition-colors" title="삭제">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                {showPeriodLabel && (
                  <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    item.period === "daily"
                      ? "bg-orange-600/20 text-orange-400"
                      : "bg-green-600/20 text-green-400"
                  }`}>
                    {item.period === "daily" ? "일일" : "주간"}
                  </span>
                )}
                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  scope === "server" ? "bg-teal-600/20 text-teal-400" : "bg-blue-600/20 text-blue-400"
                }`}>
                  {scope === "server" ? "서버" : "캐릭터"}
                </span>
              </div>
              <p className={`mt-1.5 whitespace-normal break-keep text-[15px] font-medium leading-snug ${fullyDone ? "line-through text-slate-500" : "text-white"}`}>
                {item.title}
              </p>
              {rewardTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {rewardTags.map((tag, idx) => (
                    <span key={idx} className={`text-[11px] px-1.5 py-0.5 rounded-md border border-slate-600/50 ${fullyDone ? "text-slate-600 line-through" : "text-slate-400"}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleProgressToggle}
                className={`h-10 min-w-10 rounded-lg border px-3 text-xs font-bold transition-colors ${
                  fullyDone
                    ? scope === "server" ? "border-teal-500 bg-teal-600 text-white" : "border-blue-500 bg-blue-600 text-white"
                    : completedCount > 0
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-slate-600 bg-slate-900/70 text-slate-500 hover:border-blue-500 hover:text-blue-300"
                }`}
              >
                {totalCount > 1 ? `${completedCount}/${totalCount}` : fullyDone ? "✓" : ""}
              </button>
            </div>
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-3">
            <div className="flex flex-shrink-0 items-center gap-0.5">
              <button
                {...attributes}
                {...listeners}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
                title="드래그하여 순서 변경"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
              </button>
              <button
                onClick={() => onToggleFavorite(item.id)}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg leading-none transition-all ${
                  item.isFavorite ? "text-yellow-400 hover:bg-slate-700/70" : "text-slate-600 hover:bg-slate-700/70 hover:text-slate-400"
                }`}
              >
                {item.isFavorite ? "★" : "☆"}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                {showPeriodLabel && (
                  <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    item.period === "daily"
                      ? "bg-orange-600/20 text-orange-400"
                      : "bg-green-600/20 text-green-400"
                  }`}>
                    {item.period === "daily" ? "일일" : "주간"}
                  </span>
                )}
                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  scope === "server" ? "bg-teal-600/20 text-teal-400" : "bg-blue-600/20 text-blue-400"
                }`}>
                  {scope === "server" ? "서버" : "캐릭터"}
                </span>
              </div>
              <p className={`mt-1.5 whitespace-normal break-keep text-[15px] font-medium leading-snug ${fullyDone ? "line-through text-slate-500" : "text-white"}`}>
                {item.title}
              </p>
              {rewardTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {rewardTags.map((tag, idx) => (
                    <span key={idx} className={`text-[11px] px-1.5 py-0.5 rounded-md border border-slate-600/50 ${fullyDone ? "text-slate-600 line-through" : "text-slate-400"}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {onUpdate && (
                <button onClick={() => onEditRequest ? onEditRequest(item) : setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 transition-colors" title="수정">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button onClick={() => setShowDeleteConfirm(true)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-700/70 hover:text-red-400 transition-colors" title="삭제">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleProgressToggle}
                className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-bold transition-colors ${
                  fullyDone
                    ? scope === "server" ? "border-teal-500 bg-teal-600 text-white" : "border-blue-500 bg-blue-600 text-white"
                    : completedCount > 0
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-slate-600 bg-slate-900/70 text-slate-500 hover:border-blue-500 hover:text-blue-300"
                }`}
              >
                {totalCount > 1 ? `${completedCount}/${totalCount}` : fullyDone ? "✓" : ""}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <AppConfirmModal
          open={showDeleteConfirm}
          title={`'${item.title}'을 삭제하시겠습니까?`}
          confirmLabel="삭제"
          variant="danger"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            onDelete?.(item.id);
            setShowDeleteConfirm(false);
          }}
        />
      )}
    </div>
  );
}
