import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veebase RCM Intelligence Platform",
  description: "Provider-side Revenue Cycle Management with Multi-Agent AI — Egypt / HFCX Context",
  keywords: ["RCM", "Revenue Cycle Management", "AI", "HFCX", "NHIA", "Healthcare", "Egypt"],
  authors: [{ name: "Veebase" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster
            position="bottom-right"
            richColors={false}
            closeButton={false}
            toastOptions={{
              unstyled: true,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
