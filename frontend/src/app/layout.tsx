import type { Metadata } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Forta Match",
  description: "AI for triage and referral — AI recommends, humans decide",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${notoSans.variable} font-body antialiased`}>
        <div className="flex min-h-screen bg-page-gradient">
          <Sidebar />
          <main className="flex-1 pb-20 lg:pb-0 lg:pl-72">
            <div className="min-h-screen">{children}</div>
          </main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
