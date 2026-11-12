import type { Metadata } from "next";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: "ViraPeça 3D — Sua ideia vira realidade",
  description:
    "Encontre peças feitas por fabricantes independentes ou transforme seu modelo 3D em uma peça real.",
  applicationName: "ViraPeça 3D",
  category: "marketplace",
  verification: googleVerification ? { google: googleVerification } : undefined,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    siteName: "ViraPeça 3D",
    title: "ViraPeça 3D — Sua ideia vira realidade",
    description:
      "Produtos autorais, impressão sob encomenda e fabricantes 3D do Brasil.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "ViraPeça 3D — Sua ideia vira realidade", description: "Produtos autorais, impressão sob encomenda e fabricantes 3D do Brasil." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`try { if (localStorage.getItem("virapeca-theme") === "dark") document.documentElement.dataset.theme = "dark"; } catch {}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
