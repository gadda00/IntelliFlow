import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IntelliFlow v3 · 20-Agent Data Analysis Platform",
  description: "IntelliFlow orchestrates 20 specialized AI agents in a parallel DAG to extract every actionable insight from your data. Real math, real fast, in production.",
  keywords: ["IntelliFlow", "multi-agent", "data analysis", "AI agents", "TypeScript", "Next.js", "Paystack", "anomaly detection", "forecasting", "causal inference"],
  authors: [{ name: "Victor Ndunda" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "IntelliFlow v3 · 20-Agent Data Analysis Platform",
    description: "20 specialized AI agents. One orchestrated pipeline. Real insights, fast.",
    url: "https://intelliflow.ai",
    siteName: "IntelliFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IntelliFlow v3",
    description: "20-agent parallel data analysis. TypeScript-native.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
