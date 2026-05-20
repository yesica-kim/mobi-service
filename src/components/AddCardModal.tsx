"use client";

import { useState } from "react";
import type { PeriodType, ScopeType, RegionName, ScrollType } from "@/types";
import { REGIONS, SCROLL_TYPES } from "@/types";

type CardType = "daily" | "weekly" | "purchase" | "trade" | "scroll";

interface Props {
  open: boolean;
  onClose: () => void;
  onAddHomework: (hw: { title: string; reward: string; period: PeriodType; totalCount: number; scope: ScopeType }) => void;
  onAddShopItem: (type: "purchase" | "trade", item: { itemName: string; region: RegionName; npcName: string; period: PeriodType; scope: ScopeType }) => void;
  onAddScrollItem?: (item: { title: string; scrollType: ScrollType; period: PeriodType; totalCount: number; materials: string[]; region: RegionName; reward: string }) => void;
}

const TYPE_OPTIONS: { value: CardType; label: string; color: string }[] = [
  { value: "daily", label: "일일 숙제", color: "bg-blue-600" },
  { value: "weekly", label: "주간 숙제", color: "bg-purple-600" },
  { value: "purchase", label: "구매", color: "bg-green-600" },
  { value: "trade", label: "물물교환", color: "bg-orange-600" },
  { value: "scroll", label: "임무게시판", color: "bg-indigo-600" },
];

export function AddCardModal({ open, onClose, onAddHomework, onAddShopItem, onAddScrollItem }: Props) {
  const [cardType, setCardType] = useState<CardType>("daily");
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("");
  const [totalCount, setTotalCount] = useState(1);
  const [itemName, setItemName] = useState("");
  const [region, setRegion] = useState<RegionName>("던바튼");
  const [npcName, setNpcName] = useState("");
  const [scope, setScope] = useState<ScopeType>("character");
  const [shopPeriod, setShopPeriod] = useState<PeriodType>("daily");
  // scroll fields
  const [scrollType, setScrollType] = useState<ScrollType>("제작");
  const [scrollPeriod, setScrollPeriod] = useState<PeriodType>("weekly");
  const [scrollTotalCount, setScrollTotalCount] = useState(3);
  const [scrollRegion, setScrollRegion] = useState<RegionName>("던바튼");
  const [scrollReward, setScrollReward] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialInput, setMaterialInput] = useState("");

  if (!open) return null;

  const isHomework = cardType === "daily" || cardType === "weekly";
  const isShop = cardType === "purchase" || cardType === "trade";
  const isScroll = cardType === "scroll";

  const handleSubmit = () => {
    if (isHomework) {
      if (!title.trim()) return;
      onAddHomework({
        title: title.trim(),
        reward: reward.trim() || "-",
        period: cardType as PeriodType,
        totalCount,
        scope,
      });
    } else if (isShop) {
      if (!itemName.trim()) return;
      onAddShopItem(cardType as "purchase" | "trade", {
        itemName: itemName.trim(),
        region,
        npcName: npcName.trim() || "-",
        period: shopPeriod,
        scope,
      });
    } else if (isScroll) {
      if (!title.trim() || !onAddScrollItem) return;
      onAddScrollItem({
        title: title.trim(),
        scrollType,
        period: scrollPeriod,
        totalCount: scrollTotalCount,
        materials,
        region: scrollRegion,
        reward: scrollReward.trim() || "-",
      });
    }
    resetFields();
    onClose();
  };

  const resetFields = () => {
    setTitle("");
    setReward("");
    setTotalCount(1);
    setItemName("");
    setRegion("던바튼");
    setNpcName("");
    setScope("character");
    setShopPeriod("daily");
    setScrollType("제작");
    setScrollPeriod("weekly");
    setScrollTotalCount(3);
    setScrollRegion("던바튼");
    setScrollReward("");
    setMaterials([]);
    setMaterialInput("");
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const addMaterial = () => {
    const val = materialInput.trim();
    if (val && !materials.includes(val)) {
      setMaterials([...materials, val]);
    }
    setMaterialInput("");
  };

  const removeMaterial = (idx: number) => {
    setMaterials(materials.filter((_, i) => i !== idx));
  };

  const canSubmit = isHomework ? !!title.trim() : isShop ? !!itemName.trim() : !!title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full">
        <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto max-h-[80vh] overflow-y-auto">
          <h3 className="text-white text-sm font-semibold text-center mb-4">숙제 추가</h3>

          {/* Type 선택 */}
          <div className="space-y-2 mb-4">
            <span className="text-xs text-slate-500">Type</span>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCardType(opt.value)}
                  className={`text-xs px-3 py-2 rounded-xl font-medium transition-colors ${
                    cardType === opt.value
                      ? `${opt.color} text-white`
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 숙제 입력 */}
          {isHomework && (
            <div className="space-y-3 mb-4">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">숙제 이름</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="숙제 이름을 입력하세요"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  autoFocus
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">보상</span>
                <input
                  type="text"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  placeholder="보상을 입력하세요 (선택)"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">체크박스 수</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setTotalCount(Math.max(1, totalCount - 1))} className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-lg font-bold">-</button>
                  <span className="text-white text-sm font-semibold w-6 text-center">{totalCount}</span>
                  <button onClick={() => setTotalCount(Math.min(20, totalCount + 1))} className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-lg font-bold">+</button>
                </div>
              </div>
            </div>
          )}

          {/* 구매/물물교환 입력 */}
          {isShop && (
            <div className="space-y-3 mb-4">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">아이템 이름</span>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="아이템 이름을 입력하세요"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  autoFocus
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">지역</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionName)}
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">NPC 이름</span>
                <input
                  type="text"
                  value={npcName}
                  onChange={(e) => setNpcName(e.target.value)}
                  placeholder="NPC 이름을 입력하세요 (선택)"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">주기</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    onClick={() => setShopPeriod("daily")}
                    className={`text-[11px] px-3 py-1 transition-colors ${
                      shopPeriod === "daily"
                        ? "bg-orange-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    일간
                  </button>
                  <button
                    onClick={() => setShopPeriod("weekly")}
                    className={`text-[11px] px-3 py-1 transition-colors ${
                      shopPeriod === "weekly"
                        ? "bg-green-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    주간
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 임무게시판 입력 */}
          {isScroll && (
            <div className="space-y-3 mb-4">
              <div>
                <span className="text-xs text-slate-500 mb-1 block">스크롤 이름</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="스크롤 이름을 입력하세요"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  autoFocus
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 mb-1 block">스크롤 타입</span>
                <div className="flex gap-1.5">
                  {SCROLL_TYPES.map((st) => (
                    <button
                      key={st}
                      onClick={() => setScrollType(st)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        scrollType === st
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              {/* 주기 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">주기</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    onClick={() => setScrollPeriod("daily")}
                    className={`text-[11px] px-3 py-1 transition-colors ${
                      scrollPeriod === "daily"
                        ? "bg-orange-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    일간
                  </button>
                  <button
                    onClick={() => setScrollPeriod("weekly")}
                    className={`text-[11px] px-3 py-1 transition-colors ${
                      scrollPeriod === "weekly"
                        ? "bg-green-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    주간
                  </button>
                </div>
              </div>
              {/* 지역 */}
              <div>
                <span className="text-xs text-slate-500 mb-1 block">지역</span>
                <select
                  value={scrollRegion}
                  onChange={(e) => setScrollRegion(e.target.value as RegionName)}
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">체크박스 수</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setScrollTotalCount(Math.max(1, scrollTotalCount - 1))} className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-lg font-bold">-</button>
                  <span className="text-white text-sm font-semibold w-6 text-center">{scrollTotalCount}</span>
                  <button onClick={() => setScrollTotalCount(Math.min(20, scrollTotalCount + 1))} className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-lg font-bold">+</button>
                </div>
              </div>
              {/* 재료 (토벌은 숨김) */}
              {scrollType !== "토벌" && (
                <div>
                  <span className="text-xs text-slate-500 mb-1 block">재료</span>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {materials.map((mat, idx) => (
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
                    className="w-full bg-slate-700 text-slate-300 text-xs rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  />
                </div>
              )}
              {/* 보상 */}
              <div>
                <span className="text-xs text-slate-500 mb-1 block">보상</span>
                <input
                  type="text"
                  value={scrollReward}
                  onChange={(e) => setScrollReward(e.target.value)}
                  placeholder="보상을 입력하세요 (선택)"
                  className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
            </div>
          )}

          {/* 범위 - 숙제/구매만 */}
          {(isHomework || isShop) && (
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-slate-500">범위</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-600">
                <button
                  onClick={() => setScope("character")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    scope === "character"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  캐릭터
                </button>
                <button
                  onClick={() => setScope("server")}
                  className={`text-[11px] px-3 py-1 transition-colors ${
                    scope === "server"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  서버
                </button>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
