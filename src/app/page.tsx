"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import WorkflowInput from "@/components/workflow-input";
import { useStore } from "@/lib/store";
import { getWorkflowLocal } from "@/lib/client-db";
import type { Workflow } from "@/lib/types";

/* ----- Floating Dots Background ----- */
function FloatingDots() {
  const dots = useMemo(() => {
    const result = [];
    for (let i = 0; i < 24; i++) {
      result.push({
        id: i,
        left: `${Math.floor((i * 37 + 13) % 100)}%`,
        top: `${Math.floor((i * 53 + 7) % 100)}%`,
        size: 2 + (i % 4),
        delay: (i * 0.7) % 6,
        duration: 8 + (i % 6) * 2,
        opacity: 0.12 + (i % 5) * 0.06,
      });
    }
    return result;
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Subtle radial gradient background */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "60%",
          background:
            "radial-gradient(ellipse at center, rgba(232,85,58,0.04) 0%, rgba(240,144,96,0.02) 40%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(28,37,54,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(28,37,54,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          animation: "gridPulse 8s ease-in-out infinite",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />

      {/* Floating dots */}
      {dots.map((dot) => (
        <div
          key={dot.id}
          style={{
            position: "absolute",
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            borderRadius: "50%",
            background:
              dot.id % 3 === 0
                ? "var(--color-accent)"
                : dot.id % 3 === 1
                ? "var(--color-info)"
                : "var(--color-muted)",
            opacity: dot.opacity,
            animation: `dotFloat ${dot.duration}s ease-in-out ${dot.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ----- Sparkle Element ----- */
function Sparkles() {
  const sparkles = useMemo(() => {
    const result = [];
    for (let i = 0; i < 6; i++) {
      result.push({
        id: i,
        left: `${20 + (i * 47 + 11) % 60}%`,
        top: `${10 + (i * 31 + 5) % 30}%`,
        delay: i * 1.2,
        duration: 3 + (i % 3),
      });
    }
    return result;
  }, []);

  return (
    <>
      {sparkles.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: 6,
            height: 6,
            pointerEvents: "none",
            zIndex: 1,
            animation: `sparkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {/* 4-pointed star shape via two rotated rectangles */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-accent)",
              borderRadius: 1,
              transform: "rotate(45deg) scale(0.5, 1)",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-accent)",
              borderRadius: 1,
              transform: "rotate(45deg) scale(1, 0.5)",
              opacity: 0.5,
            }}
          />
        </div>
      ))}
    </>
  );
}

/* ----- Scan Line Effect ----- */
function ScanLine() {
  return (
    <div
      style={{
        position: "absolute",
        left: "15%",
        right: "15%",
        height: 1,
        background:
          "linear-gradient(90deg, transparent, rgba(232,85,58,0.3), rgba(240,144,96,0.2), transparent)",
        animation: "scanLine 5s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 1,
        boxShadow: "0 0 12px rgba(232,85,58,0.15)",
      }}
    />
  );
}

/* ----- Main Home Content ----- */
function HomeContent() {
  const { error, isDecomposing, setError } = useStore();
  const searchParams = useSearchParams();
  const reanalyzeId = searchParams.get("reanalyze");

  // Progressive loading messages
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDecomposing) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDecomposing]);

  const loadingMessage = useMemo(() => {
    if (elapsed < 5) return "Analyzing workflow structure...";
    if (elapsed < 12) return "Mapping dependencies and layers...";
    if (elapsed < 25) return "Identifying gaps and scoring health...";
    if (elapsed < 45) return "Almost there — finalizing analysis...";
    if (elapsed < 90) return "This is taking longer than usual. Hang tight...";
    return "Still working — complex workflows take longer. Please wait...";
  }, [elapsed]);

  const loadingSubtext = useMemo(() => {
    if (elapsed < 8) return "This usually takes 5\u201315 seconds.";
    if (elapsed < 30) return `${elapsed}s elapsed`;
    return `${elapsed}s elapsed \u2014 large workflows may take up to 2 minutes.`;
  }, [elapsed]);

  const [reanalyzeWorkflow, setReanalyzeWorkflow] = useState<Workflow | null>(
    null
  );
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger mount animations
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!reanalyzeId) {
      setReanalyzeWorkflow(null);
      return;
    }
    setReanalyzeLoading(true);

    // Check localStorage first
    const local = getWorkflowLocal(reanalyzeId);
    if (local) {
      setReanalyzeWorkflow(local);
      setReanalyzeLoading(false);
    }

    // Then try server
    fetch(`/api/workflows?id=${reanalyzeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: Workflow) => setReanalyzeWorkflow(data))
      .catch(() => {
        if (!local) setReanalyzeWorkflow(null);
      })
      .finally(() => setReanalyzeLoading(false));
  }, [reanalyzeId]);

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "clamp(32px, 6vw, 64px) clamp(16px, 4vw, 32px) 96px",
        position: "relative",
      }}
    >
      {/* Animated Background Layer */}
      <FloatingDots />
      <ScanLine />

      {/* Hero */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 48,
          position: "relative",
          zIndex: 2,
        }}
      >
        <Sparkles />

        {/* "Powered by Claude" badge */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 20,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--color-info), #5BA0E0)",
              boxShadow: "0 0 6px rgba(45,125,210,0.4)",
            }}
          />
          Powered by Claude
        </div>

        {/* Main heading with gradient text */}
        <h1
          style={{
            fontSize: "clamp(36px, 8vw, 60px)",
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            marginBottom: 20,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(24px)",
            transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.25s",
          }}
        >
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--color-dark) 0%, #E8553A 45%, #F09060 70%, #E8553A 100%)",
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "gradientShift 8s ease-in-out infinite",
            }}
          >
            X-Ray Any Workflow
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 16,
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.75,
            maxWidth: 500,
            margin: "0 auto",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(18px)",
            transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.45s",
          }}
        >
          Describe a workflow in natural language. Get a visual decomposition
          with flow maps, gap analysis, and health scoring.
        </p>

        {/* Decorative line separator */}
        <div
          style={{
            width: 48,
            height: 2,
            margin: "28px auto 0",
            borderRadius: 2,
            background:
              "linear-gradient(90deg, transparent, var(--color-accent), transparent)",
            opacity: mounted ? 0.5 : 0,
            transition: "opacity 0.8s ease 0.6s",
          }}
        />
      </div>

      {/* Loading indicator */}
      {isDecomposing && (
        <div
          style={{
            marginBottom: 24,
            background:
              "linear-gradient(135deg, rgba(237,244,252,0.95) 0%, rgba(225,238,255,0.9) 100%)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(45,125,210,0.12)",
            animation: "fadeInUpSm 0.4s var(--ease-default)",
            boxShadow:
              "var(--shadow-md), 0 0 0 1px rgba(45,125,210,0.04)",
            position: "relative",
            zIndex: 2,
            overflow: "hidden",
          }}
        >
          {/* Progress bar at top */}
          <div className="progress-bar" style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }} />

          <div style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: 16 }}>
            {/* Shimmer overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(45,125,210,0.04) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2.5s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            {/* Pulsing spinner */}
            <div
              style={{
                width: 28,
                height: 28,
                border: "3px solid rgba(45,125,210,0.15)",
                borderTop: "3px solid #2D7DD2",
                borderRadius: "50%",
                animation: "spinnerPulse 1s linear infinite",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-info)",
                  opacity: 0.4,
                  animation: "pulse-slow 1.5s ease-in-out infinite",
                }}
              />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-info)",
                  fontWeight: 600,
                  marginBottom: 3,
                }}
              >
                {loadingMessage}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "var(--color-text)",
                  opacity: 0.7,
                }}
              >
                {loadingSubtext}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "16px 24px",
            marginBottom: 24,
            background:
              "linear-gradient(135deg, rgba(253,240,238,0.95) 0%, rgba(255,230,225,0.9) 100%)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(232,85,58,0.12)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            animation: "fadeInUpSm 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow:
              "0 2px 12px rgba(232,85,58,0.06), 0 0 0 1px rgba(232,85,58,0.04)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(232,85,58,0.15) 0%, rgba(192,57,43,0.12) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-danger)",
            }}
          >
            !
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-danger)",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Decomposition failed
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--color-danger)",
                opacity: 0.8,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              color: "var(--color-danger)",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
              opacity: 0.6,
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Re-analyze banner */}
      {reanalyzeId && !reanalyzeLoading && reanalyzeWorkflow && (
        <div
          style={{
            padding: "18px 24px",
            marginBottom: 24,
            background:
              "linear-gradient(135deg, rgba(255,248,246,0.95) 0%, rgba(255,240,235,0.9) 100%)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(232,85,58,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            animation: "bannerSlideIn 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow:
              "0 2px 16px rgba(232,85,58,0.06), 0 0 0 1px rgba(232,85,58,0.03)",
            position: "relative",
            zIndex: 2,
            overflow: "hidden",
          }}
        >
          {/* Accent left stripe */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              borderRadius: "3px 0 0 3px",
              background:
                "linear-gradient(180deg, #E8553A 0%, #F09060 100%)",
            }}
          />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(232,85,58,0.12) 0%, rgba(240,144,96,0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 14,
              color: "var(--color-accent)",
              animation: "float 4s ease-in-out infinite",
            }}
          >
            &#x21bb;
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-accent)",
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              Re-analyzing: {reanalyzeWorkflow.decomposition.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                color: "var(--color-text)",
                opacity: 0.7,
              }}
            >
              This will create a new version with a fresh analysis.
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.65s",
        }}
      >
        <WorkflowInput
          key={reanalyzeId || "default"}
          initialText={reanalyzeWorkflow?.description}
          reanalyzeParentId={reanalyzeId || undefined}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
