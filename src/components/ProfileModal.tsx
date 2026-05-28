"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { AutoBackupSnapshot } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  userName?: string | null;
  userEmail?: string | null;
  providerEmails?: (string | null | undefined)[];
  userPhoto?: string | null;
  isGuest?: boolean;
  isAdmin?: boolean;
  authError?: string | null;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void>;
  onSignInWithGoogle?: () => Promise<void>;
  onImportData?: (data: any) => void;
  automaticBackups?: AutoBackupSnapshot[];
  onRestoreBackup?: (backupId: string) => void;
  initialPage?: "menu" | "terms" | "privacy" | "restore";
}

type PageType = "menu" | "terms" | "privacy" | "restore";

function formatFilename() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return `mobi-account-data-${date}.json`;
}

export function ProfileModal({
  open,
  onClose,
  userName,
  userEmail,
  providerEmails = [],
  userPhoto,
  isGuest,
  isAdmin,
  authError,
  onSignOut,
  onDeleteAccount,
  onSignInWithGoogle,
  onImportData,
  automaticBackups = [],
  onRestoreBackup,
  initialPage = "menu",
}: Props) {
  const [page, setPage] = useState<PageType>("menu");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<AutoBackupSnapshot | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setPage("menu");
    setShowDeleteConfirm(false);
    setShowLogoutWarning(false);
    setRestoreTarget(null);
    setDeleteError(null);
    onClose();
  }, [onClose]);

  useEscapeClose(open, handleClose);

  useEffect(() => {
    if (open) setPage(initialPage);
  }, [open, initialPage]);

  if (!open) return null;

  const backupList = automaticBackups;

  const formatBackupTime = (value: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));

  const handleExport = () => {
    try {
      const raw = localStorage.getItem("mabimobi_data");
      if (!raw) { alert("내보낼 데이터가 없습니다."); return; }
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = formatFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("데이터 내보내기에 실패했습니다.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.characters && data.homework) {
          onImportData?.(data);
          alert("데이터를 성공적으로 가져왔습니다!");
          handleClose();
        } else {
          alert("올바른 mobimobi 백업 파일이 아닙니다.");
        }
      } catch {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteError(null);
      await onDeleteAccount?.();
      handleClose();
    } catch (err: any) {
      setDeleteError(err.message || "계정 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
        <div className="w-[calc(100vw-2rem)] max-w-lg rounded-2xl bg-slate-800 max-h-[80vh] overflow-y-auto">
          {page === "menu" ? (
            <div className="p-6">
              {/* 프로필 정보 */}
              {isGuest ? (
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">게스트</p>
                    <p className="text-slate-500 text-xs">로그인하면 데이터가 안전하게 보관됩니다</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-6">
                  {userPhoto ? (
                    <img src={userPhoto} alt="" className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{userName || "사용자"}</p>
                    <p className="text-slate-400 text-xs truncate">{userEmail || ""}</p>
                    {providerEmails.length > 0 && (
                      <p className="text-slate-600 text-[10px] truncate">
                        provider: {providerEmails.filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 게스트 → 로그인 유도 */}
              {isGuest && onSignInWithGoogle && (
                <div className="mb-4 space-y-2">
                  <button
                    onClick={() => { void onSignInWithGoogle(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#ddd" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#ddd" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#ddd" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="text-white">Google 계정으로 로그인</span>
                  </button>
                  {authError && (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs leading-relaxed text-red-200">
                      {authError}
                    </p>
                  )}
                </div>
              )}

              {/* 메뉴 */}
              <div className="space-y-1 mb-4">
                {/* 계정 데이터 내보내기/가져오기 */}
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  계정 데이터 내보내기
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  계정 데이터 가져오기
                </button>
                <button
                  onClick={() => setPage("restore")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.05 11a9 9 0 11.64 4.74" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16v-5h5" />
                  </svg>
                  이전 데이터 복구
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />

                <div className="border-t border-slate-700 my-2" />

                <button
                  onClick={() => setPage("terms")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  이용약관
                </button>
                <button
                  onClick={() => setPage("privacy")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  개인정보처리방침
                </button>
                <a
                  href="mailto:inchu594@gmail.com"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  문의하기
                </a>
                {isAdmin && (
                  <button
                    onClick={() => { window.open("/ctrl-a7x9k2m", "_blank", "noopener,noreferrer"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    관리자
                  </button>
                )}
                <div className="px-4 py-2">
                  <p className="text-[11px] text-slate-600">앱 버전 {process.env.APP_VERSION}</p>
                </div>
              </div>

              {/* 하단 버튼 */}
              <div className="space-y-2">
                {isGuest ? (
                  <>
                    <button
                      onClick={() => setShowLogoutWarning(true)}
                      className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      로그인 화면으로
                    </button>
                    <button
                      onClick={handleClose}
                      className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      닫기
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { onSignOut(); handleClose(); }}
                      className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      로그아웃
                    </button>
                    <button
                      onClick={handleClose}
                      className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                      닫기
                    </button>
                    {onDeleteAccount && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-2 rounded-xl text-slate-500 text-xs hover:bg-slate-700/50 transition-colors"
                      >
                        회원 탈퇴
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : page === "terms" ? (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setPage("menu")} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-white text-sm font-semibold">이용약관</h3>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed space-y-3">
                <p className="font-semibold text-slate-300">제1조 (목적)</p>
                <p>본 약관은 mobimobi(이하 &quot;서비스&quot;)의 이용에 관한 기본적인 사항을 규정함을 목적으로 합니다.</p>
                <p className="font-semibold text-slate-300">제2조 (서비스의 내용)</p>
                <p>본 서비스는 마비노기 모바일 게임의 일일/주간 숙제를 관리할 수 있는 무료 웹 도구입니다. 게임사와는 무관한 팬 제작 서비스입니다.</p>
                <p className="font-semibold text-slate-300">제3조 (이용자의 의무)</p>
                <p>이용자는 본 서비스를 불법적인 목적이나 타인의 권리를 침해하는 용도로 사용해서는 안 됩니다.</p>
                <p className="font-semibold text-slate-300">제4조 (면책)</p>
                <p>본 서비스는 현 상태 그대로(AS-IS) 제공되며, 데이터 손실 등에 대한 책임을 지지 않습니다. 게임 내 업데이트로 인한 정보 불일치에 대해서도 책임지지 않습니다.</p>
                <p className="font-semibold text-slate-300">제5조 (회원 탈퇴 및 데이터 삭제)</p>
                <p>이용자는 언제든지 설정 메뉴의 &quot;회원 탈퇴&quot;를 통해 계정을 삭제할 수 있습니다. 탈퇴 시 해당 계정에 저장된 모든 데이터(캐릭터, 숙제, 프리셋 등)는 즉시 영구 삭제되며 복구할 수 없습니다.</p>
                <p className="font-semibold text-slate-300">제6조 (서비스 변경 및 중단)</p>
                <p>서비스 제공자는 필요에 따라 서비스의 내용을 변경하거나 중단할 수 있습니다.</p>
              </div>
              <button
                onClick={() => setPage("menu")}
                className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors mt-4"
              >
                닫기
              </button>
            </div>
          ) : page === "privacy" ? (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setPage("menu")} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-white text-sm font-semibold">개인정보처리방침</h3>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed space-y-3">
                <p className="font-semibold text-slate-300">1. 수집하는 개인정보</p>
                <p>Google 로그인 시 제공되는 이메일 주소, 프로필 이름, 프로필 사진 URL을 수집합니다.</p>
                <p className="font-semibold text-slate-300">2. 개인정보의 이용목적</p>
                <p>수집된 정보는 사용자 식별 및 데이터 동기화 목적으로만 사용됩니다.</p>
                <p className="font-semibold text-slate-300">3. 개인정보의 보관</p>
                <p>사용자 데이터는 Google Firebase에 안전하게 저장되며, 계정 삭제 요청 시 모든 데이터가 삭제됩니다.</p>
                <p className="font-semibold text-slate-300">4. 제3자 제공</p>
                <p>수집된 개인정보는 제3자에게 제공되지 않습니다.</p>
                <p className="font-semibold text-slate-300">5. 회원 탈퇴 및 데이터 삭제</p>
                <p>이용자는 설정 메뉴에서 회원 탈퇴를 요청할 수 있으며, 탈퇴 즉시 Firebase에 저장된 모든 개인정보 및 사용자 데이터가 영구 삭제됩니다. 삭제된 데이터는 복구할 수 없습니다.</p>
                <p className="font-semibold text-slate-300">6. 문의</p>
                <p>개인정보 관련 문의는 inchu594@gmail.com으로 연락해 주세요.</p>
              </div>
              <button
                onClick={() => setPage("menu")}
                className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors mt-4"
              >
                닫기
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setPage("menu")} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-white text-sm font-semibold">이전 데이터 복구</h3>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-400">
                자동 백업은 최근 20개까지만 보관됩니다. 복구 전 현재 상태도 한 번 더 백업됩니다.
              </p>
              {backupList.length === 0 ? (
                <div className="rounded-2xl bg-slate-900/60 px-4 py-6 text-center text-xs text-slate-500">
                  저장된 자동 백업이 없습니다.
                </div>
              ) : (
                <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {backupList.map((backup) => (
                    <div key={backup.id} className="rounded-2xl bg-slate-900/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{backup.reason}</p>
                          <p className="mt-1 text-xs text-slate-400">{backup.summary}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{formatBackupTime(backup.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRestoreTarget(backup)}
                          className="h-9 shrink-0 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                        >
                          복구
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setPage("menu")}
                className="mt-4 w-full rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
              >
                닫기
              </button>
            </div>
          )}
        </div>

        {restoreTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setRestoreTarget(null)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
              <div className="w-80 rounded-2xl bg-slate-800 p-6">
                <p className="mb-2 text-center text-sm font-semibold text-white">이 백업으로 복구할까?</p>
                <p className="mb-6 text-center text-xs leading-relaxed text-slate-400">
                  {formatBackupTime(restoreTarget.createdAt)} 상태로 되돌아갑니다.<br />
                  현재 상태도 먼저 자동 백업됩니다.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(null)}
                    className="h-11 flex-1 rounded-xl bg-slate-700 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreBackup?.(restoreTarget.id);
                      setRestoreTarget(null);
                      handleClose();
                    }}
                    className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white transition-colors hover:bg-red-500"
                  >
                    복구
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 로그인 화면 이동 경고 모달 */}
        {showLogoutWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowLogoutWarning(false)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
              <div className="bg-slate-800 rounded-2xl p-6 w-80">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <p className="text-white text-sm text-center mb-2 font-semibold">데이터 백업 안내</p>
                <p className="text-slate-400 text-xs text-center mb-4 leading-relaxed">
                  로그인 화면으로 이동하면 현재 저장된 데이터가<br />
                  초기화됩니다. 캐시 삭제 시 복구할 수 없습니다.
                </p>
                <div className="bg-slate-700/50 rounded-xl p-3 mb-4">
                  <p className="text-amber-400 text-xs font-medium mb-1">데이터를 보존하려면:</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    설정 &gt; &apos;계정 데이터 내보내기&apos;를 통해<br />
                    먼저 로컬에 저장해 주세요.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutWarning(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { onSignOut(); handleClose(); }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
                  >
                    이동하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탈퇴 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
              <div className="bg-slate-800 rounded-2xl p-6 w-80">
                <p className="text-white text-sm text-center mb-2 font-semibold">정말 탈퇴하시겠습니까?</p>
                <p className="text-slate-400 text-xs text-center mb-6 leading-relaxed">
                  모든 캐릭터, 숙제 데이터가 영구적으로 삭제됩니다.<br />이 작업은 되돌릴 수 없습니다.
                </p>
                {deleteError && (
                  <p className="text-red-400 text-xs text-center mb-4">{deleteError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
                  >
                    탈퇴하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
