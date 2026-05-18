import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AppData } from "@/types";
import { parseTotalCount } from "@/types";

/**
 * Firestore에 유저 데이터 저장
 * 경로: users/{uid}
 */
export async function saveUserData(uid: string, data: AppData): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Firestore에서 유저 데이터 로드
 * 없으면 null 반환
 */
export async function loadUserData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const raw = snap.data() as AppData & { updatedAt?: string };
  // updatedAt 필드 제거 후 반환
  const { updatedAt, ...appData } = raw;
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
