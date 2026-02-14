"use client";

import ErrorBoundary from "./error-boundary";
import { ToastProvider } from "./toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}
