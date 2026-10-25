/* eslint-disable @next/next/no-page-custom-font -- App Router root layout shares this stylesheet across every route without a build-time font download. */
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AppNotifications } from "@/components/auth/app-notifications";
export const metadata: Metadata = {
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  title: "Dono | Donate items associations need",
  description:
    "Find nearby needs, offer items to associations and arrange your drop-off after staff approval.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AuthProvider>
          <AppNotifications>{children}</AppNotifications>
        </AuthProvider>
      </body>
    </html>
  );
}
