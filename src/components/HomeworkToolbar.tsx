"use client";

import { useState } from "react";
import type { HomeworkPreset } from "@/types";

interface Props {
  presets: HomeworkPreset[];
  onReset: () => void;
  onSavePreset: (name: string) => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
}

export function HomeworkToolbar({ presets, onReset, onSavePreset, onLoadPreset, onDeletePreset }: Props) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<HomeworkPreset | null>(null);
  const [presetName, setPresetName] = useState("");

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

  return (
    <>
      <div className="px-4 pt-3 pb-1 flex items-center justify-end gap-2">
        {/* 숙제 설정 저장 */}
        <button
          onClick={() => { setPresetName(""); setShowSaveModal(true); }}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          숙제 설정 저장
        </button>

        {/* 설정 불러오기 */}
        <button
          onClick={() => setShowLoadModal(true)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          설정 불러오기
        </button>

        {/* 숙제 초기화 */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          숙제 초기화
        </button>
      </div>

      {/* 초기화 확인 모달 */}
      {showResetConfirm && (
        <ModalOverlay onClose={() => setShowResetConfirm(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-80 mx-auto">
            <p className="text-white text-sm text-center mb-6">
              숙제 리스트를 초기화 하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { onReset(); setShowResetConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
              >
                초기화
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
                      onClick={() => { onLoadPreset(preset.id); setShowLoadModal(false); }}
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
