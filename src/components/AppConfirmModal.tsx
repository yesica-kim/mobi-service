"use client";

import { useEscapeClose } from "@/hooks/useEscapeClose";

type ConfirmVariant = "primary" | "danger";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AppConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  variant = "primary",
  disabled = false,
  onCancel,
  onConfirm,
}: Props) {
  useEscapeClose(open, onCancel);

  if (!open) return null;

  const confirmClassName =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : "bg-blue-600 text-white hover:bg-blue-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-80 rounded-2xl bg-slate-800 p-6">
          <p className="mb-6 break-keep text-center text-sm leading-relaxed text-white">
            {title}
          </p>
          {description && (
            <p className="-mt-4 mb-6 break-keep text-center text-xs leading-relaxed text-slate-400">
              {description}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 flex-1 rounded-xl bg-slate-700 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className={`h-11 flex-1 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${confirmClassName}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
