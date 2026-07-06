import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import SkipLink from "@/components/layout/SkipLink";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rohitsarna.github.io/ragornot";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ragornot — compare, learn, decide",
    template: "%s | ragornot",
  },
  description:
    "Compare retrieval architectures, track real cost and latency, and follow the AI, LLM, and RAG conversation — in one place.",
  authors: [{ name: "Rohit Sarna", url: "https://github.com/rohitsarna" }],
  keywords: ["RAG", "retrieval augmented generation", "LLM", "AWS docs", "benchmark", "AI", "vector search"],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "ragornot — compare, learn, decide",
    description:
      "Compare retrieval architectures — flat, hierarchical, LLM-only, and RAG — with live cost, latency, and quality tracking.",
    siteName: "ragornot",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ragornot" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ragornot — compare, learn, decide",
    description:
      "Compare retrieval architectures — flat, hierarchical, LLM-only, and RAG — with live cost, latency, and quality tracking.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("ragornot-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ragornot",
  url: SITE_URL,
  description:
    "Compare retrieval architectures, track real cost and latency, and follow the AI, LLM, and RAG conversation.",
  author: {
    "@type": "Person",
    name: "Rohit Sarna",
    url: "https://github.com/rohitsarna",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <SkipLink />
        <NavBar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
