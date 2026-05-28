import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppData, AutoBackupSnapshot } from "@/types";
import { parseTotalCount } from "@/types";

const MAX_CLOUD_BACKUPS = 15;

function createSyncRevision(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function removeUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedValues(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, removeUndefinedValues(entry)])
    ) as T;
  }
  return value;
}

function getBackupCollection(uid: string) {
  return collection(db, "users", uid, "automaticBackups");
}

async function loadAutomaticBackups(uid: string): Promise<AutoBackupSnapshot[]> {
  try {
    const backupQuery = query(
      getBackupCollection(uid),
      orderBy("createdAt", "desc"),
      limit(MAX_CLOUD_BACKUPS)
    );
    const snap = await getDocs(backupQuery);
    return snap.docs.map((backupDoc) => backupDoc.data() as AutoBackupSnapshot);
  } catch (error) {
    console.warn("자동백업 하위 컬렉션 로드 실패:", error);
    return [];
  }
}

/**
 * Firestore에 유저 데이터 저장
 * 경로: users/{uid}
 */
export async function saveUserData(uid: string, data: AppData): Promise<void> {
  const updatedAt = new Date().toISOString();
  const backups = (data.automaticBackups ?? []).slice(0, MAX_CLOUD_BACKUPS);
  const { automaticBackups, ...dataWithoutBackups } = data;
  const batch = writeBatch(db);
  const userRef = doc(db, "users", uid);
  const backupCollection = getBackupCollection(uid);

  await setDoc(userRef, removeUndefinedValues({
    ...dataWithoutBackups,
    clientUpdatedAt: updatedAt,
    syncRevision: data.syncRevision ?? createSyncRevision(),
    updatedAt,
  }));

  try {
    const existingBackups = await getDocs(backupCollection);
    const keepBackupIds = new Set(backups.map((backup) => backup.id));
    backups.forEach((backup) => {
      batch.set(doc(backupCollection, backup.id), removeUndefinedValues(backup));
    });
    existingBackups.docs.forEach((backupDoc) => {
      if (!keepBackupIds.has(backupDoc.id)) {
        batch.delete(backupDoc.ref);
      }
    });
    await batch.commit();
  } catch (error) {
    console.warn("자동백업 하위 컬렉션 저장 실패:", error);
  }
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
  const cloudBackups = await loadAutomaticBackups(uid);
  return normalizeUserData({
    ...raw,
    automaticBackups: cloudBackups.length > 0 ? cloudBackups : raw.automaticBackups,
  });
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
    async (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      try {
        const raw = snap.data() as AppData & { updatedAt?: string };
        const cloudBackups = await loadAutomaticBackups(uid);
        onData(normalizeUserData({
          ...raw,
          automaticBackups: cloudBackups.length > 0 ? cloudBackups : raw.automaticBackups,
        }));
      } catch (error) {
        onError?.(error as Error);
      }
    },
    (error) => onError?.(error)
  );
}
