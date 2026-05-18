"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  showPeriodLabel?: boolean;
}

export function HomeworkCard({ item, onToggle, onToggleFavorite, onUpdate, onDelete, showPeriodLabel }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
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
            {/* 보상 태그 입력 */}
            <div>
              <span className="text-xs text-slate-500 mb-1 block">🎁 보상</span>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {editRewardTags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 bg-amber-600/20 text-amber-400 text-[11px] px-2 py-1 rounded-lg">
                    {tag}
                    <button onClick={() => removeRewardTag(idx)} className="text-amber-600 hover:text-red-400">
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
                    onClick={() => setEditTotalCount(Math.min(10, editTotalCount + 1))}
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
        <div className="flex items-center gap-2">
          {/* 드래그 핸들 */}
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
            title="드래그하여 순서 변경"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>

          {/* 즐겨찾기 */}
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`flex-shrink-0 text-lg transition-all ${
              item.isFavorite ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {item.isFavorite ? "★" : "☆"}
          </button>

          {/* 타이틀 + 보상 태그 */}
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
              <p className={`text-[15px] font-medium leading-snug ${fullyDone ? "line-through text-slate-500" : "text-white"}`}>
                {item.title}
              </p>
            </div>
            {rewardTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="text-xs text-slate-500">🎁</span>
                {rewardTags.map((tag, idx) => (
                  <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded-md bg-amber-600/15 ${fullyDone ? "text-slate-600 line-through" : "text-amber-400"}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 체크박스 + 수정/삭제 아이콘 */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
              <button onClick={() => setEditing(true)} className="text-slate-600 hover:text-slate-400 transition-colors" title="수정">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="text-slate-600 hover:text-red-400 transition-colors" title="삭제">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full">
            <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
              <p className="text-white text-sm text-center mb-6">
                &apos;{item.title}&apos;을 삭제하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors">취소</button>
                <button onClick={() => { onDelete?.(item.id); setShowDeleteConfirm(false); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
