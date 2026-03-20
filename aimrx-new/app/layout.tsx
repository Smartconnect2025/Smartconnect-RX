import { UserProvider, AuthInterceptorProvider } from "@core/auth";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SpecodeIframeTracker } from "@core/integrations/specode";
import { ClientNotificationProvider } from "@/features/notifications";
import { PharmacyProvider } from "@/contexts/PharmacyContext";
import { Footer } from "@/components/layout/Footer";
import { InactivityTimer } from "@/components/layout/InactivityTimer";
import "./theme.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

// Cache-bust: v9.0.0 - Unified gradient design across entire app with MFA implementation
export const metadata: Metadata = {
  title: "SmartConnect RX | Pharmacy Management Platform",
  description: "SmartConnect RX connects patients, providers, and pharmacies with a secure, HIPAA-compliant platform.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <UserProvider>
          <AuthInterceptorProvider>
            <PharmacyProvider>
              <ClientNotificationProvider>
                <SpecodeIframeTracker />
                <InactivityTimer />
                <div className="flex-1 flex flex-col">
                  {children}
                </div>
                <Footer />
                <Toaster />
              </ClientNotificationProvider>
            </PharmacyProvider>
          </AuthInterceptorProvider>
        </UserProvider>
      </body>
    </html>
  );
}
