/* eslint-disable @next/next/no-page-custom-font -- App Router root layout shares this stylesheet across every route without a build-time font download. */
import type { Metadata } from "next";
import "./globals.css";
import { DemoProvider } from "@/lib/demo-context";
export const metadata: Metadata = {
  title: "Dono | Useful donations, together",
  description: "A local demonstration of the Dono donation journey.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
