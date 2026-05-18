"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyResets, createHomeworkForChar, createPurchaseForChar, createTradeForChar, loadData, saveData } from "@/lib/storage";
import { loadUserData, saveUserData } from "@/lib/firestore";
import type { AppData, Character, HomeworkItem, HomeworkPreset, ServerName, ShopItem, ScrollItem, TabType, PeriodType, ScopeType, RegionName, ScrollType } from "@/types";
import { DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, MAX_CHARS_PER_SERVER, SERVERS, parseTotalCount, toScope } from "@/types";

export function useAppState(uid?: string | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerName | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 로드: Firestore 우선, 없으면 localStorage
  useEffect(() => {
    let cancelled = false;
    async function init() {
      let loaded: AppData;

      if (uid) {
        // Firestore에서 로드 시도
        const cloudData = await loadUserData(uid);
        if (cloudData) {
          loaded = applyResets(cloudData);
        } else {
          // Firestore에 없으면 localStorage 데이터를 마이그레이션
          const localData = loadData();
          loaded = applyResets(localData);
          // 클라우드에 초기 저장
          await saveUserData(uid, loaded);
        }
      } else {
        loaded = applyResets(loadData());
      }

      if (cancelled) return;
      setData(loaded);
      if (loaded.characters.length > 0) {
        const first = loaded.characters[0];
        setSelectedServer(first.server);
        setSelectedCharId(first.id);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [uid]);

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
      persist((prev) => ({
        ...prev,
        characters: [...prev.characters, newChar],
        homework: { ...prev.homework, [id]: createHomeworkForChar(id) },
        purchaseItems: { ...prev.purchaseItems, [id]: createPurchaseForChar(id) },
        tradeItems: { ...prev.tradeItems, [id]: createTradeForChar(id) },
      }));
      setSelectedServer(char.server);
      setSelectedCharId(id);
    },
    [persist]
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
        delete hw[charId];
        delete pur[charId];
        delete trd[charId];
        return { ...prev, characters: chars, homework: hw, purchaseItems: pur, tradeItems: trd };
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

  const toggleFavorite = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => ({
        ...prev,
        homework: {
          ...prev.homework,
          [selectedCharId]: (prev.homework[selectedCharId] ?? []).map((hw) =>
            hw.id === hwId ? { ...hw, isFavorite: !hw.isFavorite } : hw
          ),
        },
      }));
    },
    [persist, selectedCharId]
  );

  // ── 숙제 수정 ──
  const updateHomework = useCallback(
    (hwId: string, updates: Partial<Pick<import("@/types").HomeworkItem, "title" | "reward" | "totalCount" | "scope">>) => {
      if (!selectedCharId) return;
      persist((prev) => ({
        ...prev,
        homework: {
          ...prev.homework,
          [selectedCharId]: (prev.homework[selectedCharId] ?? []).map((hw) => {
            if (hw.id !== hwId) return hw;
            const updated = { ...hw, ...updates };
            // totalCount가 줄었으면 completedCount도 맞춤
            if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
              updated.completedCount = updates.totalCount;
            }
            return updated;
          }),
        },
      }));
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

  const toggleShopFavorite = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [selectedCharId]: (prev[key][selectedCharId] ?? []).map((item) =>
            item.id === itemId ? { ...item, isFavorite: !item.isFavorite } : item
          ),
        },
      }));
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 수정 ──
  const updateShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade", updates: Partial<Pick<import("@/types").ShopItem, "itemName" | "region" | "npcName" | "scope">>) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [selectedCharId]: (prev[key][selectedCharId] ?? []).map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        },
      }));
    },
    [persist, selectedCharId]
  );

  // ── 숙제 삭제 ──
  const deleteHomework = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => ({
        ...prev,
        homework: {
          ...prev.homework,
          [selectedCharId]: (prev.homework[selectedCharId] ?? []).filter((hw) => hw.id !== hwId),
        },
      }));
    },
    [persist, selectedCharId]
  );

  // ── 숙제 추가 ──
  const addHomework = useCallback(
    (hw: { title: string; reward: string; period: PeriodType; totalCount: number; scope: ScopeType }) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const list = prev.homework[selectedCharId] ?? [];
        const newItem: HomeworkItem = {
          id: `${selectedCharId}_hw_${Date.now()}`,
          title: hw.title,
          reward: hw.reward,
          period: hw.period,
          totalCount: hw.totalCount,
          completedCount: 0,
          isFavorite: false,
          scope: hw.scope,
        };
        // 같은 period의 마지막에 추가
        const lastIndex = list.reduce((acc, item, i) => (item.period === hw.period ? i : acc), -1);
        const newList = [...list];
        newList.splice(lastIndex + 1, 0, newItem);
        return { ...prev, homework: { ...prev.homework, [selectedCharId]: newList } };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 삭제 ──
  const deleteShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [selectedCharId]: (prev[key][selectedCharId] ?? []).filter((item) => item.id !== itemId),
        },
      }));
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 추가 ──
  const addShopItem = useCallback(
    (type: "purchase" | "trade", item: { itemName: string; region: RegionName; npcName: string; scope: ScopeType }) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      const prefix = type === "purchase" ? "pur" : "trd";
      persist((prev) => {
        const list = prev[key][selectedCharId] ?? [];
        const newItem: ShopItem = {
          id: `${selectedCharId}_${prefix}_${Date.now()}`,
          itemName: item.itemName,
          region: item.region,
          npcName: item.npcName,
          completed: false,
          isFavorite: false,
          scope: item.scope,
        };
        return { ...prev, [key]: { ...prev[key], [selectedCharId]: [...list, newItem] } };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 순서 변경 ──
  const reorderHomework = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const list = [...(prev.homework[selectedCharId] ?? [])];
        const [moved] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, moved);
        return { ...prev, homework: { ...prev.homework, [selectedCharId]: list } };
      });
    },
    [persist, selectedCharId]
  );

  // ── 구매/물물교환 순서 변경 ──
  const reorderShopItem = useCallback(
    (type: "purchase" | "trade", oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        const list = [...(prev[key][selectedCharId] ?? [])];
        const [moved] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, moved);
        return { ...prev, [key]: { ...prev[key], [selectedCharId]: list } };
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
    return items;
  }, [allScrollItems, favoriteOnly]);

  const addScrollItem = useCallback(
    (item: { title: string; scrollType: ScrollType; totalCount: number; materials: string[] }) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        const list = scrollItems[selectedCharId] ?? [];
        const newItem: ScrollItem = {
          id: `${selectedCharId}_scroll_${Date.now()}`,
          title: item.title,
          scrollType: item.scrollType,
          totalCount: item.totalCount,
          completedCount: 0,
          isFavorite: false,
          scope: "character",
          materials: item.materials,
        };
        return { ...prev, scrollItems: { ...scrollItems, [selectedCharId]: [...list, newItem] } };
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

  const toggleScrollFavorite = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        return {
          ...prev,
          scrollItems: {
            ...scrollItems,
            [selectedCharId]: (scrollItems[selectedCharId] ?? []).map((s) =>
              s.id === itemId ? { ...s, isFavorite: !s.isFavorite } : s
            ),
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  const updateScrollItem = useCallback(
    (itemId: string, updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "totalCount" | "materials" | "tags">>) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        return {
          ...prev,
          scrollItems: {
            ...scrollItems,
            [selectedCharId]: (scrollItems[selectedCharId] ?? []).map((s) => {
              if (s.id !== itemId) return s;
              const updated = { ...s, ...updates };
              if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
                updated.completedCount = updates.totalCount;
              }
              return updated;
            }),
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  const deleteScrollItem = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        return {
          ...prev,
          scrollItems: {
            ...scrollItems,
            [selectedCharId]: (scrollItems[selectedCharId] ?? []).filter((s) => s.id !== itemId),
          },
        };
      });
    },
    [persist, selectedCharId]
  );

  const reorderScrollItem = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        const scrollItems = prev.scrollItems ?? {};
        const list = [...(scrollItems[selectedCharId] ?? [])];
        const [moved] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, moved);
        return { ...prev, scrollItems: { ...scrollItems, [selectedCharId]: list } };
      });
    },
    [persist, selectedCharId]
  );

  // ── 숙제 초기화 (기본 세팅으로) ──
  const resetHomework = useCallback(() => {
    if (!selectedCharId) return;
    persist((prev) => ({
      ...prev,
      homework: { ...prev.homework, [selectedCharId]: createHomeworkForChar(selectedCharId) },
      purchaseItems: { ...prev.purchaseItems, [selectedCharId]: createPurchaseForChar(selectedCharId) },
      tradeItems: { ...prev.tradeItems, [selectedCharId]: createTradeForChar(selectedCharId) },
    }));
  }, [persist, selectedCharId]);

  // 기본 프리셋
  const defaultPreset: HomeworkPreset = useMemo(() => ({
    id: "__default__",
    name: "기본 숙제 설정",
    createdAt: "2024-01-01T00:00:00.000Z",
    homework: DEFAULT_HOMEWORK.map((hw) => ({
      title: hw.title,
      reward: hw.reward,
      period: hw.period,
      totalCount: parseTotalCount(hw.title),
      isFavorite: false,
      scope: toScope(hw.scope),
    })),
    purchaseItems: DEFAULT_PURCHASE_ITEMS.map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      isFavorite: false,
      scope: toScope(item.scope),
    })),
    tradeItems: DEFAULT_TRADE_ITEMS.map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      isFavorite: false,
      scope: toScope(item.scope),
    })),
  }), []);

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
        homework: hw.map(({ id, completedCount, ...rest }) => rest),
        purchaseItems: pur.map(({ id, completed, ...rest }) => rest),
        tradeItems: trd.map(({ id, completed, ...rest }) => rest),
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
      persist((prev) => ({
        ...prev,
        homework: {
          ...prev.homework,
          [selectedCharId]: preset!.homework.map((hw, i) => ({
            ...hw,
            id: `${selectedCharId}_hw_${i}`,
            completedCount: 0,
            totalCount: hw.totalCount || parseTotalCount(hw.title),
          })),
        },
        purchaseItems: {
          ...prev.purchaseItems,
          [selectedCharId]: preset!.purchaseItems.map((item, i) => ({
            ...item,
            id: `${selectedCharId}_pur_${i}`,
            completed: false,
          })),
        },
        tradeItems: {
          ...prev.tradeItems,
          [selectedCharId]: preset!.tradeItems.map((item, i) => ({
            ...item,
            id: `${selectedCharId}_trd_${i}`,
            completed: false,
          })),
        },
      }));
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
    return list;
  }, [allHomework, activeTab, favoriteOnly]);

  const allPurchaseItems = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.purchaseItems[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const allTradeItems = useMemo(() => {
    if (!data || !selectedCharId) return [];
    return data.tradeItems[selectedCharId] ?? [];
  }, [data, selectedCharId]);

  const currentShopItems = useMemo((): ShopItem[] => {
    let items: ShopItem[] = [];
    if (activeTab === "purchase") items = allPurchaseItems;
    else if (activeTab === "trade") items = allTradeItems;
    else return [];
    if (favoriteOnly) items = items.filter((item) => item.isFavorite);
    return items;
  }, [allPurchaseItems, allTradeItems, activeTab, favoriteOnly]);

  const progress = useMemo(() => {
    const hwSource = favoriteOnly ? allHomework.filter((hw) => hw.isFavorite) : allHomework;
    const purSource = favoriteOnly ? allPurchaseItems.filter((i) => i.isFavorite) : allPurchaseItems;
    const trdSource = favoriteOnly ? allTradeItems.filter((i) => i.isFavorite) : allTradeItems;
    const scrSource = favoriteOnly ? allScrollItems.filter((i) => i.isFavorite) : allScrollItems;

    const dailyHw = hwSource.filter((hw) => hw.period === "daily");
    const weeklyHw = hwSource.filter((hw) => hw.period === "weekly");

    const dailyTotal = dailyHw.reduce((sum, hw) => sum + hw.totalCount, 0);
    const dailyDone = dailyHw.reduce((sum, hw) => sum + hw.completedCount, 0);
    const weeklyTotal = weeklyHw.reduce((sum, hw) => sum + hw.totalCount, 0);
    const weeklyDone = weeklyHw.reduce((sum, hw) => sum + hw.completedCount, 0);
    const purTotal = purSource.length;
    const purDone = purSource.filter((i) => i.completed).length;
    const trdTotal = trdSource.length;
    const trdDone = trdSource.filter((i) => i.completed).length;
    const scrTotal = scrSource.reduce((sum, s) => sum + s.totalCount, 0);
    const scrDone = scrSource.reduce((sum, s) => sum + s.completedCount, 0);

    const total = dailyTotal + weeklyTotal + purTotal + trdTotal + scrTotal;
    const done = dailyDone + weeklyDone + purDone + trdDone + scrDone;

    const makePct = (d: number, t: number) => t > 0 ? Math.round((d / t) * 100) : 0;

    return {
      total,
      done,
      pct: makePct(done, total),
      categories: [
        { label: "일일 숙제", done: dailyDone, total: dailyTotal, pct: makePct(dailyDone, dailyTotal), color: "bg-blue-500" },
        { label: "주간 숙제", done: weeklyDone, total: weeklyTotal, pct: makePct(weeklyDone, weeklyTotal), color: "bg-purple-500" },
        { label: "구매", done: purDone, total: purTotal, pct: makePct(purDone, purTotal), color: "bg-green-500" },
        { label: "물물교환", done: trdDone, total: trdTotal, pct: makePct(trdDone, trdTotal), color: "bg-orange-500" },
        { label: "임무게시판", done: scrDone, total: scrTotal, pct: makePct(scrDone, scrTotal), color: "bg-indigo-500" },
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
    toggleFavorite,
    updateHomework,
    favoriteOnly,
    setFavoriteOnly,
    progress,
    allPurchaseItems,
    allTradeItems,
    currentShopItems,
    toggleShopItem,
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
    allScrollItems,
    currentScrollItems,
    addScrollItem,
    toggleScrollItem,
    toggleScrollFavorite,
    updateScrollItem,
    deleteScrollItem,
    reorderScrollItem,
  };
}
