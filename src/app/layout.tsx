import type { Metadata } from "next";
import Nav from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow X-Ray",
  description:
    "Decompose any workflow into visual flow maps with gap analysis and health scoring — powered by Claude.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
