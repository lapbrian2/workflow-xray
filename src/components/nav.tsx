"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "X-Ray" },
    { href: "/library", label: "Library" },
  ];

  return (
    <nav
      style={{
        background: "var(--color-dark)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 900,
          color: "#F0F2F5",
          textDecoration: "none",
          letterSpacing: "-0.02em",
        }}
      >
        Workflow X-Ray
      </Link>
      <div style={{ display: "flex", gap: 4 }}>
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/" || pathname.startsWith("/xray")
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#F0F2F5" : "#6B7A8D",
                textDecoration: "none",
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
