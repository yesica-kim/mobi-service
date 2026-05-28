"use client";

import { UPDATE_NOTES } from "@/types";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpdateNotesModal({ open, onClose }: Props) {
  useEscapeClose(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
        <div className="w-[calc(100vw-2rem)] max-w-lg rounded-2xl bg-slate-800 max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-white text-sm font-semibold">업데이트 노트</h3>
            </div>
            <div className="space-y-4">
              {UPDATE_NOTES.map((note, idx) => (
                <div key={note.version} className={idx === 0 ? "" : "border-t border-slate-700 pt-4"}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-400 text-xs font-bold">v{note.version}</span>
                    <span className="text-slate-500 text-[11px]">{note.date}</span>
                    {idx === 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/20 text-blue-400 font-bold">NEW</span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {note.changes.map((change, i) => (
                      <li key={i} className="text-slate-400 text-xs flex gap-1.5">
                        <span className="text-slate-600 mt-0.5">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors mt-4"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
