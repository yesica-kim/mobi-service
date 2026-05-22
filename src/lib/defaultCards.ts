import {
  DEFAULT_HOMEWORK,
  DEFAULT_PURCHASE_ITEMS,
  DEFAULT_SCROLL_ITEMS,
  DEFAULT_TRADE_ITEMS,
} from "@/types";
import {
  getDraftCards,
  getPublishedCards,
  type DefaultCardsData,
} from "@/lib/adminFirestore";

export function getCodeDefaultCards(): DefaultCardsData {
  return {
    homework: DEFAULT_HOMEWORK.map((item) => ({ ...item })),
    purchaseItems: DEFAULT_PURCHASE_ITEMS.map((item) => ({ ...item })),
    tradeItems: DEFAULT_TRADE_ITEMS.map((item) => ({ ...item })),
    scrollItems: DEFAULT_SCROLL_ITEMS.map((item) => ({ ...item })),
  };
}

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export async function loadRuntimeDefaultCards(): Promise<DefaultCardsData> {
  const codeDefaults = getCodeDefaultCards();

  if (isLocalHost()) {
    const draft = await getDraftCards();
    if (draft) return draft;
    const published = await getPublishedCards();
    return published ?? codeDefaults;
  }

  const published = await getPublishedCards();
  return published ?? codeDefaults;
}
