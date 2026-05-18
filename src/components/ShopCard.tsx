"use client";

import { useState, useRef, useEffect } from "react";
import type { ShopItem, RegionName, ScopeType } from "@/types";
import { REGIONS } from "@/types";

interface Props {
  item: ShopItem;
  onToggle: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Pick<ShopItem, "itemName" | "region" | "npcName" | "scope">>) => void;
}

export function ShopCard({ item, onToggle, onToggleFavorite, onUpdate }: Props) {
  const scope: ScopeType = item.scope || "character";
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.itemName);
  const [editRegion, setEditRegion] = useState<RegionName>(item.region);
  const [editNpc, setEditNpc] = useState(item.npcName);
  const [editScope, setEditScope] = useState<ScopeType>(scope);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && nameRef.current) {
      nameRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (onUpdate) {
      const updates: Partial<Pick<ShopItem, "itemName" | "region" | "npcName" | "scope">> = {};
      if (editName !== item.itemName) updates.itemName = editName;
      if (editRegion !== item.region) updates.region = editRegion;
      if (editNpc !== item.npcName) updates.npcName = editNpc;
      if (editScope !== scope) updates.scope = editScope;
      if (Object.keys(updates).length > 0) onUpdate(item.id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.itemName);
    setEditRegion(item.region);
    setEditNpc(item.npcName);
    setEditScope(scope);
    setEditing(false);
  };

  return (
    <div
      className={`rounded-2xl p-4 transition-all duration-200 ${
        item.completed ? "bg-slate-800/40 opacity-50" : "bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 즐겨찾기 */}
        <button
          onClick={() => onToggleFavorite(item.id)}
          className={`flex-shrink-0 text-lg transition-all ${
            item.isFavorite ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
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
                <select
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value as RegionName)}
                  className="bg-slate-700 text-blue-400 text-[11px] font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editNpc}
                  onChange={(e) => setEditNpc(e.target.value)}
                  className="flex-1 bg-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="NPC 이름"
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
              <div className="flex items-center justify-end gap-2 pt-1">
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
          ) : (
            <>
              <div className="flex items-center gap-2">
                {scope === "server" && (
                  <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-600/20 text-teal-400">
                    서버
                  </span>
                )}
                <p
                  className={`text-[15px] font-medium leading-snug ${
                    item.completed ? "line-through text-slate-500" : "text-white"
                  }`}
                >
                  {item.itemName}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center rounded-md bg-blue-600/20 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                  {item.region}
                </span>
                <span className={`text-xs ${item.completed ? "text-slate-600 line-through" : "text-slate-400"}`}>
                  {item.npcName}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 수정 버튼 + 체크박스 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing && onUpdate && (
            <button
              onClick={() => setEditing(true)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              title="수정"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onToggle(item.id)}
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
              item.completed
                ? scope === "server" ? "bg-teal-600 border-teal-600" : "bg-blue-600 border-blue-600"
                : "border-slate-600 hover:border-blue-500"
            }`}
          >
            {item.completed && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
