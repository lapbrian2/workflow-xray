export default function Loading() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "40px 32px",
      }}
    >
      {/* Back link skeleton */}
      <div
        style={{
          height: 12,
          width: 80,
          background: "var(--color-border)",
          borderRadius: 4,
          marginBottom: 8,
          animation: "pulse-slow 1.5s ease infinite",
        }}
      />

      {/* Title skeleton */}
      <div
        style={{
          height: 32,
          width: 320,
          background: "var(--color-border)",
          borderRadius: "var(--radius-sm)",
          marginBottom: 12,
          animation: "pulse-slow 1.5s ease 0.1s infinite",
        }}
      />

      {/* Tags skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[72, 56, 96].map((w, i) => (
          <div
            key={i}
            style={{
              height: 20,
              width: w,
              background: "var(--color-border)",
              borderRadius: 4,
              animation: `pulse-slow 1.5s ease ${0.2 + i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Tab skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[80, 64, 72].map((w, i) => (
          <div
            key={i}
            style={{
              height: 32,
              width: w,
              background: "var(--color-border)",
              borderRadius: "var(--radius-sm)",
              animation: `pulse-slow 1.5s ease ${0.3 + i * 0.1}s infinite`,
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
          borderRadius: "var(--radius-lg)",
          animation: "pulse-slow 1.5s ease 0.5s infinite",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Fake flow nodes */}
        <div style={{ padding: 48 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 48 }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 180,
                  height: 72,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-border)",
                  animation: `pulse-slow 1.5s ease ${0.6 + i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 48 }}>
            {[3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: 180,
                  height: 72,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-border)",
                  animation: `pulse-slow 1.5s ease ${0.6 + i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
            {[6, 7].map((i) => (
              <div
                key={i}
                style={{
                  width: 180,
                  height: 72,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-border)",
                  animation: `pulse-slow 1.5s ease ${0.6 + i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
