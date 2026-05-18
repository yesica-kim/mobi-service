"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ScrollItem, ScrollType } from "@/types";
import { SCROLL_TYPES } from "@/types";

const SCROLL_TYPE_COLORS: Record<ScrollType, { bg: string; text: string }> = {
  "제작": { bg: "bg-indigo-600/20", text: "text-indigo-400" },
  "채집": { bg: "bg-emerald-600/20", text: "text-emerald-400" },
  "요리": { bg: "bg-amber-600/20", text: "text-amber-400" },
  "토벌": { bg: "bg-red-600/20", text: "text-red-400" },
};

interface Props {
  item: ScrollItem;
  onToggle: (id: string, checkIndex: number) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "totalCount" | "materials" | "tags">>) => void;
  onDelete?: (id: string) => void;
}

export function ScrollCard({ item, onToggle, onToggleFavorite, onUpdate, onDelete }: Props) {
  const totalCount = item.totalCount || 3;
  const completedCount = item.completedCount || 0;
  const fullyDone = completedCount >= totalCount;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editScrollType, setEditScrollType] = useState<ScrollType>(item.scrollType);
  const [editTotalCount, setEditTotalCount] = useState(totalCount);
  const [editMaterials, setEditMaterials] = useState<string[]>(item.materials || []);
  const [editTags, setEditTags] = useState<string[]>(item.tags || []);
  const [materialInput, setMaterialInput] = useState("");
  const [tagInput, setTagInput] = useState("");
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
      const updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "totalCount" | "materials" | "tags">> = {};
      if (editTitle !== item.title) updates.title = editTitle;
      if (editScrollType !== item.scrollType) updates.scrollType = editScrollType;
      if (editTotalCount !== totalCount) updates.totalCount = editTotalCount;
      if (JSON.stringify(editMaterials) !== JSON.stringify(item.materials)) updates.materials = editMaterials;
      if (JSON.stringify(editTags) !== JSON.stringify(item.tags || [])) updates.tags = editTags;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditScrollType(item.scrollType);
    setEditTotalCount(totalCount);
    setEditMaterials(item.materials || []);
    setEditTags(item.tags || []);
    setMaterialInput("");
    setTagInput("");
    setEditing(false);
  };

  const addMaterial = () => {
    const val = materialInput.trim();
    if (val && !editMaterials.includes(val)) {
      setEditMaterials([...editMaterials, val]);
    }
    setMaterialInput("");
  };

  const removeMaterial = (idx: number) => {
    setEditMaterials(editMaterials.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    const val = tagInput.trim();
    if (val && !editTags.includes(val)) {
      setEditTags([...editTags, val]);
    }
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    setEditTags(editTags.filter((_, i) => i !== idx));
  };

  const typeColor = SCROLL_TYPE_COLORS[item.scrollType];

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
              placeholder="스크롤 이름"
            />
            {/* 스크롤 타입 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">타입</span>
              <div className="flex gap-1">
                {SCROLL_TYPES.map((st) => (
                  <button
                    key={st}
                    onClick={() => setEditScrollType(st)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                      editScrollType === st
                        ? `${SCROLL_TYPE_COLORS[st].bg} ${SCROLL_TYPE_COLORS[st].text} ring-1 ring-current`
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            {/* 체크박스 수 */}
            <div className="flex items-center justify-between">
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
            </div>
            {/* 재료 태그 입력 */}
            <div>
              <span className="text-xs text-slate-500 mb-1 block">재료</span>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {editMaterials.map((mat, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 text-[11px] px-2 py-1 rounded-lg">
                    {mat}
                    <button onClick={() => removeMaterial(idx)} className="text-slate-500 hover:text-red-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={materialInput}
                onChange={(e) => setMaterialInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMaterial(); } }}
                placeholder="재료 입력 후 Enter"
                className="w-full bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
            </div>
            {/* 태그 입력 */}
            <div>
              <span className="text-xs text-slate-500 mb-1 block">태그</span>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {editTags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 bg-cyan-600/20 text-cyan-400 text-[11px] px-2 py-1 rounded-lg">
                    {tag}
                    <button onClick={() => removeTag(idx)} className="text-cyan-600 hover:text-red-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="태그 입력 후 Enter"
                className="w-full bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={handleCancel} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors">취소</button>
              <button onClick={handleSave} className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">저장</button>
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
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>

          {/* 즐겨찾기 */}
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`flex-shrink-0 text-[18px] leading-none transition-all ${
              item.isFavorite ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {item.isFavorite ? "★" : "☆"}
          </button>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {item.scope === "server" && (
                <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-600/20 text-teal-400">서버</span>
              )}
              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${typeColor.bg} ${typeColor.text}`}>
                {item.scrollType}
              </span>
              <p className={`text-[15px] font-medium leading-snug ${fullyDone ? "line-through text-slate-500" : "text-white"}`}>
                {item.title}
              </p>
            </div>
            {/* 재료 태그 */}
            {item.materials && item.materials.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.materials.map((mat, idx) => (
                  <span key={idx} className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-400">
                    {mat}
                  </span>
                ))}
              </div>
            )}
            {/* 태그 */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.map((tag, idx) => (
                  <span key={idx} className="text-[11px] px-1.5 py-0.5 rounded-md bg-cyan-600/15 text-cyan-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 체크박스 + 수정/삭제 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-wrap justify-end gap-1.5" style={{ maxWidth: `${4 * 24 + 3 * 6}px` }}>
              {Array.from({ length: totalCount }, (_, i) => {
                const checked = i < completedCount;
                return (
                  <button
                    key={i}
                    onClick={() => onToggle(item.id, i)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      checked ? "bg-indigo-600 border-indigo-600" : "border-slate-600 hover:border-indigo-500"
                    }`}
                  >
                    {checked && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {onUpdate && (
              <button onClick={() => setEditing(true)} className="text-slate-600 hover:text-slate-400 transition-colors" title="수정">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="text-slate-600 hover:text-red-400 transition-colors" title="삭제">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
