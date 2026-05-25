"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyResets, createHomeworkForChar, createPurchaseForChar, createTradeForChar, createScrollForChar, getNextDailyResetMs, getNextWeeklyResetMs, loadData, saveData } from "@/lib/storage";
import { loadUserData, saveUserData } from "@/lib/firestore";
import { loadRuntimeDefaultCards } from "@/lib/defaultCards";
import type { DefaultCardsData } from "@/lib/adminFirestore";
import type { AppData, Character, HomeworkItem, HomeworkPreset, MembershipInfo, ServerName, ShopItem, ScrollItem, TabType, PeriodType, ScopeType, RegionName, ScrollType} from "@/types";
import { DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, MAX_CHARS_PER_SERVER, SERVERS, parseTotalCount, toScope } from "@/types";

function cloneHomeworkForChar(charId: string, item: HomeworkItem, index: number): HomeworkItem {
  return {
    ...item,
    id: `${charId}_hw_clone_${Date.now()}_${index}`,
    completedCount: 0,
    isFavorite: false,
  };
}

function cloneShopForChar(charId: string, item: ShopItem, prefix: "pur" | "trd", index: number): ShopItem {
  return {
    ...item,
    id: `${charId}_${prefix}_clone_${Date.now()}_${index}`,
    completed: false,
    isFavorite: false,
  };
}

function cloneScrollForChar(charId: string, item: ScrollItem, index: number): ScrollItem {
  return {
    ...item,
    id: `${charId}_scroll_clone_${Date.now()}_${index}`,
    completedCount: 0,
    isFavorite: false,
  };
}

function pickTemplateList<T>(records: Record<string, T[]>, charIds: string[]): T[] {
  return charIds.reduce<T[]>((template, charId) => {
    const list = records[charId] ?? [];
    return list.length > template.length ? list : template;
  }, []);
}

function normalizeRecordByTemplate<T>(
  records: Record<string, T[]>,
  charIds: string[],
  getKey: (item: T) => string,
  cloneItem: (charId: string, item: T, index: number) => T
): { records: Record<string, T[]>; changed: boolean } {
  const template = pickTemplateList(records, charIds);
  if (template.length === 0) return { records, changed: false };

  let changed = false;
  const normalized: Record<string, T[]> = { ...records };

  for (const charId of charIds) {
    const current = records[charId] ?? [];
    const used = new Set<number>();
    const next = template.map((templateItem, index) => {
      const templateKey = getKey(templateItem);
      const existingIndex = current.findIndex((item, itemIndex) => !used.has(itemIndex) && getKey(item) === templateKey);
      if (existingIndex !== -1) {
        used.add(existingIndex);
        return current[existingIndex];
      }
      changed = true;
      return cloneItem(charId, templateItem, index);
    });

    if (current.length !== next.length || next.some((item, index) => item !== current[index])) {
      changed = true;
      normalized[charId] = next;
    }
  }

  return { records: normalized, changed };
}

function normalizeCharacterCardLists(data: AppData): { data: AppData; changed: boolean } {
  const charIds = data.characters.map((char) => char.id);
  if (charIds.length === 0) return { data, changed: false };

  const homework = normalizeRecordByTemplate(
    data.homework,
    charIds,
    (item) => `${item.period}|${item.scope ?? "character"}|${item.title}|${item.reward}`,
    cloneHomeworkForChar
  );
  const purchaseItems = normalizeRecordByTemplate(
    data.purchaseItems,
    charIds,
    (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.npcName}|${item.itemName}`,
    (charId, item, index) => cloneShopForChar(charId, item, "pur", index)
  );
  const tradeItems = normalizeRecordByTemplate(
    data.tradeItems,
    charIds,
    (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.npcName}|${item.itemName}`,
    (charId, item, index) => cloneShopForChar(charId, item, "trd", index)
  );
  const scrollItems = normalizeRecordByTemplate(
    data.scrollItems ?? {},
    charIds,
    (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.scrollType}|${item.title}|${item.reward}`,
    cloneScrollForChar
  );

  const changed = homework.changed || purchaseItems.changed || tradeItems.changed || scrollItems.changed;
  if (!changed) return { data, changed: false };

  return {
    data: {
      ...data,
      homework: homework.records,
      purchaseItems: purchaseItems.records,
      tradeItems: tradeItems.records,
      scrollItems: scrollItems.records,
    },
    changed: true,
  };
}

export function useAppState(uid?: string | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [runtimeDefaults, setRuntimeDefaults] = useState<DefaultCardsData | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerName | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionName[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodType | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeType | "all">("all");
  const [scrollTypeFilter, setScrollTypeFilter] = useState<ScrollType | "all">("all");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 로드: Firestore 우선, 없으면 localStorage
  useEffect(() => {
    let cancelled = false;
    async function init() {
      let loaded: AppData;
      const defaults = await loadRuntimeDefaultCards();

      if (uid) {
        // Firestore에서 로드 시도
        const cloudData = await loadUserData(uid);
        if (cloudData) {
          loaded = applyResets(cloudData, defaults);
        } else {
          // Firestore에 없으면 localStorage 데이터를 마이그레이션
          const localData = loadData(defaults);
          loaded = applyResets(localData, defaults);
          // 클라우드에 초기 저장
          await saveUserData(uid, loaded);
        }
      } else {
        loaded = applyResets(loadData(defaults), defaults);
      }

      // 기존 캐릭터에 scrollItems가 없으면 기본 스크롤 추가
      if (loaded.characters.length > 0) {
        const scrollItems = loaded.scrollItems ?? {};
        let updated = false;
        for (const char of loaded.characters) {
          if (!scrollItems[char.id] || scrollItems[char.id].length === 0) {
            scrollItems[char.id] = createScrollForChar(char.id, defaults);
            updated = true;
          }
        }
        if (updated) {
          loaded = { ...loaded, scrollItems };
        }
      }

      const normalized = normalizeCharacterCardLists(loaded);
      if (normalized.changed) {
        loaded = normalized.data;
        saveData(loaded);
        if (uid) await saveUserData(uid, loaded);
      }

      if (cancelled) return;
      setRuntimeDefaults(defaults);
      setData(loaded);
      if (loaded.characters.length > 0) {
        // SERVERS 순서 기준으로 첫 서버의 첫 캐릭터 선택
        const charServers = new Set(loaded.characters.map((c) => c.server));
        const firstServer = SERVERS.find((s) => charServers.has(s));
        if (firstServer) {
          const firstChar = loaded.characters.find((c) => c.server === firstServer);
          setSelectedServer(firstServer);
          setSelectedCharId(firstChar?.id ?? loaded.characters[0].id);
        } else {
          const first = loaded.characters[0];
          setSelectedServer(first.server);
          setSelectedCharId(first.id);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [uid]);

  // 일간/주간 리셋 타이머: 앱이 열려 있는 동안 자동 리셋
  useEffect(() => {
    if (!data) return;

    const scheduleDailyReset = () => {
      const ms = getNextDailyResetMs();
      return setTimeout(() => {
        setData((prev) => {
          if (!prev) return prev;
          const next = applyResets({ ...prev }, runtimeDefaults ?? undefined);
          saveData(next);
          if (uid) saveUserData(uid, next);
          return next;
        });
        dailyTimer = scheduleDailyReset();
      }, ms + 1000); // 1초 여유
    };

    const scheduleWeeklyReset = () => {
      const ms = getNextWeeklyResetMs();
      return setTimeout(() => {
        setData((prev) => {
          if (!prev) return prev;
          const next = applyResets({ ...prev }, runtimeDefaults ?? undefined);
          saveData(next);
          if (uid) saveUserData(uid, next);
          return next;
        });
        weeklyTimer = scheduleWeeklyReset();
      }, ms + 1000);
    };

    let dailyTimer = scheduleDailyReset();
    let weeklyTimer = scheduleWeeklyReset();

    return () => {
      clearTimeout(dailyTimer);
      clearTimeout(weeklyTimer);
    };
  }, [data !== null, uid, runtimeDefaults]); // data가 로드된 후 한 번만 설정

  // 데이터 변경 시 저장 (debounce)
  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      // localStorage에 즉시 저장
      saveData(next);
      // Firestore에 debounce 저장 (1초)
      if (uid) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          saveUserData(uid, next);
        }, 1000);
      }
      return next;
    });
  }, [uid]);

  // ── 캐릭터 CRUD ──
  const addCharacter = useCallback(
    (char: Omit<Character, "id">) => {
      const id = `char_${Date.now()}`;
      const newChar: Character = { id, ...char };
      persist((prev) => {
        const sourceCharId = selectedCharId ?? prev.characters[0]?.id;
        const sourceHomework = sourceCharId ? prev.homework[sourceCharId] ?? [] : [];
        const sourcePurchase = sourceCharId ? prev.purchaseItems[sourceCharId] ?? [] : [];
        const sourceTrade = sourceCharId ? prev.tradeItems[sourceCharId] ?? [] : [];
        const sourceScroll = sourceCharId ? (prev.scrollItems ?? {})[sourceCharId] ?? [] : [];
        const homework = sourceHomework.length > 0
          ? sourceHomework.map((item, index) => cloneHomeworkForChar(id, item, index))
          : createHomeworkForChar(id, runtimeDefaults ?? undefined);
        const purchaseItems = sourcePurchase.length > 0
          ? sourcePurchase.map((item, index) => cloneShopForChar(id, item, "pur", index))
          : createPurchaseForChar(id, runtimeDefaults ?? undefined);
        const tradeItems = sourceTrade.length > 0
          ? sourceTrade.map((item, index) => cloneShopForChar(id, item, "trd", index))
          : createTradeForChar(id, runtimeDefaults ?? undefined);
        const scrollItems = sourceScroll.length > 0
          ? sourceScroll.map((item, index) => cloneScrollForChar(id, item, index))
          : createScrollForChar(id, runtimeDefaults ?? undefined);
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };

        if (sourceCharId) {
          const idMap = new Map<string, string>([
            ...sourceHomework.map((item, index) => [item.id, homework[index]?.id ?? ""] as const),
            ...sourcePurchase.map((item, index) => [item.id, purchaseItems[index]?.id ?? ""] as const),
            ...sourceTrade.map((item, index) => [item.id, tradeItems[index]?.id ?? ""] as const),
            ...sourceScroll.map((item, index) => [item.id, scrollItems[index]?.id ?? ""] as const),
          ]);
          const mappedOrder = (allTabOrder[sourceCharId] ?? [])
            .map((itemId) => idMap.get(itemId))
            .filter((itemId): itemId is string => Boolean(itemId));
          const allIds = [
            ...homework.map((item) => item.id),
            ...purchaseItems.map((item) => item.id),
            ...tradeItems.map((item) => item.id),
            ...scrollItems.map((item) => item.id),
          ];
          allTabOrder[id] = [...mappedOrder, ...allIds.filter((itemId) => !mappedOrder.includes(itemId))];
        }

        return {
          ...prev,
          characters: [...prev.characters, newChar],
          homework: { ...prev.homework, [id]: homework },
          purchaseItems: { ...prev.purchaseItems, [id]: purchaseItems },
          tradeItems: { ...prev.tradeItems, [id]: tradeItems },
          scrollItems: { ...(prev.scrollItems ?? {}), [id]: scrollItems },
          allTabOrder,
        };
      });
      setSelectedServer(char.server);
      setSelectedCharId(id);
    },
    [persist, runtimeDefaults, selectedCharId]
  );

  const updateCharacter = useCallback(
    (charId: string, updates: Partial<Omit<Character, "id">>) => {
      persist((prev) => ({
        ...prev,
        characters: prev.characters.map((c) =>
          c.id === charId ? { ...c, ...updates } : c
        ),
      }));
      if (updates.server) setSelectedServer(updates.server);
    },
    [persist]
  );

  const deleteCharacter = useCallback(
    (charId: string) => {
      persist((prev) => {
        const chars = prev.characters.filter((c) => c.id !== charId);
        const hw = { ...prev.homework };
        const pur = { ...prev.purchaseItems };
        const trd = { ...prev.tradeItems };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        delete hw[charId];
        delete pur[charId];
        delete trd[charId];
        delete allTabOrder[charId];
        return { ...prev, characters: chars, homework: hw, purchaseItems: pur, tradeItems: trd, allTabOrder };
      });
      setData((prev) => {
        if (!prev) return prev;
        const remaining = prev.characters.filter((c) => c.id !== charId);
        if (remaining.length > 0) {
          const sameServer = remaining.filter((c) => c.server === selectedServer);
          const next = sameServer.length > 0 ? sameServer[0] : remaining[0];
          setSelectedServer(next.server);
          setSelectedCharId(next.id);
        } else {
          setSelectedServer(null);
          setSelectedCharId(null);
        }
        return prev;
      });
    },
    [persist, selectedServer]
  );

  // ── 같은 서버 캐릭터 ID 목록 ──
  const getSameServerCharIds = useCallback(
    (prev: AppData): string[] => {
      if (!selectedServer) return [];
      return prev.characters.filter((c) => c.server === selectedServer).map((c) => c.id);
    },
    [selectedServer]
  );

  const getCharServerCharIds = useCallback((prev: AppData, charId: string): string[] => {
    const server = prev.characters.find((c) => c.id === charId)?.server;
    if (!server) return [charId];
    return prev.characters.filter((c) => c.server === server).map((c) => c.id);
  }, []);

  // ── 숙제 토글 ──
  const toggleHomework = useCallback(
    (hwId: string, checkIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const currentList = prev.homework[selectedCharId] ?? [];
        const target = currentList.find((hw) => hw.id === hwId);
        if (!target) return prev;

        const newCount = checkIndex < target.completedCount ? checkIndex : checkIndex + 1;
        const hwIndex = currentList.indexOf(target);

        // 서버 scope면 같은 서버 전체 캐릭터에 적용
        if (target.scope === "server") {
          const charIds = getSameServerCharIds(prev);
          const newHomework = { ...prev.homework };
          for (const cid of charIds) {
            newHomework[cid] = (newHomework[cid] ?? []).map((hw, i) =>
              i === hwIndex ? { ...hw, completedCount: newCount } : hw
            );
          }
          return { ...prev, homework: newHomework };
        }

        return {
          ...prev,
          homework: {
            ...prev.homework,
            [selectedCharId]: currentList.map((hw) =>
              hw.id === hwId ? { ...hw, completedCount: newCount } : hw
            ),
          },
        };
      });
    },
    [persist, selectedCharId, getSameServerCharIds]
  );

  const toggleHomeworkForChar = useCallback(
    (charId: string, hwId: string, checkIndex: number) => {
      persist((prev) => {
        const currentList = prev.homework[charId] ?? [];
        const target = currentList.find((hw) => hw.id === hwId);
        if (!target) return prev;

        const newCount = checkIndex < target.completedCount ? checkIndex : checkIndex + 1;
        const hwIndex = currentList.indexOf(target);

        if (target.scope === "server") {
          const charIds = getCharServerCharIds(prev, charId);
          const newHomework = { ...prev.homework };
          for (const cid of charIds) {
            newHomework[cid] = (newHomework[cid] ?? []).map((hw, i) =>
              i === hwIndex ? { ...hw, completedCount: newCount } : hw
            );
          }
          return { ...prev, homework: newHomework };
        }

        return {
          ...prev,
          homework: {
            ...prev.homework,
            [charId]: currentList.map((hw) =>
              hw.id === hwId ? { ...hw, completedCount: newCount } : hw
            ),
          },
        };
      });
    },
    [persist, getCharServerCharIds]
  );

  const toggleFavorite = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;

        const newHomework = { ...prev.homework };
        newHomework[selectedCharId] = currentList.map((hw, i) =>
          i === idx ? { ...hw, isFavorite: !hw.isFavorite } : hw
        );
        return { ...prev, homework: newHomework };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 수정 (전체 캐릭터 동기화) ──
  const updateHomework = useCallback(
    (hwId: string, updates: Partial<Pick<import("@/types").HomeworkItem, "title" | "reward" | "totalCount" | "scope">>) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;

        const newHomework = { ...prev.homework };
        for (const charId of Object.keys(newHomework)) {
          newHomework[charId] = (newHomework[charId] ?? []).map((hw, i) => {
            if (i !== idx) return hw;
            const updated = { ...hw, ...updates };
            if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
              updated.completedCount = updates.totalCount;
            }
            return updated;
          });
        }
        return { ...prev, homework: newHomework };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 토글 ──
  const toggleShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const currentList = prev[key][selectedCharId] ?? [];
        const target = currentList.find((item) => item.id === itemId);
        if (!target) return prev;

        const newCompleted = !target.completed;
        const itemIndex = currentList.indexOf(target);

        if (target.scope === "server") {
          const charIds = getSameServerCharIds(prev);
          const newItems = { ...prev[key] };
          for (const cid of charIds) {
            newItems[cid] = (newItems[cid] ?? []).map((item, i) =>
              i === itemIndex ? { ...item, completed: newCompleted } : item
            );
          }
          return { ...prev, [key]: newItems };
        }

        return {
          ...prev,
          [key]: {
            ...prev[key],
            [selectedCharId]: currentList.map((item) =>
              item.id === itemId ? { ...item, completed: newCompleted } : item
            ),
          },
        };
      });
    },
    [persist, selectedCharId, getSameServerCharIds]
  );

  const toggleShopItemForChar = useCallback(
    (charId: string, itemId: string, type: "purchase" | "trade") => {
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const currentList = prev[key][charId] ?? [];
        const target = currentList.find((item) => item.id === itemId);
        if (!target) return prev;

        const newCompleted = !target.completed;
        const itemIndex = currentList.indexOf(target);

        if (target.scope === "server") {
          const charIds = getCharServerCharIds(prev, charId);
          const newItems = { ...prev[key] };
          for (const cid of charIds) {
            newItems[cid] = (newItems[cid] ?? []).map((item, i) =>
              i === itemIndex ? { ...item, completed: newCompleted } : item
            );
          }
          return { ...prev, [key]: newItems };
        }

        return {
          ...prev,
          [key]: {
            ...prev[key],
            [charId]: currentList.map((item) =>
              item.id === itemId ? { ...item, completed: newCompleted } : item
            ),
          },
        };
      });
    },
    [persist, getCharServerCharIds]
  );

  const toggleShopFavorite = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;

        const newItems = { ...prev[key] };
        newItems[selectedCharId] = currentList.map((item, i) =>
          i === idx ? { ...item, isFavorite: !item.isFavorite } : item
        );
        return { ...prev, [key]: newItems };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 수정 (전체 캐릭터 동기화) ──
  const updateShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade", updates: Partial<Pick<import("@/types").ShopItem, "itemName" | "region" | "npcName" | "period" | "scope">>) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;

        const newItems = { ...prev[key] };
        for (const charId of Object.keys(newItems)) {
          newItems[charId] = (newItems[charId] ?? []).map((item, i) =>
            i === idx ? { ...item, ...updates } : item
          );
        }
        return { ...prev, [key]: newItems };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 삭제 (전체 캐릭터 동기화) ──
  const deleteHomework = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;

        // 삭제 전 모든 캐릭터의 상태 저장
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        for (const charId of Object.keys(prev.homework)) {
          const item = (prev.homework[charId] ?? [])[idx];
          if (!item) continue;
          const cs = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
          cs.homework = { ...cs.homework, [item.title]: { completedCount: item.completedCount, isFavorite: item.isFavorite } };
          savedStates[charId] = cs;
        }

        const newHomework = { ...prev.homework };
        for (const charId of Object.keys(newHomework)) {
          const list = newHomework[charId] ?? [];
          newHomework[charId] = list.filter((_, i) => i !== idx);
        }
        return { ...prev, homework: newHomework, savedItemStates: savedStates };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 추가 (전체 캐릭터 동기화) ──
  const addHomework = useCallback(
    (hw: { title: string; reward: string; period: PeriodType; totalCount: number; scope: ScopeType }) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const newHomework = { ...prev.homework };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of Object.keys(newHomework)) {
          const list = [...(newHomework[charId] ?? [])];
          const newItem: HomeworkItem = {
            id: `${charId}_hw_${ts}`,
            title: hw.title,
            reward: hw.reward,
            period: hw.period,
            totalCount: hw.totalCount,
            completedCount: 0,
            isFavorite: false,
            scope: hw.scope,
          };
          newHomework[charId] = [newItem, ...list];
          allTabOrder[charId] = [newItem.id, ...(allTabOrder[charId] ?? []).filter((id) => id !== newItem.id)];
        }
        return { ...prev, homework: newHomework, allTabOrder };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 삭제 (전체 캐릭터 동기화) ──
  const deleteShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      const stateKey = type === "purchase" ? "purchase" : "trade";
      persist((prev) => {
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;

        // 삭제 전 모든 캐릭터의 상태 저장
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        for (const charId of Object.keys(prev[key])) {
          const item = (prev[key][charId] ?? [])[idx];
          if (!item) continue;
          const cs = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
          cs[stateKey] = { ...cs[stateKey], [item.itemName]: { completed: item.completed, isFavorite: item.isFavorite } };
          savedStates[charId] = cs;
        }

        const newItems = { ...prev[key] };
        for (const charId of Object.keys(newItems)) {
          const list = newItems[charId] ?? [];
          newItems[charId] = list.filter((_, i) => i !== idx);
        }
        return { ...prev, [key]: newItems, savedItemStates: savedStates };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 추가 (전체 캐릭터 동기화) ──
  const addShopItem = useCallback(
    (type: "purchase" | "trade", item: { itemName: string; region: RegionName; npcName: string; period: PeriodType; scope: ScopeType }) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      const prefix = type === "purchase" ? "pur" : "trd";
      persist((prev) => {
        const newItems = { ...prev[key] };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of Object.keys(newItems)) {
          const list = newItems[charId] ?? [];
          const newItem: ShopItem = {
            id: `${charId}_${prefix}_${ts}`,
            itemName: item.itemName,
            region: item.region,
            npcName: item.npcName,
            period: item.period,
            completed: false,
            isFavorite: false,
            scope: item.scope,
          };
          newItems[charId] = [newItem, ...list];
          allTabOrder[charId] = [newItem.id, ...(allTabOrder[charId] ?? []).filter((id) => id !== newItem.id)];
        }
        return { ...prev, [key]: newItems, allTabOrder };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 순서 변경 (전체 캐릭터 동기화) ──
  const reorderHomework = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const newHomework = { ...prev.homework };
        for (const charId of Object.keys(newHomework)) {
          const list = [...(newHomework[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            newHomework[charId] = list;
          }
        }
        return { ...prev, homework: newHomework };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 순서 변경 (전체 캐릭터 동기화) ──
  const reorderShopItem = useCallback(
    (type: "purchase" | "trade", oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const newItems = { ...prev[key] };
        for (const charId of Object.keys(newItems)) {
          const list = [...(newItems[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            newItems[charId] = list;
          }
        }
        return { ...prev, [key]: newItems };
      });
    },
    [persist, selectedCharId]
  );

  // ── 캐릭터 순서 변경 ──
  const reorderCharacters = useCallback(
    (oldIndex: number, newIndex: number) => {
      persist((prev) => {
        const list = [...prev.characters];
        const [moved] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, moved);
        return { ...prev, characters: list };
      });
    },
    [persist]
  );

  // ── 스크롤(임무게시판) CRUD ──
  const allScrollItems = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return (data.scrollItems ?? {})[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const currentScrollItems = useMemo((): ScrollItem[] => {
    let items = allScrollItems;
    if (favoriteOnly) items = items.filter((item) => item.isFavorite);
    if (periodFilter !== "all") items = items.filter((item) => (item.period ?? "weekly") === periodFilter);
    if (scopeFilter !== "all") items = items.filter((item) => (item.scope || "character") === scopeFilter);
    if (scrollTypeFilter !== "all") items = items.filter((item) => item.scrollType === scrollTypeFilter);
    if (regionFilter.length > 0) items = items.filter((item) => regionFilter.includes(item.region));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => item.title.toLowerCase().includes(q) || item.reward.toLowerCase().includes(q));
    }
    return items;
  }, [allScrollItems, favoriteOnly, periodFilter, scopeFilter, scrollTypeFilter, regionFilter, searchQuery]);

  const addScrollItem = useCallback(
    (item: { title: string; scrollType: ScrollType; period: PeriodType; totalCount: number; materials: string[]; region: RegionName; reward: string }) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of Object.keys(scrollItems)) {
          const list = scrollItems[charId] ?? [];
          const newItem: ScrollItem = {
            id: `${charId}_scroll_${ts}`,
            title: item.title,
            scrollType: item.scrollType,
            period: item.period,
            totalCount: item.totalCount,
            completedCount: 0,
            isFavorite: false,
            scope: "character",
            region: item.region,
            materials: item.materials,
            reward: item.reward,
          };
          scrollItems[charId] = [newItem, ...list];
          allTabOrder[charId] = [newItem.id, ...(allTabOrder[charId] ?? []).filter((id) => id !== newItem.id)];
        }
        return { ...prev, scrollItems, allTabOrder };
      });
    },
    [persist, selectedCharId]
  );

  const toggleScrollItem = useCallback(
    (itemId: string, checkIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        const list = scrollItems[selectedCharId] ?? [];
        const target = list.find((s) => s.id === itemId);
        if (!target) return prev;
        const newCount = checkIndex < target.completedCount ? checkIndex : checkIndex + 1;
        return {
          ...prev,
          scrollItems: {
            ...scrollItems,
            [selectedCharId]: list.map((s) => s.id === itemId ? { ...s, completedCount: newCount } : s),
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  const toggleScrollItemForChar = useCallback(
    (charId: string, itemId: string, checkIndex: number) => {
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        const list = scrollItems[charId] ?? [];
        const target = list.find((s) => s.id === itemId);
        if (!target) return prev;
        const newCount = checkIndex < target.completedCount ? checkIndex : checkIndex + 1;
        return {
          ...prev,
          scrollItems: {
            ...scrollItems,
            [charId]: list.map((s) => s.id === itemId ? { ...s, completedCount: newCount } : s),
          },
        };
      });
    },
    [persist]
  );

  const toggleScrollFavorite = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;

        scrollItems[selectedCharId] = currentList.map((s, i) =>
          i === idx ? { ...s, isFavorite: !s.isFavorite } : s
        );
        return { ...prev, scrollItems };
      });
    },
    [persist, selectedCharId]
  );

  const updateScrollItem = useCallback(
    (itemId: string, updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "period" | "totalCount" | "materials" | "reward" | "region" | "tags">>) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;

        for (const charId of Object.keys(scrollItems)) {
          scrollItems[charId] = (scrollItems[charId] ?? []).map((s, i) => {
            if (i !== idx) return s;
            const updated = { ...s, ...updates };
            if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
              updated.completedCount = updates.totalCount;
            }
            return updated;
          });
        }
        return { ...prev, scrollItems };
      });
    },
    [persist, selectedCharId]
  );

  const deleteScrollItem = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;

        for (const charId of Object.keys(scrollItems)) {
          const list = scrollItems[charId] ?? [];
          scrollItems[charId] = list.filter((_, i) => i !== idx);
        }
        return { ...prev, scrollItems };
      });
    },
    [persist, selectedCharId]
  );

  const reorderScrollItem = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        for (const charId of Object.keys(scrollItems)) {
          const list = [...(scrollItems[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            scrollItems[charId] = list;
          }
        }
        return { ...prev, scrollItems };
      });
    },
    [persist, selectedCharId]
  );

  const reorderAllTabItem = useCallback(
    (visibleIds: string[], oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      const activeId = visibleIds[oldIndex];
      const overId = visibleIds[newIndex];
      if (!activeId || !overId || activeId === overId) return;

      persist((prev) => {
        const charId = selectedCharId;
        const allIds = [
          ...(prev.homework[charId] ?? []).map((item) => item.id),
          ...(prev.purchaseItems[charId] ?? []).map((item) => item.id),
          ...(prev.tradeItems[charId] ?? []).map((item) => item.id),
          ...((prev.scrollItems ?? {})[charId] ?? []).map((item) => item.id),
        ];
        const existingOrder = (prev.allTabOrder?.[charId] ?? []).filter((id) => allIds.includes(id));
        const order = [
          ...existingOrder,
          ...allIds.filter((id) => !existingOrder.includes(id)),
        ];
        const from = order.indexOf(activeId);
        const to = order.indexOf(overId);
        if (from === -1 || to === -1) return prev;

        const nextOrder = [...order];
        const [moved] = nextOrder.splice(from, 1);
        nextOrder.splice(to, 0, moved);

        return {
          ...prev,
          allTabOrder: {
            ...(prev.allTabOrder ?? {}),
            [charId]: nextOrder,
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 초기화 (기본 세팅으로) ──
  const resetHomework = useCallback(() => {
    if (!selectedCharId) return;
    persist((prev) => {
      // savedItemStates에서 해당 캐릭터 상태 초기화
      const savedStates = { ...(prev.savedItemStates ?? {}) };
      const allTabOrder = { ...(prev.allTabOrder ?? {}) };
      delete savedStates[selectedCharId];
      delete allTabOrder[selectedCharId];
      return {
        ...prev,
        homework: { ...prev.homework, [selectedCharId]: createHomeworkForChar(selectedCharId, runtimeDefaults ?? undefined) },
        purchaseItems: { ...prev.purchaseItems, [selectedCharId]: createPurchaseForChar(selectedCharId, runtimeDefaults ?? undefined) },
        tradeItems: { ...prev.tradeItems, [selectedCharId]: createTradeForChar(selectedCharId, runtimeDefaults ?? undefined) },
        scrollItems: { ...(prev.scrollItems ?? {}), [selectedCharId]: createScrollForChar(selectedCharId, runtimeDefaults ?? undefined) },
        savedItemStates: savedStates,
        allTabOrder,
      };
    });
  }, [persist, selectedCharId, runtimeDefaults]);

  // 기본 프리셋
  const defaultPreset: HomeworkPreset = useMemo(() => ({
    id: "__default__",
    name: "기본 숙제 설정",
    createdAt: "2024-01-01T00:00:00.000Z",
    homework: (runtimeDefaults?.homework ?? DEFAULT_HOMEWORK).map((hw) => ({
      title: hw.title,
      reward: hw.reward,
      period: hw.period,
      totalCount: parseTotalCount(hw.title),
      scope: toScope(hw.scope),
    })),
    purchaseItems: (runtimeDefaults?.purchaseItems ?? DEFAULT_PURCHASE_ITEMS).map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      period: item.period,
      scope: toScope(item.scope),
    })),
    tradeItems: (runtimeDefaults?.tradeItems ?? DEFAULT_TRADE_ITEMS).map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      period: item.period,
      scope: toScope(item.scope),
    })),
  }), [runtimeDefaults]);

  // ── 프리셋 저장 ──
  const savePreset = useCallback(
    (name: string) => {
      if (!selectedCharId || !data) return;
      const hw = data.homework[selectedCharId] ?? [];
      const pur = data.purchaseItems[selectedCharId] ?? [];
      const trd = data.tradeItems[selectedCharId] ?? [];
      const preset: HomeworkPreset = {
        id: `preset_${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        homework: hw.map(({ id, completedCount, isFavorite, ...rest }) => rest),
        purchaseItems: pur.map(({ id, completed, isFavorite, ...rest }) => rest),
        tradeItems: trd.map(({ id, completed, isFavorite, ...rest }) => rest),
      };
      persist((prev) => ({
        ...prev,
        presets: [...(prev.presets ?? []), preset],
      }));
    },
    [persist, selectedCharId, data]
  );

  // ── 프리셋 불러오기 ──
  const loadPreset = useCallback(
    (presetId: string) => {
      if (!selectedCharId || !data) return;
      // defaultPreset(__default__)은 data.presets에 없으므로 별도 처리
      let preset: HomeworkPreset | undefined;
      if (presetId === "__default__") {
        preset = defaultPreset;
      } else {
        preset = (data.presets ?? []).find((p) => p.id === presetId);
      }
      if (!preset) return;
      persist((prev) => {
        // 1. 현재 상태를 savedItemStates에 저장 (기존 저장분과 병합)
        const prevHw = prev.homework[selectedCharId] ?? [];
        const prevPur = prev.purchaseItems[selectedCharId] ?? [];
        const prevTrd = prev.tradeItems[selectedCharId] ?? [];

        const savedStates = { ...(prev.savedItemStates ?? {}) };
        const charStates = savedStates[selectedCharId] ?? { homework: {}, purchase: {}, trade: {} };

        // 기존 저장분과 현재 상태 병합 (현재가 우선)
        const mergedHw = { ...charStates.homework };
        for (const h of prevHw) { mergedHw[h.title] = { completedCount: h.completedCount, isFavorite: h.isFavorite }; }
        const mergedPur = { ...charStates.purchase };
        for (const p of prevPur) { mergedPur[p.itemName] = { completed: p.completed, isFavorite: p.isFavorite }; }
        const mergedTrd = { ...charStates.trade };
        for (const t of prevTrd) { mergedTrd[t.itemName] = { completed: t.completed, isFavorite: t.isFavorite }; }

        savedStates[selectedCharId] = { homework: mergedHw, purchase: mergedPur, trade: mergedTrd };

        // 2. 프리셋 아이템 생성 + 저장된 상태 복원
        return {
          ...prev,
          savedItemStates: savedStates,
          homework: {
            ...prev.homework,
            [selectedCharId]: preset!.homework.map((hw, i) => {
              const saved = mergedHw[hw.title];
              return {
                ...hw,
                id: `${selectedCharId}_hw_${i}`,
                completedCount: saved?.completedCount ?? 0,
                isFavorite: saved?.isFavorite ?? false,
                totalCount: hw.totalCount || parseTotalCount(hw.title),
              };
            }),
          },
          purchaseItems: {
            ...prev.purchaseItems,
            [selectedCharId]: preset!.purchaseItems.map((item, i) => {
              const saved = mergedPur[item.itemName];
              return {
                ...item,
                id: `${selectedCharId}_pur_${i}`,
                completed: saved?.completed ?? false,
                isFavorite: saved?.isFavorite ?? false,
              };
            }),
          },
          tradeItems: {
            ...prev.tradeItems,
            [selectedCharId]: preset!.tradeItems.map((item, i) => {
              const saved = mergedTrd[item.itemName];
              return {
                ...item,
                id: `${selectedCharId}_trd_${i}`,
                completed: saved?.completed ?? false,
                isFavorite: saved?.isFavorite ?? false,
              };
            }),
          },
        };
      });
    },
    [persist, selectedCharId, data, defaultPreset]
  );

  // ── 프리셋 삭제 ──
  const deletePreset = useCallback(
    (presetId: string) => {
      if (presetId === "__default__") return; // 기본 프리셋 삭제 방지
      persist((prev) => ({
        ...prev,
        presets: (prev.presets ?? []).filter((p) => p.id !== presetId),
      }));
    },
    [persist]
  );

  // ── 프리셋 내보내기 (현재 캐릭터의 설정을 HomeworkPreset 형태로 반환) ──
  const exportCurrentPreset = useCallback((): HomeworkPreset | null => {
    if (!selectedCharId || !data) return null;
    const hw = data.homework[selectedCharId] ?? [];
    const pur = data.purchaseItems[selectedCharId] ?? [];
    const trd = data.tradeItems[selectedCharId] ?? [];
    const char = data.characters.find((c) => c.id === selectedCharId);
    return {
      id: `preset_export_${Date.now()}`,
      name: char ? `${char.name}의 설정` : "내보낸 설정",
      createdAt: new Date().toISOString(),
      homework: hw.map(({ id, completedCount, isFavorite, ...rest }) => rest),
      purchaseItems: pur.map(({ id, completed, isFavorite, ...rest }) => rest),
      tradeItems: trd.map(({ id, completed, isFavorite, ...rest }) => rest),
    };
  }, [selectedCharId, data]);

  // ── 프리셋 가져오기 (외부 JSON에서 불러온 프리셋 적용) ──
  // loadPreset과 동일하게 현재 상태를 savedItemStates에 저장 후, 매칭되는 항목 복원
  const importPreset = useCallback(
    (preset: HomeworkPreset) => {
      if (!selectedCharId) return;
      persist((prev) => {
        // 1. 현재 상태를 savedItemStates에 저장 (기존 저장분과 병합)
        const prevHw = prev.homework[selectedCharId] ?? [];
        const prevPur = prev.purchaseItems[selectedCharId] ?? [];
        const prevTrd = prev.tradeItems[selectedCharId] ?? [];

        const savedStates = { ...(prev.savedItemStates ?? {}) };
        const charStates = savedStates[selectedCharId] ?? { homework: {}, purchase: {}, trade: {} };

        const mergedHw = { ...charStates.homework };
        for (const h of prevHw) { mergedHw[h.title] = { completedCount: h.completedCount, isFavorite: h.isFavorite }; }
        const mergedPur = { ...charStates.purchase };
        for (const p of prevPur) { mergedPur[p.itemName] = { completed: p.completed, isFavorite: p.isFavorite }; }
        const mergedTrd = { ...charStates.trade };
        for (const t of prevTrd) { mergedTrd[t.itemName] = { completed: t.completed, isFavorite: t.isFavorite }; }

        savedStates[selectedCharId] = { homework: mergedHw, purchase: mergedPur, trade: mergedTrd };

        // 2. 프리셋 아이템 생성 + savedItemStates에서 매칭되는 상태 복원
        return {
          ...prev,
          savedItemStates: savedStates,
          homework: {
            ...prev.homework,
            [selectedCharId]: preset.homework.map((hw, i) => {
              const saved = mergedHw[hw.title];
              return {
                ...hw,
                id: `${selectedCharId}_hw_${i}`,
                completedCount: saved?.completedCount ?? 0,
                isFavorite: saved?.isFavorite ?? false,
                totalCount: hw.totalCount || parseTotalCount(hw.title),
              };
            }),
          },
          purchaseItems: {
            ...prev.purchaseItems,
            [selectedCharId]: preset.purchaseItems.map((item, i) => {
              const saved = mergedPur[item.itemName];
              return {
                ...item,
                id: `${selectedCharId}_pur_${i}`,
                completed: saved?.completed ?? false,
                isFavorite: saved?.isFavorite ?? false,
              };
            }),
          },
          tradeItems: {
            ...prev.tradeItems,
            [selectedCharId]: preset.tradeItems.map((item, i) => {
              const saved = mergedTrd[item.itemName];
              return {
                ...item,
                id: `${selectedCharId}_trd_${i}`,
                completed: saved?.completed ?? false,
                isFavorite: saved?.isFavorite ?? false,
              };
            }),
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  // (defaultPreset은 위에서 정의됨)

  const presets = useMemo(() => [defaultPreset, ...(data?.presets ?? [])], [data, defaultPreset]);

  // ── 파생 데이터 ──
  const characters = data?.characters ?? [];

  const activeServers = useMemo(() => {
    const charServers = new Set<ServerName>();
    characters.forEach((c) => charServers.add(c.server));
    return SERVERS.filter((s) => charServers.has(s));
  }, [characters]);

  const serverChars = useMemo(
    () => characters.filter((c) => c.server === selectedServer),
    [characters, selectedServer]
  );

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? null;

  const handleServerChange = useCallback(
    (server: ServerName) => {
      setSelectedServer(server);
      const first = characters.find((c) => c.server === server);
      if (first) setSelectedCharId(first.id);
    },
    [characters]
  );

  const allHomework = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.homework[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const currentHomework = useMemo(() => {
    let list = allHomework;
    if (activeTab === "daily") {
      list = list.filter((hw) => hw.period === "daily");
    } else if (activeTab === "weekly") {
      list = list.filter((hw) => hw.period === "weekly");
    } else if (activeTab !== "all") {
      return [];
    }
    if (favoriteOnly) {
      list = list.filter((hw) => hw.isFavorite);
    }
    if (periodFilter !== "all") {
      list = list.filter((hw) => hw.period === periodFilter);
    }
    if (scopeFilter !== "all") {
      list = list.filter((hw) => (hw.scope || "character") === scopeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((hw) => hw.title.toLowerCase().includes(q) || hw.reward.toLowerCase().includes(q));
    }
    return list;
  }, [allHomework, activeTab, favoriteOnly, periodFilter, scopeFilter, searchQuery]);

  const allPurchaseItems = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.purchaseItems[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const allTradeItems = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.tradeItems[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const allTabOrder = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.allTabOrder?.[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const currentShopItems = useMemo((): ShopItem[] => {
    let items: ShopItem[] = [];
    if (activeTab === "purchase") items = allPurchaseItems;
    else if (activeTab === "trade") items = allTradeItems;
    else return [];
    if (favoriteOnly) items = items.filter((item) => item.isFavorite);
    if (periodFilter !== "all") items = items.filter((item) => (item.period ?? "daily") === periodFilter);
    if (scopeFilter !== "all") items = items.filter((item) => (item.scope || "character") === scopeFilter);
    if (regionFilter.length > 0) items = items.filter((item) => regionFilter.includes(item.region));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => item.itemName.toLowerCase().includes(q) || item.npcName.toLowerCase().includes(q));
    }
    return items;
  }, [allPurchaseItems, allTradeItems, activeTab, favoriteOnly, periodFilter, scopeFilter, regionFilter, searchQuery]);

  const progress = useMemo(() => {
    const hwSource = favoriteOnly ? allHomework.filter((hw) => hw.isFavorite) : allHomework;
    const purSource = favoriteOnly ? allPurchaseItems.filter((i) => i.isFavorite) : allPurchaseItems;
    const trdSource = favoriteOnly ? allTradeItems.filter((i) => i.isFavorite) : allTradeItems;
    const scrSource = favoriteOnly ? allScrollItems.filter((i) => i.isFavorite) : allScrollItems;

    const dailyHw = hwSource.filter((hw) => hw.period === "daily");
    const weeklyHw = hwSource.filter((hw) => hw.period === "weekly");
    const countTotal = <T extends { totalCount: number }>(items: T[]) =>
      favoriteOnly ? items.length : items.reduce((sum, item) => sum + item.totalCount, 0);
    const countDone = <T extends { completedCount: number; totalCount: number }>(items: T[]) =>
      favoriteOnly
        ? items.filter((item) => item.completedCount >= item.totalCount).length
        : items.reduce((sum, item) => sum + item.completedCount, 0);

    const dailyTotal = countTotal(dailyHw);
    const dailyDone = countDone(dailyHw);
    const weeklyTotal = countTotal(weeklyHw);
    const weeklyDone = countDone(weeklyHw);
    const purTotal = purSource.length;
    const purDone = purSource.filter((i) => i.completed).length;
    const trdTotal = trdSource.length;
    const trdDone = trdSource.filter((i) => i.completed).length;
    const scrTotal = countTotal(scrSource);
    const scrDone = countDone(scrSource);

    const total = dailyTotal + weeklyTotal + purTotal + trdTotal + scrTotal;
    const done = dailyDone + weeklyDone + purDone + trdDone + scrDone;

    const makePct = (d: number, t: number) => t > 0 ? Math.round((d / t) * 100) : 0;

    return {
      total,
      done,
      pct: makePct(done, total),
      categories: [
        { label: "일일 숙제", done: dailyDone, total: dailyTotal, pct: makePct(dailyDone, dailyTotal), color: "bg-orange-500" },
        { label: "주간 숙제", done: weeklyDone, total: weeklyTotal, pct: makePct(weeklyDone, weeklyTotal), color: "bg-green-500" },
        { label: "구매", done: purDone, total: purTotal, pct: makePct(purDone, purTotal), color: "bg-purple-500" },
        { label: "물물교환", done: trdDone, total: trdTotal, pct: makePct(trdDone, trdTotal), color: "bg-pink-500" },
        { label: "임무게시판", done: scrDone, total: scrTotal, pct: makePct(scrDone, scrTotal), color: "bg-yellow-500" },
      ].filter((c) => c.total > 0),
    };
  }, [allHomework, allPurchaseItems, allTradeItems, allScrollItems, favoriteOnly]);

  const serverCharCount = useCallback(
    (server: ServerName): number => characters.filter((c) => c.server === server).length,
    [characters]
  );

  const canAddToServer = useCallback(
    (server: ServerName): boolean => serverCharCount(server) < MAX_CHARS_PER_SERVER,
    [serverCharCount]
  );

  // ── 멤버십 ──
  const updateMembership = useCallback(
    (server: ServerName, info: MembershipInfo | null) => {
      persist((prev) => {
        const membership = { ...(prev.membership ?? {}) } as Record<ServerName, MembershipInfo>;
        if (info) {
          membership[server] = info;
        } else {
          delete membership[server];
        }
        return { ...prev, membership };
      });
    },
    [persist]
  );

  // ── 메모 ──
  const saveMemo = useCallback(
    (memo: string) => {
      persist((prev) => ({ ...prev, memo }));
    },
    [persist]
  );

  return {
    isLoaded: data !== null,
    activeServers,
    selectedServer,
    setSelectedServer: handleServerChange,
    characters,
    serverChars,
    selectedChar,
    selectedCharId,
    setSelectedCharId,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    serverCharCount,
    canAddToServer,
    activeTab,
    setActiveTab,
    currentHomework,
    toggleHomework,
    toggleHomeworkForChar,
    toggleFavorite,
    updateHomework,
    favoriteOnly,
    setFavoriteOnly,
    searchQuery,
    setSearchQuery,
    regionFilter,
    setRegionFilter,
    periodFilter,
    setPeriodFilter,
    scopeFilter,
    setScopeFilter,
    scrollTypeFilter,
    setScrollTypeFilter,
    progress,
    allPurchaseItems,
    allTradeItems,
    allTabOrder,
    currentShopItems,
    toggleShopItem,
    toggleShopItemForChar,
    toggleShopFavorite,
    updateShopItem,
    resetHomework,
    savePreset,
    loadPreset,
    deletePreset,
    presets,
    deleteHomework,
    addHomework,
    deleteShopItem,
    addShopItem,
    reorderHomework,
    reorderShopItem,
    reorderCharacters,
    allHomework,
    homeworkByChar: data?.homework ?? {},
    allScrollItems,
    purchaseItemsByChar: data?.purchaseItems ?? {},
    tradeItemsByChar: data?.tradeItems ?? {},
    scrollItemsByChar: data?.scrollItems ?? {},
    currentScrollItems,
    addScrollItem,
    toggleScrollItem,
    toggleScrollItemForChar,
    toggleScrollFavorite,
    updateScrollItem,
    deleteScrollItem,
    reorderScrollItem,
    reorderAllTabItem,
    exportCurrentPreset,
    importPreset,
    // 멤버십
    membership: data?.membership,
    updateMembership,
    // 메모
    memo: data?.memo ?? "",
    saveMemo,
  };
}
