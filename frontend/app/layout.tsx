import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DocuMind — Chat with your documents",
    template: "%s · DocuMind",
  },
  description:
    "Upload PDFs and text files, then ask questions grounded in your own documents with cited answers.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}