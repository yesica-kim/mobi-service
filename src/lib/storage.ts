import type { AppData, Character, HomeworkItem, ScrollItem, ShopItem } from "@/types";
import { DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, DEFAULT_SCROLL_ITEMS, parseTotalCount, parseTradeItemName, toScope } from "@/types";
import type { DefaultCardsData } from "@/lib/adminFirestore";

const STORAGE_KEY = "mabimobi_data";

function getDefaultCards(defaultCards?: DefaultCardsData): DefaultCardsData {
  return defaultCards ?? {
    homework: DEFAULT_HOMEWORK,
    purchaseItems: DEFAULT_PURCHASE_ITEMS,
    tradeItems: DEFAULT_TRADE_ITEMS,
    scrollItems: DEFAULT_SCROLL_ITEMS,
  };
}

/** server -> region 마이그레이션 */
function migrateShopItems(items: Record<string, any[]>) {
  for (const charId of Object.keys(items)) {
    items[charId] = items[charId].map((item: any) => {
      if (item.server && !item.region) {
        const { server, ...rest } = item;
        return { ...rest, region: server };
      }
      return item;
    });
  }
}

/** isDefault 마이그레이션: 기존 데이터에 isDefault 플래그가 없으면 ID 패턴으로 판별 */
// 기존 데이터 타이틀/카운트 마이그레이션
function migrateRenames(data: AppData, defaultCards?: DefaultCardsData) {
  const renames: Record<string, { newTitle: string; totalCount?: number }> = {
    "주간 어비스 3회": { newTitle: "주간 어비스", totalCount: 1 },
  };
  for (const charId of Object.keys(data.homework ?? {})) {
    data.homework[charId] = data.homework[charId].map((item) => {
      const rename = renames[item.title];
      if (rename) {
        return { ...item, title: rename.newTitle, ...(rename.totalCount !== undefined ? { totalCount: rename.totalCount, completedCount: Math.min(item.completedCount, rename.totalCount) } : {}) };
      }
      return item;
    });
  }

  // 구매 아이템 이름 변경
  const purchaseRenames: Record<string, string> = {
    "성수 5개(서버)": "성수 5개",
  };
  for (const charId of Object.keys(data.purchaseItems ?? {})) {
    data.purchaseItems[charId] = data.purchaseItems[charId].map((item) => {
      const newName = purchaseRenames[item.itemName];
      return newName ? { ...item, itemName: newName } : item;
    });
  }

  // 물물교환 아이템: itemName에서 스키마 파싱 + 옛날 포맷 → 괄호 포맷으로 변환
  // 기존 저장 데이터의 itemName을 DEFAULT_TRADE_ITEMS 기준으로 업데이트
  const tradeNameMap: Record<string, string> = {};
  for (const item of getDefaultCards(defaultCards).tradeItems) {
    // 괄호/공백 제거한 키로 매칭
    const key = item.itemName.replace(/[() ]/g, "").toLowerCase();
    tradeNameMap[key] = item.itemName;
  }

  for (const charId of Object.keys(data.tradeItems ?? {})) {
    data.tradeItems[charId] = data.tradeItems[charId].map((item) => {
      // 이미 스키마가 있으면 스킵
      if (item.fromItem && item.toItem) return item;

      // 옛날 포맷 → 현재 DEFAULT 이름으로 매칭
      const normalKey = item.itemName.replace(/[() ]/g, "").toLowerCase();
      const matchedName = tradeNameMap[normalKey];
      const nameToUse = matchedName || item.itemName;

      // 파싱
      const parsed = parseTradeItemName(nameToUse);
      if (parsed) {
        return { ...item, itemName: nameToUse, ...parsed };
      }
      return { ...item, itemName: nameToUse };
    });
  }
}

/** 새 기본 숙제가 추가되었을 때 기존 캐릭터에 자동 삽입 */
function migrateNewDefaults(data: AppData, defaultCards?: DefaultCardsData) {
  const defaults = getDefaultCards(defaultCards);
  const savedStates = { ...(data.savedItemStates ?? {}) };
  const deletedDefaults = data.deletedDefaultItems ?? {};
  const deletedHomework = new Set(deletedDefaults.homework ?? []);
  const deletedPurchase = new Set(deletedDefaults.purchase ?? []);
  const deletedTrade = new Set(deletedDefaults.trade ?? []);
  const deletedScroll = new Set(deletedDefaults.scroll ?? []);
  const homeworkDefaults = defaults.homework.filter((item) => !deletedHomework.has(item.title));
  const purchaseDefaults = defaults.purchaseItems.filter((item) => !deletedPurchase.has(item.itemName));
  const tradeDefaults = defaults.tradeItems.filter((item) => !deletedTrade.has(item.itemName));
  const scrollDefaults = defaults.scrollItems.filter((item) => !deletedScroll.has(item.title));

  for (const charId of Object.keys(data.homework ?? {})) {
    const current = data.homework[charId] ?? [];
    if (current.length === 0) continue;
    const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
    data.homework[charId] = syncDefaultItems(
      current,
      homeworkDefaults,
      (item) => item.defaultKey ?? item.title,
      (item) => item.title,
      (hw, existing) => {
        const key = hw.title;
        const saved = charStates.homework[key];
        const totalCount = hw.totalCount || parseTotalCount(hw.title);
        return {
          id: existing?.id ?? `${charId}_hw_added_${key}_${current.length}`,
          title: hw.title,
          reward: hw.reward,
          period: hw.period,
          totalCount,
          completedCount: Math.min(existing?.completedCount ?? saved?.completedCount ?? 0, totalCount),
          isFavorite: existing?.isFavorite ?? saved?.isFavorite ?? false,
          isDefault: true,
          defaultKey: key,
          scope: toScope(hw.scope),
        };
      }
    );
    savedStates[charId] = charStates;
  }

  for (const charId of Object.keys(data.purchaseItems ?? {})) {
    const current = data.purchaseItems[charId] ?? [];
    if (current.length === 0) continue;
    const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
    data.purchaseItems[charId] = syncDefaultItems(
      current,
      purchaseDefaults,
      (item) => item.defaultKey ?? item.itemName,
      (item) => item.itemName,
      (item, existing) => {
        const key = item.itemName;
        const saved = charStates.purchase[key];
        return {
          id: existing?.id ?? `${charId}_pur_added_${key}_${current.length}`,
          itemName: item.itemName,
          region: item.region,
          npcName: item.npcName,
          period: item.period,
          completed: existing?.completed ?? saved?.completed ?? false,
          isFavorite: existing?.isFavorite ?? saved?.isFavorite ?? false,
          isDefault: true,
          defaultKey: key,
          scope: toScope(item.scope),
        };
      }
    );
    savedStates[charId] = charStates;
  }

  for (const charId of Object.keys(data.tradeItems ?? {})) {
    const current = data.tradeItems[charId] ?? [];
    if (current.length === 0) continue;
    const charStates = savedStates[charId] ?? { homework: {}, purchase: {}, trade: {} };
    data.tradeItems[charId] = syncDefaultItems(
      current,
      tradeDefaults,
      (item) => item.defaultKey ?? item.itemName,
      (item) => item.itemName,
      (item, existing) => {
        const key = item.itemName;
        const saved = charStates.trade[key];
        const parsed = parseTradeItemName(item.itemName);
        return {
          id: existing?.id ?? `${charId}_trd_added_${key}_${current.length}`,
          itemName: item.itemName,
          region: item.region,
          npcName: item.npcName,
          period: item.period,
          completed: existing?.completed ?? saved?.completed ?? false,
          isFavorite: existing?.isFavorite ?? saved?.isFavorite ?? false,
          isDefault: true,
          defaultKey: key,
          scope: toScope(item.scope),
          ...(parsed ?? {}),
        };
      }
    );
    savedStates[charId] = charStates;
  }

  for (const charId of Object.keys(data.scrollItems ?? {})) {
    const current = data.scrollItems![charId] ?? [];
    if (current.length === 0) continue;
    data.scrollItems![charId] = syncDefaultItems(
      current,
      scrollDefaults,
      (item) => item.defaultKey ?? item.title,
      (item) => item.title,
      (item, existing) => {
        const key = item.title;
        return {
          id: existing?.id ?? `${charId}_scroll_added_${key}_${current.length}`,
          title: item.title,
          scrollType: item.scrollType,
          period: item.period,
          totalCount: item.totalCount || 3,
          completedCount: Math.min(existing?.completedCount ?? 0, item.totalCount || 3),
          isFavorite: existing?.isFavorite ?? false,
          isDefault: true,
          defaultKey: key,
          scope: "character" as const,
          region: item.region,
          materials: item.materials === "-" ? ["-"] : item.materials.split(",").map((s) => s.trim()),
          reward: item.reward,
        };
      }
    );
  }

  data.savedItemStates = savedStates;
  reconcileAllTabOrder(data);
}

function syncDefaultItems<Current extends { isDefault?: boolean; isModifiedDefault?: boolean; defaultKey?: string }, Default>(
  current: Current[],
  defaults: Default[],
  getCurrentKey: (item: Current) => string,
  getDefaultKey: (item: Default) => string,
  buildDefault: (item: Default, existing?: Current) => Current
): Current[] {
  const defaultKeys = new Set(defaults.map(getDefaultKey));
  const defaultsByKey = new Map(defaults.map((item) => [getDefaultKey(item), item] as const));
  const seenDefaultKeys = new Set<string>();

  const syncedCurrent = current.reduce<Current[]>((items, item) => {
    if (!item.isDefault) {
      items.push(item);
      return items;
    }

    const key = getCurrentKey(item);
    const defaultItem = defaultsByKey.get(key);
    if (!defaultItem) {
      if (item.isModifiedDefault) items.push({ ...item, isDefault: false, isModifiedDefault: false });
      return items;
    }

    seenDefaultKeys.add(key);
    if (item.isModifiedDefault) {
      items.push({ ...item, defaultKey: key, isDefault: false, isModifiedDefault: false });
    } else {
      items.push(buildDefault(defaultItem, item));
    }
    return items;
  }, []);

  const missingDefaults = defaults
    .filter((item) => !seenDefaultKeys.has(getDefaultKey(item)))
    .map((item) => buildDefault(item));
  const defaultIndex = new Map(defaults.map((item, index) => [getDefaultKey(item), index] as const));
  const merged = [...syncedCurrent];

  for (const missingItem of missingDefaults) {
    const missingIndex = defaultIndex.get(getCurrentKey(missingItem)) ?? Number.MAX_SAFE_INTEGER;
    const insertAt = merged.findIndex((item) => {
      if (!item.isDefault) return false;
      return (defaultIndex.get(getCurrentKey(item)) ?? Number.MAX_SAFE_INTEGER) > missingIndex;
    });
    if (insertAt === -1) {
      merged.push(missingItem);
    } else {
      merged.splice(insertAt, 0, missingItem);
    }
  }

  return merged;
}

function reconcileAllTabOrder(data: AppData) {
  if (!data.allTabOrder) return;

  for (const charId of data.characters.map((char) => char.id)) {
    const allItems = [
      ...(data.homework[charId] ?? []),
      ...(data.purchaseItems[charId] ?? []),
      ...(data.tradeItems[charId] ?? []),
      ...((data.scrollItems ?? {})[charId] ?? []),
    ];
    const allIds = allItems.map((item) => item.id);
    const allIdSet = new Set(allIds);
    const orderedIds = (data.allTabOrder[charId] ?? []).filter((id) => allIdSet.has(id));
    const missingIds = allIds.filter((id) => !orderedIds.includes(id));
    const order = [...orderedIds];
    const itemIndex = new Map(allIds.map((id, index) => [id, index]));

    for (const missingId of missingIds) {
      const missingIndex = itemIndex.get(missingId) ?? Number.MAX_SAFE_INTEGER;
      const insertAt = order.findIndex((id) => (itemIndex.get(id) ?? Number.MAX_SAFE_INTEGER) > missingIndex);
      if (insertAt === -1) {
        order.push(missingId);
      } else {
        order.splice(insertAt, 0, missingId);
      }
    }

    data.allTabOrder[charId] = order;
  }
}

function migrateIsDefault(data: AppData) {
  // ID가 인덱스 기반(_hw_0, _pur_2 등)이면 기본 카드, 타임스탬프 기반이면 유저 추가 카드
  const isDefaultId = (id: string, prefix: string) => {
    const match = id.match(new RegExp(`_${prefix}_(\\d+)$`));
    if (!match) return false;
    return Number(match[1]) < 100; // 기본 카드 인덱스는 100 미만
  };

  for (const charId of Object.keys(data.homework ?? {})) {
    data.homework[charId] = data.homework[charId].map((item) =>
      item.isDefault === undefined ? { ...item, isDefault: isDefaultId(item.id, "hw") } : item
    );
  }
  for (const charId of Object.keys(data.purchaseItems ?? {})) {
    data.purchaseItems[charId] = data.purchaseItems[charId].map((item) =>
      item.isDefault === undefined ? { ...item, isDefault: isDefaultId(item.id, "pur") } : item
    );
  }
  for (const charId of Object.keys(data.tradeItems ?? {})) {
    data.tradeItems[charId] = data.tradeItems[charId].map((item) =>
      item.isDefault === undefined ? { ...item, isDefault: isDefaultId(item.id, "trd") } : item
    );
  }
  for (const charId of Object.keys(data.scrollItems ?? {})) {
    data.scrollItems![charId] = data.scrollItems![charId].map((item) =>
      item.isDefault === undefined ? { ...item, isDefault: isDefaultId(item.id, "scroll") } : item
    );
  }
}

export function createHomeworkForChar(charId: string, defaultCards?: DefaultCardsData): HomeworkItem[] {
  return getDefaultCards(defaultCards).homework.map((hw, i) => ({
    id: `${charId}_hw_${i}`,
    title: hw.title,
    reward: hw.reward,
    period: hw.period,
    totalCount: hw.totalCount || parseTotalCount(hw.title),
    completedCount: 0,
    isFavorite: false,
    isDefault: true,
    defaultKey: hw.title,
    scope: toScope(hw.scope),
  }));
}

export function createPurchaseForChar(charId: string, defaultCards?: DefaultCardsData): ShopItem[] {
  return getDefaultCards(defaultCards).purchaseItems.map((item, i) => ({
    id: `${charId}_pur_${i}`,
    itemName: item.itemName,
    region: item.region,
    npcName: item.npcName,
    period: item.period,
    completed: false,
    isFavorite: false,
    isDefault: true,
    defaultKey: item.itemName,
    scope: toScope(item.scope),
  }));
}

export function createTradeForChar(charId: string, defaultCards?: DefaultCardsData): ShopItem[] {
  return getDefaultCards(defaultCards).tradeItems.map((item, i) => {
    const parsed = parseTradeItemName(item.itemName);
    return {
      id: `${charId}_trd_${i}`,
      itemName: item.itemName,
      region: item.region,
      npcName: item.npcName,
      period: item.period,
      completed: false,
      isFavorite: false,
      isDefault: true,
      defaultKey: item.itemName,
      scope: toScope(item.scope),
      ...(parsed ?? {}),
    };
  });
}

export function createScrollForChar(charId: string, defaultCards?: DefaultCardsData): ScrollItem[] {
  return getDefaultCards(defaultCards).scrollItems.map((item, i) => ({
    id: `${charId}_scroll_${i}`,
    title: item.title,
    scrollType: item.scrollType,
    period: item.period,
    totalCount: item.totalCount || 3,
    completedCount: 0,
    isFavorite: false,
    isDefault: true,
    defaultKey: item.title,
    region: item.region,
    materials: item.materials === "-" ? ["-"] : item.materials.split(",").map((s) => s.trim()),
    reward: item.reward,
  }));
}

function createDefaultData(defaultCards?: DefaultCardsData): AppData {
  const defaultChar: Character = {
    id: "char_default",
    server: "몰리",
    name: "캐릭터닉네임",
    mainClass: "마법사 계열",
    subClass: "화염술사",
  };
  return {
    characters: [defaultChar],
    homework: { [defaultChar.id]: [] },
    purchaseItems: { [defaultChar.id]: [] },
    tradeItems: { [defaultChar.id]: [] },
    scrollItems: { [defaultChar.id]: [] },
    lastDailyReset: new Date().toISOString(),
    lastWeeklyReset: new Date().toISOString(),
  };
}

export function loadData(defaultCards?: DefaultCardsData): AppData {
  if (typeof window === "undefined") return createDefaultData(defaultCards);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData(defaultCards);
    const parsed = JSON.parse(raw) as AppData;
    // 마이그레이션: purchaseItems/tradeItems/scrollItems 없으면 추가
    if (!parsed.purchaseItems) parsed.purchaseItems = {};
    if (!parsed.tradeItems) parsed.tradeItems = {};
    if (!parsed.scrollItems) parsed.scrollItems = {};
    // 마이그레이션: server -> region 필드 변환
    migrateShopItems(parsed.purchaseItems);
    migrateShopItems(parsed.tradeItems);
    // 마이그레이션
    migrateRenames(parsed, defaultCards);
    migrateIsDefault(parsed);
    migrateNewDefaults(parsed, defaultCards);
    return parsed;
  } catch {
    return createDefaultData(defaultCards);
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    clientUpdatedAt: data.clientUpdatedAt ?? new Date().toISOString(),
  }));
}

// ── 리셋 로직 ──
function getKSTDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

/** 일일 리셋: 매일 오전 6시 KST (= UTC 21시 전날) */
function getTodayResetUTC(): Date {
  const kst = getKSTDate();
  const resetKST = new Date(kst);
  resetKST.setUTCHours(6, 0, 0, 0); // KST 06:00
  if (kst.getUTCHours() < 6) {
    resetKST.setUTCDate(resetKST.getUTCDate() - 1);
  }
  return new Date(resetKST.getTime() - 9 * 60 * 60 * 1000);
}

/** 주간 리셋: 매주 월요일 오전 6시 KST */
function getWeeklyResetUTC(): Date {
  const kst = getKSTDate();
  const resetKST = new Date(kst);
  resetKST.setUTCHours(6, 0, 0, 0); // KST 06:00
  const day = kst.getUTCDay(); // 0=일, 1=월, ...
  let diff = day - 1; // 월요일(1) 기준
  if (diff < 0) diff += 7;
  if (diff === 0 && kst.getUTCHours() < 6) diff = 7;
  resetKST.setUTCDate(resetKST.getUTCDate() - diff);
  return new Date(resetKST.getTime() - 9 * 60 * 60 * 1000);
}

/** 다음 일간 리셋까지 남은 밀리초 */
export function getNextDailyResetMs(): number {
  const kst = getKSTDate();
  const nextResetKST = new Date(kst);
  nextResetKST.setUTCHours(6, 0, 0, 0);
  if (kst.getUTCHours() >= 6) {
    nextResetKST.setUTCDate(nextResetKST.getUTCDate() + 1);
  }
  const nextResetUTC = new Date(nextResetKST.getTime() - 9 * 60 * 60 * 1000);
  return nextResetUTC.getTime() - new Date().getTime();
}

/** 다음 주간 리셋까지 남은 밀리초 */
export function getNextWeeklyResetMs(): number {
  const kst = getKSTDate();
  const nextResetKST = new Date(kst);
  nextResetKST.setUTCHours(6, 0, 0, 0);
  const day = kst.getUTCDay();
  let daysUntilMonday = 1 - day;
  if (daysUntilMonday <= 0) daysUntilMonday += 7;
  if (daysUntilMonday === 7 && kst.getUTCHours() >= 6) daysUntilMonday = 7;
  if (day === 1 && kst.getUTCHours() < 6) daysUntilMonday = 0;
  nextResetKST.setUTCDate(nextResetKST.getUTCDate() + daysUntilMonday);
  const nextResetUTC = new Date(nextResetKST.getTime() - 9 * 60 * 60 * 1000);
  return nextResetUTC.getTime() - new Date().getTime();
}

export function applyResets(data: AppData, defaultCards?: DefaultCardsData): AppData {
  // Firestore 로드 시에도 마이그레이션 적용
  migrateRenames(data, defaultCards);
  migrateIsDefault(data);
  migrateNewDefaults(data, defaultCards);

  const dailyReset = getTodayResetUTC();
  const weeklyReset = getWeeklyResetUTC();
  let changed = false;

  if (new Date(data.lastDailyReset) < dailyReset) {
    for (const charId of Object.keys(data.homework)) {
      data.homework[charId] = data.homework[charId].map((hw) =>
        hw.period === "daily" ? { ...hw, completedCount: 0 } : hw
      );
    }
    // 일간 구매/물물교환 초기화
    for (const charId of Object.keys(data.purchaseItems ?? {})) {
      data.purchaseItems[charId] = data.purchaseItems[charId].map((item) =>
        (item.period ?? "daily") === "daily" ? { ...item, completed: false } : item
      );
    }
    for (const charId of Object.keys(data.tradeItems ?? {})) {
      data.tradeItems[charId] = data.tradeItems[charId].map((item) =>
        (item.period ?? "daily") === "daily" ? { ...item, completed: false } : item
      );
    }
    // 일간 임무게시판 초기화
    for (const charId of Object.keys(data.scrollItems ?? {})) {
      data.scrollItems![charId] = data.scrollItems![charId].map((item) =>
        (item.period ?? "weekly") === "daily" ? { ...item, completedCount: 0 } : item
      );
    }
    data.lastDailyReset = dailyReset.toISOString();
    changed = true;
  }

  if (new Date(data.lastWeeklyReset) < weeklyReset) {
    for (const charId of Object.keys(data.homework)) {
      data.homework[charId] = data.homework[charId].map((hw) =>
        hw.period === "weekly" ? { ...hw, completedCount: 0 } : hw
      );
    }
    // 주간 구매/물물교환 초기화
    for (const charId of Object.keys(data.purchaseItems ?? {})) {
      data.purchaseItems[charId] = data.purchaseItems[charId].map((item) =>
        item.period === "weekly" ? { ...item, completed: false } : item
      );
    }
    for (const charId of Object.keys(data.tradeItems ?? {})) {
      data.tradeItems[charId] = data.tradeItems[charId].map((item) =>
        item.period === "weekly" ? { ...item, completed: false } : item
      );
    }
    // 주간 임무게시판 초기화
    for (const charId of Object.keys(data.scrollItems ?? {})) {
      data.scrollItems![charId] = data.scrollItems![charId].map((item) =>
        (item.period ?? "weekly") === "weekly" ? { ...item, completedCount: 0 } : item
      );
    }
    data.lastWeeklyReset = weeklyReset.toISOString();
    changed = true;
  }

  if (changed) saveData(data);
  return data;
}
