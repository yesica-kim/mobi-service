import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PeriodType, ScrollType, RegionName } from "@/types";

// ── 관리자 이메일 체크 ──
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email || !ADMIN_EMAIL) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return ADMIN_EMAIL.split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
    .some((adminEmail) => adminEmail === normalizedEmail);
}

// ── Firestore 기본 카드 데이터 타입 ──
export interface DefaultHomework {
  title: string;
  reward: string;
  period: PeriodType;
  scope?: string;
}

export interface DefaultPurchaseItem {
  itemName: string;
  region: RegionName;
  npcName: string;
  period: PeriodType;
  scope?: string;
}

export interface DefaultTradeItem {
  itemName: string;
  region: RegionName;
  npcName: string;
  period: PeriodType;
  scope?: string;
}

export interface DefaultScrollItem {
  title: string;
  scrollType: ScrollType;
  period: PeriodType;
  region: RegionName;
  materials: string;
  reward: string;
}

export interface DefaultCardsData {
  homework: DefaultHomework[];
  purchaseItems: DefaultPurchaseItem[];
  tradeItems: DefaultTradeItem[];
  scrollItems: DefaultScrollItem[];
  updatedAt?: string;
}

export interface HistoryEntry {
  id: string;
  data: DefaultCardsData;
  summary: string[];
  createdAt: string;
}

// ── Firestore 경로 ──
const COLLECTION = "defaultCards";
const PUBLISHED_DOC = "published";
const DRAFT_DOC = "draft";
const HISTORY_COLLECTION = "defaultCardsHistory";

// ── 읽기 ──
export async function getPublishedCards(): Promise<DefaultCardsData | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, PUBLISHED_DOC));
    return snap.exists() ? (snap.data() as DefaultCardsData) : null;
  } catch (e) {
    console.error("published 로드 실패:", e);
    return null;
  }
}

export async function getDraftCards(): Promise<DefaultCardsData | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, DRAFT_DOC));
    return snap.exists() ? (snap.data() as DefaultCardsData) : null;
  } catch (e) {
    console.error("draft 로드 실패:", e);
    return null;
  }
}

// ── 쓰기 ──
/** 로컬 업로드: draft에 저장 */
export async function saveDraft(data: DefaultCardsData): Promise<void> {
  await setDoc(doc(db, COLLECTION, DRAFT_DOC), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** 실섭 업로드: draft → published + 히스토리 생성 */
export async function publishDraft(
  newData: DefaultCardsData,
  changeSummary: string[]
): Promise<void> {
  // published에 저장
  await setDoc(doc(db, COLLECTION, PUBLISHED_DOC), {
    ...newData,
    updatedAt: new Date().toISOString(),
  });
  // draft 삭제 (published와 동일하므로)
  await deleteDoc(doc(db, COLLECTION, DRAFT_DOC));
  // 히스토리 생성
  const historyId = new Date().toISOString();
  await setDoc(doc(db, HISTORY_COLLECTION, historyId), {
    data: newData,
    summary: changeSummary,
    createdAt: historyId,
  });
}

/** draft 삭제 (초기화 시) */
export async function deleteDraft(): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, DRAFT_DOC));
}

// ── 히스토리 ──
export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const q = query(collection(db, HISTORY_COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const entries: HistoryEntry[] = [];
    const now = Date.now();
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

    for (const d of snap.docs) {
      const data = d.data();
      const createdAt = data.createdAt as string;
      // 14일 지난 항목 자동 삭제
      if (now - new Date(createdAt).getTime() > FOURTEEN_DAYS) {
        await deleteDoc(doc(db, HISTORY_COLLECTION, d.id));
        continue;
      }
      entries.push({
        id: d.id,
        data: data.data as DefaultCardsData,
        summary: data.summary as string[],
        createdAt,
      });
    }
    return entries;
  } catch (e) {
    console.error("히스토리 로드 실패:", e);
    return [];
  }
}

/** 히스토리에서 롤백: 해당 데이터를 published로 복원 */
export async function rollbackToHistory(entry: HistoryEntry): Promise<void> {
  await setDoc(doc(db, COLLECTION, PUBLISHED_DOC), {
    ...entry.data,
    updatedAt: new Date().toISOString(),
  });
  // draft도 삭제
  await deleteDoc(doc(db, COLLECTION, DRAFT_DOC));
}

// ── 변경사항 비교 (자동 요약 생성) ──
export function generateChangeSummary(
  oldData: DefaultCardsData,
  newData: DefaultCardsData
): string[] {
  const changes: string[] = [];

  // 숙제 비교
  diffList(
    oldData.homework.map((h) => h.title),
    newData.homework.map((h) => h.title),
    "숙제",
    changes
  );
  // 숙제 내용 변경 (같은 타이틀인데 보상/주기 변경)
  for (const newItem of newData.homework) {
    const oldItem = oldData.homework.find((h) => h.title === newItem.title);
    if (oldItem) {
      if (oldItem.reward !== newItem.reward) {
        changes.push(`숙제 보상 수정: ${newItem.title}`);
      }
      if (oldItem.period !== newItem.period) {
        changes.push(`숙제 주기 수정: ${newItem.title} (${oldItem.period} → ${newItem.period})`);
      }
    }
  }

  // 구매 비교
  diffList(
    oldData.purchaseItems.map((p) => p.itemName),
    newData.purchaseItems.map((p) => p.itemName),
    "구매",
    changes
  );

  // 물물교환 비교
  diffList(
    oldData.tradeItems.map((t) => t.itemName),
    newData.tradeItems.map((t) => t.itemName),
    "물물교환",
    changes
  );

  // 임무게시판 비교
  diffList(
    oldData.scrollItems.map((s) => s.title),
    newData.scrollItems.map((s) => s.title),
    "임무게시판",
    changes
  );

  return changes.length > 0 ? changes : ["변경사항 없음"];
}

function diffList(oldNames: string[], newNames: string[], category: string, changes: string[]) {
  const oldSet = new Set(oldNames);
  const newSet = new Set(newNames);

  for (const name of newNames) {
    if (!oldSet.has(name)) changes.push(`${category} 추가: ${name}`);
  }
  for (const name of oldNames) {
    if (!newSet.has(name)) changes.push(`${category} 삭제: ${name}`);
  }
}
