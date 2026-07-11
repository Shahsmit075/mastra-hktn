import type { Metadata } from 'next';
import { DM_Sans, Space_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono' });

export const metadata: Metadata = {
  title: 'Runbook Sentinel — SRE Incident Response',
  description: 'AI-powered incident triage, remediation, and post-mortem platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${spaceMono.variable} font-sans bg-background text-foreground antialiased scanlines`}>
        {children}
      </body>
    </html>
  );
}
