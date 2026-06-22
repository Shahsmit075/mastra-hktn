import type { ReactNode } from "react";

export const metadata = {
  title: "Runbook Sentinel",
  description: "Incident response and post-mortem agent workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafafa", color: "#111" }}>{children}</body>
    </html>
  );
}
