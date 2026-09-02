import type { Metadata, Viewport } from "next";
import { DM_Mono, Fraunces, Karla } from "next/font/google";
import { AppShell } from "@/components/templates/AppShell";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 * Fraunces carries the display voice — a variable serif with SOFT and WONK
 * axes, set warm and slightly wonky so the app reads as friendly rather than
 * institutional. Karla handles UI text: a grotesque with enough character to
 * sit beside a serif without looking like a system default. DM Mono appears
 * only on metadata — shelf labels, counts, tool names — which is the nod to
 * library card catalogues that gives the layout its structure.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const karla = Karla({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-karla",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "TBR — a library your agent can read too",
  description:
    "Track what you want to read, what you finished and what you gave up on — " +
    "and let an AI agent search your shelves, learn your taste and add books, " +
    "through WebMCP.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#14110d" },
  ],
};

/**
 * Resolves the theme before first paint. Without this, a reader who chose dark
 * sees a flash of cream while React hydrates.
 */
const THEME_BOOTSTRAP = `
try {
  var stored = localStorage.getItem('tbr.theme');
  var theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body
        className={`${fraunces.variable} ${karla.variable} ${dmMono.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
