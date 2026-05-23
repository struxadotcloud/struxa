import type { Metadata } from "next";
import { Cal_Sans, Geist, Geist_Mono } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";

import "../index.css";
import Providers from "@/components/providers";
import { getInstanceSettings } from "@/lib/instance-settings";

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

export async function generateMetadata(): Promise<Metadata> {
  const { appName, metaDescription, logoUrl, ogBannerUrl } = await getInstanceSettings();
  const description = metaDescription || `${appName} panel`;
  return {
    title: appName,
    description,
    icons: { icon: logoUrl ?? "/favicon.ico" },
    openGraph: {
      title: appName,
      description,
      ...(ogBannerUrl ? { images: [{ url: ogBannerUrl }] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${calSans.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
