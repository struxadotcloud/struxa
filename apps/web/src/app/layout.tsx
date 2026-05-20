import type { Metadata } from "next";
import { Cal_Sans, Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const calSans = Cal_Sans({
  variable: "--font-cal-sans",
  fallback: [],
  subsets: ["latin"],
  weight: "400",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  fallback: [],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "struxa",
  description: "struxa panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${calSans.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
