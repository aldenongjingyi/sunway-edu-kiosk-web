import type { Metadata, Viewport } from "next";
import "./globals.css";
import HyperDXInit from "@/components/HyperDXInit";

export const metadata: Metadata = {
  title: "Sunway University Campus Kiosk",
  description: "Find facilities, staff, and directions across Sunway University campus.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-white">
        <HyperDXInit />
        {children}
      </body>
    </html>
  );
}
