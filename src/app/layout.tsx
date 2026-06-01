import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: 'NexGuard360 | Seguridad Operativa y Control 360',
    template: '%s | NexGuard360',
  },
  description: 'Sistema operativo para agencias de seguridad privada. Turnos, armamento DIASP, flota, nómina ACH Panamá, analítica IA y compliance en una sola plataforma.',
  keywords: ['seguridad privada', 'agencia de seguridad', 'Panamá', 'DIASP', 'control de turnos', 'nómina quincenal', 'CSS', 'MITRADEL', 'ERP seguridad', 'NexGuard360'],
  authors: [{ name: 'Nexera' }],
  creator: 'Nexera',
  metadataBase: new URL('https://www.nexguard360.com'),
  openGraph: {
    type: 'website',
    locale: 'es_PA',
    url: 'https://www.nexguard360.com',
    siteName: 'NexGuard360',
    title: 'NexGuard360 | Seguridad Operativa y Control 360',
    description: 'Sistema operativo para agencias de seguridad privada en Panamá y LATAM. Centralice turnos, armamento, flota, nómina y compliance en una sola plataforma.',
    images: [{ url: '/nexguard360-logo.png', width: 1200, height: 630, alt: 'NexGuard360' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexGuard360 | Seguridad Operativa y Control 360',
    description: 'Sistema operativo para agencias de seguridad privada. Sin Excel, sin WhatsApp, sin parches.',
    images: ['/nexguard360-logo.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
