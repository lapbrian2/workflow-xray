import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow X-Ray — Architecture Blueprint",
  description:
    "Architecture & component blueprint for the Workflow X-Ray platform — from internal diagnostic to Glass-Box platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
