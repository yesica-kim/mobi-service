"use client";

import { useState } from "react";
import type { ServerName } from "@/types";
import { CLASS_TREE, MAIN_CLASSES, SERVERS } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { server: ServerName; name: string; mainClass: string; subClass: string }) => void;
  canAddToServer: (server: ServerName) => boolean;
  serverCharCount: (server: ServerName) => number;
}

export function CharacterCreateModal({ open, onClose, onSubmit, canAddToServer, serverCharCount }: Props) {
  const [server, setServer] = useState<ServerName | "">("");
  const [charName, setCharName] = useState("");
  const [mainClass, setMainClass] = useState("");
  const [subClass, setSubClass] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setServer("");
    setCharName("");
    setMainClass("");
    setSubClass("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    // 유효성 검증
    if (!server) { setError("서버를 선택해주세요."); return; }
    if (!canAddToServer(server)) { setError("해당 서버의 캐릭터가 이미 6개입니다."); return; }
    const trimmed = charName.trim();
    if (trimmed.length < 2 || trimmed.length > 12) { setError("닉네임은 2~12자로 입력해주세요."); return; }
    if (!mainClass) { setError("계열을 선택해주세요."); return; }
    if (!subClass) { setError("세부 직업을 선택해주세요."); return; }

    onSubmit({ server, name: trimmed, mainClass, subClass });
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-white">캐릭터 추가</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* 서버 선택 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">서버 선택</label>
            <select
              value={server}
              onChange={(e) => setServer(e.target.value as ServerName)}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">서버를 선택하세요</option>
              {SERVERS.map((s) => (
                <option key={s} value={s} disabled={!canAddToServer(s)}>
                  {s} ({serverCharCount(s)}/6)
                </option>
              ))}
            </select>
          </div>

          {/* 닉네임 입력 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">닉네임</label>
            <input
              type="text"
              value={charName}
              onChange={(e) => { setCharName(e.target.value); setError(""); }}
              placeholder="닉네임을 입력하세요 (2~12자)"
              maxLength={12}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 text-white px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 계열 선택 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">계열 선택</label>
            <div className="flex flex-wrap gap-2">
              {MAIN_CLASSES.map((mc) => (
                <button
                  key={mc}
                  onClick={() => { setMainClass(mc); setSubClass(""); }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    mainClass === mc
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {mc}
                </button>
              ))}
            </div>
          </div>

          {/* 세부 클래스 선택 */}
          {mainClass && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">세부 직업</label>
              <div className="flex flex-wrap gap-2">
                {CLASS_TREE[mainClass].map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setSubClass(sc)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      subClass === sc
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 에러 */}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* 등록 버튼 */}
          <button
            onClick={handleSubmit}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm transition-colors"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
