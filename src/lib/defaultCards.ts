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

function isDraftDefaultHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname) || hostname.includes("-git-dev-");
}

export async function loadRuntimeDefaultCards(): Promise<DefaultCardsData> {
  const codeDefaults = getCodeDefaultCards();

  if (isDraftDefaultHost()) {
    const draft = await getDraftCards();
    if (draft) return draft;
    const published = await getPublishedCards();
    return published ?? codeDefaults;
  }

  const published = await getPublishedCards();
  return published ?? codeDefaults;
}
