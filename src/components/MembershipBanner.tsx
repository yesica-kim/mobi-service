"use client";

import { useEffect, useState } from "react";
import { AppConfirmModal } from "@/components/AppConfirmModal";
import type { MembershipInfo, ServerName } from "@/types";

interface Props {
  server: ServerName | null;
  membership?: Record<ServerName, MembershipInfo>;
  onUpdate: (server: ServerName, info: MembershipInfo | null) => void;
}

function getMembershipResetTime(expiresAt: string): Date {
  return new Date(`${expiresAt}T06:00:00+09:00`);
}

function toKstDateString(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRemainingTime(expiresAt: string, now: Date) {
  const diffMs = getMembershipResetTime(expiresAt).getTime() - now.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  return {
    isExpired: diffMs <= 0,
    totalMinutes,
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

function formatRemainingTime(remaining: ReturnType<typeof getRemainingTime>): string {
  return `${remaining.days}일 ${remaining.hours}시간 ${remaining.minutes}분 남음`;
}

function addDaysToDate(baseDate: string | undefined, days: number): string {
  const d = baseDate ? new Date(`${baseDate}T00:00:00+09:00`) : new Date();
  // 기존 만료일 오전 6시가 지났으면 오늘 기준으로 계산
  if (baseDate && getMembershipResetTime(baseDate).getTime() < Date.now()) {
    const today = new Date();
    today.setUTCDate(today.getUTCDate() + days);
    return toKstDateString(today);
  }
  d.setUTCDate(d.getUTCDate() + days);
  return toKstDateString(d);
}

export function MembershipBanner({ server, membership, onUpdate }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [showRegister, setShowRegister] = useState(false);
  const [showAddDays, setShowAddDays] = useState(false);
  const [showEditDays, setShowEditDays] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [registerMode, setRegisterMode] = useState<"30day" | "7day" | "custom">("30day");
  const [customDays, setCustomDays] = useState("");
  const [editDays, setEditDays] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!server) return null;

  const info = membership?.[server];
  const remaining = info ? getRemainingTime(info.expiresAt, now) : null;

  const handleRegister = () => {
    let days: number;
    if (registerMode === "custom") {
      days = parseInt(customDays, 10);
      if (!days || days < 1) return;
    } else {
      days = registerMode === "30day" ? 30 : 7;
    }
    const expiresAt = addDaysToDate(undefined, days);
    onUpdate(server, { expiresAt });
    setShowRegister(false);
    setShowAddDays(false);
    setCustomDays("");
    setRegisterMode("30day");
  };

  const handleAddDays = (days: number) => {
    if (!info) return;
    const expiresAt = addDaysToDate(info.expiresAt, days);
    onUpdate(server, { expiresAt });
    setShowAddDays(false);
    setCustomDays("");
  };

  const handleAddCustomDays = () => {
    const days = parseInt(customDays, 10);
    if (!days || days < 1) return;
    handleAddDays(days);
  };

  const handleEditDays = () => {
    const days = parseInt(editDays, 10);
    if (!days || days < 1) return;
    onUpdate(server, { expiresAt: addDaysToDate(undefined, days) });
    setShowEditDays(false);
    setEditDays("");
  };

  const handleDelete = () => {
    onUpdate(server, null);
    setShowDeleteConfirm(false);
  };

  // 미등록
  if (!info) {
    return (
      <div className="px-4 pt-2">
        {!showRegister ? (
          <button
            onClick={() => setShowRegister(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            판타지 라이프 토탈 멤버십 등록
          </button>
        ) : (
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">판타지 라이프 토탈 멤버십 등록</span>
              <button onClick={() => { setShowRegister(false); setCustomDays(""); setRegisterMode("30day"); }} className="text-slate-500 hover:text-slate-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setRegisterMode("30day")}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  registerMode === "30day" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                30일권
              </button>
              <button
                onClick={() => setRegisterMode("7day")}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  registerMode === "7day" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                7일권
              </button>
              <button
                onClick={() => setRegisterMode("custom")}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  registerMode === "custom" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                직접 입력
              </button>
            </div>
            {registerMode === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="남은 일수"
                  className="flex-1 bg-slate-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600 placeholder-slate-500"
                />
                <span className="text-slate-400 text-xs">일</span>
              </div>
            )}
            <button
              onClick={handleRegister}
              disabled={registerMode === "custom" && (!customDays || parseInt(customDays, 10) < 1)}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              등록
            </button>
          </div>
        )}
      </div>
    );
  }

  // 등록됨
  const isExpired = remaining?.isExpired ?? false;
  const isUrgent = remaining ? !remaining.isExpired && remaining.totalMinutes <= 60 * 24 * 3 : false;

  return (
    <div className="px-4 pt-2">
      <div className={`min-h-12 rounded-xl px-3 py-3 text-sm ${
        isExpired
          ? "bg-red-600/10 border border-red-500/30"
          : isUrgent
          ? "bg-amber-600/10 border border-amber-500/30"
          : "bg-slate-800/60 border border-slate-700/50"
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <svg className={`h-4 w-4 ${isExpired ? "text-red-400" : isUrgent ? "text-amber-400" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <span className={isExpired ? "text-red-400" : isUrgent ? "text-amber-400" : "text-slate-300"}>
              판타지 라이프 토탈 멤버십
            </span>
            <span className={`font-bold ${isExpired ? "text-red-400" : isUrgent ? "text-amber-400" : "text-blue-400"}`}>
              {isExpired || !remaining ? "만료됨" : formatRemainingTime(remaining)}
            </span>
            <span className="text-xs text-slate-500">({info.expiresAt} 06:00까지)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowAddDays(!showAddDays); setShowEditDays(false); setCustomDays(""); }}
              className="text-slate-500 hover:text-blue-400 transition-colors"
              title="기간 추가"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => { setShowEditDays(!showEditDays); setShowAddDays(false); setEditDays(remaining && !remaining.isExpired ? String(Math.max(1, Math.ceil(remaining.totalMinutes / (60 * 24)))) : ""); }}
              className="text-slate-500 hover:text-blue-400 transition-colors"
              title="기간 변경"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-slate-600 hover:text-red-400 transition-colors"
              title="멤버십 삭제"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 기간 추가 패널 */}
        {showAddDays && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2">
            <span className="text-[11px] text-slate-400">기간 추가</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleAddDays(30)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
              >
                +30일
              </button>
              <button
                onClick={() => handleAddDays(7)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
              >
                +7일
              </button>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="일수"
                  className="w-full bg-slate-700 text-white text-[11px] rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600 placeholder-slate-500"
                />
                <button
                  onClick={handleAddCustomDays}
                  disabled={!customDays || parseInt(customDays, 10) < 1}
                  className="text-[11px] px-2 py-1.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  추가
                </button>
                <button
                  onClick={() => { setShowAddDays(false); setCustomDays(""); }}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  title="닫기"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 기간 변경 패널 */}
        {showEditDays && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2">
            <span className="text-[11px] text-slate-400">기간 변경 (오늘 기준 남은 일수)</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="365"
                value={editDays}
                onChange={(e) => setEditDays(e.target.value)}
                placeholder="남은 일수"
                className="flex-1 bg-slate-700 text-white text-[11px] rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600 placeholder-slate-500"
              />
              <span className="text-slate-400 text-[11px]">일</span>
              <button
                onClick={handleEditDays}
                disabled={!editDays || parseInt(editDays, 10) < 1}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                변경
              </button>
              <button
                onClick={() => { setShowEditDays(false); setEditDays(""); }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="닫기"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <AppConfirmModal
          open={showDeleteConfirm}
          title="등록된 멤버십 정보를 삭제하시겠습니까?"
          description="이 작업은 되돌릴 수 없습니다."
          confirmLabel="삭제"
          variant="danger"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
