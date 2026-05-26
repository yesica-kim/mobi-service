"use client";

import { useState, useRef, useCallback } from "react";
import type { HomeworkPreset } from "@/types";

interface Props {
  presets: HomeworkPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPreset: () => HomeworkPreset | null;
  onImportPreset: (preset: HomeworkPreset) => void;
  onCreateEmptyList: () => void;
  hasAnyCard: boolean;
}

const toolbarButtonClass =
  "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200";

export function HomeworkToolbar({ presets, onSavePreset, onLoadPreset, onDeletePreset, onExportPreset, onImportPreset, onCreateEmptyList, hasAnyCard }: Props) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<HomeworkPreset | null>(null);
  const [showLoadConfirm, setShowLoadConfirm] = useState<HomeworkPreset | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState<HomeworkPreset | null>(null);
  const [showCreateEmptyConfirm, setShowCreateEmptyConfirm] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [emptyListPresetName, setEmptyListPresetName] = useState("내 숙제 리스트");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);

  const openTooltip = useCallback(() => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(true);
  }, []);
  const closeTooltip = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 200);
  }, []);

  const handleSave = () => {
    if (!presetName.trim()) return;
    onSavePreset(presetName.trim());
    setPresetName("");
    setShowSaveModal(false);
    setShowSaveSuccess(true);
  };

  const handleDelete = (preset: HomeworkPreset) => {
    setShowDeleteConfirm(preset);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      onDeletePreset(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  const handleExport = () => {
    const preset = onExportPreset();
    if (!preset) return;
    const exportData = {
      _type: "mobimobi_preset",
      name: preset.name,
      createdAt: preset.createdAt,
      homework: preset.homework,
      purchaseItems: preset.purchaseItems,
      tradeItems: preset.tradeItems,
      scrollItems: preset.scrollItems,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date();
    a.download = `mobi-quests-list-${now.toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data._type === "mobimobi_preset" && data.homework && data.purchaseItems && data.tradeItems) {
          const preset: HomeworkPreset = {
            id: `preset_import_${Date.now()}`,
            name: data.name || "가져온 설정",
            createdAt: data.createdAt || new Date().toISOString(),
            homework: data.homework,
            purchaseItems: data.purchaseItems,
            tradeItems: data.tradeItems,
            scrollItems: data.scrollItems,
          };
          setShowImportConfirm(preset);
        } else {
          alert("올바른 mobimobi 설정 파일이 아닙니다.");
        }
      } catch {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5 mb-1.5 relative">
          <p className="text-sm text-white font-bold">숙제 설정</p>
          <button
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
            onClick={() => setShowTooltip((v) => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
          </button>
          {showTooltip && (
            <div
              onMouseEnter={openTooltip}
              onMouseLeave={closeTooltip}
              className="absolute left-0 top-full mt-1 z-50 w-72 bg-slate-700 rounded-xl p-3 shadow-xl text-[11px] text-slate-300 leading-relaxed space-y-1.5"
            >
              <p className="text-slate-200 font-semibold">숙제 설정은 전체 서버와 캐릭터 모두 동일하게 적용됩니다.</p>
              <p><span className="text-slate-200 font-medium">현재 리스트 저장</span> : 지금 쓰는 카드 구성을 저장합니다.</p>
              <p><span className="text-slate-200 font-medium">저장한 리스트</span> : 저장해 둔 카드 구성을 불러옵니다.</p>
              <p><span className="text-slate-200 font-medium">백업/복원</span> : 숙제 리스트 파일을 내보내거나 가져옵니다.</p>
              <p><span className="text-slate-200 font-medium">빈 리스트로 시작</span> : 빈 리스트에서 다시 구성합니다.</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
            {/* 설정 저장 */}
            <button
              onClick={() => { setPresetName(""); setShowSaveModal(true); }}
              className={toolbarButtonClass}
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8V3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 14h10v7H7z" />
              </svg>
              현재 리스트 저장
            </button>

            {/* 설정 리스트 */}
            <button
              onClick={() => setShowLoadModal(true)}
              className={toolbarButtonClass}
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              저장한 리스트
            </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="flex min-h-[40px] items-center justify-center rounded-lg bg-slate-800 px-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            백업/복원
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasAnyCard) {
                setEmptyListPresetName("내 숙제 리스트");
                setShowCreateEmptyConfirm(true);
              } else {
                onCreateEmptyList();
              }
            }}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v5m2.5-2.5h-5" />
            </svg>
            빈 리스트로 시작
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {showBackupModal && (
        <ModalOverlay onClose={() => setShowBackupModal(false)}>
          <div className="mx-auto w-80 rounded-2xl bg-slate-800 p-6">
            <h3 className="mb-4 text-center text-sm font-semibold text-white">백업/복원</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleExport();
                  setShowBackupModal(false);
                }}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
              >
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                백업 파일 저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBackupModal(false);
                  fileInputRef.current?.click();
                }}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
              >
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                백업 파일 가져오기
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBackupModal(false)}
              className="mt-3 h-11 w-full rounded-xl bg-slate-700 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
            >
              닫기
            </button>
          </div>
        </ModalOverlay>
      )}

      {showCreateEmptyConfirm && (
        <ModalOverlay onClose={() => setShowCreateEmptyConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-2">
              현재 숙제 리스트를 저장할까요?
            </p>
            <p className="text-slate-400 text-xs text-center leading-relaxed mb-6">
              저장하지 않고 새 리스트를 만들면 현재 카드 구성은 사라질 수 있습니다.
            </p>
            <input
              type="text"
              value={emptyListPresetName}
              onChange={(e) => setEmptyListPresetName(e.target.value)}
              placeholder="저장할 리스트 이름"
              className="mb-4 w-full rounded-xl bg-slate-700 px-4 py-3 text-sm text-white outline-none placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
            />
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (!emptyListPresetName.trim()) return;
                  onSavePreset(emptyListPresetName.trim());
                  onCreateEmptyList();
                  setShowCreateEmptyConfirm(false);
                }}
                disabled={!emptyListPresetName.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                저장 후 새로 만들기
              </button>
              <button
                onClick={() => {
                  onCreateEmptyList();
                  setShowCreateEmptyConfirm(false);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                저장하지 않고 새로 만들기
              </button>
              <button
                onClick={() => setShowCreateEmptyConfirm(false)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 설정 저장 모달 */}
      {showSaveModal && (
        <ModalOverlay onClose={() => setShowSaveModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <h3 className="text-white text-sm font-semibold text-center mb-4">숙제 설정 저장</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="설정 이름을 입력하세요."
              className="w-full bg-slate-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!presetName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                저장
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 저장 완료 모달 */}
      {showSaveSuccess && (
        <ModalOverlay onClose={() => setShowSaveSuccess(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-6 leading-relaxed">
              수정된 숙제 설정이 저장되었습니다.<br />
              &apos;설정 불러오기&apos;에서 확인하실 수 있습니다.
            </p>
            <button
              onClick={() => setShowSaveSuccess(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              확인
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* 설정 불러오기 모달 */}
      {showLoadModal && (
        <ModalOverlay onClose={() => setShowLoadModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto max-h-[70vh] flex flex-col">
            <h3 className="text-white text-sm font-semibold text-center mb-4">설정 불러오기</h3>
            {presets.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 bg-slate-700 rounded-xl p-3 hover:bg-slate-600 transition-colors group"
                  >
                    <button
                      onClick={() => { setShowLoadConfirm(preset); }}
                      className="flex-1 text-left"
                    >
                      <p className="text-white text-sm font-medium">{preset.name}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        {preset.id === "__default__" ? "기본 제공" : `${new Date(preset.createdAt).toLocaleDateString("ko-KR")} 저장`}
                      </p>
                    </button>
                    {preset.id !== "__default__" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(preset); }}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-4">
                <p className="text-slate-500 text-sm leading-relaxed">
                  개인 숙제 설정을 저장해서<br />사용할 수 있습니다.
                </p>
              </div>
            )}
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* 프리셋 불러오기 확인 모달 */}
      {showLoadConfirm && (
        <ModalOverlay onClose={() => setShowLoadConfirm(null)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-2 font-semibold">
              &apos;{showLoadConfirm.name}&apos;을 불러오시겠습니까?
            </p>
            <p className="text-slate-400 text-xs text-center mb-6">
              현재 숙제 설정 리스트가 변경됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoadConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onLoadPreset(showLoadConfirm.id);
                  setShowLoadConfirm(null);
                  setShowLoadModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                적용
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 프리셋 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <ModalOverlay onClose={() => setShowDeleteConfirm(null)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-6">
              &apos;{showDeleteConfirm.name}&apos;을 삭제하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 설정 가져오기 확인 모달 */}
      {showImportConfirm && (
        <ModalOverlay onClose={() => setShowImportConfirm(null)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-2 font-semibold">
              &apos;{showImportConfirm.name}&apos; 설정을 가져오시겠습니까?
            </p>
            <p className="text-slate-400 text-xs text-center mb-6">
              현재 숙제 설정 리스트가 변경됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onImportPreset(showImportConfirm);
                  setShowImportConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                적용
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
