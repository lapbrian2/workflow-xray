"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Hide nav on login page
  if (pathname === "/login") return null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const links = [
    { href: "/", label: "X-Ray" },
    { href: "/library", label: "Library" },
    { href: "/compare", label: "Compare" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav
      style={{
        background:
          "linear-gradient(180deg, rgba(28, 37, 54, 0.98) 0%, rgba(28, 37, 54, 0.95) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "relative",
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Subtle bottom glow line */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(232,85,58,0.2) 30%, rgba(240,144,96,0.15) 50%, rgba(232,85,58,0.2) 70%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <Link
        href="/"
        className="brand-link"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Small accent dot / icon */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #E8553A 0%, #F09060 100%)",
            boxShadow: "0 0 8px rgba(232, 85, 58, 0.4)",
            animation: "pulseGlow 3s ease-in-out infinite",
          }}
        />
        <span
          className="brand-text"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background:
              "linear-gradient(135deg, #F0F2F5 0%, #E8553A 60%, #F09060 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "gradientShift 6s ease-in-out infinite",
            transition: "all 0.3s ease",
          }}
        >
          Workflow X-Ray
        </span>
      </Link>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/" || pathname.startsWith("/xray")
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${isActive ? " nav-active" : ""}`}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#F0F2F5" : "#6B7A8D",
                textDecoration: "none",
                background: isActive
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {link.label}
            </Link>
          );
        })}
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", marginLeft: 4, marginRight: 4 }} />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="nav-link"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 400,
            color: "#6B7A8D",
            background: "transparent",
            border: "none",
            cursor: loggingOut ? "wait" : "pointer",
            opacity: loggingOut ? 0.5 : 1,
          }}
        >
          {loggingOut ? "..." : "Logout"}
        </button>
      </div>
    </nav>
  );
}
