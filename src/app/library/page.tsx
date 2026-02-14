import WorkflowLibrary from "@/components/workflow-library";

export default function LibraryPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 clamp(16px, 4vw, 32px) 64px" }}>
      {/* Gradient header area */}
      <div
        style={{
          position: "relative",
          padding: "clamp(24px, 4vw, 40px) 0 32px",
          marginBottom: 8,
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient backdrop */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: -32,
            right: -32,
            bottom: 0,
            background:
              "linear-gradient(135deg, rgba(232,85,58,0.04) 0%, rgba(45,125,210,0.04) 50%, rgba(142,68,173,0.04) 100%)",
            backgroundSize: "200% 200%",
            animation: "gradientShift 8s ease infinite",
            zIndex: 0,
            borderRadius: "0 0 24px 24px",
          }}
        />
        {/* Decorative accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent 0%, var(--color-accent) 20%, var(--color-info) 50%, var(--color-memory) 80%, transparent 100%)",
            opacity: 0.3,
            borderRadius: 2,
            zIndex: 1,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 36px)",
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
              marginBottom: 10,
              animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
              background:
                "linear-gradient(135deg, var(--color-dark) 0%, var(--color-accent) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Workflow Library
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
              opacity: 0,
            }}
          >
            Sort, filter, and diagnose across all your analyzed workflows.
          </p>
        </div>
      </div>
      <WorkflowLibrary />
    </div>
  );
}
