import type { AppData, Character, HomeworkItem, ShopItem } from "@/types";
import { DEFAULT_HOMEWORK, DEFAULT_PURCHASE_ITEMS, DEFAULT_TRADE_ITEMS, parseTotalCount, toScope } from "@/types";

const STORAGE_KEY = "mabimobi_data";

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

export function createHomeworkForChar(charId: string): HomeworkItem[] {
  return DEFAULT_HOMEWORK.map((hw, i) => ({
    id: `${charId}_hw_${i}`,
    title: hw.title,
    reward: hw.reward,
    period: hw.period,
    totalCount: parseTotalCount(hw.title),
    completedCount: 0,
    isFavorite: false,
    scope: toScope(hw.scope),
  }));
}

export function createPurchaseForChar(charId: string): ShopItem[] {
  return DEFAULT_PURCHASE_ITEMS.map((item, i) => ({
    id: `${charId}_pur_${i}`,
    itemName: item.itemName,
    region: item.region,
    npcName: item.npcName,
    completed: false,
    isFavorite: false,
    scope: toScope(item.scope),
  }));
}

export function createTradeForChar(charId: string): ShopItem[] {
  return DEFAULT_TRADE_ITEMS.map((item, i) => ({
    id: `${charId}_trd_${i}`,
    itemName: item.itemName,
    region: item.region,
    npcName: item.npcName,
    completed: false,
    isFavorite: false,
    scope: toScope(item.scope),
  }));
}

function createDefaultData(): AppData {
  const defaultChar: Character = {
    id: "char_default",
    server: "몰리",
    name: "캐릭터닉네임",
    mainClass: "마법사 계열",
    subClass: "화염술사",
  };
  return {
    characters: [defaultChar],
    homework: { [defaultChar.id]: createHomeworkForChar(defaultChar.id) },
    purchaseItems: { [defaultChar.id]: createPurchaseForChar(defaultChar.id) },
    tradeItems: { [defaultChar.id]: createTradeForChar(defaultChar.id) },
    lastDailyReset: new Date().toISOString(),
    lastWeeklyReset: new Date().toISOString(),
  };
}

export function loadData(): AppData {
  if (typeof window === "undefined") return createDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();
    const parsed = JSON.parse(raw) as AppData;
    // 마이그레이션: purchaseItems/tradeItems/scrollItems 없으면 추가
    if (!parsed.purchaseItems) parsed.purchaseItems = {};
    if (!parsed.tradeItems) parsed.tradeItems = {};
    if (!parsed.scrollItems) parsed.scrollItems = {};
    // 마이그레이션: server -> region 필드 변환
    migrateShopItems(parsed.purchaseItems);
    migrateShopItems(parsed.tradeItems);
    return parsed;
  } catch {
    return createDefaultData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

export function applyResets(data: AppData): AppData {
  const dailyReset = getTodayResetUTC();
  const weeklyReset = getWeeklyResetUTC();
  let changed = false;

  if (new Date(data.lastDailyReset) < dailyReset) {
    for (const charId of Object.keys(data.homework)) {
      data.homework[charId] = data.homework[charId].map((hw) =>
        hw.period === "daily" ? { ...hw, completedCount: 0 } : hw
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
    // 주간 리셋 시 구매/물물교환도 초기화
    for (const charId of Object.keys(data.purchaseItems ?? {})) {
      data.purchaseItems[charId] = data.purchaseItems[charId].map((item) => ({ ...item, completed: false }));
    }
    for (const charId of Object.keys(data.tradeItems ?? {})) {
      data.tradeItems[charId] = data.tradeItems[charId].map((item) => ({ ...item, completed: false }));
    }
    data.lastWeeklyReset = weeklyReset.toISOString();
    changed = true;
  }

  if (changed) saveData(data);
  return data;
}
