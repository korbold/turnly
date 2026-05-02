import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "../components/providers";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto", weight: ["400","500","600","700","800"],
});

export const metadata: Metadata = {
  title: "Turnly Admin",
  description: "Panel de administración Turnly",
  manifest: "/manifest.json",
  themeColor: "#F2693A",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Turnly",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${roboto.className} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
