import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { AppFrame } from "@/components/shell";
export const metadata: Metadata = {
  title: "BrewLite | Cà phê Việt",
  description: "Đặt cà phê nhanh, thanh toán tiện lợi",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Google Fonts link preserves the Stitch font families without build-time downloads. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <AppFrame>{children}</AppFrame>
        </AuthProvider>
      </body>
    </html>
  );
}
