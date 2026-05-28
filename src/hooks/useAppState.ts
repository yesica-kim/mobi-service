"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyResets, createScrollForChar, getNextDailyResetMs, getNextWeeklyResetMs, loadData, saveData } from "@/lib/storage";
import { loadUserBackups, loadUserData, saveUserData, subscribeUserData } from "@/lib/firestore";
import { loadRuntimeDefaultCards, subscribeRuntimeDefaultCards } from "@/lib/defaultCards";
import type { DefaultCardsData } from "@/lib/adminFirestore";
import type { AppData, AutoBackupSnapshot, Character, HomeworkItem, HomeworkPreset, MembershipInfo, ServerName, ShopItem, ScrollItem, TabType, PeriodType, ScopeType, RegionName, ScrollType} from "@/types";
import { DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, DEFAULT_SCROLL_ITEMS, MAX_CHARS_PER_SERVER, SERVERS, parseTotalCount, toScope } from "@/types";

function cloneHomeworkForChar(charId: string, item: HomeworkItem, index: number): HomeworkItem {
  return {
    ...item,
    id: `${charId}_hw_clone_${Date.now()}_${index}`,
    completedCount: 0,
    isFavorite: item.isFavorite ?? false,
  };
}

function cloneShopForChar(charId: string, item: ShopItem, prefix: "pur" | "trd", index: number): ShopItem {
  return {
    ...item,
    id: `${charId}_${prefix}_clone_${Date.now()}_${index}`,
    completed: false,
    isFavorite: item.isFavorite ?? false,
  };
}

function cloneScrollForChar(charId: string, item: ScrollItem, index: number): ScrollItem {
  return {
    ...item,
    id: `${charId}_scroll_clone_${Date.now()}_${index}`,
    completedCount: 0,
    isFavorite: item.isFavorite ?? false,
  };
}

function pickTemplateList<T>(records: Record<string, T[]>, charIds: string[]): T[] {
  return charIds.reduce<T[]>((template, charId) => {
    const list = records[charId] ?? [];
    return list.length > template.length ? list : template;
  }, []);
}

function shouldLogLoadPerformance(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("-git-dev-");
}

function createLoadPerformanceLogger(label: string) {
  if (!shouldLogLoadPerformance()) {
    return {
      mark: (_name: string) => {},
      finish: (_extra?: Record<string, unknown>) => {},
    };
  }

  const startedAt = performance.now();
  const marks: Record<string, number> = {};

  return {
    mark(name: string) {
      marks[name] = Math.round(performance.now() - startedAt);
    },
    finish(extra: Record<string, unknown> = {}) {
      const total = Math.round(performance.now() - startedAt);
      const metrics = {
        label,
        ...marks,
        total,
        ...extra,
      };
      (window as typeof window & { __mobimobiLoadMetrics?: unknown[] }).__mobimobiLoadMetrics = [
        ...(((window as typeof window & { __mobimobiLoadMetrics?: unknown[] }).__mobimobiLoadMetrics ?? [])),
        metrics,
      ];
      console.log("[mobimobi-load]", JSON.stringify(metrics));
    },
  };
}

function markDeletedDefault(prev: AppData, type: "homework" | "purchase" | "trade" | "scroll", key?: string): AppData["deletedDefaultItems"] {
  if (!key) return prev.deletedDefaultItems;
  const deletedDefaultItems = { ...(prev.deletedDefaultItems ?? {}) };
  const existing = new Set(deletedDefaultItems[type] ?? []);
  existing.add(key);
  deletedDefaultItems[type] = Array.from(existing);
  return deletedDefaultItems;
}

function getIndexedDefaultKey<T>(id: string, prefix: string, defaults: T[], getKey: (item: T) => string): string | undefined {
  const match = id.match(new RegExp(`_${prefix}_(\\d+)(?:$|_)`));
  if (!match) return undefined;
  const index = Number(match[1]);
  return Number.isInteger(index) ? defaults[index] ? getKey(defaults[index]) : undefined : undefined;
}

function getHomeworkDefaultDeleteKey(item: HomeworkItem, defaultCards?: DefaultCardsData | null): string | undefined {
  const defaults = defaultCards?.homework ?? (DEFAULT_HOMEWORK as DefaultCardsData["homework"]);
  const matched = defaults.find((defaultItem) => defaultItem.defaultId === item.defaultKey || defaultItem.title === item.title || defaultItem.title === item.defaultKey);
  if (matched) return matched.defaultId ?? matched.title;
  if (item.defaultKey) return item.defaultKey;
  const indexed = getIndexedDefaultKey(item.id, "hw", defaults, (defaultItem) => defaultItem.defaultId ?? defaultItem.title);
  return indexed ?? (item.isDefault ? item.title : undefined);
}

function getShopDefaultDeleteKey(item: ShopItem, type: "purchase" | "trade", defaultCards?: DefaultCardsData | null): string | undefined {
  const defaults = type === "purchase"
    ? defaultCards?.purchaseItems ?? (DEFAULT_PURCHASE_ITEMS as DefaultCardsData["purchaseItems"])
    : defaultCards?.tradeItems ?? (DEFAULT_TRADE_ITEMS as DefaultCardsData["tradeItems"]);
  const prefix = type === "purchase" ? "pur" : "trd";
  const matched = defaults.find((defaultItem) => defaultItem.defaultId === item.defaultKey || defaultItem.itemName === item.itemName || defaultItem.itemName === item.defaultKey);
  if (matched) return matched.defaultId ?? matched.itemName;
  if (item.defaultKey) return item.defaultKey;
  const indexed = getIndexedDefaultKey(item.id, prefix, defaults, (defaultItem) => defaultItem.defaultId ?? defaultItem.itemName);
  return indexed ?? (item.isDefault ? item.itemName : undefined);
}

function getScrollDefaultDeleteKey(item: ScrollItem, defaultCards?: DefaultCardsData | null): string | undefined {
  const defaults = defaultCards?.scrollItems ?? (DEFAULT_SCROLL_ITEMS as DefaultCardsData["scrollItems"]);
  const matched = defaults.find((defaultItem) => defaultItem.defaultId === item.defaultKey || defaultItem.title === item.title || defaultItem.title === item.defaultKey);
  if (matched) return matched.defaultId ?? matched.title;
  if (item.defaultKey) return item.defaultKey;
  const indexed = getIndexedDefaultKey(item.id, "scroll", defaults, (defaultItem) => defaultItem.defaultId ?? defaultItem.title);
  return indexed ?? (item.isDefault ? item.title : undefined);
}

function getHomeworkSyncKey(item: HomeworkItem): string {
  return item.defaultKey
    ? `default|${item.defaultKey}`
    : `custom|${item.period}|${item.scope ?? "character"}|${item.title}|${item.reward}`;
}

function getShopSyncKey(item: ShopItem): string {
  return item.defaultKey
    ? `default|${item.defaultKey}`
    : `custom|${item.period}|${item.scope ?? "character"}|${item.region}|${item.npcName}|${item.itemName}`;
}

function getScrollSyncKey(item: ScrollItem): string {
  return item.defaultKey
    ? `default|${item.defaultKey}`
    : `custom|${item.period}|${item.scope ?? "character"}|${item.region}|${item.scrollType}|${item.title}|${item.reward}`;
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

function normalizeFavoritesByIndex<T extends { isFavorite: boolean }>(
  records: Record<string, T[]>,
  charIds: string[]
): { records: Record<string, T[]>; changed: boolean } {
  const maxLength = Math.max(0, ...charIds.map((charId) => (records[charId] ?? []).length));
  if (maxLength === 0) return { records, changed: false };

  const sharedFavorites = Array.from({ length: maxLength }, (_, index) =>
    charIds.some((charId) => Boolean((records[charId] ?? [])[index]?.isFavorite))
  );

  let changed = false;
  const normalized: Record<string, T[]> = { ...records };

  for (const charId of charIds) {
    const list = records[charId] ?? [];
    normalized[charId] = list.map((item, index) => {
      const isFavorite = sharedFavorites[index] ?? false;
      if (item.isFavorite === isFavorite) return item;
      changed = true;
      return { ...item, isFavorite };
    });
  }

  return { records: normalized, changed };
}

function normalizeCharacterCardLists(data: AppData): { data: AppData; changed: boolean } {
  const charIds = data.characters.map((char) => char.id);
  if (charIds.length === 0) return { data, changed: false };

  const homework = normalizeRecordByTemplate(
    data.homework,
    charIds,
    getHomeworkSyncKey,
    cloneHomeworkForChar
  );
  const purchaseItems = normalizeRecordByTemplate(
    data.purchaseItems,
    charIds,
    getShopSyncKey,
    (charId, item, index) => cloneShopForChar(charId, item, "pur", index)
  );
  const tradeItems = normalizeRecordByTemplate(
    data.tradeItems,
    charIds,
    getShopSyncKey,
    (charId, item, index) => cloneShopForChar(charId, item, "trd", index)
  );
  const scrollItems = normalizeRecordByTemplate(
    data.scrollItems ?? {},
    charIds,
    getScrollSyncKey,
    cloneScrollForChar
  );

  const favoriteHomework = normalizeFavoritesByIndex(homework.records, charIds);
  const favoritePurchase = normalizeFavoritesByIndex(purchaseItems.records, charIds);
  const favoriteTrade = normalizeFavoritesByIndex(tradeItems.records, charIds);
  const favoriteScroll = normalizeFavoritesByIndex(scrollItems.records, charIds);

  const changed = homework.changed || purchaseItems.changed || tradeItems.changed || scrollItems.changed
    || favoriteHomework.changed || favoritePurchase.changed || favoriteTrade.changed || favoriteScroll.changed;
  if (!changed) return { data, changed: false };

  return {
    data: {
      ...data,
      homework: favoriteHomework.records,
      purchaseItems: favoritePurchase.records,
      tradeItems: favoriteTrade.records,
      scrollItems: favoriteScroll.records,
    },
    changed: true,
  };
}

function syncRecordFromTemplate<T>(
  records: Record<string, T[]>,
  charIds: string[],
  templateCharId: string,
  getKey: (item: T) => string,
  cloneItem: (charId: string, item: T, index: number) => T,
  mergeItem: (templateItem: T, existingItem: T, charId: string, index: number) => T
): Record<string, T[]> {
  const template = records[templateCharId] ?? pickTemplateList(records, charIds);
  if (template.length === 0) return records;

  const synced: Record<string, T[]> = { ...records };
  for (const charId of charIds) {
    if (charId === templateCharId) {
      synced[charId] = template;
      continue;
    }

    const current = records[charId] ?? [];
    const used = new Set<number>();
    synced[charId] = template.map((templateItem, index) => {
      const key = getKey(templateItem);
      const existingIndex = current.findIndex((item, itemIndex) => !used.has(itemIndex) && getKey(item) === key);
      if (existingIndex === -1) return cloneItem(charId, templateItem, index);
      used.add(existingIndex);
      return mergeItem(templateItem, current[existingIndex], charId, index);
    });
  }

  return synced;
}

function syncAllTabOrderFromTemplate(data: AppData, templateCharId: string): AppData["allTabOrder"] {
  const allTabOrder = { ...(data.allTabOrder ?? {}) };
  const templateOrder = (allTabOrder[templateCharId] ?? getAllTabIds(data, templateCharId)).filter((id) =>
    getAllTabIds(data, templateCharId).includes(id)
  );
  const templateLists = {
    homework: data.homework[templateCharId] ?? [],
    purchase: data.purchaseItems[templateCharId] ?? [],
    trade: data.tradeItems[templateCharId] ?? [],
    scroll: (data.scrollItems ?? {})[templateCharId] ?? [],
  };
  const descriptors = templateOrder.map((id) => {
    const homeworkIndex = templateLists.homework.findIndex((item) => item.id === id);
    if (homeworkIndex !== -1) return { type: "homework" as const, index: homeworkIndex };
    const purchaseIndex = templateLists.purchase.findIndex((item) => item.id === id);
    if (purchaseIndex !== -1) return { type: "purchase" as const, index: purchaseIndex };
    const tradeIndex = templateLists.trade.findIndex((item) => item.id === id);
    if (tradeIndex !== -1) return { type: "trade" as const, index: tradeIndex };
    const scrollIndex = templateLists.scroll.findIndex((item) => item.id === id);
    if (scrollIndex !== -1) return { type: "scroll" as const, index: scrollIndex };
    return null;
  }).filter((descriptor): descriptor is NonNullable<typeof descriptor> => descriptor !== null);

  for (const char of data.characters) {
    const targetLists = {
      homework: data.homework[char.id] ?? [],
      purchase: data.purchaseItems[char.id] ?? [],
      trade: data.tradeItems[char.id] ?? [],
      scroll: (data.scrollItems ?? {})[char.id] ?? [],
    };
    const orderedIds = descriptors
      .map((descriptor) => targetLists[descriptor.type][descriptor.index]?.id)
      .filter((id): id is string => Boolean(id));
    const targetIds = getAllTabIds(data, char.id);
    allTabOrder[char.id] = [
      ...orderedIds,
      ...targetIds.filter((id) => !orderedIds.includes(id)),
    ];
  }

  return allTabOrder;
}

function syncAllCardListsFromTemplate(data: AppData, templateCharId: string): AppData {
  const charIds = data.characters.map((char) => char.id);
  if (charIds.length === 0 || !charIds.includes(templateCharId)) return data;

  const homework = syncRecordFromTemplate(
    data.homework,
    charIds,
    templateCharId,
    getHomeworkSyncKey,
    cloneHomeworkForChar,
    (templateItem, existingItem) => ({
      ...templateItem,
      id: existingItem.id,
      completedCount: Math.min(existingItem.completedCount, templateItem.totalCount),
    })
  );
  const purchaseItems = syncRecordFromTemplate(
    data.purchaseItems,
    charIds,
    templateCharId,
    getShopSyncKey,
    (charId, item, index) => cloneShopForChar(charId, item, "pur", index),
    (templateItem, existingItem) => ({
      ...templateItem,
      id: existingItem.id,
      completed: existingItem.completed,
    })
  );
  const tradeItems = syncRecordFromTemplate(
    data.tradeItems,
    charIds,
    templateCharId,
    getShopSyncKey,
    (charId, item, index) => cloneShopForChar(charId, item, "trd", index),
    (templateItem, existingItem) => ({
      ...templateItem,
      id: existingItem.id,
      completed: existingItem.completed,
    })
  );
  const scrollItems = syncRecordFromTemplate(
    data.scrollItems ?? {},
    charIds,
    templateCharId,
    getScrollSyncKey,
    cloneScrollForChar,
    (templateItem, existingItem) => ({
      ...templateItem,
      id: existingItem.id,
      completedCount: Math.min(existingItem.completedCount, templateItem.totalCount),
    })
  );

  const next = {
    ...data,
    homework,
    purchaseItems,
    tradeItems,
    scrollItems,
  };
  return {
    ...next,
    allTabOrder: syncAllTabOrderFromTemplate(next, templateCharId),
  };
}

function getAllTabIds(data: AppData, charId: string): string[] {
  return [
    ...(data.homework[charId] ?? []).map((item) => item.id),
    ...(data.purchaseItems[charId] ?? []).map((item) => item.id),
    ...(data.tradeItems[charId] ?? []).map((item) => item.id),
    ...((data.scrollItems ?? {})[charId] ?? []).map((item) => item.id),
  ];
}

function hasStoredCards(data: AppData): boolean {
  const hasItems = (records: Record<string, unknown[]> | undefined) =>
    Object.values(records ?? {}).some((items) => items.length > 0);
  return hasItems(data.homework) || hasItems(data.purchaseItems) || hasItems(data.tradeItems) || hasItems(data.scrollItems);
}

const MAX_AUTO_BACKUPS = 15;

function stripAutomaticBackups(data: AppData): Omit<AppData, "automaticBackups"> {
  const { automaticBackups, ...snapshot } = data;
  return snapshot;
}

function countUniqueRecordItems(records: Record<string, unknown[]> | undefined): number {
  return Math.max(0, ...Object.values(records ?? {}).map((items) => items.length));
}

function getBackupSummary(data: AppData): string {
  const cardCount =
    countUniqueRecordItems(data.homework) +
    countUniqueRecordItems(data.purchaseItems) +
    countUniqueRecordItems(data.tradeItems) +
    countUniqueRecordItems(data.scrollItems);
  return `캐릭터 ${data.characters.length}명 / 카드 ${cardCount}개`;
}

function createBackupSnapshot(data: AppData, reason: string): AutoBackupSnapshot {
  const createdAt = new Date().toISOString();
  return {
    id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    reason,
    summary: getBackupSummary(data),
    data: {
      ...stripAutomaticBackups(data),
      clientUpdatedAt: data.clientUpdatedAt ?? createdAt,
    },
  };
}

function addAutoBackup(data: AppData, reason: string): AppData {
  const snapshot = createBackupSnapshot(data, reason);
  const backups = [snapshot, ...(data.automaticBackups ?? [])].slice(0, MAX_AUTO_BACKUPS);
  return { ...data, automaticBackups: backups };
}

function addAutoBackupIfUseful(data: AppData, reason: string): AppData {
  return hasStoredCards(data) || data.characters.length > 0 ? addAutoBackup(data, reason) : data;
}

function getDataUpdatedMs(data?: AppData | null): number {
  const value = data?.clientUpdatedAt;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createSyncRevision(prefix = "sync"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSyncedRevisionKey(uid: string): string {
  return `mabimobi_synced_revision_${uid}`;
}

function getLocalSyncedRevision(uid: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getSyncedRevisionKey(uid));
}

function markLocalSyncedRevision(uid: string, data: AppData): void {
  if (typeof window === "undefined" || !data.syncRevision) return;
  localStorage.setItem(getSyncedRevisionKey(uid), data.syncRevision);
}

function hasAutomaticBackups(data: AppData): boolean {
  return Boolean(data.automaticBackups?.length);
}

function hasNewRestoreSync(cloudData: AppData, currentData: AppData): boolean {
  return Boolean(cloudData.restoreSyncId && cloudData.restoreSyncId !== currentData.restoreSyncId);
}

function getDefaultCardsFingerprint(defaults: DefaultCardsData | null): string {
  return JSON.stringify(defaults ?? null);
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
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingUserDataSaveRef = useRef<{ data: AppData; syncBackups: boolean } | null>(null);
  const latestDataRef = useRef<AppData | null>(null);
  const runtimeDefaultsFingerprintRef = useRef<string>("");
  const selectedServerRef = useRef<ServerName | null>(null);
  const selectedCharIdRef = useRef<string | null>(null);

  const flushUserDataSave = useCallback(async () => {
    if (!uid || saveInFlightRef.current) return;
    const pending = pendingUserDataSaveRef.current;
    if (!pending) return;

    pendingUserDataSaveRef.current = null;
    saveInFlightRef.current = true;
    try {
      await saveUserData(uid, pending.data, { syncBackups: pending.syncBackups });
      markLocalSyncedRevision(uid, pending.data);
    } catch (error) {
      console.error("사용자 데이터 저장 실패:", error);
    } finally {
      saveInFlightRef.current = false;
      const latest = latestDataRef.current;
      const queued = pendingUserDataSaveRef.current as { data: AppData; syncBackups: boolean } | null;
      if (
        latest?.syncRevision &&
        latest.syncRevision !== pending.data.syncRevision &&
        getLocalSyncedRevision(uid) !== latest.syncRevision
      ) {
        pendingUserDataSaveRef.current = {
          data: latest,
          syncBackups: Boolean(pending.syncBackups || queued?.syncBackups),
        };
      }
      if (pendingUserDataSaveRef.current) void flushUserDataSave();
    }
  }, [uid]);

  const queueUserDataSave = useCallback((next: AppData, options: { syncBackups?: boolean } = {}) => {
    if (!uid) return;
    pendingUserDataSaveRef.current = {
      data: next,
      syncBackups: Boolean(options.syncBackups || pendingUserDataSaveRef.current?.syncBackups),
    };
    void flushUserDataSave();
  }, [flushUserDataSave, uid]);

  useEffect(() => {
    selectedServerRef.current = selectedServer;
  }, [selectedServer]);

  useEffect(() => {
    selectedCharIdRef.current = selectedCharId;
  }, [selectedCharId]);

  // 초기 로드: Firestore 우선, 없으면 localStorage
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const perf = createLoadPerformanceLogger("mobimobi initial load");
      setData(null);
      let loaded: AppData;
      let loadedSyncedWithCloud = false;
      let loadedFromExistingCloud = false;
      const defaultsPromise = loadRuntimeDefaultCards();
      const cloudDataPromise = uid ? loadUserData(uid).catch((error) => {
        console.error("사용자 데이터 로드 실패:", error);
        return null;
      }) : Promise.resolve<AppData | null>(null);
      const defaults = await defaultsPromise;
      perf.mark("defaultCardsLoadedMs");

      if (uid) {
        // Firestore에서 로드 시도
        const cloudData = await cloudDataPromise;
        perf.mark("userDataLoadedMs");
        const localData = loadData(defaults);
        perf.mark("localDataLoadedMs");
        if (cloudData) {
          const resetCloudData = applyResets(cloudData, defaults);
          perf.mark("cloudResetsAppliedMs");
          loaded = resetCloudData;
          loadedFromExistingCloud = true;
          loadedSyncedWithCloud = true;
        } else {
          // Firestore에 없으면 새 계정은 빈 리스트에서 시작한다.
          // 단, 같은 브라우저에 게스트/로컬 카드가 1개라도 있으면 그 데이터를 초기 클라우드 데이터로 승격한다.
          loaded = applyResets(localData, defaults);
          // 클라우드에 초기 저장
          try {
            await saveUserData(uid, loaded, { syncBackups: hasAutomaticBackups(loaded) });
            markLocalSyncedRevision(uid, loaded);
            loadedSyncedWithCloud = true;
          } catch (error) {
            console.error("사용자 데이터 초기 저장 실패:", error);
          }
        }
      } else {
        loaded = applyResets(loadData(defaults), defaults);
        perf.mark("guestDataLoadedMs");
      }

      // 기존 캐릭터에 scrollItems 필드 자체가 없으면 기본 스크롤 추가
      let shouldSaveNormalizedData = false;
      if (loaded.characters.length > 0) {
        const scrollItems = loaded.scrollItems ?? {};
        let updated = false;
        for (const char of loaded.characters) {
          if (!scrollItems[char.id]) {
            scrollItems[char.id] = createScrollForChar(char.id, defaults);
            updated = true;
          }
        }
        if (updated) {
          loaded = { ...loaded, scrollItems };
          shouldSaveNormalizedData = true;
        }
      }

      const normalized = normalizeCharacterCardLists(loaded);
      perf.mark("normalizedMs");
      if (normalized.changed) {
        loaded = normalized.data;
        shouldSaveNormalizedData = true;
      }
      if (loaded.characters.length > 0) {
        loaded = syncAllCardListsFromTemplate(loaded, loaded.characters[0].id);
        perf.mark("syncedTemplateMs");
      }
      if (shouldSaveNormalizedData) {
        if (uid && !loadedFromExistingCloud) {
          try {
            await saveUserData(uid, loaded);
            markLocalSyncedRevision(uid, loaded);
            loadedSyncedWithCloud = true;
          } catch (error) {
            console.error("사용자 데이터 정규화 저장 실패:", error);
          }
        }
      }

      if (cancelled) return;
      saveData(loaded);
      latestDataRef.current = loaded;
      if (uid && loadedSyncedWithCloud) markLocalSyncedRevision(uid, loaded);
      runtimeDefaultsFingerprintRef.current = getDefaultCardsFingerprint(defaults);
      setRuntimeDefaults(defaults);
      setData(loaded);
      perf.finish({
        characters: loaded.characters.length,
        cloud: loadedFromExistingCloud,
      });
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

  useEffect(() => {
    if (!data) return;

    const unsubscribe = subscribeRuntimeDefaultCards(
      (defaults) => {
        const fingerprint = getDefaultCardsFingerprint(defaults);
        if (fingerprint === runtimeDefaultsFingerprintRef.current) return;
        runtimeDefaultsFingerprintRef.current = fingerprint;
        setRuntimeDefaults(defaults);
        setData((prev) => {
          if (!prev) return prev;
          const before = JSON.stringify(prev);
          const next = applyResets(structuredClone(prev), defaults);
          if (JSON.stringify(next) === before) return prev;

          saveData(next);
          latestDataRef.current = next;
          return next;
        });
      },
      (error) => {
        console.error("기본 카드 실시간 동기화 실패:", error);
      }
    );

    return () => unsubscribe();
  }, [data !== null]);

  useEffect(() => {
    if (!uid || !data) return;

    const unsubscribe = subscribeUserData(
      uid,
      (cloudData) => {
        if (!cloudData) return;

        setData((prev) => {
          if (!prev) return prev;
          const isRestoreSync = hasNewRestoreSync(cloudData, prev);
          const cloudIsNewer = getDataUpdatedMs(cloudData) > getDataUpdatedMs(prev);
          if (!isRestoreSync && !cloudIsNewer) {
            return prev;
          }

          const next = applyResets(cloudData, runtimeDefaults ?? undefined);
          saveData(next);
          latestDataRef.current = next;
          markLocalSyncedRevision(uid, next);

          const selectedCharStillExists = selectedCharIdRef.current
            ? next.characters.some((char) => char.id === selectedCharIdRef.current)
            : false;
          if (!selectedCharStillExists) {
            const sameServerChar = selectedServerRef.current
              ? next.characters.find((char) => char.server === selectedServerRef.current)
              : null;
            const nextChar = sameServerChar ?? next.characters[0];
            setSelectedServer(nextChar?.server ?? null);
            setSelectedCharId(nextChar?.id ?? null);
          }

          return next;
        });
      },
      (error) => {
        console.error("사용자 데이터 실시간 동기화 실패:", error);
      }
    );

    return () => unsubscribe();
  }, [uid, data !== null, runtimeDefaults]);

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
          latestDataRef.current = next;
          queueUserDataSave(next);
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
          latestDataRef.current = next;
          queueUserDataSave(next);
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
  }, [data !== null, queueUserDataSave, runtimeDefaults]); // data가 로드된 후 한 번만 설정

  // 데이터 변경 시 저장 (debounce)
  const persist = useCallback((updater: (prev: AppData) => AppData, options?: { immediate?: boolean }) => {
    setData((prev) => {
      if (!prev) return prev;
      const previousBackupId = prev.automaticBackups?.[0]?.id;
      const next = { ...updater(prev), clientUpdatedAt: new Date().toISOString(), syncRevision: createSyncRevision() };
      const backupChanged = Boolean(next.automaticBackups?.[0]?.id && next.automaticBackups[0].id !== previousBackupId);
      if (backupChanged) {
        setBackupNotice("데이터가 자동백업 되었습니다.\n설정 > 이전 데이터 복구에서 확인하실 수 있습니다.");
      }
      // localStorage에 즉시 저장
      saveData(next);
      latestDataRef.current = next;
      // 로그인 상태에서는 다른 기기와의 차이를 줄이기 위해 모든 변경을 빠르게 Firestore에 저장한다.
      if (uid) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (options?.immediate) {
          queueUserDataSave(next, { syncBackups: backupChanged });
        } else {
          saveTimerRef.current = setTimeout(() => {
            queueUserDataSave(next, { syncBackups: backupChanged });
          }, 300);
        }
      }
      return next;
    });
  }, [queueUserDataSave, uid]);

  // ── 캐릭터 CRUD ──
  const addCharacter = useCallback(
    (char: Omit<Character, "id">) => {
      const id = `char_${Date.now()}`;
      const newChar: Character = { id, ...char };
      persist((prev) => {
        prev = addAutoBackupIfUseful(prev, `'${char.name}' 캐릭터 추가 전`);
        const sourceCharId = selectedCharId ?? prev.characters[0]?.id;
        const sourceHomework = sourceCharId ? prev.homework[sourceCharId] ?? [] : [];
        const sourcePurchase = sourceCharId ? prev.purchaseItems[sourceCharId] ?? [] : [];
        const sourceTrade = sourceCharId ? prev.tradeItems[sourceCharId] ?? [] : [];
        const sourceScroll = sourceCharId ? (prev.scrollItems ?? {})[sourceCharId] ?? [] : [];
        const homework = sourceCharId ? sourceHomework.map((item, index) => cloneHomeworkForChar(id, item, index)) : [];
        const purchaseItems = sourceCharId ? sourcePurchase.map((item, index) => cloneShopForChar(id, item, "pur", index)) : [];
        const tradeItems = sourceCharId ? sourceTrade.map((item, index) => cloneShopForChar(id, item, "trd", index)) : [];
        const scrollItems = sourceCharId ? sourceScroll.map((item, index) => cloneScrollForChar(id, item, index)) : [];
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

        const next = {
          ...prev,
          characters: [...prev.characters, newChar],
          homework: { ...prev.homework, [id]: homework },
          purchaseItems: { ...prev.purchaseItems, [id]: purchaseItems },
          tradeItems: { ...prev.tradeItems, [id]: tradeItems },
          scrollItems: { ...(prev.scrollItems ?? {}), [id]: scrollItems },
          allTabOrder,
        };
        return next;
      }, { immediate: true });
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
        const targetChar = prev.characters.find((char) => char.id === charId);
        prev = addAutoBackupIfUseful(prev, `'${targetChar?.name ?? "선택한"}' 캐릭터 삭제 전`);
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

  const getAllCharIds = useCallback(
    (prev: AppData): string[] => prev.characters.map((c) => c.id),
    []
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
      }, { immediate: true });
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
      }, { immediate: true });
    },
    [persist, getCharServerCharIds]
  );

  const toggleFavorite = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;
        const isFavorite = !currentList[idx].isFavorite;

        const newHomework = { ...prev.homework };
        for (const charId of getAllCharIds(prev)) {
          newHomework[charId] = (newHomework[charId] ?? []).map((hw, i) =>
            i === idx ? { ...hw, isFavorite } : hw
          );
        }
        return { ...prev, homework: newHomework };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 숙제 수정 (전체 서버/캐릭터 동기화) ──
  const updateHomework = useCallback(
    (hwId: string, updates: Partial<Pick<import("@/types").HomeworkItem, "title" | "reward" | "totalCount" | "scope">>) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = target.isDefault
          ? markDeletedDefault(prev, "homework", getHomeworkDefaultDeleteKey(target, runtimeDefaults))
          : prev.deletedDefaultItems;

        const newHomework = { ...prev.homework };
        for (const charId of getAllCharIds(prev)) {
          newHomework[charId] = (newHomework[charId] ?? []).map((hw, i) => {
            if (i !== idx) return hw;
            const updated = { ...hw, ...updates, ...(target.isDefault ? { isDefault: false, isModifiedDefault: false } : {}) };
            if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
              updated.completedCount = updates.totalCount;
            }
            return updated;
          });
        }
        return { ...prev, homework: newHomework, deletedDefaultItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
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
      }, { immediate: true });
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
      }, { immediate: true });
    },
    [persist, getCharServerCharIds]
  );

  const toggleShopFavorite = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;
        const isFavorite = !currentList[idx].isFavorite;

        const newItems = { ...prev[key] };
        for (const charId of getAllCharIds(prev)) {
          newItems[charId] = (newItems[charId] ?? []).map((item, i) =>
            i === idx ? { ...item, isFavorite } : item
          );
        }
        return { ...prev, [key]: newItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 구매/물물교환 수정 (전체 서버/캐릭터 동기화) ──
  const updateShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade", updates: Partial<Pick<import("@/types").ShopItem, "itemName" | "region" | "npcName" | "period" | "scope">>) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = target.isDefault
          ? markDeletedDefault(prev, type === "purchase" ? "purchase" : "trade", getShopDefaultDeleteKey(target, type, runtimeDefaults))
          : prev.deletedDefaultItems;

        const newItems = { ...prev[key] };
        for (const charId of getAllCharIds(prev)) {
          newItems[charId] = (newItems[charId] ?? []).map((item, i) =>
            i === idx ? { ...item, ...updates, ...(target.isDefault ? { isDefault: false, isModifiedDefault: false } : {}) } : item
          );
        }
        return { ...prev, [key]: newItems, deletedDefaultItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 숙제 삭제 (전체 서버/캐릭터 동기화) ──
  const deleteHomework = useCallback(
    (hwId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev.homework[selectedCharId] ?? [];
        const idx = currentList.findIndex((hw) => hw.id === hwId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = markDeletedDefault(prev, "homework", getHomeworkDefaultDeleteKey(target, runtimeDefaults));
        const charIds = getAllCharIds(prev);

        // 삭제 전 모든 캐릭터의 상태 저장
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        for (const charId of charIds) {
          const item = (prev.homework[charId] ?? [])[idx];
          if (!item) continue;
          const cs = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
          cs.homework = { ...cs.homework, [item.title]: { completedCount: item.completedCount, isFavorite: item.isFavorite } };
          savedStates[charId] = cs;
        }

        const newHomework = { ...prev.homework };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        for (const charId of charIds) {
          const list = newHomework[charId] ?? [];
          const deletedId = list[idx]?.id;
          newHomework[charId] = list.filter((_, i) => i !== idx);
          if (deletedId) allTabOrder[charId] = (allTabOrder[charId] ?? []).filter((id) => id !== deletedId);
        }
        return { ...prev, homework: newHomework, savedItemStates: savedStates, deletedDefaultItems, allTabOrder };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 숙제 추가 (전체 서버/캐릭터 동기화) ──
  const addHomework = useCallback(
    (hw: { title: string; reward: string; period: PeriodType; totalCount: number; scope: ScopeType }) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const newHomework = { ...prev.homework };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of getAllCharIds(prev)) {
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
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 구매/물물교환 삭제 (전체 서버/캐릭터 동기화) ──
  const deleteShopItem = useCallback(
    (itemId: string, type: "purchase" | "trade") => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      const stateKey = type === "purchase" ? "purchase" : "trade";
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const currentList = prev[key][selectedCharId] ?? [];
        const idx = currentList.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = markDeletedDefault(prev, stateKey, getShopDefaultDeleteKey(target, type, runtimeDefaults));
        const charIds = getAllCharIds(prev);

        // 삭제 전 모든 캐릭터의 상태 저장
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        for (const charId of charIds) {
          const item = (prev[key][charId] ?? [])[idx];
          if (!item) continue;
          const cs = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
          cs[stateKey] = { ...cs[stateKey], [item.itemName]: { completed: item.completed, isFavorite: item.isFavorite } };
          savedStates[charId] = cs;
        }

        const newItems = { ...prev[key] };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        for (const charId of charIds) {
          const list = newItems[charId] ?? [];
          const deletedId = list[idx]?.id;
          newItems[charId] = list.filter((_, i) => i !== idx);
          if (deletedId) allTabOrder[charId] = (allTabOrder[charId] ?? []).filter((id) => id !== deletedId);
        }
        return { ...prev, [key]: newItems, savedItemStates: savedStates, deletedDefaultItems, allTabOrder };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 구매/물물교환 추가 (전체 서버/캐릭터 동기화) ──
  const addShopItem = useCallback(
    (type: "purchase" | "trade", item: { itemName: string; region: RegionName; npcName: string; period: PeriodType; scope: ScopeType }) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      const prefix = type === "purchase" ? "pur" : "trd";
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const newItems = { ...prev[key] };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of getAllCharIds(prev)) {
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
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 숙제 순서 변경 (전체 서버/캐릭터 동기화) ──
  const reorderHomework = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const newHomework = { ...prev.homework };
        for (const charId of getAllCharIds(prev)) {
          const list = [...(newHomework[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            newHomework[charId] = list;
          }
        }
        return { ...prev, homework: newHomework };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 구매/물물교환 순서 변경 (전체 서버/캐릭터 동기화) ──
  const reorderShopItem = useCallback(
    (type: "purchase" | "trade", oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      const key = type === "purchase" ? "purchaseItems" : "tradeItems";
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const newItems = { ...prev[key] };
        for (const charId of getAllCharIds(prev)) {
          const list = [...(newItems[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            newItems[charId] = list;
          }
        }
        return { ...prev, [key]: newItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  // ── 캐릭터 순서 변경 ──
  const reorderCharacters = useCallback(
    (oldIndex: number, newIndex: number) => {
      persist((prev) => {
        const serverList = prev.characters.filter((char) => char.server === selectedServer);
        const [moved] = serverList.splice(oldIndex, 1);
        if (!moved) return prev;

        serverList.splice(newIndex, 0, moved);
        let serverIndex = 0;
        const characters = prev.characters.map((char) => {
          if (char.server !== selectedServer) return char;
          const next = serverList[serverIndex];
          serverIndex += 1;
          return next ?? char;
        });

        return { ...prev, characters };
      }, { immediate: true });
    },
    [persist, selectedServer]
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
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        const ts = Date.now();
        for (const charId of getAllCharIds(prev)) {
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
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
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
      }, { immediate: true });
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
      }, { immediate: true });
    },
    [persist]
  );

  const toggleScrollFavorite = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;
        const isFavorite = !currentList[idx].isFavorite;

        for (const charId of getAllCharIds(prev)) {
          scrollItems[charId] = (scrollItems[charId] ?? []).map((s, i) =>
            i === idx ? { ...s, isFavorite } : s
          );
        }
        return { ...prev, scrollItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds]
  );

  const updateScrollItem = useCallback(
    (itemId: string, updates: Partial<Pick<ScrollItem, "title" | "scrollType" | "period" | "totalCount" | "materials" | "reward" | "region" | "tags">>) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = target.isDefault
          ? markDeletedDefault(prev, "scroll", getScrollDefaultDeleteKey(target, runtimeDefaults))
          : prev.deletedDefaultItems;

        for (const charId of getAllCharIds(prev)) {
          scrollItems[charId] = (scrollItems[charId] ?? []).map((s, i) => {
            if (i !== idx) return s;
            const updated = { ...s, ...updates, ...(target.isDefault ? { isDefault: false, isModifiedDefault: false } : {}) };
            if (updates.totalCount !== undefined && updated.completedCount > updates.totalCount) {
              updated.completedCount = updates.totalCount;
            }
            return updated;
          });
        }
        return { ...prev, scrollItems, deletedDefaultItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  const deleteScrollItem = useCallback(
    (itemId: string) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        const currentList = scrollItems[selectedCharId] ?? [];
        const idx = currentList.findIndex((s) => s.id === itemId);
        if (idx === -1) return prev;
        const target = currentList[idx];
        const deletedDefaultItems = markDeletedDefault(prev, "scroll", getScrollDefaultDeleteKey(target, runtimeDefaults));
        const charIds = getAllCharIds(prev);

        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        for (const charId of charIds) {
          const list = scrollItems[charId] ?? [];
          const deletedId = list[idx]?.id;
          scrollItems[charId] = list.filter((_, i) => i !== idx);
          if (deletedId) allTabOrder[charId] = (allTabOrder[charId] ?? []).filter((id) => id !== deletedId);
        }
        return { ...prev, scrollItems, deletedDefaultItems, allTabOrder };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds, runtimeDefaults]
  );

  const reorderScrollItem = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const scrollItems = { ...(prev.scrollItems ?? {}) };
        for (const charId of getAllCharIds(prev)) {
          const list = [...(scrollItems[charId] ?? [])];
          if (oldIndex < list.length && newIndex < list.length) {
            const [moved] = list.splice(oldIndex, 1);
            list.splice(newIndex, 0, moved);
            scrollItems[charId] = list;
          }
        }
        return { ...prev, scrollItems };
      }, { immediate: true });
    },
    [persist, selectedCharId, getAllCharIds]
  );

  const reorderAllTabItem = useCallback(
    (visibleIds: string[], oldIndex: number, newIndex: number) => {
      if (!selectedCharId) return;
      const activeId = visibleIds[oldIndex];
      const overId = visibleIds[newIndex];
      if (!activeId || !overId || activeId === overId) return;

      persist((prev) => {
        prev = syncAllCardListsFromTemplate(prev, selectedCharId);
        const charId = selectedCharId;
        const allIds = getAllTabIds(prev, charId);
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

        const sourceLists = {
          homework: prev.homework[charId] ?? [],
          purchase: prev.purchaseItems[charId] ?? [],
          trade: prev.tradeItems[charId] ?? [],
          scroll: (prev.scrollItems ?? {})[charId] ?? [],
        };
        const descriptors = nextOrder.map((id) => {
          const homeworkIndex = sourceLists.homework.findIndex((item) => item.id === id);
          if (homeworkIndex !== -1) return { type: "homework" as const, index: homeworkIndex };
          const purchaseIndex = sourceLists.purchase.findIndex((item) => item.id === id);
          if (purchaseIndex !== -1) return { type: "purchase" as const, index: purchaseIndex };
          const tradeIndex = sourceLists.trade.findIndex((item) => item.id === id);
          if (tradeIndex !== -1) return { type: "trade" as const, index: tradeIndex };
          const scrollIndex = sourceLists.scroll.findIndex((item) => item.id === id);
          if (scrollIndex !== -1) return { type: "scroll" as const, index: scrollIndex };
          return null;
        }).filter((descriptor): descriptor is NonNullable<typeof descriptor> => descriptor !== null);

        const allTabOrder = { ...(prev.allTabOrder ?? {}) };
        for (const targetCharId of getAllCharIds(prev)) {
          const targetLists = {
            homework: prev.homework[targetCharId] ?? [],
            purchase: prev.purchaseItems[targetCharId] ?? [],
            trade: prev.tradeItems[targetCharId] ?? [],
            scroll: (prev.scrollItems ?? {})[targetCharId] ?? [],
          };
          const orderedIds = descriptors
            .map((descriptor) => targetLists[descriptor.type][descriptor.index]?.id)
            .filter((id): id is string => Boolean(id));
          const targetAllIds = getAllTabIds(prev, targetCharId);
          allTabOrder[targetCharId] = [
            ...orderedIds,
            ...targetAllIds.filter((id) => !orderedIds.includes(id)),
          ];
        }

        return {
          ...prev,
          allTabOrder,
        };
      });
    },
    [persist, selectedCharId, getAllCharIds]
  );

  // ── 숙제 초기화 (전체 서버/캐릭터 체크 상태 해제) ──
  const resetHomework = useCallback(() => {
    if (!selectedCharId) return;
    persist((prev) => {
      prev = addAutoBackupIfUseful(prev, "체크박스 초기화 전");
      const charIds = getAllCharIds(prev);
      if (charIds.length === 0) return prev;

      const normalizedHomework = normalizeRecordByTemplate(
        prev.homework,
        charIds,
        (item) => `${item.period}|${item.scope ?? "character"}|${item.title}|${item.reward}`,
        cloneHomeworkForChar
      );
      const normalizedPurchase = normalizeRecordByTemplate(
        prev.purchaseItems,
        charIds,
        (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.npcName}|${item.itemName}`,
        (charId, item, index) => cloneShopForChar(charId, item, "pur", index)
      );
      const normalizedTrade = normalizeRecordByTemplate(
        prev.tradeItems,
        charIds,
        (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.npcName}|${item.itemName}`,
        (charId, item, index) => cloneShopForChar(charId, item, "trd", index)
      );
      const normalizedScroll = normalizeRecordByTemplate(
        prev.scrollItems ?? {},
        charIds,
        (item) => `${item.period}|${item.scope ?? "character"}|${item.region}|${item.scrollType}|${item.title}|${item.reward}`,
        cloneScrollForChar
      );

      const homework = { ...normalizedHomework.records };
      const purchaseItems = { ...normalizedPurchase.records };
      const tradeItems = { ...normalizedTrade.records };
      const scrollItems = { ...(prev.scrollItems ?? {}), ...normalizedScroll.records };
      const savedStates = { ...(prev.savedItemStates ?? {}) };
      const allTabOrder = { ...(prev.allTabOrder ?? {}) };

      for (const charId of charIds) {
        homework[charId] = (homework[charId] ?? []).map((item) => ({ ...item, completedCount: 0 }));
        purchaseItems[charId] = (purchaseItems[charId] ?? []).map((item) => ({ ...item, completed: false }));
        tradeItems[charId] = (tradeItems[charId] ?? []).map((item) => ({ ...item, completed: false }));
        scrollItems[charId] = (scrollItems[charId] ?? []).map((item) => ({ ...item, completedCount: 0 }));

        const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
        savedStates[charId] = {
          homework: Object.fromEntries(
            Object.entries(charStates.homework ?? {}).map(([key, state]) => [
              key,
              { ...state, completedCount: 0 },
            ])
          ),
          purchase: Object.fromEntries(
            Object.entries(charStates.purchase ?? {}).map(([key, state]) => [
              key,
              { ...state, completed: false },
            ])
          ),
          trade: Object.fromEntries(
            Object.entries(charStates.trade ?? {}).map(([key, state]) => [
              key,
              { ...state, completed: false },
            ])
          ),
        };
      }

      const next = {
        ...prev,
        homework,
        purchaseItems,
        tradeItems,
        scrollItems,
        savedItemStates: savedStates,
        allTabOrder,
      };

      for (const charId of charIds) {
        const validIds = getAllTabIds(next, charId);
        allTabOrder[charId] = [
          ...(allTabOrder[charId] ?? []).filter((id) => validIds.includes(id)),
          ...validIds.filter((id) => !(allTabOrder[charId] ?? []).includes(id)),
        ];
      }

      return next;
    }, { immediate: true });
  }, [persist, selectedCharId, getAllCharIds]);

  const createEmptyHomeworkList = useCallback(() => {
    if (!selectedCharId) return;
    persist((prev) => {
      prev = addAutoBackupIfUseful(prev, "빈 리스트로 시작 전");
      const savedStates = { ...(prev.savedItemStates ?? {}) };
      const allTabOrder = { ...(prev.allTabOrder ?? {}) };
      for (const char of prev.characters) {
        delete savedStates[char.id];
        delete allTabOrder[char.id];
      }
      const emptyByChar = Object.fromEntries(prev.characters.map((char) => [char.id, []]));
      return {
        ...prev,
        homework: { ...prev.homework, ...emptyByChar },
        purchaseItems: { ...prev.purchaseItems, ...emptyByChar },
        tradeItems: { ...prev.tradeItems, ...emptyByChar },
        scrollItems: { ...(prev.scrollItems ?? {}), ...emptyByChar },
        savedItemStates: savedStates,
        allTabOrder,
      };
    }, { immediate: true });
  }, [persist, selectedCharId]);

  const hasAnyCard = useMemo(() => {
    if (!data) return false;
    const count = (records: Record<string, unknown[]> | undefined) =>
      Object.values(records ?? {}).some((items) => items.length > 0);
    return count(data.homework) || count(data.purchaseItems) || count(data.tradeItems) || count(data.scrollItems);
  }, [data]);

  // 기본 프리셋
  const defaultPreset: HomeworkPreset = useMemo(() => ({
    id: "__default__",
    name: "기본 숙제 설정",
    createdAt: "2024-01-01T00:00:00.000Z",
    homework: (runtimeDefaults?.homework ?? DEFAULT_HOMEWORK).map((hw) => ({
      title: hw.title,
      reward: hw.reward,
      period: hw.period,
      totalCount: hw.totalCount || parseTotalCount(hw.title),
      scope: toScope(hw.scope),
      isDefault: true,
    })),
    purchaseItems: (runtimeDefaults?.purchaseItems ?? DEFAULT_PURCHASE_ITEMS).map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      period: item.period,
      scope: toScope(item.scope),
      isDefault: true,
    })),
    tradeItems: (runtimeDefaults?.tradeItems ?? DEFAULT_TRADE_ITEMS).map((item) => ({
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      period: item.period,
      scope: toScope(item.scope),
      isDefault: true,
    })),
    scrollItems: (runtimeDefaults?.scrollItems ?? DEFAULT_SCROLL_ITEMS).map((item) => ({
      title: item.title,
      scrollType: item.scrollType,
      period: item.period,
      totalCount: item.totalCount || 3,
      scope: "character" as const,
      region: item.region,
      materials: item.materials === "-" ? ["-"] : item.materials.split(",").map((s) => s.trim()),
      reward: item.reward,
      isDefault: true,
    })),
  }), [runtimeDefaults]);

  // ── 프리셋 저장 ──
  const savePreset = useCallback(
    (name: string) => {
      if (!selectedCharId || !data) return;
      const hw = data.homework[selectedCharId] ?? [];
      const pur = data.purchaseItems[selectedCharId] ?? [];
      const trd = data.tradeItems[selectedCharId] ?? [];
      const scr = (data.scrollItems ?? {})[selectedCharId] ?? [];
      const preset: HomeworkPreset = {
        id: `preset_${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        homework: hw.map(({ id, completedCount, isFavorite, ...rest }) => rest),
        purchaseItems: pur.map(({ id, completed, isFavorite, ...rest }) => rest),
        tradeItems: trd.map(({ id, completed, isFavorite, ...rest }) => rest),
        scrollItems: scr.map(({ id, completedCount, isFavorite, ...rest }) => rest),
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
        prev = addAutoBackupIfUseful(prev, presetId === "__default__" ? "기본 숙제 설정 불러오기 전" : "저장한 리스트 불러오기 전");
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        const nextHomework = { ...prev.homework };
        const nextPurchase = { ...prev.purchaseItems };
        const nextTrade = { ...prev.tradeItems };
        const nextScroll = { ...(prev.scrollItems ?? {}) };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };

        for (const char of prev.characters) {
          const charId = char.id;
          const prevHw = prev.homework[charId] ?? [];
          const prevPur = prev.purchaseItems[charId] ?? [];
          const prevTrd = prev.tradeItems[charId] ?? [];
          const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
          const mergedHw = { ...charStates.homework };
          for (const h of prevHw) { mergedHw[h.title] = { completedCount: h.completedCount, isFavorite: h.isFavorite }; }
          const mergedPur = { ...charStates.purchase };
          for (const p of prevPur) { mergedPur[p.itemName] = { completed: p.completed, isFavorite: p.isFavorite }; }
          const mergedTrd = { ...charStates.trade };
          for (const t of prevTrd) { mergedTrd[t.itemName] = { completed: t.completed, isFavorite: t.isFavorite }; }

          savedStates[charId] = { homework: mergedHw, purchase: mergedPur, trade: mergedTrd };
          delete allTabOrder[charId];

          nextHomework[charId] = preset!.homework.map((hw, i) => {
            const saved = mergedHw[hw.title];
            const totalCount = hw.totalCount || parseTotalCount(hw.title);
            return {
              ...hw,
              id: `${charId}_hw_${i}`,
              completedCount: Math.min(saved?.completedCount ?? 0, totalCount),
              isFavorite: saved?.isFavorite ?? false,
              totalCount,
            };
      }, { immediate: true });
          nextPurchase[charId] = preset!.purchaseItems.map((item, i) => {
            const saved = mergedPur[item.itemName];
            return {
              ...item,
              id: `${charId}_pur_${i}`,
              completed: saved?.completed ?? false,
              isFavorite: saved?.isFavorite ?? false,
            };
          });
          nextTrade[charId] = preset!.tradeItems.map((item, i) => {
            const saved = mergedTrd[item.itemName];
            return {
              ...item,
              id: `${charId}_trd_${i}`,
              completed: saved?.completed ?? false,
              isFavorite: saved?.isFavorite ?? false,
            };
          });
          nextScroll[charId] = (preset!.scrollItems ?? []).map((item, i) => {
            const totalCount = item.totalCount || 3;
            return {
              ...item,
              id: `${charId}_scroll_${i}`,
              completedCount: 0,
              isFavorite: false,
              totalCount,
            };
          });
        }

        const next = {
          ...prev,
          savedItemStates: savedStates,
          homework: nextHomework,
          purchaseItems: nextPurchase,
          tradeItems: nextTrade,
          scrollItems: nextScroll,
          allTabOrder,
        };
        return normalizeCharacterCardLists(next).data;
      }, { immediate: true });
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
    const scr = (data.scrollItems ?? {})[selectedCharId] ?? [];
    const char = data.characters.find((c) => c.id === selectedCharId);
    return {
      id: `preset_export_${Date.now()}`,
      name: char ? `${char.name}의 설정` : "내보낸 설정",
      createdAt: new Date().toISOString(),
      homework: hw.map(({ id, completedCount, isFavorite, ...rest }) => rest),
      purchaseItems: pur.map(({ id, completed, isFavorite, ...rest }) => rest),
      tradeItems: trd.map(({ id, completed, isFavorite, ...rest }) => rest),
      scrollItems: scr.map(({ id, completedCount, isFavorite, ...rest }) => rest),
    };
  }, [selectedCharId, data]);

  // ── 프리셋 가져오기 (외부 JSON에서 불러온 프리셋 적용) ──
  // loadPreset과 동일하게 현재 상태를 savedItemStates에 저장 후, 매칭되는 항목 복원
  const importPreset = useCallback(
    (preset: HomeworkPreset) => {
      if (!selectedCharId) return;
      persist((prev) => {
        prev = addAutoBackupIfUseful(prev, "백업 파일 가져오기 전");
        const savedStates = { ...(prev.savedItemStates ?? {}) };
        const nextHomework = { ...prev.homework };
        const nextPurchase = { ...prev.purchaseItems };
        const nextTrade = { ...prev.tradeItems };
        const nextScroll = { ...(prev.scrollItems ?? {}) };
        const allTabOrder = { ...(prev.allTabOrder ?? {}) };

        for (const char of prev.characters) {
          const charId = char.id;
          const prevHw = prev.homework[charId] ?? [];
          const prevPur = prev.purchaseItems[charId] ?? [];
          const prevTrd = prev.tradeItems[charId] ?? [];
          const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };

          const mergedHw = { ...charStates.homework };
          for (const h of prevHw) { mergedHw[h.title] = { completedCount: h.completedCount, isFavorite: h.isFavorite }; }
          const mergedPur = { ...charStates.purchase };
          for (const p of prevPur) { mergedPur[p.itemName] = { completed: p.completed, isFavorite: p.isFavorite }; }
          const mergedTrd = { ...charStates.trade };
          for (const t of prevTrd) { mergedTrd[t.itemName] = { completed: t.completed, isFavorite: t.isFavorite }; }

          savedStates[charId] = { homework: mergedHw, purchase: mergedPur, trade: mergedTrd };
          delete allTabOrder[charId];

          nextHomework[charId] = preset.homework.map((hw, i) => {
            const saved = mergedHw[hw.title];
            const totalCount = hw.totalCount || parseTotalCount(hw.title);
            return {
              ...hw,
              id: `${charId}_hw_${i}`,
              completedCount: Math.min(saved?.completedCount ?? 0, totalCount),
              isFavorite: saved?.isFavorite ?? false,
              totalCount,
            };
          });
          nextPurchase[charId] = preset.purchaseItems.map((item, i) => {
            const saved = mergedPur[item.itemName];
            return {
              ...item,
              id: `${charId}_pur_${i}`,
              completed: saved?.completed ?? false,
              isFavorite: saved?.isFavorite ?? false,
            };
          });
          nextTrade[charId] = preset.tradeItems.map((item, i) => {
            const saved = mergedTrd[item.itemName];
            return {
              ...item,
              id: `${charId}_trd_${i}`,
              completed: saved?.completed ?? false,
              isFavorite: saved?.isFavorite ?? false,
            };
          });
          nextScroll[charId] = (preset.scrollItems ?? []).map((item, i) => {
            const totalCount = item.totalCount || 3;
            return {
              ...item,
              id: `${charId}_scroll_${i}`,
              completedCount: 0,
              isFavorite: false,
              totalCount,
            };
          });
        }

        const next = {
          ...prev,
          savedItemStates: savedStates,
          homework: nextHomework,
          purchaseItems: nextPurchase,
          tradeItems: nextTrade,
          scrollItems: nextScroll,
          allTabOrder,
        };
        return normalizeCharacterCardLists(next).data;
      }, { immediate: true });
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

  const handleCharacterChange = useCallback(
    (charId: string) => {
      if (selectedCharId && charId !== selectedCharId) {
        persist((prev) => syncAllCardListsFromTemplate(prev, selectedCharId), { immediate: true });
      }
      setSelectedCharId(charId);
    },
    [persist, selectedCharId]
  );

  const handleServerChange = useCallback(
    (server: ServerName) => {
      if (selectedCharId) {
        persist((prev) => syncAllCardListsFromTemplate(prev, selectedCharId), { immediate: true });
      }
      setSelectedServer(server);
      const first = characters.find((c) => c.server === server);
      if (first) setSelectedCharId(first.id);
    },
    [characters, persist, selectedCharId]
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
    const countTotal = <T extends { totalCount: number }>(items: T[]) => items.length;
    const countDone = <T extends { completedCount: number; totalCount: number }>(items: T[]) =>
      items.filter((item) => item.completedCount >= item.totalCount).length;

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
      }, { immediate: true });
    },
    [persist]
  );

  // ── 메모 ──
  const saveMemo = useCallback(
    (memo: string) => {
      persist((prev) => ({ ...prev, memo }), { immediate: true });
    },
    [persist]
  );

  const createAutoBackupForImport = useCallback((reason: string): AutoBackupSnapshot | null => {
    if (!data || (!hasStoredCards(data) && data.characters.length === 0)) return null;
    return createBackupSnapshot(data, reason);
  }, [data]);

  const importAccountData = useCallback((importedData: AppData) => {
    if (!importedData.characters || !importedData.homework) return;
    const backup = createAutoBackupForImport("백업 파일 가져오기 전");
    const now = new Date().toISOString();
    const next: AppData = {
      ...importedData,
      syncRevision: createSyncRevision("import"),
      automaticBackups: [
        ...(backup ? [backup] : []),
        ...(importedData.automaticBackups ?? []),
      ].slice(0, MAX_AUTO_BACKUPS),
      clientUpdatedAt: now,
    };

    saveData(next);
    latestDataRef.current = next;
    queueUserDataSave(next, { syncBackups: true });
    setData(next);
    setBackupNotice(backup ? "데이터가 자동백업 되었습니다.\n설정 > 이전 데이터 복구에서 확인하실 수 있습니다." : "백업 파일을 가져왔습니다.");
    const first = next.characters[0];
    setSelectedServer(first?.server ?? null);
    setSelectedCharId(first?.id ?? null);
  }, [createAutoBackupForImport, queueUserDataSave]);

  const loadAutomaticBackups = useCallback(async () => {
    if (!uid) return;
    try {
      const backups = await loadUserBackups(uid);
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, automaticBackups: backups };
        saveData(next);
        latestDataRef.current = next;
        return next;
      });
    } catch (error) {
      console.error("자동백업 로드 실패:", error);
    }
  }, [uid]);

  const restoreAutoBackup = useCallback((backupId: string) => {
    let nextSelection: { server: ServerName | null; charId: string | null } | null = null;
    persist((prev) => {
      const backup = (prev.automaticBackups ?? []).find((item) => item.id === backupId);
      if (!backup) return prev;

      const beforeRestore = createBackupSnapshot(prev, "이전 데이터 복구 전");
      const restored: AppData = {
        ...backup.data,
        syncRevision: createSyncRevision("restore"),
        restoreSyncId: `restore_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        automaticBackups: [
          beforeRestore,
          ...(prev.automaticBackups ?? []).filter((item) => item.id !== beforeRestore.id),
        ].slice(0, MAX_AUTO_BACKUPS),
      };
      const sameCharacter = selectedCharId
        ? restored.characters.find((char) => char.id === selectedCharId)
        : null;
      const sameServerCharacter = selectedServer
        ? restored.characters.find((char) => char.server === selectedServer)
        : null;
      const nextCharacter = sameCharacter ?? sameServerCharacter ?? restored.characters[0];
      nextSelection = nextCharacter
        ? { server: nextCharacter.server, charId: nextCharacter.id }
        : { server: null, charId: null };
      return restored;
    }, { immediate: true });

    window.setTimeout(() => {
      if (!nextSelection) return;
      setSelectedServer(nextSelection.server);
      setSelectedCharId(nextSelection.charId);
    }, 0);
  }, [persist, selectedCharId, selectedServer]);

  const dismissBackupNotice = useCallback(() => {
    setBackupNotice(null);
  }, []);

  return {
    isLoaded: data !== null,
    activeServers,
    selectedServer,
    setSelectedServer: handleServerChange,
    characters,
    serverChars,
    selectedChar,
    selectedCharId,
    setSelectedCharId: handleCharacterChange,
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
    createEmptyHomeworkList,
    hasAnyCard,
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
    // 자동 백업
    automaticBackups: data?.automaticBackups ?? [],
    backupNotice,
    dismissBackupNotice,
    createAutoBackupForImport,
    importAccountData,
    loadAutomaticBackups,
    restoreAutoBackup,
  };
}
