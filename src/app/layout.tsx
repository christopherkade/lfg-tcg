import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeRegistry } from "@/components/ThemeRegistry";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { getServerLocale } from "@/lib/i18n/server";
import { ThemeModeProvider } from "@/lib/theme/ThemeModeContext";
import { getServerThemeMode } from "@/lib/theme/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PodMaker",
  description:
    "Create your own TCG pods and find your next game, IRL or online.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  const mode = await getServerThemeMode();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          <ThemeModeProvider initialMode={mode}>
            <ThemeRegistry>{children}</ThemeRegistry>
          </ThemeModeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
