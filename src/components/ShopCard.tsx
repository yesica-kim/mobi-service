"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShopItem, RegionName, ScopeType, PeriodType } from "@/types";
import { REGIONS } from "@/types";

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

/** npcName 문자열을 태그 배열로 파싱 */
function npcToTags(npcName: string): string[] {
  if (!npcName || npcName === "-") return [];
  return npcName.split(",").map((s) => s.trim()).filter(Boolean);
}

/** 태그 배열을 npcName 문자열로 합치기 */
function tagsToNpc(tags: string[]): string {
  return tags.length > 0 ? tags.join(", ") : "-";
}

interface Props {
  item: ShopItem;
  onToggle: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<ShopItem, "itemName" | "region" | "npcName" | "scope" | "period">>) => void;
  onDelete?: (id: string) => void;
}

export function ShopCard({ item, onToggle, onToggleFavorite, onUpdate, onDelete }: Props) {
  const scope: ScopeType = item.scope || "character";
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.itemName);
  const [editRegion, setEditRegion] = useState<RegionName>(item.region);
  const [editNpcTags, setEditNpcTags] = useState<string[]>(npcToTags(item.npcName));
  const [npcInput, setNpcInput] = useState("");
  const [editScope, setEditScope] = useState<ScopeType>(scope);
  const [editPeriod, setEditPeriod] = useState<PeriodType>(item.period ?? "daily");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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
    if (editing && nameRef.current) {
      nameRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (onUpdate) {
      const updates: Partial<Pick<ShopItem, "itemName" | "region" | "npcName" | "scope" | "period">> = {};
      if (editName !== item.itemName) updates.itemName = editName;
      if (editRegion !== item.region) updates.region = editRegion;
      const newNpc = tagsToNpc(editNpcTags);
      if (newNpc !== item.npcName) updates.npcName = newNpc;
      if (editScope !== scope) updates.scope = editScope;
      if (editPeriod !== (item.period ?? "daily")) updates.period = editPeriod;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.itemName);
    setEditRegion(item.region);
    setEditNpcTags(npcToTags(item.npcName));
    setNpcInput("");
    setEditScope(scope);
    setEditPeriod(item.period ?? "daily");
    setEditing(false);
  };

  const addNpcTag = () => {
    const val = npcInput.trim();
    if (val && !editNpcTags.includes(val)) {
      setEditNpcTags([...editNpcTags, val]);
    }
    setNpcInput("");
  };

  const removeNpcTag = (idx: number) => {
    setEditNpcTags(editNpcTags.filter((_, i) => i !== idx));
  };

  const npcTags = npcToTags(item.npcName);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl py-4 pl-2 pr-4 transition-all duration-200 ${
        item.completed ? "bg-slate-800/40 opacity-50" : "bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-1">
        {/* 드래그 핸들 */}
        {!editing && (
          <button
            {...attributes}
            {...listeners}
            className="flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
            title="드래그하여 순서 변경"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
        )}

        {/* 즐겨찾기 */}
        <button
          onClick={() => onToggleFavorite(item.id)}
          className={`flex h-10 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[18px] leading-none transition-all ${
            item.isFavorite ? "text-yellow-400 hover:bg-slate-700/70" : "text-slate-600 hover:bg-slate-700/70 hover:text-slate-400"
          }`}
        >
          {item.isFavorite ? "★" : "☆"}
        </button>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                ref={nameRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-700 text-white text-[15px] font-medium rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="아이템 이름"
              />
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
              {/* NPC 태그 입력 */}
              <div>
                <span className="text-xs text-slate-500 mb-1 block">NPC</span>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {editNpcTags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 border border-slate-500/40 text-slate-300 text-[11px] px-2 py-1 rounded-lg">
                      {tag}
                      <button onClick={() => removeNpcTag(idx)} className="text-slate-500 hover:text-red-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={npcInput}
                  onChange={(e) => setNpcInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNpcTag(); } }}
                  placeholder="NPC 입력 후 Enter"
                  className="w-full bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
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
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={handleCancel} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors">취소</button>
                <button onClick={handleSave} className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">저장</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {(item.period ?? "daily") === "weekly" ? (
                  <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-green-600/20 text-green-400">주간</span>
                ) : (
                  <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-600/20 text-orange-400">일간</span>
                )}
                <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  scope === "server" ? "bg-teal-600/20 text-teal-400" : "bg-blue-600/20 text-blue-400"
                }`}>
                  {scope === "server" ? "서버" : "캐릭터"}
                </span>
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${REGION_COLORS[item.region]?.bg ?? "bg-blue-600/20"} ${REGION_COLORS[item.region]?.text ?? "text-blue-400"}`}>
                  {item.region}
                </span>
              </div>
              <div className="mt-1.5">
                {item.fromItem && item.toItem ? (
                  <p className={`whitespace-normal break-keep text-[15px] font-medium leading-snug ${item.completed ? "line-through text-slate-500" : "text-white"}`}>
                    <span>{item.fromItem}</span>
                    <span className="text-slate-500 text-[12px]">({item.fromCount})</span>
                    <span className="text-slate-500 mx-1">→</span>
                    <span>{item.toItem}</span>
                    <span className="text-slate-500 text-[12px]">({item.toCount})</span>
                  </p>
                ) : (
                  <p className={`whitespace-normal break-keep text-[15px] font-medium leading-snug ${item.completed ? "line-through text-slate-500" : "text-white"}`}>
                    {item.itemName}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {npcTags.map((tag, idx) => (
                  <span key={idx} className={`text-[11px] ${item.completed ? "text-slate-600 line-through" : "text-slate-400"}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 수정/삭제 버튼 + 체크박스 */}
        {!editing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {onUpdate && !item.isDefault && (
              <button onClick={() => setEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-700/70 hover:text-slate-400 transition-colors" title="수정">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && !item.isDefault && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-700/70 hover:text-red-400 transition-colors" title="삭제">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onToggle(item.id)}
              className={`h-9 w-9 rounded-lg border flex items-center justify-center text-sm font-bold transition-all ${
                item.completed
                  ? scope === "server" ? "border-teal-500 bg-teal-600 text-white" : "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-600 bg-slate-900/70 text-slate-500 hover:border-blue-500 hover:text-blue-300"
              }`}
            >
              {item.completed ? "✓" : ""}
            </button>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full">
            <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
              <p className="text-white text-sm text-center mb-6">
                &apos;{item.itemName}&apos;을 삭제하시겠습니까?
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
