import type { Metadata } from "next";
import { Funnel_Display, Geist, Geist_Mono } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";

import "../index.css";
import Providers from "@/components/providers";
import { getInstanceSettings } from "@/lib/instance-settings";

const funnelDisplay = Funnel_Display({
  variable: "--font-funnel-display",
  fallback: [],
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
  const {
    appName, metaDescription, logoUrl, ogBannerUrl,
    ogTitle, ogDescription, ogSiteName, ogType,
    twitterCard, twitterSite, twitterCreator,
    themeColor, metaKeywords,
  } = await getInstanceSettings();

  const resolvedTitle = ogTitle || appName;
  const resolvedDesc = ogDescription || metaDescription || `${appName} panel`;

  return {
    title: appName,
    description: resolvedDesc,
    ...(metaKeywords ? { keywords: metaKeywords } : {}),
    ...(themeColor ? { themeColor } : {}),
    icons: { icon: logoUrl ?? "/favicon.ico" },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDesc,
      siteName: ogSiteName || appName,
      type: (ogType as "website" | "article" | "profile") ?? "website",
      ...(ogBannerUrl ? { images: [{ url: ogBannerUrl }] } : {}),
    },
    twitter: {
      card: (twitterCard as "summary" | "summary_large_image") ?? "summary_large_image",
      ...(twitterSite ? { site: twitterSite } : {}),
      ...(twitterCreator ? { creator: twitterCreator } : {}),
      title: resolvedTitle,
      description: resolvedDesc,
      ...(ogBannerUrl ? { images: [ogBannerUrl] } : {}),
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
      <body className={`${funnelDisplay.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
