import {
  DEFAULT_HOMEWORK,
  DEFAULT_PURCHASE_ITEMS,
  DEFAULT_SCROLL_ITEMS,
  DEFAULT_TRADE_ITEMS,
} from "@/types";
import {
  getDraftCards,
  getPublishedCards,
  normalizeDefaultCardsData,
  subscribeDraftCards,
  subscribePublishedCards,
  type DefaultCardsData,
} from "@/lib/adminFirestore";

export function getCodeDefaultCards(): DefaultCardsData {
  return normalizeDefaultCardsData({
    homework: DEFAULT_HOMEWORK.map((item) => ({ ...item })),
    purchaseItems: DEFAULT_PURCHASE_ITEMS.map((item) => ({ ...item })),
    tradeItems: DEFAULT_TRADE_ITEMS.map((item) => ({ ...item })),
    scrollItems: DEFAULT_SCROLL_ITEMS.map((item) => ({ ...item })),
  });
}

function isDraftDefaultHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname) || hostname.includes("-git-dev-");
}

export function shouldUseDraftCards(
  draft: DefaultCardsData | null,
  published: DefaultCardsData | null
): draft is DefaultCardsData {
  if (!draft) return false;
  if (!published) return true;
  if (!draft.updatedAt || !published.updatedAt) return true;
  return new Date(draft.updatedAt).getTime() >= new Date(published.updatedAt).getTime();
}

export async function loadRuntimeDefaultCards(): Promise<DefaultCardsData> {
  const codeDefaults = getCodeDefaultCards();

  if (isDraftDefaultHost()) {
    const [published, draft] = await Promise.all([getPublishedCards(), getDraftCards()]);
    if (shouldUseDraftCards(draft, published)) return draft;
    return published ?? codeDefaults;
  }

  const published = await getPublishedCards();
  return published ?? codeDefaults;
}

export function subscribeRuntimeDefaultCards(
  onData: (data: DefaultCardsData) => void,
  onError?: (error: Error) => void
): () => void {
  const codeDefaults = getCodeDefaultCards();
  let draft: DefaultCardsData | null = null;
  let published: DefaultCardsData | null = null;
  let hasDraftSnapshot = !isDraftDefaultHost();
  let hasPublishedSnapshot = false;

  const emit = () => {
    if (!hasPublishedSnapshot || !hasDraftSnapshot) return;
    if (isDraftDefaultHost() && shouldUseDraftCards(draft, published)) {
      onData(draft);
      return;
    }
    onData(published ?? codeDefaults);
  };

  const unsubscribePublished = subscribePublishedCards(
    (data) => {
      published = data;
      hasPublishedSnapshot = true;
      emit();
    },
    onError
  );
  const unsubscribeDraft = isDraftDefaultHost()
    ? subscribeDraftCards(
        (data) => {
          draft = data;
          hasDraftSnapshot = true;
          emit();
        },
        onError
      )
    : undefined;

  return () => {
    unsubscribePublished();
    unsubscribeDraft?.();
  };
}
