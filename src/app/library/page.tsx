import WorkflowLibrary from "@/components/workflow-library";

export default function LibraryPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 28px 60px" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 900,
          fontFamily: "var(--font-display)",
          color: "var(--color-dark)",
          letterSpacing: "-0.02em",
          marginBottom: 4,
        }}
      >
        Workflow Library
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text)",
          fontFamily: "var(--font-body)",
          marginBottom: 24,
        }}
      >
        All your decomposed workflows, saved and searchable.
      </p>
      <WorkflowLibrary />
    </div>
  );
}
