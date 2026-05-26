"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { ScrollItem, ScrollType, RegionName, PeriodType } from "@/types";
import { SCROLL_TYPES, REGIONS } from "@/types";

const SCROLL_TYPE_COLORS: Record<ScrollType, { bg: string; text: string }> = {
  "제작": { bg: "bg-indigo-600/20", text: "text-indigo-400" },
  "채집": { bg: "bg-emerald-600/20", text: "text-emerald-400" },
  "요리": { bg: "bg-amber-600/20", text: "text-amber-400" },
  "토벌": { bg: "bg-red-600/20", text: "text-red-400" },
};

const REGION_COLORS: Record<string, { bg: string; text: string }> = {
  "콜헨": { bg: "bg-red-600/20", text: "text-red-400" },
  "티르코네일": { bg: "bg-sky-600/20", text: "text-sky-400" },
  "두갈드아일": { bg: "bg-amber-600/20", text: "text-amber-400" },
  "던바튼": { bg: "bg-violet-600/20", text: "text-violet-400" },
  "가이레흐 언덕": { bg: "bg-pink-600/20", text: "text-pink-400" },
  "반호르": { bg: "bg-orange-600/20", text: "text-orange-400" },
  "이멘마하": { bg: "bg-cyan-600/20", text: "text-cyan-400" },
  "캐시샵": { bg: "bg-fuchsia-600/20", text: "text-fuchsia-400" },
};

interface Props {
  item: ScrollItem;
  onToggle: (id: string, checkIndex: number) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "period" | "totalCount" | "materials" | "reward" | "region" | "tags">>) => void;
  onDelete?: (id: string) => void;
  onEditRequest?: (item: ScrollItem) => void;
}

export function ScrollCard({ item, onToggle, onToggleFavorite, onUpdate, onDelete, onEditRequest }: Props) {
  const totalCount = item.totalCount || 3;
  const completedCount = item.completedCount || 0;
  const fullyDone = completedCount >= totalCount;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editScrollType, setEditScrollType] = useState<ScrollType>(item.scrollType);
  const [editPeriod, setEditPeriod] = useState<PeriodType>(item.period ?? "weekly");
  const [editTotalCount, setEditTotalCount] = useState(totalCount);
  const [editRegion, setEditRegion] = useState<RegionName>(item.region || "콜헨");
  const [editMaterials, setEditMaterials] = useState<string[]>(item.materials || []);
  const [editReward, setEditReward] = useState(item.reward || "-");
  const [materialInput, setMaterialInput] = useState("");
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
  useEscapeClose(showDeleteConfirm, () => setShowDeleteConfirm(false));

  const handleSave = () => {
    if (onUpdate) {
      const updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "period" | "totalCount" | "materials" | "reward" | "region">> = {};
      if (editTitle !== item.title) updates.title = editTitle;
      if (editScrollType !== item.scrollType) updates.scrollType = editScrollType;
      if (editPeriod !== (item.period ?? "weekly")) updates.period = editPeriod;
      if (editTotalCount !== totalCount) updates.totalCount = editTotalCount;
      if (editRegion !== item.region) updates.region = editRegion;
      if (editReward !== (item.reward || "-")) updates.reward = editReward;
      if (JSON.stringify(editMaterials) !== JSON.stringify(item.materials)) updates.materials = editMaterials;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditScrollType(item.scrollType);
    setEditPeriod(item.period ?? "weekly");
    setEditTotalCount(totalCount);
    setEditRegion(item.region || "콜헨");
    setEditMaterials(item.materials || []);
    setEditReward(item.reward || "-");
    setMaterialInput("");
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

  const typeColor = SCROLL_TYPE_COLORS[item.scrollType];
  const regionColor = REGION_COLORS[item.region] ?? { bg: "bg-blue-600/20", text: "text-blue-400" };
  const hasMaterials = item.scrollType !== "토벌" && item.materials && item.materials.length > 0 && item.materials[0] !== "-";
  const hasReward = item.reward && item.reward !== "-";
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
            {/* 주기 설정 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">주기</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-600">
                <button
                  onClick={() => setEditPeriod("daily")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    editPeriod === "daily"
                      ? "bg-orange-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  일간
                </button>
                <button
                  onClick={() => setEditPeriod("weekly")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    editPeriod === "weekly"
                      ? "bg-green-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  주간
                </button>
              </div>
            </div>
            {/* 지역 드롭다운 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">지역</span>
              <select
                value={editRegion}
                onChange={(e) => setEditRegion(e.target.value as RegionName)}
                className="bg-slate-700 text-blue-400 text-[11px] font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {/* 체크박스 수 */}
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
            {/* 재료 태그 입력 (토벌은 숨김) */}
            {editScrollType !== "토벌" && (
              <div>
                <span className="text-xs text-slate-500 mb-1 block">재료</span>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {editMaterials.filter((m) => m !== "-").map((mat, idx) => (
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
            )}
            {/* 보상 입력 */}
            <div>
              <span className="text-xs text-slate-500 mb-1 block">보상</span>
              <input
                type="text"
                value={editReward}
                onChange={(e) => setEditReward(e.target.value)}
                placeholder="보상 입력"
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
        <div className="space-y-3">
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
              {(item.period ?? "weekly") === "weekly" ? (
                <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-green-600/20 text-green-400">주간</span>
              ) : (
                <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-600/20 text-orange-400">일간</span>
              )}
              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                item.scope === "server" ? "bg-teal-600/20 text-teal-400" : "bg-blue-600/20 text-blue-400"
              }`}>
                {item.scope === "server" ? "서버" : "캐릭터"}
              </span>
              {item.region && (
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${regionColor.bg} ${regionColor.text}`}>
                  {item.region}
                </span>
              )}
              <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${typeColor.bg} ${typeColor.text}`}>
                {item.scrollType}
              </span>
            </div>
            <p className={`mt-1.5 whitespace-normal break-keep text-[15px] font-medium leading-snug ${fullyDone ? "line-through text-slate-500" : "text-white"}`}>
              {item.title}
            </p>
            {/* 지역 + 재료 + 보상 */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {hasMaterials && item.materials.map((mat, idx) => (
                <span key={idx} className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-400">
                  {mat}
                </span>
              ))}
              {hasReward && (
                <span className="text-[11px] text-slate-500">{item.reward}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProgressToggle}
              className={`h-10 min-w-10 rounded-lg border px-3 text-xs font-bold transition-colors ${
                fullyDone
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : completedCount > 0
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-slate-600 bg-slate-900/70 text-slate-500 hover:border-indigo-500 hover:text-indigo-300"
              }`}
            >
              {totalCount > 1 ? `${completedCount}/${totalCount}` : fullyDone ? "✓" : ""}
            </button>
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
                <button onClick={() => setShowDeleteConfirm(false)} className="h-11 flex-1 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors">취소</button>
                <button onClick={() => { onDelete?.(item.id); setShowDeleteConfirm(false); }} className="h-11 flex-1 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
