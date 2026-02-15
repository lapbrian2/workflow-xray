"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading || lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed.");
        setPassword("");
        setShake(true);
        setTimeout(() => setShake(false), 600);
        inputRef.current?.focus();
        return;
      }

      // Success — redirect
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      lockRef.current = false;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0F1624 0%, #1C2536 40%, #1a2233 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow orbs */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "30%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232, 85, 58, 0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          animation: "float 8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "25%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45, 125, 210, 0.06) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
          animation: "float 10s ease-in-out infinite reverse",
        }}
      />

      {/* Grid pattern background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "gridPulse 4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 400,
          padding: "0 24px",
          animation: "fadeInUp 0.6s ease both",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "40px 36px",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Brand */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            {/* Glowing dot */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #E8553A 0%, #F09060 100%)",
                boxShadow: "0 0 20px rgba(232, 85, 58, 0.5), 0 0 60px rgba(232, 85, 58, 0.2)",
                margin: "0 auto 16px",
                animation: "pulseGlow 3s ease-in-out infinite",
              }}
            />
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #F0F2F5 0%, #E8553A 60%, #F09060 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "gradientShift 6s ease-in-out infinite",
                marginBottom: 6,
              }}
            >
              Workflow X-Ray
            </h1>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.35)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Enter password to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div
              style={{
                position: "relative",
                marginBottom: 16,
                animation: shake ? "shakeX 0.5s ease" : "none",
              }}
            >
              <label
                htmlFor="password-input"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  borderWidth: 0,
                }}
              >
                Password
              </label>
              <input
                id="password-input"
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Password"
                autoFocus
                autoComplete="current-password"
                disabled={loading}
                aria-describedby={error ? "login-error" : undefined}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 10,
                  border: `1px solid ${error ? "rgba(232, 85, 58, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
                  background: "rgba(0, 0, 0, 0.2)",
                  color: "#F0F2F5",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  outline: "none",
                  transition: "all 0.3s ease",
                  boxShadow: error
                    ? "0 0 0 3px rgba(232, 85, 58, 0.15)"
                    : "0 0 0 0 transparent",
                }}
                onFocus={(e) => {
                  if (!error) {
                    e.target.style.borderColor = "rgba(232, 85, 58, 0.4)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(232, 85, 58, 0.1)";
                  }
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    e.target.style.boxShadow = "0 0 0 0 transparent";
                  }
                }}
              />
              {/* Lock icon */}
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 14,
                  opacity: 0.3,
                  pointerEvents: "none",
                }}
              >
                🔒
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                id="login-error"
                role="alert"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#E8553A",
                  marginBottom: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(232, 85, 58, 0.08)",
                  border: "1px solid rgba(232, 85, 58, 0.15)",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                background: loading || !password.trim()
                  ? "rgba(232, 85, 58, 0.3)"
                  : "linear-gradient(135deg, #E8553A 0%, #F09060 100%)",
                color: "#fff",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: loading || !password.trim() ? "not-allowed" : "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: loading || !password.trim()
                  ? "none"
                  : "0 4px 20px rgba(232, 85, 58, 0.3), 0 0 0 1px rgba(255,255,255,0.05) inset",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #fff",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  Authenticating...
                </>
              ) : (
                "Enter"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "rgba(255, 255, 255, 0.2)",
            letterSpacing: "0.05em",
          }}
        >
          Protected by password authentication
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-6px); }
          30%, 70% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
