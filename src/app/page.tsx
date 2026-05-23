"use client";

import { useState } from "react";
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
import { Download, Upload, Settings } from "lucide-react";
import { isAdminFirebaseUser } from "@/lib/adminFirestore";
import type { Character, HomeworkItem, RegionName, ScrollItem, ShopItem } from "@/types";

type FilterState = { favoriteOnly: boolean; searchQuery: string; regionFilter: RegionName[]; periodFilter: string; scopeFilter: string };

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
  const { user, loading: authLoading, isGuest, signInWithGoogle, continueAsGuest, signOut, deleteAccount } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUpdateNotes, setShowUpdateNotes] = useState(false);
  const state = useAppState(user?.uid);

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
          <h1 className="text-5xl font-extrabold text-blue-500 tracking-wider mb-3">mobimobi</h1>
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

  // 대시보드
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1
            className="text-2xl font-bold text-blue-500 cursor-pointer"
            onClick={() => window.location.reload()}
          >mobimobi</h1>
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

      <main className="max-w-lg mx-auto pb-8 flex-1 w-full">
        <ServerTabs
          servers={state.activeServers}
          selected={state.selectedServer}
          onChange={state.setSelectedServer}
        />

        <CharacterTabs
          characters={state.serverChars}
          selectedId={state.selectedCharId}
          onSelect={state.setSelectedCharId}
          onAdd={() => setShowCreateModal(true)}
          onEdit={(c) => setEditingChar(c)}
          onReorder={state.reorderCharacters}
        />

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

            {state.activeTab === "all" && (
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

            {(state.activeTab === "daily" || state.activeTab === "weekly") && (
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

            {isShopTab && (
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

            {isScrollTab && (
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

            {isEventTab && (
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
