"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  REGIONS,
  SCROLL_TYPES,
  type PeriodType,
  type RegionName,
  type ScrollType,
} from "@/types";

type AdminTab = "homework" | "purchase" | "trade" | "scroll";

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
  const [loading, setLoading] = useState(true);

  // 데이터 상태
  const [publishedData, setPublishedData] = useState<DefaultCardsData | null>(null);
  const [editData, setEditData] = useState<DefaultCardsData>(codeDefaultsToData());
  const [draftSaved, setDraftSaved] = useState(false); // 로컬 업로드 완료 여부

  // UI 상태
  const [activeTab, setActiveTab] = useState<AdminTab>("homework");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<HistoryEntry | null>(null);

  // 편집 모달 상태
  const [editModal, setEditModal] = useState<{
    type: AdminTab;
    index: number | null; // null = 새로 추가
    data: any;
  } | null>(null);

  // ── 권한 확인 ──
  useEffect(() => {
    if (authLoading) return;
    if (isAdminFirebaseUser(user)) {
      setAuthorized(true);
    } else {
      // 비인가 접근 → 홈으로
      window.location.href = "/";
    }
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

  // ── 액션 ──
  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const handleReset = useCallback(async () => {
    if (!publishedData) return;
    if (!confirm("수정사항을 초기화하시겠습니까?\n현재 실섭 데이터로 되돌립니다.")) return;
    setEditData(structuredClone(publishedData));
    setDraftSaved(false);
    await deleteDraft();
    showStatus("초기화 완료");
  }, [publishedData]);

  const handleLocalUpload = useCallback(async () => {
    setSaving(true);
    try {
      await saveDraft(editData);
      setDraftSaved(true);
      showStatus("로컬 업로드 완료 — localhost에서 확인하세요");
    } catch (e) {
      showStatus("로컬 업로드 실패");
      console.error(e);
    }
    setSaving(false);
  }, [editData]);

  const handlePublish = useCallback(async () => {
    if (!publishedData) return;
    if (!confirm("실섭에 업로드하시겠습니까?\n모든 유저에게 즉시 반영됩니다.")) return;
    setSaving(true);
    try {
      const summary = generateChangeSummary(publishedData, editData);
      await publishDraft(editData, summary);
      setPublishedData(structuredClone(editData));
      setDraftSaved(false);
      showStatus("실섭 업로드 완료!");
    } catch (e) {
      showStatus("실섭 업로드 실패");
      console.error(e);
    }
    setSaving(false);
  }, [publishedData, editData]);

  const handleShowHistory = useCallback(async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    const entries = await getHistory();
    setHistory(entries);
    setHistoryLoading(false);
  }, []);

  const handleRollback = useCallback(async (entry: HistoryEntry) => {
    try {
      await rollbackToHistory(entry);
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
  }, []);

  // ── 카드 CRUD ──
  const deleteItem = useCallback(
    (tab: AdminTab, index: number) => {
      if (!confirm("삭제하시겠습니까?")) return;
      setEditData((prev) => {
        const key =
          tab === "homework" ? "homework" : tab === "purchase" ? "purchaseItems" : tab === "trade" ? "tradeItems" : "scrollItems";
        const arr = [...(prev[key] as any[])];
        arr.splice(index, 1);
        return { ...prev, [key]: arr };
      });
    },
    []
  );

  const saveEditModal = useCallback(() => {
    if (!editModal) return;
    const { type, index, data } = editModal;
    setEditData((prev) => {
      const key =
        type === "homework" ? "homework" : type === "purchase" ? "purchaseItems" : type === "trade" ? "tradeItems" : "scrollItems";
      const arr = [...(prev[key] as any[])];
      if (index === null) {
        arr.push(data);
      } else {
        arr[index] = data;
      }
      return { ...prev, [key]: arr };
    });
    setEditModal(null);
  }, [editModal]);

  // ── 로딩/비인가 ──
  if (authLoading || loading || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">
          {authLoading ? "인증 확인 중..." : "데이터 불러오는 중..."}
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; count: number }[] = [
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
      </div>

      {/* 카드 목록 */}
      <div className="max-w-3xl mx-auto w-full px-4 py-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {activeTab === "homework" &&
            editData.homework.map((item, i) => (
              <CardRow
                key={i}
                title={item.title}
                subtitle={`${item.period === "daily" ? "일일" : "주간"} · ${item.scope === "on" ? "서버" : "캐릭터"}`}
                detail={item.reward !== "-" ? item.reward : undefined}
                period={item.period}
                onEdit={() =>
                  setEditModal({ type: "homework", index: i, data: { ...item } })
                }
                onDelete={() => deleteItem("homework", i)}
              />
            ))}
          {activeTab === "purchase" &&
            editData.purchaseItems.map((item, i) => (
              <CardRow
                key={i}
                title={item.itemName}
                subtitle={`${item.period === "daily" ? "일일" : "주간"} · ${item.region} · ${item.npcName}`}
                period={item.period}
                onEdit={() =>
                  setEditModal({ type: "purchase", index: i, data: { ...item } })
                }
                onDelete={() => deleteItem("purchase", i)}
              />
            ))}
          {activeTab === "trade" &&
            editData.tradeItems.map((item, i) => (
              <CardRow
                key={i}
                title={item.itemName}
                subtitle={`${item.period === "daily" ? "일일" : "주간"} · ${item.region} · ${item.npcName}`}
                period={item.period}
                onEdit={() =>
                  setEditModal({ type: "trade", index: i, data: { ...item } })
                }
                onDelete={() => deleteItem("trade", i)}
              />
            ))}
          {activeTab === "scroll" &&
            editData.scrollItems.map((item, i) => (
              <CardRow
                key={i}
                title={item.title}
                subtitle={`${item.scrollType} · ${item.period === "daily" ? "일일" : "주간"} · ${item.region}`}
                period={item.period}
                onEdit={() =>
                  setEditModal({ type: "scroll", index: i, data: { ...item } })
                }
                onDelete={() => deleteItem("scroll", i)}
              />
            ))}
        </div>

        {/* 추가 버튼 */}
        <button
          onClick={() => {
            const emptyData =
              activeTab === "homework"
                ? { title: "", reward: "-", period: "daily" as PeriodType, scope: "off" }
                : activeTab === "purchase"
                ? { itemName: "", region: "던바튼" as RegionName, npcName: "", period: "daily" as PeriodType, scope: "off" }
                : activeTab === "trade"
                ? { itemName: "", region: "던바튼" as RegionName, npcName: "", period: "weekly" as PeriodType, scope: "off" }
                : { title: "", scrollType: "제작" as ScrollType, period: "weekly" as PeriodType, region: "던바튼" as RegionName, materials: "-", reward: "-" };
            setEditModal({ type: activeTab, index: null, data: emptyData });
          }}
          className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400 transition-colors text-sm font-medium"
        >
          + 카드 추가
        </button>
      </div>

      {/* 하단 액션 바 */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {statusMsg && (
            <div className="text-center text-sm text-green-400 mb-2">{statusMsg}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
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
              onClick={handleLocalUpload}
              disabled={!hasChanges || saving}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                hasChanges && !saving
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {saving ? "저장 중..." : "로컬 업로드"}
            </button>
            <button
              onClick={handlePublish}
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
        <EditModal
          type={editModal.type}
          data={editModal.data}
          isNew={editModal.index === null}
          onChange={(data) => setEditModal({ ...editModal, data })}
          onSave={saveEditModal}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <HistoryModal
          history={history}
          loading={historyLoading}
          rollbackTarget={rollbackTarget}
          onSelectRollback={setRollbackTarget}
          onConfirmRollback={handleRollback}
          onClose={() => {
            setShowHistory(false);
            setRollbackTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── 카드 행 컴포넌트 ──
function CardRow({
  title,
  subtitle,
  detail,
  period,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  detail?: string;
  period: PeriodType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-800/50 group">
      <span
        className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
          period === "daily"
            ? "bg-orange-600/20 text-orange-400"
            : "bg-green-600/20 text-green-400"
        }`}
      >
        {period === "daily" ? "일일" : "주간"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{title || "(제목 없음)"}</p>
        <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
        {detail && <p className="text-[11px] text-slate-600 truncate mt-0.5">{detail}</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── 편집 모달 ──
function EditModal({
  type,
  data,
  isNew,
  onChange,
  onSave,
  onClose,
}: {
  type: AdminTab;
  data: any;
  isNew: boolean;
  onChange: (data: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const update = (key: string, value: any) => onChange({ ...data, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">
            {isNew ? "카드 추가" : "카드 수정"}
          </h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          {type === "homework" && (
            <>
              <Field label="제목" value={data.title} onChange={(v) => update("title", v)} />
              <Field label="보상" value={data.reward} onChange={(v) => update("reward", v)} />
              <SelectField label="주기" value={data.period} options={[["daily", "일일"], ["weekly", "주간"]]} onChange={(v) => update("period", v)} />
              <SelectField label="범위" value={data.scope ?? "off"} options={[["off", "캐릭터"], ["on", "서버"]]} onChange={(v) => update("scope", v)} />
            </>
          )}
          {type === "purchase" && (
            <>
              <Field label="아이템명" value={data.itemName} onChange={(v) => update("itemName", v)} />
              <SelectField label="지역" value={data.region} options={REGIONS.map((r) => [r, r])} onChange={(v) => update("region", v)} />
              <Field label="NPC" value={data.npcName} onChange={(v) => update("npcName", v)} />
              <SelectField label="주기" value={data.period} options={[["daily", "일일"], ["weekly", "주간"]]} onChange={(v) => update("period", v)} />
              <SelectField label="범위" value={data.scope ?? "off"} options={[["off", "캐릭터"], ["on", "서버"]]} onChange={(v) => update("scope", v)} />
            </>
          )}
          {type === "trade" && (
            <>
              <Field label="아이템명" value={data.itemName} onChange={(v) => update("itemName", v)} placeholder="우유(10) -> 케이틴 특제 통밀빵(3)" />
              <SelectField label="지역" value={data.region} options={REGIONS.map((r) => [r, r])} onChange={(v) => update("region", v)} />
              <Field label="NPC" value={data.npcName} onChange={(v) => update("npcName", v)} />
              <SelectField label="주기" value={data.period} options={[["daily", "일일"], ["weekly", "주간"]]} onChange={(v) => update("period", v)} />
              <SelectField label="범위" value={data.scope ?? "off"} options={[["off", "캐릭터"], ["on", "서버"]]} onChange={(v) => update("scope", v)} />
            </>
          )}
          {type === "scroll" && (
            <>
              <Field label="제목" value={data.title} onChange={(v) => update("title", v)} />
              <SelectField label="스크롤 타입" value={data.scrollType} options={SCROLL_TYPES.map((s) => [s, s])} onChange={(v) => update("scrollType", v)} />
              <SelectField label="지역" value={data.region} options={REGIONS.map((r) => [r, r])} onChange={(v) => update("region", v)} />
              <SelectField label="주기" value={data.period} options={[["daily", "일일"], ["weekly", "주간"]]} onChange={(v) => update("period", v)} />
              <Field label="재료" value={data.materials} onChange={(v) => update("materials", v)} />
              <Field label="보상" value={data.reward} onChange={(v) => update("reward", v)} />
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-medium transition-colors"
          >
            {isNew ? "추가" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 히스토리 모달 ──
function HistoryModal({
  history,
  loading,
  rollbackTarget,
  onSelectRollback,
  onConfirmRollback,
  onClose,
}: {
  history: HistoryEntry[];
  loading: boolean;
  rollbackTarget: HistoryEntry | null;
  onSelectRollback: (entry: HistoryEntry | null) => void;
  onConfirmRollback: (entry: HistoryEntry) => void;
  onClose: () => void;
}) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">히스토리</h3>
          <span className="text-[11px] text-slate-500">14일 이내 보관</span>
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
                    {formatDate(entry.createdAt)}
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

        {/* 롤백 확인 모달 */}
        {rollbackTarget && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
            <div className="bg-slate-800 rounded-xl p-5 mx-6 border border-slate-600">
              <p className="text-sm text-white font-medium mb-1">롤백하시겠습니까?</p>
              <p className="text-[12px] text-slate-400 mb-4">
                {formatDate(rollbackTarget.createdAt)} 시점으로 되돌립니다.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => onSelectRollback(null)}
                  className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => onConfirmRollback(rollbackTarget)}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 font-medium transition-colors"
                >
                  롤백
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 폼 필드 ──
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] text-slate-400 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
      >
        {options.map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
