import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SleepyHug CS",
  description: "Customer support workspace for SleepyHug",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-color-mode="light" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
