import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import type { AppData } from "@/types";
import { parseTotalCount } from "@/types";

/**
 * Firestore에 유저 데이터 저장
 * 경로: users/{uid}
 */
export async function saveUserData(uid: string, data: AppData): Promise<void> {
  const updatedAt = new Date().toISOString();
  await setDoc(doc(db, "users", uid), {
    ...data,
    clientUpdatedAt: updatedAt,
    syncRevision: data.syncRevision ?? `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    updatedAt,
  });
}

/**
 * Firestore 원본 데이터를 앱 데이터로 보정
 */
function normalizeUserData(rawData: AppData & { updatedAt?: string }): AppData {
  const raw = rawData;
  const { updatedAt, ...appData } = raw;
  appData.clientUpdatedAt = updatedAt ?? appData.clientUpdatedAt;

  // 마이그레이션: homework totalCount / scope 보정
  if (appData.homework) {
    for (const charId of Object.keys(appData.homework)) {
      appData.homework[charId] = (appData.homework[charId] as any[]).map((hw: any) => ({
        ...hw,
        totalCount: hw.totalCount || parseTotalCount(hw.title || ""),
        completedCount: hw.completedCount || 0,
        isFavorite: hw.isFavorite ?? false,
        scope: hw.scope || "character",
      }));
    }
  }
  // 마이그레이션: server -> region + scope 보정
  if (appData.purchaseItems) {
    for (const charId of Object.keys(appData.purchaseItems)) {
      appData.purchaseItems[charId] = (appData.purchaseItems[charId] as any[]).map((item: any) => {
        const migrated = { ...item, isFavorite: item.isFavorite ?? false, scope: item.scope || "character" };
        if (migrated.server && !migrated.region) {
          const { server, ...rest } = migrated;
          return { ...rest, region: server };
        }
        return migrated;
      });
    }
  }
  if (appData.tradeItems) {
    for (const charId of Object.keys(appData.tradeItems)) {
      appData.tradeItems[charId] = (appData.tradeItems[charId] as any[]).map((item: any) => {
        const migrated = { ...item, isFavorite: item.isFavorite ?? false, scope: item.scope || "character" };
        if (migrated.server && !migrated.region) {
          const { server, ...rest } = migrated;
          return { ...rest, region: server };
        }
        return migrated;
      });
    }
  }
  return appData as AppData;
}

/**
 * Firestore에서 유저 데이터 로드
 * 없으면 null 반환
 */
export async function loadUserData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const raw = snap.data() as AppData & { updatedAt?: string };
  return normalizeUserData(raw);
}

/**
 * Firestore 유저 데이터 실시간 구독
 */
export function subscribeUserData(
  uid: string,
  onData: (data: AppData | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(normalizeUserData(snap.data() as AppData & { updatedAt?: string }));
    },
    (error) => onError?.(error)
  );
}
