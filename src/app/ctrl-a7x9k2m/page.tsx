"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { SortableList } from "@/components/SortableList";
import { AddCardModal, type EditCard } from "@/components/AddCardModal";
import { AppConfirmModal } from "@/components/AppConfirmModal";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  isAdminFirebaseUser,
  getPublishedCards,
  getDraftCards,
  saveDraft,
  publishDraft,
  deleteDraft,
  getHistory,
  rollbackToHistory,
  generateChangeSummary,
  getAdminFirestoreErrorMessage,
  type DefaultCardsData,
  type DefaultHomework,
  type DefaultPurchaseItem,
  type DefaultTradeItem,
  type DefaultScrollItem,
  type HistoryEntry,
} from "@/lib/adminFirestore";
import {
  DEFAULT_HOMEWORK,
  DEFAULT_PURCHASE_ITEMS,
  DEFAULT_TRADE_ITEMS,
  DEFAULT_SCROLL_ITEMS,
  parseTotalCount,
  type PeriodType,
  type RegionName,
  type ScopeType,
  type ScrollType,
} from "@/types";

type AdminCategory = "homework" | "purchase" | "trade" | "scroll";
type AdminTab = "all" | AdminCategory;
type AdminBadge = { label: string; className: string; plain?: boolean };
type AdminRow = { id: string; tab: AdminCategory; index: number; item: any };

const ADMIN_PERIOD_BADGES: Record<PeriodType, AdminBadge> = {
  daily: { label: "일간", className: "bg-orange-600/20 text-orange-400" },
  weekly: { label: "주간", className: "bg-green-600/20 text-green-400" },
};

const ADMIN_SCOPE_BADGES: Record<"character" | "server", AdminBadge> = {
  character: { label: "캐릭터", className: "bg-blue-600/20 text-blue-400" },
  server: { label: "서버", className: "bg-teal-600/20 text-teal-400" },
};

const ADMIN_REGION_BADGES: Record<string, AdminBadge> = {
  "콜헨": { label: "콜헨", className: "bg-red-600/20 text-red-400" },
  "티르코네일": { label: "티르코네일", className: "bg-sky-600/20 text-sky-400" },
  "두갈드아일": { label: "두갈드아일", className: "bg-amber-600/20 text-amber-400" },
  "던바튼": { label: "던바튼", className: "bg-violet-600/20 text-violet-400" },
  "가이레흐 언덕": { label: "가이레흐 언덕", className: "bg-pink-600/20 text-pink-400" },
  "반호르": { label: "반호르", className: "bg-orange-600/20 text-orange-400" },
  "이멘마하": { label: "이멘마하", className: "bg-cyan-600/20 text-cyan-400" },
  "캐시샵": { label: "캐시샵", className: "bg-fuchsia-600/20 text-fuchsia-400" },
};

const ADMIN_SCROLL_TYPE_BADGES: Record<ScrollType, AdminBadge> = {
  "제작": { label: "제작", className: "bg-indigo-600/20 text-indigo-400" },
  "채집": { label: "채집", className: "bg-emerald-600/20 text-emerald-400" },
  "요리": { label: "요리", className: "bg-amber-600/20 text-amber-400" },
  "토벌": { label: "토벌", className: "bg-red-600/20 text-red-400" },
};

function getAdminActorEmail(user: {
  email?: string | null;
  providerData?: { email?: string | null }[];
} | null | undefined): string {
  const email = user?.email ?? user?.providerData?.find((provider) => provider.email)?.email;
  return email?.trim().toLowerCase() || "알 수 없음";
}

function normalizeAdminScope(scope?: string): "character" | "server" {
  return scope === "on" || scope === "server" ? "server" : "character";
}

function splitAdminTags(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(",");
  return list.map((item) => item.trim()).filter((item) => item && item !== "-");
}

function adminKey(tab: AdminCategory): keyof DefaultCardsData {
  return tab === "homework" ? "homework" : tab === "purchase" ? "purchaseItems" : tab === "trade" ? "tradeItems" : "scrollItems";
}

function toScopeType(scope?: string): ScopeType {
  return scope === "on" || scope === "server" ? "server" : "character";
}

function toMaterialList(materials: string | string[] | undefined): string[] {
  return splitAdminTags(materials);
}

function toMaterialString(materials: string[] | undefined): string {
  return materials && materials.length > 0 ? materials.join(", ") : "-";
}

function formatAdminDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// ── 코드 하드코딩 → DefaultCardsData 변환 ──
function codeDefaultsToData(): DefaultCardsData {
  return {
    homework: DEFAULT_HOMEWORK.map((h) => ({ ...h })),
    purchaseItems: DEFAULT_PURCHASE_ITEMS.map((p) => ({ ...p })),
    tradeItems: DEFAULT_TRADE_ITEMS.map((t) => ({ ...t })),
    scrollItems: DEFAULT_SCROLL_ITEMS.map((s) => ({ ...s })),
  };
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  // 데이터 상태
  const [publishedData, setPublishedData] = useState<DefaultCardsData | null>(null);
  const [editData, setEditData] = useState<DefaultCardsData>(codeDefaultsToData());
  const [draftSaved, setDraftSaved] = useState(false); // Dev 저장 완료 여부

  // UI 상태
  const [activeTab, setActiveTab] = useState<AdminTab>("all");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ tab: AdminCategory; index: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<HistoryEntry | null>(null);

  // 편집 모달 상태
  const [editModal, setEditModal] = useState<{
    type: AdminCategory;
    index: number | null; // null = 새로 추가
    data: any;
  } | null>(null);

  // ── 권한 확인 ──
  useEffect(() => {
    if (authLoading) return;
    if (isAdminFirebaseUser(user)) {
      setAuthorized(true);
    } else {
      setAuthorized(false);
      setLoading(false);
    }
    setAuthChecked(true);
  }, [user, authLoading]);

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const published = await getPublishedCards();
      const draft = await getDraftCards();
      const base = published ?? codeDefaultsToData();
      setPublishedData(base);
      if (draft) {
        setEditData(draft);
        setDraftSaved(true);
      } else {
        setEditData(structuredClone(base));
        setDraftSaved(false);
      }
      setLoading(false);
    })();
  }, [authorized]);

  // ── 변경 여부 ──
  const hasChanges = useMemo(() => {
    if (!publishedData) return false;
    return !deepEqual(publishedData, editData);
  }, [publishedData, editData]);

  const actorEmail = useMemo(() => getAdminActorEmail(user), [user]);

  // ── 액션 ──
  const showStatus = (msg: string, duration = 3000) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), duration);
  };

  const handleReset = useCallback(async () => {
    if (!publishedData) return;
    setEditData(structuredClone(publishedData));
    setDraftSaved(false);
    await deleteDraft();
    setShowResetConfirm(false);
    showStatus("초기화 완료");
  }, [publishedData]);

  const handleDevSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveDraft(editData);
      setDraftSaved(true);
      showStatus("Dev 저장 완료 — 개발 섭에서 확인하세요");
    } catch (e) {
      showStatus(`Dev 저장 실패: ${getAdminFirestoreErrorMessage(e)}`, 12000);
      console.error(e);
    }
    setSaving(false);
  }, [editData]);

  const handlePublish = useCallback(async () => {
    if (!publishedData) return;
    setSaving(true);
    try {
      const summary = generateChangeSummary(publishedData, editData);
      await publishDraft(editData, summary, actorEmail, user?.uid);
      setPublishedData(structuredClone(editData));
      setDraftSaved(false);
      setShowPublishConfirm(false);
      showStatus("실섭 업로드 완료!");
    } catch (e) {
      showStatus(`실섭 업로드 실패: ${getAdminFirestoreErrorMessage(e)}`, 12000);
      console.error(e);
    }
    setSaving(false);
  }, [publishedData, editData, actorEmail, user?.uid]);

  const handleShowHistory = useCallback(async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    const entries = await getHistory();
    setHistory(entries);
    setHistoryLoading(false);
  }, []);

  const handleRollback = useCallback(async (entry: HistoryEntry) => {
    try {
      await rollbackToHistory(entry, actorEmail, user?.uid);
      setPublishedData(structuredClone(entry.data));
      setEditData(structuredClone(entry.data));
      setDraftSaved(false);
      setShowHistory(false);
      setRollbackTarget(null);
      showStatus("롤백 완료!");
    } catch (e) {
      showStatus("롤백 실패");
      console.error(e);
    }
  }, [actorEmail, user?.uid]);

  // ── 카드 CRUD ──
  const deleteItem = useCallback(
    (tab: AdminCategory, index: number) => {
      setEditData((prev) => {
        const key = adminKey(tab);
        const arr = [...(prev[key] as any[])];
        arr.splice(index, 1);
        return { ...prev, [key]: arr };
      });
      setDeleteTarget(null);
    },
    []
  );

  const upsertAdminItem = useCallback((type: AdminCategory, index: number | null, data: any) => {
    setEditData((prev) => {
      const key = adminKey(type);
      const arr = [...(prev[key] as any[])];
      if (index === null) {
        arr.unshift(data);
      } else {
        arr[index] = data;
      }
      return { ...prev, [key]: arr };
    });
    setEditModal(null);
  }, []);

  const reorderItems = useCallback((tab: AdminCategory, oldIndex: number, newIndex: number) => {
    setEditData((prev) => {
      const key = adminKey(tab);
      const arr = [...(prev[key] as any[])];
      const [moved] = arr.splice(oldIndex, 1);
      if (!moved) return prev;
      arr.splice(newIndex, 0, moved);
      return { ...prev, [key]: arr };
    });
  }, []);

  const createEmptyData = (tab: AdminCategory) =>
    tab === "homework"
      ? { title: "", reward: "-", period: "daily" as PeriodType, totalCount: 1, scope: "character" as ScopeType }
      : tab === "purchase"
      ? { itemName: "", region: "던바튼" as RegionName, npcName: "", period: "daily" as PeriodType, scope: "character" as ScopeType }
      : tab === "trade"
      ? { itemName: "", region: "던바튼" as RegionName, npcName: "", period: "weekly" as PeriodType, scope: "character" as ScopeType }
      : { title: "", scrollType: "제작" as ScrollType, period: "weekly" as PeriodType, totalCount: 3, region: "던바튼" as RegionName, materials: "-", reward: "-" };

  const adminRows = useMemo<AdminRow[]>(() => {
    const rows: AdminRow[] = [];
    if (activeTab === "all" || activeTab === "homework") {
      editData.homework.forEach((item, index) => rows.push({ id: `homework-${index}`, tab: "homework", index, item }));
    }
    if (activeTab === "all" || activeTab === "purchase") {
      editData.purchaseItems.forEach((item, index) => rows.push({ id: `purchase-${index}`, tab: "purchase", index, item }));
    }
    if (activeTab === "all" || activeTab === "trade") {
      editData.tradeItems.forEach((item, index) => rows.push({ id: `trade-${index}`, tab: "trade", index, item }));
    }
    if (activeTab === "all" || activeTab === "scroll") {
      editData.scrollItems.forEach((item, index) => rows.push({ id: `scroll-${index}`, tab: "scroll", index, item }));
    }
    return rows;
  }, [activeTab, editData]);

  const activeItems = useMemo(() => adminRows.map((row) => ({ id: row.id })), [adminRows]);

  const reorderRows = useCallback((oldIndex: number, newIndex: number) => {
    const from = adminRows[oldIndex];
    const to = adminRows[newIndex];
    if (!from || !to || from.tab !== to.tab) return;
    reorderItems(from.tab, from.index, to.index);
  }, [adminRows, reorderItems]);

  const openAddModal = useCallback(() => {
    const type: AdminCategory = activeTab === "all" ? "homework" : activeTab;
    setEditModal({ type, index: null, data: createEmptyData(type) });
  }, [activeTab]);

  const editCardForModal = useMemo<EditCard | null>(() => {
    if (!editModal || editModal.index === null) return null;
    const data = editModal.data;
    const id = `admin-${editModal.type}-${editModal.index}`;
    if (editModal.type === "homework") {
      return {
        type: "homework",
        item: {
          id,
          title: data.title ?? "",
          reward: data.reward ?? "-",
          period: data.period ?? "daily",
          totalCount: data.totalCount || parseTotalCount(data.title ?? ""),
          completedCount: 0,
          isFavorite: false,
          scope: toScopeType(data.scope),
          isDefault: true,
        },
      };
    }
    if (editModal.type === "purchase" || editModal.type === "trade") {
      return {
        type: editModal.type,
        item: {
          id,
          itemName: data.itemName ?? "",
          region: data.region ?? "던바튼",
          npcName: data.npcName ?? "-",
          period: data.period ?? (editModal.type === "trade" ? "weekly" : "daily"),
          completed: false,
          isFavorite: false,
          scope: toScopeType(data.scope),
          isDefault: true,
        },
      };
    }
    return {
      type: "scroll",
      item: {
        id,
        title: data.title ?? "",
        scrollType: data.scrollType ?? "제작",
        period: data.period ?? "weekly",
        totalCount: data.totalCount || 3,
        completedCount: 0,
        isFavorite: false,
        scope: "character",
        region: data.region ?? "던바튼",
        materials: toMaterialList(data.materials),
        reward: data.reward ?? "-",
        isDefault: true,
      },
    };
  }, [editModal]);

  const initialModalType = useMemo(() => {
    if (!editModal) return "daily";
    if (editModal.type === "purchase" || editModal.type === "trade" || editModal.type === "scroll") return editModal.type;
    return editModal.data?.period === "weekly" ? "weekly" : "daily";
  }, [editModal]);

  // ── 로딩/비인가 ──
  if (authLoading || !authChecked || (authorized && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">
          {authLoading ? "인증 확인 중..." : "데이터 불러오는 중..."}
        </div>
      </div>
    );
  }

  if (!authorized) {
    const emails = [user?.email, ...(user?.providerData?.map((provider) => provider.email) ?? [])]
      .filter(Boolean)
      .join(" / ");
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm font-bold text-red-400">관리자 권한을 확인할 수 없습니다</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            현재 로그인 이메일
          </p>
          <p className="mt-1 break-all text-xs text-slate-300">
            {emails || "로그인 정보 없음"}
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="mt-5 w-full rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; count: number }[] = [
    {
      id: "all",
      label: "전체",
      count: editData.homework.length + editData.purchaseItems.length + editData.tradeItems.length + editData.scrollItems.length,
    },
    { id: "homework", label: "숙제", count: editData.homework.length },
    { id: "purchase", label: "구매", count: editData.purchaseItems.length },
    { id: "trade", label: "물물교환", count: editData.tradeItems.length },
    { id: "scroll", label: "임무게시판", count: editData.scrollItems.length },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-bold text-blue-500 cursor-pointer"
              onClick={() => (window.location.href = "/")}
            >
              mobimobi
            </h1>
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-600/20 text-red-400">
              관리자
            </span>
          </div>
          <span className="text-xs text-slate-500">{user?.email}</span>
        </div>
      </header>

      {/* 탭 */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-1 bg-slate-900/50 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {t.label}
              <span className="ml-1 text-[11px] opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
        <button
          onClick={openAddModal}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-slate-700 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-400"
        >
          + 카드 추가
        </button>
      </div>

      {/* 카드 목록 */}
      <div className="max-w-3xl mx-auto w-full px-4 py-4 flex-1 overflow-y-auto">
        <SortableList items={activeItems} onReorder={reorderRows}>
          <div className="space-y-2">
            {adminRows.map((row) => {
              if (row.tab === "homework") {
                const item = row.item as DefaultHomework;
                return (
                <CardRow
                  key={row.id}
                  id={row.id}
                  title={item.title}
                  badges={[
                    ADMIN_PERIOD_BADGES[item.period],
                    ADMIN_SCOPE_BADGES[normalizeAdminScope(item.scope)],
                  ]}
                  details={splitAdminTags(item.reward).map((label) => ({ label, className: "border border-slate-600/50 text-slate-400" }))}
                  onEdit={() =>
                    setEditModal({ type: "homework", index: row.index, data: { ...item } })
                  }
                  onDelete={() => setDeleteTarget({ tab: "homework", index: row.index })}
                />
                );
              }
              if (row.tab === "purchase") {
                const item = row.item as DefaultPurchaseItem;
                return (
                <CardRow
                  key={row.id}
                  id={row.id}
                  title={item.itemName}
                  badges={[
                    ADMIN_PERIOD_BADGES[item.period],
                    ADMIN_SCOPE_BADGES[normalizeAdminScope(item.scope)],
                    ADMIN_REGION_BADGES[item.region],
                  ]}
                  details={splitAdminTags(item.npcName).map((label) => ({ label, className: "text-slate-400", plain: true }))}
                  onEdit={() =>
                    setEditModal({ type: "purchase", index: row.index, data: { ...item } })
                  }
                  onDelete={() => setDeleteTarget({ tab: "purchase", index: row.index })}
                />
                );
              }
              if (row.tab === "trade") {
                const item = row.item as DefaultTradeItem;
                return (
                <CardRow
                  key={row.id}
                  id={row.id}
                  title={item.itemName}
                  badges={[
                    ADMIN_PERIOD_BADGES[item.period],
                    ADMIN_SCOPE_BADGES[normalizeAdminScope(item.scope)],
                    ADMIN_REGION_BADGES[item.region],
                  ]}
                  details={splitAdminTags(item.npcName).map((label) => ({ label, className: "text-slate-400", plain: true }))}
                  onEdit={() =>
                    setEditModal({ type: "trade", index: row.index, data: { ...item } })
                  }
                  onDelete={() => setDeleteTarget({ tab: "trade", index: row.index })}
                />
                );
              }
              const item = row.item as DefaultScrollItem;
              return (
                <CardRow
                  key={row.id}
                  id={row.id}
                  title={item.title}
                  badges={[
                    ADMIN_PERIOD_BADGES[item.period],
                    ADMIN_REGION_BADGES[item.region],
                    ADMIN_SCROLL_TYPE_BADGES[item.scrollType],
                  ]}
                  details={[
                    ...splitAdminTags(item.materials).map((label) => ({ label, className: "bg-slate-700 text-slate-400" })),
                    ...splitAdminTags(item.reward).map((label) => ({ label, className: "text-slate-500", plain: true })),
                  ]}
                  onEdit={() =>
                    setEditModal({ type: "scroll", index: row.index, data: { ...item } })
                  }
                  onDelete={() => setDeleteTarget({ tab: "scroll", index: row.index })}
                />
              );
            })}
          </div>
        </SortableList>
      </div>

      {/* 하단 액션 바 */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {statusMsg && (
            <div className="text-center text-sm text-green-400 mb-2">{statusMsg}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={!hasChanges && !draftSaved}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                hasChanges || draftSaved
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              초기화
            </button>
            <button
              onClick={handleDevSave}
              disabled={!hasChanges || saving}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                hasChanges && !saving
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {saving ? "저장 중..." : "Dev 저장"}
            </button>
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={!draftSaved || !hasChanges || saving}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                draftSaved && hasChanges && !saving
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              실섭 업로드
            </button>
            <button
              onClick={handleShowHistory}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              히스토리
            </button>
          </div>
        </div>
      </div>

      {/* 편집 모달 */}
      {editModal && (
        <AddCardModal
          open={!!editModal}
          initialType={initialModalType}
          editCard={editCardForModal}
          onClose={() => setEditModal(null)}
          onAddHomework={(hw) => upsertAdminItem("homework", null, hw)}
          onAddShopItem={(type, item) => upsertAdminItem(type, null, item)}
          onAddScrollItem={(item) =>
            upsertAdminItem("scroll", null, {
              ...item,
              materials: toMaterialString(item.materials),
            })
          }
          onUpdateHomework={(_, updates) => {
            if (!editModal || editModal.type !== "homework") return;
            upsertAdminItem("homework", editModal.index, {
              ...editModal.data,
              ...updates,
            });
          }}
          onUpdateShopItem={(_, type, updates) => {
            if (!editModal || editModal.type !== type) return;
            upsertAdminItem(type, editModal.index, {
              ...editModal.data,
              ...updates,
            });
          }}
          onUpdateScrollItem={(_, updates) => {
            if (!editModal || editModal.type !== "scroll") return;
            upsertAdminItem("scroll", editModal.index, {
              ...editModal.data,
              ...updates,
              materials: toMaterialString(updates.materials ?? toMaterialList(editModal.data.materials)),
            });
          }}
        />
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <HistoryModal
          history={history}
          loading={historyLoading}
          onSelectRollback={setRollbackTarget}
          onClose={() => {
            setShowHistory(false);
            setRollbackTarget(null);
          }}
        />
      )}

      {showResetConfirm && (
        <AppConfirmModal
          open={showResetConfirm}
          title="수정사항을 초기화할까요?"
          description="현재 편집 중인 내용과 Dev 저장본을 버리고 현재 실섭 데이터로 되돌립니다."
          confirmLabel="초기화"
          variant="danger"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={handleReset}
        />
      )}

      {showPublishConfirm && (
        <AppConfirmModal
          open={showPublishConfirm}
          title="실섭에 업로드할까요?"
          description="현재 Dev 저장본을 실섭 기본 카드로 반영합니다. 모든 사용자에게 적용될 수 있습니다."
          confirmLabel={saving ? "업로드 중..." : "업로드"}
          variant="primary"
          onCancel={() => setShowPublishConfirm(false)}
          onConfirm={handlePublish}
          disabled={saving}
        />
      )}

      {deleteTarget && (
        <AppConfirmModal
          open={!!deleteTarget}
          title="카드를 삭제할까요?"
          description="삭제한 카드는 Dev 저장 후 실섭 업로드 전까지 편집 데이터에만 반영됩니다."
          confirmLabel="삭제"
          variant="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteItem(deleteTarget.tab, deleteTarget.index)}
        />
      )}

      {rollbackTarget && (
        <AppConfirmModal
          open={!!rollbackTarget}
          title="롤백하시겠습니까?"
          description={`${formatAdminDate(rollbackTarget.createdAt)} 시점으로 되돌립니다.`}
          confirmLabel="롤백"
          variant="danger"
          onCancel={() => setRollbackTarget(null)}
          onConfirm={() => handleRollback(rollbackTarget)}
        />
      )}
    </div>
  );
}

// ── 카드 행 컴포넌트 ──
function CardRow({
  id,
  title,
  badges,
  details,
  onEdit,
  onDelete,
}: {
  id: string;
  title: string;
  badges: AdminBadge[];
  details?: AdminBadge[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-800/50"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        title="드래그하여 순서 변경"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          {badges.filter(Boolean).map((badge) => (
            <span
              key={`${id}-${badge.label}`}
              className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <p className="mt-1.5 whitespace-normal break-keep text-sm font-medium leading-snug text-white">{title || "(제목 없음)"}</p>
        {details && details.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {details.map((detail, idx) => (
              <span
                key={`${id}-detail-${idx}-${detail.label}`}
                className={detail.plain ? `text-[11px] ${detail.className}` : `rounded-md px-1.5 py-0.5 text-[11px] ${detail.className}`}
              >
                {detail.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
          title="수정"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          title="삭제"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── 히스토리 모달 ──
function HistoryModal({
  history,
  loading,
  onSelectRollback,
  onClose,
}: {
  history: HistoryEntry[];
  loading: boolean;
  onSelectRollback: (entry: HistoryEntry | null) => void;
  onClose: () => void;
}) {
  useEscapeClose(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">히스토리</h3>
          <span className="text-[11px] text-slate-500">30일 이내 보관</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-8">로딩 중...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">히스토리가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelectRollback(entry)}
                  className="w-full text-left bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 hover:border-blue-500/50 transition-colors"
                >
                  <p className="text-sm font-medium text-white">
                    {formatAdminDate(entry.createdAt)}
                  </p>
                  <p className="mt-1 break-all text-xs font-medium text-blue-300">
                    {entry.actorEmail ?? "알 수 없음"}
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    {entry.summary.map((s, i) => (
                      <p key={i} className="text-[12px] text-slate-400">
                        • {s}
                      </p>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
