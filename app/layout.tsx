import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sump Pump Monitor",
  description: "Real-time sump pit monitoring",
  manifest: "/manifest.json", // LINK THE MANIFEST
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sump Monitor",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


