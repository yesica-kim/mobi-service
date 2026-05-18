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
import { useAppState } from "@/hooks/useAppState";
import { useAuth } from "@/hooks/useAuth";
import type { Character } from "@/types";

function filteredPurchase(state: { allPurchaseItems: any[]; favoriteOnly: boolean }) {
  return state.favoriteOnly ? state.allPurchaseItems.filter((i) => i.isFavorite) : state.allPurchaseItems;
}
function filteredTrade(state: { allTradeItems: any[]; favoriteOnly: boolean }) {
  return state.favoriteOnly ? state.allTradeItems.filter((i) => i.isFavorite) : state.allTradeItems;
}

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
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
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 px-6">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-blue-500 tracking-wider mb-3">모비모비</h1>
          <p className="text-slate-400 text-sm">마비노기 숙제 트래커</p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 rounded-2xl bg-white px-8 py-4 font-semibold text-gray-700 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          구글 계정으로 로그인
        </button>
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

  // 대시보드
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-blue-500">모비모비</h1>
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
            )}
            <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-300">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-20">
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
        />

        {state.selectedChar ? (
          <>
            <HomeworkToolbar
              presets={state.presets}
              onReset={state.resetHomework}
              onSavePreset={state.savePreset}
              onLoadPreset={state.loadPreset}
              onDeletePreset={state.deletePreset}
            />
            <WeeklyCountdown />
            <ProgressBar
              {...state.progress}
              favoriteOnly={state.favoriteOnly}
              onFavoriteToggle={state.setFavoriteOnly}
            />

            <PeriodToggle active={state.activeTab} onChange={state.setActiveTab} />

            {state.activeTab === "all" && (
              <div className="px-4 py-4 space-y-3">
                {state.currentHomework.length > 0 || filteredPurchase(state).length > 0 || filteredTrade(state).length > 0 ? (
                  <>
                    {state.currentHomework.some((hw) => hw.period === "daily") && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wide pt-1">일일 숙제</h3>
                        {state.currentHomework
                          .filter((hw) => hw.period === "daily")
                          .map((hw) => (
                            <HomeworkCard key={hw.id} item={hw} onToggle={state.toggleHomework} onToggleFavorite={state.toggleFavorite} onUpdate={state.updateHomework} />
                          ))}
                      </div>
                    )}
                    {state.currentHomework.some((hw) => hw.period === "weekly") && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide pt-3">주간 숙제</h3>
                        {state.currentHomework
                          .filter((hw) => hw.period === "weekly")
                          .map((hw) => (
                            <HomeworkCard key={hw.id} item={hw} onToggle={state.toggleHomework} onToggleFavorite={state.toggleFavorite} onUpdate={state.updateHomework} />
                          ))}
                      </div>
                    )}
                    {filteredPurchase(state).length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-wide pt-3">구매</h3>
                        {filteredPurchase(state).map((item) => (
                          <ShopCard
                            key={item.id}
                            item={item}
                            onToggle={(id) => state.toggleShopItem(id, "purchase")}
                            onToggleFavorite={(id) => state.toggleShopFavorite(id, "purchase")}
                            onUpdate={(id, updates) => state.updateShopItem(id, "purchase", updates)}
                          />
                        ))}
                      </div>
                    )}
                    {filteredTrade(state).length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wide pt-3">물물교환</h3>
                        {filteredTrade(state).map((item) => (
                          <ShopCard
                            key={item.id}
                            item={item}
                            onToggle={(id) => state.toggleShopItem(id, "trade")}
                            onToggleFavorite={(id) => state.toggleShopFavorite(id, "trade")}
                            onUpdate={(id, updates) => state.updateShopItem(id, "trade", updates)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {(state.activeTab === "daily" || state.activeTab === "weekly") && (
              <div className="px-4 py-4 space-y-3">
                {state.currentHomework.length > 0 ? (
                  state.currentHomework.map((hw) => (
                    <HomeworkCard key={hw.id} item={hw} onToggle={state.toggleHomework} onToggleFavorite={state.toggleFavorite} onUpdate={state.updateHomework} />
                  ))
                ) : (
                  <EmptyState />
                )}
              </div>
            )}

            {isShopTab && (
              <div className="px-4 py-4 space-y-3">
                {state.currentShopItems.length > 0 ? (
                  state.currentShopItems.map((item) => (
                    <ShopCard
                      key={item.id}
                      item={item}
                      onToggle={(id) => state.toggleShopItem(id, state.activeTab as "purchase" | "trade")}
                      onToggleFavorite={(id) => state.toggleShopFavorite(id, state.activeTab as "purchase" | "trade")}
                      onUpdate={(id, updates) => state.updateShopItem(id, state.activeTab as "purchase" | "trade", updates)}
                    />
                  ))
                ) : (
                  <EmptyState />
                )}
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
