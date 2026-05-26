"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { Character, ServerName } from "@/types";
import { CLASS_TREE, MAIN_CLASSES, SERVERS } from "@/types";

interface Props {
  open: boolean;
  character: Character | null;
  onClose: () => void;
  onSave: (charId: string, updates: Partial<Omit<Character, "id">>) => void;
  onDelete: (charId: string) => void;
  canAddToServer: (server: ServerName) => boolean;
  serverCharCount: (server: ServerName) => number;
}

export function CharacterEditModal({ open, character, onClose, onSave, onDelete, canAddToServer, serverCharCount }: Props) {
  const [charName, setCharName] = useState("");
  const [server, setServer] = useState<ServerName | "">("");
  const [mainClass, setMainClass] = useState("");
  const [subClass, setSubClass] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // character가 바뀌면 폼 초기화
  const initForm = () => {
    if (character) {
      setCharName(character.name);
      setServer(character.server);
      setMainClass(character.mainClass);
      setSubClass(character.subClass);
    }
    setError("");
    setShowDeleteConfirm(false);
  };

  // open 상태가 바뀔 때 초기화 (useEffect 대신 조건부)
  if (open && character && charName === "" && server === "") {
    initForm();
  }

  const handleClose = () => {
    setCharName("");
    setServer("");
    setMainClass("");
    setSubClass("");
    setError("");
    setShowDeleteConfirm(false);
    onClose();
  };

  useEscapeClose(open && !!character, handleClose);

  if (!open || !character) return null;

  const handleSave = () => {
    if (!server) { setError("서버를 선택해주세요."); return; }
    const trimmed = charName.trim();
    if (trimmed.length < 2 || trimmed.length > 12) { setError("닉네임은 2~12자로 입력해주세요."); return; }
    if (!mainClass) { setError("계열을 선택해주세요."); return; }
    if (!subClass) { setError("세부 직업을 선택해주세요."); return; }

    // 서버 변경 시 제한 체크
    if (server !== character.server && !canAddToServer(server)) {
      setError("해당 서버의 캐릭터가 이미 6개입니다.");
      return;
    }

    onSave(character.id, { server, name: trimmed, mainClass, subClass });
    handleClose();
  };

  const handleDelete = () => {
    onDelete(character.id);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-white">캐릭터 수정</h2>
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
              {SERVERS.map((s) => (
                <option key={s} value={s} disabled={s !== character.server && !canAddToServer(s)}>
                  {s} ({serverCharCount(s)}/6)
                </option>
              ))}
            </select>
          </div>

          {/* 닉네임 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">닉네임</label>
            <input
              type="text"
              value={charName}
              onChange={(e) => { setCharName(e.target.value); setError(""); }}
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
                    mainClass === mc ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {mc}
                </button>
              ))}
            </div>
          </div>

          {/* 세부 직업 */}
          {mainClass && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">세부 직업</label>
              <div className="flex flex-wrap gap-2">
                {CLASS_TREE[mainClass]?.map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setSubClass(sc)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      subClass === sc ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm transition-colors"
          >
            저장
          </button>

          {/* 삭제 영역 */}
          <div className="border-t border-slate-800 pt-4">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-xl bg-slate-800 hover:bg-red-900/40 text-red-400 font-semibold py-3 text-sm transition-colors"
              >
                캐릭터 삭제
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-400 text-sm text-center">정말 삭제하시겠습니까? 숙제 데이터도 함께 삭제됩니다.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-xl bg-slate-800 text-slate-400 font-semibold py-3 text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3 text-sm transition-colors"
                  >
                    삭제 확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
