"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_COLORS = {
  danger: { bg: "var(--danger-bg)", border: "var(--color-accent)", icon: "!", accent: "var(--color-danger)" },
  warning: { bg: "var(--warning-bg)", border: "var(--color-warning)", icon: "⚠", accent: "var(--color-warning-dark)" },
  info: { bg: "var(--info-bg)", border: "var(--color-info)", icon: "i", accent: "var(--color-info)" },
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const colors = VARIANT_COLORS[variant];

  // Focus trap — focus cancel button on open
  useEffect(() => {
    if (open) {
      cancelBtnRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 22, 36, 0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-xl)",
          border: `1px solid ${colors.border}20`,
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
          animation: "fadeInUp 0.25s var(--ease-spring)",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${colors.border}, ${colors.border}80)`,
          }}
        />

        <div style={{ padding: "28px 28px 24px" }}>
          {/* Icon + Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: colors.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: colors.accent,
                flexShrink: 0,
              }}
            >
              {colors.icon}
            </div>
            <h2
              id="confirm-modal-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 900,
                color: "var(--color-dark)",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
          </div>

          {/* Message */}
          <p
            id="confirm-modal-message"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--color-text)",
              lineHeight: 1.65,
              marginBottom: 24,
              paddingLeft: 54,
            }}
          >
            {message}
          </p>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <button
              ref={cancelBtnRef}
              onClick={onCancel}
              style={{
                padding: "10px 20px",
                borderRadius: "var(--radius-sm)",
                border: "1.5px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: "10px 20px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background:
                  variant === "danger"
                    ? "linear-gradient(135deg, var(--color-danger), #e74c3c)"
                    : variant === "warning"
                      ? "linear-gradient(135deg, var(--color-warning-dark), var(--color-warning))"
                      : "linear-gradient(135deg, var(--color-info), #5ba0e0)",
                color: "var(--color-light)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: `0 4px 16px ${colors.border}30`,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
