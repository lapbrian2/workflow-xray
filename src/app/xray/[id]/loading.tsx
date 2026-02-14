export default function Loading() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "40px 28px",
      }}
    >
      {/* Title skeleton */}
      <div
        style={{
          height: 28,
          width: 300,
          background: "var(--color-border)",
          borderRadius: 6,
          marginBottom: 24,
          animation: "pulse-slow 1.5s ease infinite",
        }}
      />

      {/* Tab skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[80, 60, 70].map((w, i) => (
          <div
            key={i}
            style={{
              height: 32,
              width: w,
              background: "var(--color-border)",
              borderRadius: 6,
              animation: `pulse-slow 1.5s ease ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div
        style={{
          height: 500,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          animation: "pulse-slow 1.5s ease infinite",
        }}
      />
    </div>
  );
}
