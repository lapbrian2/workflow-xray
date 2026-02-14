"use client";

const EXAMPLES = [
  "Our client onboarding process: sales closes deal → account manager sends welcome email → project manager creates Notion workspace → designer builds brand kit → developer sets up staging environment → PM schedules kickoff call",
  "Content publishing pipeline: writer drafts article in Google Docs → editor reviews and suggests changes → writer revises → SEO specialist optimizes → designer creates featured image → social media manager schedules promotion → analytics tracks performance after 1 week",
  "Bug triage workflow: user reports bug via support ticket → support agent categorizes severity → PM adds to sprint backlog → developer reproduces and fixes → QA tests the fix → PM approves release → support notifies the user",
];

interface FreeformInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function FreeformInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: FreeformInputProps) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        placeholder="Describe your workflow in natural language. Include team members, tools, and handoff points for the best analysis..."
        style={{
          width: "100%",
          minHeight: 180,
          padding: "16px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--color-dark)",
          resize: "vertical",
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
          }}
        >
          {value.length} chars &middot; Ctrl+Enter to submit
        </span>
        <button
          onClick={onSubmit}
          disabled={disabled || value.trim().length < 20}
          style={{
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background:
              disabled || value.trim().length < 20
                ? "var(--color-border)"
                : "var(--color-accent)",
            color:
              disabled || value.trim().length < 20
                ? "var(--color-muted)"
                : "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            cursor:
              disabled || value.trim().length < 20 ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {disabled ? "Analyzing..." : "Decompose Workflow"}
        </button>
      </div>

      {/* Example prompts */}
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Try an example
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => onChange(ex)}
              disabled={disabled}
              style={{
                textAlign: "left",
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--color-text)",
                lineHeight: 1.5,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "border-color 0.2s, box-shadow 0.2s",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
