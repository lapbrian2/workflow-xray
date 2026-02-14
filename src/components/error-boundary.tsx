"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg)",
            padding: "clamp(16px, 4vw, 32px)",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              textAlign: "center",
              animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(232, 85, 58, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 28,
                color: "var(--color-accent)",
              }}
            >
              !
            </div>
            <h1
              style={{
                fontSize: "clamp(20px, 4vw, 28px)",
                fontWeight: 900,
                fontFamily: "var(--font-display)",
                color: "var(--color-dark)",
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--color-text)",
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            >
              An unexpected error occurred. Please try again or return to the
              home page.
            </p>
            {this.state.error?.message && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-muted)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  marginBottom: 24,
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.message}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="btn-primary"
                style={{ textDecoration: "none" }}
              >
                Try Again
              </button>
              <Link
                href="/"
                className="btn-secondary"
                style={{ textDecoration: "none" }}
                onClick={() => this.setState({ hasError: false, error: undefined })}
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
