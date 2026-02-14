"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ── Toast Types ──

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ── Provider ──

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Container ──

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
        pointerEvents: "none",
        maxWidth: 380,
        width: "100%",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}

// ── Individual Toast ──

const ICON_MAP: Record<ToastType, string> = {
  success: "\u2713",
  error: "!",
  warning: "\u26A0",
  info: "i",
};

const COLOR_MAP: Record<ToastType, { bg: string; border: string; accent: string; icon: string }> = {
  success: {
    bg: "linear-gradient(135deg, rgba(232,249,245,0.97) 0%, rgba(213,245,240,0.95) 100%)",
    border: "rgba(23,165,137,0.18)",
    accent: "var(--color-success)",
    icon: "#17A589",
  },
  error: {
    bg: "linear-gradient(135deg, rgba(253,240,238,0.97) 0%, rgba(255,230,225,0.95) 100%)",
    border: "rgba(232,85,58,0.18)",
    accent: "var(--color-accent)",
    icon: "#C0392B",
  },
  warning: {
    bg: "linear-gradient(135deg, rgba(255,249,230,0.97) 0%, rgba(255,243,210,0.95) 100%)",
    border: "rgba(212,160,23,0.18)",
    accent: "var(--color-warning)",
    icon: "#D4A017",
  },
  info: {
    bg: "linear-gradient(135deg, rgba(232,243,255,0.97) 0%, rgba(215,235,255,0.95) 100%)",
    border: "rgba(45,125,210,0.18)",
    accent: "var(--color-info)",
    icon: "#2D7DD2",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const colors = COLOR_MAP[toast.type];

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [onDismiss, toast.id]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, dismiss]);

  return (
    <div
      role="alert"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.accent}`,
        borderRadius: "var(--radius-sm)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        pointerEvents: "auto",
        animation: exiting
          ? "toastExit 0.25s var(--ease-default) forwards"
          : "toastEnter 0.3s var(--ease-spring) both",
        cursor: "pointer",
      }}
      onClick={dismiss}
    >
      {/* Icon */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: `${colors.accent}`,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          fontFamily: "var(--font-mono)",
        }}
      >
        {ICON_MAP[toast.type]}
      </div>

      {/* Message */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--color-dark)",
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {toast.message}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          fontSize: 14,
          color: "var(--color-muted)",
          cursor: "pointer",
          padding: "0 2px",
          opacity: 0.6,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        &times;
      </button>
    </div>
  );
}
