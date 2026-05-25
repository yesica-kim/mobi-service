"use client";

import { useEffect, useState } from "react";
import { CharacterTabs } from "@/components/CharacterTabs";
import { CharacterCreateModal } from "@/components/CharacterCreateModal";
import { CharacterEditModal } from "@/components/CharacterEditModal";
import { HomeworkCard } from "@/components/HomeworkCard";
import { HomeworkToolbar } from "@/components/HomeworkToolbar";
import { PeriodToggle } from "@/components/PeriodToggle";
import { ProgressBar } from "@/components/ProgressBar";
import { ServerTabs } from "@/components/ServerTabs";
import { WeeklyCountdown } from "@/components/WeeklyCountdown";
import { ShopCard } from "@/components/ShopCard";
import { ScrollCard } from "@/components/ScrollCard";
import { AddCardModal } from "@/components/AddCardModal";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { MembershipBanner } from "@/components/MembershipBanner";
import { MemoSection } from "@/components/MemoSection";
import { UpdateNotesModal } from "@/components/UpdateNotesModal";
import { ProfileModal } from "@/components/ProfileModal";
import { SortableList } from "@/components/SortableList";
import { useAppState } from "@/hooks/useAppState";
import { useAuth } from "@/hooks/useAuth";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Download, Upload, Settings } from "lucide-react";
import { isAdminFirebaseUser } from "@/lib/adminFirestore";
import type { Character, HomeworkItem, RegionName, ScrollItem, ShopItem } from "@/types";

type FilterState = { favoriteOnly: boolean; searchQuery: string; regionFilter: RegionName[]; periodFilter: string; scopeFilter: string };
type ViewMode = "character" | "list";
type Badge = { label: string; className: string };

const PERIOD_BADGES: Record<"daily" | "weekly", Badge> = {
  daily: { label: "일간", className: "bg-orange-600/20 text-orange-400" },
  weekly: { label: "주간", className: "bg-green-600/20 text-green-400" },
};

const SERVER_BADGE: Badge = { label: "서버", className: "bg-teal-600/20 text-teal-400" };

const REGION_BADGES: Record<string, Badge> = {
  "콜헨": { label: "콜헨", className: "bg-red-600/20 text-red-400" },
  "티르코네일": { label: "티르코네일", className: "bg-sky-600/20 text-sky-400" },
  "두갈드아일": { label: "두갈드아일", className: "bg-amber-600/20 text-amber-400" },
  "던바튼": { label: "던바튼", className: "bg-violet-600/20 text-violet-400" },
  "가이레흐 언덕": { label: "가이레흐 언덕", className: "bg-pink-600/20 text-pink-400" },
  "반호르": { label: "반호르", className: "bg-orange-600/20 text-orange-400" },
  "이멘마하": { label: "이멘마하", className: "bg-cyan-600/20 text-cyan-400" },
  "캐시샵": { label: "캐시샵", className: "bg-fuchsia-600/20 text-fuchsia-400" },
};

const REGION_DETAIL_BADGES: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_BADGES).map(([region, badge]) => [region, `font-semibold ${badge.className}`])
);

const SCROLL_TYPE_BADGES: Record<string, Badge> = {
  "제작": { label: "제작", className: "bg-indigo-600/20 text-indigo-400" },
  "채집": { label: "채집", className: "bg-emerald-600/20 text-emerald-400" },
  "요리": { label: "요리", className: "bg-amber-600/20 text-amber-400" },
  "토벌": { label: "토벌", className: "bg-red-600/20 text-red-400" },
};

function filteredPurchase(state: FilterState & { allPurchaseItems: any[] }) {
  let items = state.favoriteOnly ? state.allPurchaseItems.filter((i: any) => i.isFavorite) : state.allPurchaseItems;
  if (state.periodFilter !== "all") items = items.filter((i: any) => (i.period ?? "daily") === state.periodFilter);
  if (state.scopeFilter !== "all") items = items.filter((i: any) => (i.scope || "character") === state.scopeFilter);
  if (state.regionFilter.length > 0) items = items.filter((i: any) => state.regionFilter.includes(i.region));
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter((i: any) => i.itemName.toLowerCase().includes(q) || i.npcName.toLowerCase().includes(q));
  }
  return items;
}
function filteredTrade(state: FilterState & { allTradeItems: any[] }) {
  let items = state.favoriteOnly ? state.allTradeItems.filter((i: any) => i.isFavorite) : state.allTradeItems;
  if (state.periodFilter !== "all") items = items.filter((i: any) => (i.period ?? "daily") === state.periodFilter);
  if (state.scopeFilter !== "all") items = items.filter((i: any) => (i.scope || "character") === state.scopeFilter);
  if (state.regionFilter.length > 0) items = items.filter((i: any) => state.regionFilter.includes(i.region));
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter((i: any) => i.itemName.toLowerCase().includes(q) || i.npcName.toLowerCase().includes(q));
  }
  return items;
}
function filteredScroll(state: FilterState & { allScrollItems: any[]; scrollTypeFilter: string }) {
  let items = state.favoriteOnly ? state.allScrollItems.filter((i: any) => i.isFavorite) : state.allScrollItems;
  if (state.periodFilter !== "all") items = items.filter((i: any) => (i.period ?? "weekly") === state.periodFilter);
  if (state.scopeFilter !== "all") items = items.filter((i: any) => (i.scope || "character") === state.scopeFilter);
  if (state.scrollTypeFilter !== "all") items = items.filter((i: any) => i.scrollType === state.scrollTypeFilter);
  if (state.regionFilter.length > 0) items = items.filter((i: any) => state.regionFilter.includes(i.region));
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter((i: any) => i.title.toLowerCase().includes(q) || i.reward.toLowerCase().includes(q));
  }
  return items;
}

type AllTabCard =
  | { id: string; type: "homework"; item: HomeworkItem }
  | { id: string; type: "purchase"; item: ShopItem }
  | { id: string; type: "trade"; item: ShopItem }
  | { id: string; type: "scroll"; item: ScrollItem };

type MatrixRow =
  | { id: string; type: "homework"; label: string; badges: Badge[]; details: Badge[]; sourceItem: HomeworkItem; cells: { char: Character; item?: HomeworkItem }[] }
  | { id: string; type: "purchase" | "trade"; label: string; badges: Badge[]; details: Badge[]; sourceItem: ShopItem; cells: { char: Character; item?: ShopItem }[] }
  | { id: string; type: "scroll"; label: string; badges: Badge[]; details: Badge[]; sourceItem: ScrollItem; cells: { char: Character; item?: ScrollItem }[] };

function splitTags(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(",");
  return list.map((item) => item.trim()).filter((item) => item && item !== "-");
}

function sortAllTabCards(cards: AllTabCard[], order: string[]) {
  if (order.length === 0) return cards;
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  return [...cards].sort((a, b) => {
    const aIndex = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return cards.indexOf(a) - cards.indexOf(b);
  });
}

export default function Home() {
  const { user, loading: authLoading, isGuest, authError, signInWithGoogle, continueAsGuest, signOut, deleteAccount } = useAuth();
  const [isDevHost, setIsDevHost] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUpdateNotes, setShowUpdateNotes] = useState(false);
  const state = useAppState(user?.uid);

  useEffect(() => {
    setIsDevHost(window.location.hostname.includes("-git-dev-"));
  }, []);

  // 인증 로딩
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  // 로그인 화면
  if (!user && !isGuest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6">
        <div className="text-center">
          <h1 className={`text-5xl font-extrabold tracking-wider mb-3 ${isDevHost ? "text-red-500" : "text-blue-500"}`}>mobimobi</h1>
          <p className="text-slate-400 text-sm">마비노기 숙제 트래커</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 font-semibold text-gray-700 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            구글 계정으로 로그인
          </button>
          {authError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs leading-relaxed text-red-200">
              {authError}
            </p>
          )}
          <button
            onClick={continueAsGuest}
            className="rounded-2xl bg-slate-800 px-8 py-4 font-semibold text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-all"
          >
            비로그인으로 계속하기
          </button>
        </div>
        <p className="text-[11px] text-slate-600 text-center mt-2 leading-relaxed">
          비로그인 시 데이터는 이 브라우저에만 저장됩니다.<br />
          쿠키 삭제 시 데이터가 사라질 수 있습니다.<br />
          (데이터 내보내기를 통해 로컬 저장이 가능합니다.)
        </p>
        <footer className="absolute bottom-6 text-center">
          <p className="text-[11px] text-slate-600">
            &copy; 2026 mobimobi. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            마비노기는 NEXON Korea의 등록 상표입니다. 본 서비스는 비공식 팬 제작 도구입니다.
          </p>
        </footer>
      </div>
    );
  }

  // 데이터 로딩
  if (!state.isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">데이터 불러오는 중...</div>
      </div>
    );
  }

  const isShopTab = state.activeTab === "purchase" || state.activeTab === "trade";
  const isScrollTab = state.activeTab === "scroll";
  const isEventTab = state.activeTab === "event";
  const isAdmin = isAdminFirebaseUser(user);
  const providerEmails = user?.providerData?.map((provider) => provider.email).filter(Boolean) ?? [];
  const visiblePurchaseItems = filteredPurchase(state);
  const visibleTradeItems = filteredTrade(state);
  const visibleScrollItems = filteredScroll(state);
  const allTabCards = sortAllTabCards(
    [
      ...state.currentHomework.map((item): AllTabCard => ({ id: item.id, type: "homework", item })),
      ...visiblePurchaseItems.map((item): AllTabCard => ({ id: item.id, type: "purchase", item })),
      ...visibleTradeItems.map((item): AllTabCard => ({ id: item.id, type: "trade", item })),
      ...visibleScrollItems.map((item): AllTabCard => ({ id: item.id, type: "scroll", item })),
    ],
    state.allTabOrder
  );
  const matrixRows: MatrixRow[] = (() => {
    const makeHomeworkRow = (item: HomeworkItem): MatrixRow | null => {
      const index = state.allHomework.indexOf(item);
      if (index === -1) return null;
      return {
        id: `homework-${item.id}`,
        type: "homework",
        label: item.title,
        badges: [PERIOD_BADGES[item.period], ...(item.scope === "server" ? [SERVER_BADGE] : [])],
        details: splitTags(item.reward).map((label) => ({ label, className: "border border-slate-600/50 text-slate-400" })),
        sourceItem: item,
        cells: state.serverChars.map((char) => ({ char, item: state.homeworkByChar[char.id]?.[index] })),
      };
    };
    const makeShopRow = (item: ShopItem, type: "purchase" | "trade"): MatrixRow | null => {
      const source = type === "purchase" ? state.allPurchaseItems : state.allTradeItems;
      const byChar = type === "purchase" ? state.purchaseItemsByChar : state.tradeItemsByChar;
      const index = source.indexOf(item);
      if (index === -1) return null;
      return {
        id: `${type}-${item.id}`,
        type,
        label: item.itemName,
        sourceItem: item,
        badges: [
          PERIOD_BADGES[item.period ?? "daily"],
          ...(item.scope === "server" ? [SERVER_BADGE] : []),
        ],
        details: [
          { label: item.region, className: REGION_DETAIL_BADGES[item.region] ?? "font-semibold bg-blue-600/20 text-blue-400" },
          ...splitTags(item.npcName).map((label) => ({ label, className: "text-slate-400" })),
        ],
        cells: state.serverChars.map((char) => ({ char, item: byChar[char.id]?.[index] })),
      };
    };
    const makeScrollRow = (item: ScrollItem): MatrixRow | null => {
      const index = state.allScrollItems.indexOf(item);
      if (index === -1) return null;
      return {
        id: `scroll-${item.id}`,
        type: "scroll",
        label: item.title,
        sourceItem: item,
        badges: [
          PERIOD_BADGES[item.period ?? "weekly"],
          ...(item.scope === "server" ? [SERVER_BADGE] : []),
          SCROLL_TYPE_BADGES[item.scrollType] ?? { label: item.scrollType, className: "bg-blue-600/20 text-blue-400" },
        ],
        details: [
          { label: item.region, className: REGION_DETAIL_BADGES[item.region] ?? "font-semibold bg-blue-600/20 text-blue-400" },
          ...splitTags(item.scrollType !== "토벌" ? item.materials : []).map((label) => ({ label, className: "bg-slate-700 text-slate-400" })),
          ...splitTags(item.reward).map((label) => ({ label, className: "text-slate-500" })),
        ],
        cells: state.serverChars.map((char) => ({ char, item: state.scrollItemsByChar[char.id]?.[index] })),
      };
    };

    if (state.activeTab === "all") {
      return allTabCards
        .map((card) => {
          if (card.type === "homework") return makeHomeworkRow(card.item);
          if (card.type === "scroll") return makeScrollRow(card.item);
          return makeShopRow(card.item, card.type);
        })
        .filter(Boolean) as MatrixRow[];
    }
    if (state.activeTab === "daily" || state.activeTab === "weekly") {
      return state.currentHomework.map(makeHomeworkRow).filter(Boolean) as MatrixRow[];
    }
    if (state.activeTab === "purchase" || state.activeTab === "trade") {
      return state.currentShopItems.map((item) => makeShopRow(item, state.activeTab as "purchase" | "trade")).filter(Boolean) as MatrixRow[];
    }
    if (state.activeTab === "scroll") {
      return state.currentScrollItems.map(makeScrollRow).filter(Boolean) as MatrixRow[];
    }
    return [];
  })();

  // 대시보드
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => window.location.reload()}
          >
            <span className={`text-2xl font-bold ${isDevHost ? "text-red-500" : "text-blue-500"}`}>
              mobimobi
            </span>
            {isDevHost && (
              <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold uppercase leading-none text-white">
                dev
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpdateNotes(true)}
              className="px-2 py-1 rounded-lg text-[15px] font-bold text-white hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              업데이트 노트
            </button>
            {isGuest ? (
              <>
                {/* 계정 데이터 내보내기 */}
                <button
                  onClick={() => {
                    const raw = localStorage.getItem("mabimobi_data");
                    if (!raw) return;
                    const blob = new Blob([raw], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const now = new Date(); a.download = `mobi-account-data-${now.toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="계정 데이터 내보내기"
                >
                  <Download size={28} strokeWidth={1.5} />
                </button>
                {/* 계정 데이터 가져오기 */}
                <button
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const importedData = JSON.parse(ev.target?.result as string);
                          if (importedData.characters && importedData.homework) {
                            if (confirm("계정 데이터를 가져오시겠습니까?\n현재 데이터가 덮어씌워집니다.")) {
                              localStorage.setItem("mabimobi_data", JSON.stringify(importedData));
                              window.location.reload();
                            }
                          } else {
                            alert("올바른 mobimobi 백업 파일이 아닙니다.");
                          }
                        } catch {
                          alert("파일을 읽는 중 오류가 발생했습니다.");
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="계정 데이터 가져오기"
                >
                  <Upload size={28} strokeWidth={1.5} />
                </button>
                {/* 설정 */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="설정"
                >
                  <Settings size={28} strokeWidth={1.5} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowProfile(true)} className="hover:opacity-80 transition-opacity">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-7 h-7 rounded-full"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center"><svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>'; }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[780px] flex-1 pb-8">
        <ServerTabs
          servers={state.activeServers}
          selected={state.selectedServer}
          onChange={state.setSelectedServer}
        />

        {state.serverChars.length > 0 && (
          <div className="px-4 pt-3">
            <div className="grid grid-cols-2 rounded-xl bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                캐릭터 전체 보기
              </button>
              <button
                type="button"
                onClick={() => setViewMode("character")}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  viewMode === "character" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                캐릭터별로 보기
              </button>
            </div>
          </div>
        )}

        {viewMode === "character" && (
          <CharacterTabs
            characters={state.serverChars}
            selectedId={state.selectedCharId}
            onSelect={state.setSelectedCharId}
            onAdd={() => setShowCreateModal(true)}
            onEdit={(c) => setEditingChar(c)}
            onReorder={state.reorderCharacters}
          />
        )}

        <MembershipBanner
          server={state.selectedServer}
          membership={state.membership}
          onUpdate={state.updateMembership}
        />
        <MemoSection memo={state.memo} onSave={state.saveMemo} />

        {state.selectedChar ? (
          <>
            <HomeworkToolbar
              presets={state.presets}
              onReset={state.resetHomework}
              onSavePreset={state.savePreset}
              onLoadPreset={state.loadPreset}
              onDeletePreset={state.deletePreset}
              onExportPreset={state.exportCurrentPreset}
              onImportPreset={state.importPreset}
            />
            <WeeklyCountdown />
            <ProgressBar
              done={state.progress.done}
              total={state.progress.total}
              pct={state.progress.pct}
              categories={state.progress.categories}
              favoriteOnly={state.favoriteOnly}
              onFavoriteToggle={state.setFavoriteOnly}
            />

            <PeriodToggle active={state.activeTab} onChange={state.setActiveTab} />

            <SearchFilterBar
              searchQuery={state.searchQuery}
              onSearchChange={state.setSearchQuery}
              regionFilter={state.regionFilter}
              onRegionChange={state.setRegionFilter}
              periodFilter={state.periodFilter}
              onPeriodChange={state.setPeriodFilter}
              scopeFilter={state.scopeFilter}
              onScopeChange={state.setScopeFilter}
              scrollTypeFilter={state.scrollTypeFilter}
              onScrollTypeChange={state.setScrollTypeFilter}
            />

            {/* 숙제 추가 버튼 */}
            <div className="px-4 pt-3">
              <button
                onClick={() => setShowAddCard(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 text-sm font-medium hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                숙제 추가
              </button>
            </div>

            {viewMode === "list" && (
              <ListMatrixView
                rows={matrixRows}
                characters={state.serverChars}
                onToggleHomework={(charId, item) => {
                  const nextIndex = item.completedCount >= item.totalCount ? 0 : item.completedCount;
                  state.toggleHomeworkForChar(charId, item.id, nextIndex);
                }}
                onToggleShop={(charId, item, type) => state.toggleShopItemForChar(charId, item.id, type)}
                onToggleScroll={(charId, item) => {
                  const nextIndex = item.completedCount >= item.totalCount ? 0 : item.completedCount;
                  state.toggleScrollItemForChar(charId, item.id, nextIndex);
                }}
                onToggleFavorite={(row) => {
                  if (row.type === "homework") state.toggleFavorite(row.sourceItem.id);
                  if (row.type === "scroll") state.toggleScrollFavorite(row.sourceItem.id);
                  if (row.type === "purchase" || row.type === "trade") state.toggleShopFavorite(row.sourceItem.id, row.type);
                }}
                onQuickEdit={(row) => {
                  const current = row.type === "homework" ? row.sourceItem.title : row.type === "scroll" ? row.sourceItem.title : row.sourceItem.itemName;
                  const next = window.prompt("카드 이름 수정", current)?.trim();
                  if (!next || next === current) return;
                  if (row.type === "homework") state.updateHomework(row.sourceItem.id, { title: next });
                  if (row.type === "scroll") state.updateScrollItem(row.sourceItem.id, { title: next });
                  if (row.type === "purchase" || row.type === "trade") state.updateShopItem(row.sourceItem.id, row.type, { itemName: next });
                }}
                onDeleteRow={(row) => {
                  if (!window.confirm(`'${row.label}'을 삭제하시겠습니까?`)) return;
                  if (row.type === "homework") state.deleteHomework(row.sourceItem.id);
                  if (row.type === "scroll") state.deleteScrollItem(row.sourceItem.id);
                  if (row.type === "purchase" || row.type === "trade") state.deleteShopItem(row.sourceItem.id, row.type);
                }}
                onReorder={(oldIdx, newIdx) => {
                  if (state.activeTab === "all") {
                    state.reorderAllTabItem(matrixRows.map((row) => row.sourceItem.id), oldIdx, newIdx);
                    return;
                  }
                  if (state.activeTab === "daily" || state.activeTab === "weekly") {
                    const item1 = matrixRows[oldIdx]?.sourceItem as HomeworkItem | undefined;
                    const item2 = matrixRows[newIdx]?.sourceItem as HomeworkItem | undefined;
                    if (!item1 || !item2) return;
                    const realOld = state.allHomework.indexOf(item1);
                    const realNew = state.allHomework.indexOf(item2);
                    if (realOld !== -1 && realNew !== -1) state.reorderHomework(realOld, realNew);
                    return;
                  }
                  if (state.activeTab === "purchase" || state.activeTab === "trade") {
                    state.reorderShopItem(state.activeTab as "purchase" | "trade", oldIdx, newIdx);
                    return;
                  }
                  if (state.activeTab === "scroll") {
                    state.reorderScrollItem(oldIdx, newIdx);
                  }
                }}
              />
            )}

            {viewMode === "character" && state.activeTab === "all" && (
              <div className="px-4 py-4 space-y-3">
                {allTabCards.length > 0 ? (
                  <SortableList
                    items={allTabCards}
                    onReorder={(oldIdx, newIdx) => state.reorderAllTabItem(allTabCards.map((card) => card.id), oldIdx, newIdx)}
                  >
                    {allTabCards.map((card) => {
                      if (card.type === "homework") {
                        return (
                          <HomeworkCard
                            key={card.id}
                            item={card.item}
                            onToggle={state.toggleHomework}
                            onToggleFavorite={state.toggleFavorite}
                            onUpdate={state.updateHomework}
                            onDelete={state.deleteHomework}
                            showPeriodLabel
                          />
                        );
                      }
                      if (card.type === "scroll") {
                        return (
                          <ScrollCard
                            key={card.id}
                            item={card.item}
                            onToggle={state.toggleScrollItem}
                            onToggleFavorite={state.toggleScrollFavorite}
                            onUpdate={state.updateScrollItem}
                            onDelete={state.deleteScrollItem}
                          />
                        );
                      }
                      return (
                        <ShopCard
                          key={card.id}
                          item={card.item}
                          onToggle={(id) => state.toggleShopItem(id, card.type)}
                          onToggleFavorite={(id) => state.toggleShopFavorite(id, card.type)}
                          onUpdate={(id, updates) => state.updateShopItem(id, card.type, updates)}
                          onDelete={(id) => state.deleteShopItem(id, card.type)}
                        />
                      );
                    })}
                  </SortableList>
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {viewMode === "character" && (state.activeTab === "daily" || state.activeTab === "weekly") && (
              <div className="px-4 py-4 space-y-3">
                {state.currentHomework.length > 0 ? (
                  <SortableList
                    items={state.currentHomework}
                    onReorder={(oldIdx, newIdx) => {
                      const item1 = state.currentHomework[oldIdx];
                      const item2 = state.currentHomework[newIdx];
                      if (item1 && item2) {
                        const realOld = state.allHomework.indexOf(item1);
                        const realNew = state.allHomework.indexOf(item2);
                        if (realOld !== -1 && realNew !== -1) {
                          state.reorderHomework(realOld, realNew);
                        }
                      }
                    }}
                  >
                    {state.currentHomework.map((hw) => (
                      <HomeworkCard key={hw.id} item={hw} onToggle={state.toggleHomework} onToggleFavorite={state.toggleFavorite} onUpdate={state.updateHomework} onDelete={state.deleteHomework} showPeriodLabel />
                    ))}
                  </SortableList>
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {viewMode === "character" && isShopTab && (
              <div className="px-4 py-4 space-y-3">
                {state.currentShopItems.length > 0 ? (
                  <SortableList
                    items={state.currentShopItems}
                    onReorder={(oldIdx, newIdx) => state.reorderShopItem(state.activeTab as "purchase" | "trade", oldIdx, newIdx)}
                  >
                    {state.currentShopItems.map((item) => (
                            <ShopCard
                              key={item.id}
                              item={item}
                        onToggle={(id) => state.toggleShopItem(id, state.activeTab as "purchase" | "trade")}
                        onToggleFavorite={(id) => state.toggleShopFavorite(id, state.activeTab as "purchase" | "trade")}
                        onUpdate={(id, updates) => state.updateShopItem(id, state.activeTab as "purchase" | "trade", updates)}
                        onDelete={(id) => state.deleteShopItem(id, state.activeTab as "purchase" | "trade")}
                            />
                          ))}
                        </SortableList>
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {viewMode === "character" && isScrollTab && (
              <div className="px-4 py-4 space-y-3">
                {state.currentScrollItems.length > 0 ? (
                  <SortableList
                    items={state.currentScrollItems}
                    onReorder={(oldIdx, newIdx) => state.reorderScrollItem(oldIdx, newIdx)}
                  >
                    {state.currentScrollItems.map((item) => (
                      <ScrollCard
                        key={item.id}
                        item={item}
                        onToggle={state.toggleScrollItem}
                        onToggleFavorite={state.toggleScrollFavorite}
                        onUpdate={state.updateScrollItem}
                        onDelete={state.deleteScrollItem}
                      />
                    ))}
                  </SortableList>
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {viewMode === "character" && isEventTab && (
              <div className="px-4 py-4">
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="text-slate-400 text-sm mb-1">이벤트 탭은 준비 중입니다.</p>
                  <p className="text-slate-500 text-xs">곧 업데이트될 예정입니다!</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 px-6">
            <p className="text-5xl mb-4">🎮</p>
            <p className="text-slate-400 text-sm mb-1">등록된 캐릭터가 없습니다.</p>
            <p className="text-slate-500 text-xs">[+ 캐릭터 추가] 버튼으로 시작하세요!</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-4 text-center">
        <div className="max-w-lg mx-auto px-4">
          <p className="text-[11px] text-slate-600">
            &copy; 2026 mobimobi. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            마비노기는 NEXON Korea의 등록 상표입니다. 본 서비스는 비공식 팬 제작 도구입니다.
          </p>
        </div>
      </footer>

      <CharacterCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={state.addCharacter}
        canAddToServer={state.canAddToServer}
        serverCharCount={state.serverCharCount}
      />
      <CharacterEditModal
        open={editingChar !== null}
        character={editingChar}
        onClose={() => setEditingChar(null)}
        onSave={state.updateCharacter}
        onDelete={state.deleteCharacter}
        canAddToServer={state.canAddToServer}
        serverCharCount={state.serverCharCount}
      />
      <AddCardModal
        open={showAddCard}
        onClose={() => setShowAddCard(false)}
        onAddHomework={state.addHomework}
        onAddShopItem={state.addShopItem}
        onAddScrollItem={state.addScrollItem}
      />
      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        userName={user?.displayName}
        userEmail={user?.email}
        providerEmails={providerEmails}
        userPhoto={user?.photoURL}
        isAdmin={isAdmin}
        isGuest={isGuest}
        onSignOut={signOut}
        onDeleteAccount={user ? deleteAccount : undefined}
        onSignInWithGoogle={isGuest ? signInWithGoogle : undefined}
        authError={authError}
        onImportData={(importedData) => {
          localStorage.setItem("mabimobi_data", JSON.stringify(importedData));
          window.location.reload();
        }}
      />
      <UpdateNotesModal open={showUpdateNotes} onClose={() => setShowUpdateNotes(false)} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-slate-500 text-sm">표시할 항목이 없습니다.</p>
    </div>
  );
}

function ListMatrixView({
  rows,
  characters,
  onToggleHomework,
  onToggleShop,
  onToggleScroll,
  onToggleFavorite,
  onQuickEdit,
  onDeleteRow,
  onReorder,
}: {
  rows: MatrixRow[];
  characters: Character[];
  onToggleHomework: (charId: string, item: HomeworkItem) => void;
  onToggleShop: (charId: string, item: ShopItem, type: "purchase" | "trade") => void;
  onToggleScroll: (charId: string, item: ScrollItem) => void;
  onToggleFavorite: (row: MatrixRow) => void;
  onQuickEdit: (row: MatrixRow) => void;
  onDeleteRow: (row: MatrixRow) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <div className="grid grid-cols-[minmax(188px,52vw)_1fr] md:grid-cols-[340px_1fr] border-b border-slate-800 bg-slate-950/80">
          <div className="px-3 py-3 text-sm font-bold text-slate-300">
            <div className="flex items-center">
              <span className="w-20 flex-shrink-0" />
              <span>항목</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div
              className="grid min-w-max"
              style={{ gridTemplateColumns: `repeat(${characters.length}, minmax(54px, 64px))` }}
            >
              {characters.map((char) => (
                <div key={char.id} className="px-1 py-3 text-center font-bold">
                  <span className="block truncate text-xs text-slate-400/80">{char.subClass}</span>
                  <span className="block truncate text-sm text-slate-300">{char.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SortableList items={rows} onReorder={onReorder}>
          <div className="divide-y divide-slate-800/80">
            {rows.map((row) => (
              <ListMatrixRow
                key={row.id}
                row={row}
                characters={characters}
                onToggleHomework={onToggleHomework}
                onToggleShop={onToggleShop}
                onToggleScroll={onToggleScroll}
                onToggleFavorite={onToggleFavorite}
                onQuickEdit={onQuickEdit}
                onDeleteRow={onDeleteRow}
              />
            ))}
          </div>
        </SortableList>
      </div>
    </div>
  );
}

function ListMatrixRow({
  row,
  characters,
  onToggleHomework,
  onToggleShop,
  onToggleScroll,
  onToggleFavorite,
  onQuickEdit,
  onDeleteRow,
}: {
  row: MatrixRow;
  characters: Character[];
  onToggleHomework: (charId: string, item: HomeworkItem) => void;
  onToggleShop: (charId: string, item: ShopItem, type: "purchase" | "trade") => void;
  onToggleScroll: (charId: string, item: ScrollItem) => void;
  onToggleFavorite: (row: MatrixRow) => void;
  onQuickEdit: (row: MatrixRow) => void;
  onDeleteRow: (row: MatrixRow) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[minmax(188px,52vw)_1fr] bg-slate-900 md:grid-cols-[340px_1fr]"
    >
      <div className="min-w-0 px-3 py-3">
        <div className="flex h-full min-w-0 items-center gap-2">
          <div className="flex w-20 flex-shrink-0 items-center justify-center gap-1">
            <button
              {...attributes}
              {...listeners}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-800 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
              title="드래그하여 순서 변경"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(row)}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
                row.sourceItem.isFavorite ? "text-yellow-400" : "text-slate-600 hover:bg-slate-800 hover:text-slate-400"
              }`}
              title={row.sourceItem.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            >
              {row.sourceItem.isFavorite ? "★" : "☆"}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {row.badges.map((badge) => (
                  <span
                    key={`${row.id}-${badge.label}`}
                    className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ))}
                <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{row.label}</div>
              </div>
              {!row.sourceItem.isDefault && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onQuickEdit(row)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
                    title="수정"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-800 hover:text-red-400"
                    title="삭제"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {row.details.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {row.details.map((detail, idx) => (
                  <span
                    key={`${row.id}-detail-${idx}-${detail.label}`}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] ${detail.className}`}
                  >
                    {detail.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-full overflow-x-auto">
        <div
          className="grid h-full min-w-max"
          style={{ gridTemplateColumns: `repeat(${characters.length}, minmax(54px, 64px))` }}
        >
          {row.cells.map((cell) => {
            if (!cell.item) {
              return (
                <div key={cell.char.id} className="flex min-h-full items-center justify-center px-1 py-3">
                  <span className="text-xs text-slate-700">-</span>
                </div>
              );
            }

            if (row.type === "purchase" || row.type === "trade") {
              const item = cell.item as ShopItem;
              return (
                <div key={cell.char.id} className="flex min-h-full items-center justify-center px-1 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleShop(cell.char.id, item, row.type)}
                    className={`h-9 w-9 rounded-lg border text-sm font-bold transition-colors ${
                      item.completed
                        ? "border-blue-400 bg-blue-500 text-white"
                        : "border-slate-700 bg-slate-950 text-slate-600 hover:border-blue-500 hover:text-blue-300"
                    }`}
                    title={`${cell.char.name} ${row.label}`}
                  >
                    {item.completed ? "✓" : ""}
                  </button>
                </div>
              );
            }

            const item = cell.item as HomeworkItem | ScrollItem;
            const done = item.completedCount >= item.totalCount;
            return (
              <div key={cell.char.id} className="flex min-h-full items-center justify-center px-1 py-3">
                <button
                  type="button"
                  onClick={() => row.type === "homework"
                    ? onToggleHomework(cell.char.id, item as HomeworkItem)
                    : onToggleScroll(cell.char.id, item as ScrollItem)
                  }
                  className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-bold transition-colors ${
                    done
                      ? "border-blue-400 bg-blue-500 text-white"
                      : item.completedCount > 0
                      ? "border-amber-400 bg-amber-500/20 text-amber-200"
                      : "border-slate-700 bg-slate-950 text-slate-600 hover:border-blue-500 hover:text-blue-300"
                  }`}
                  title={`${cell.char.name} ${row.label}`}
                >
                  {item.totalCount > 1 ? `${item.completedCount}/${item.totalCount}` : done ? "✓" : ""}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
