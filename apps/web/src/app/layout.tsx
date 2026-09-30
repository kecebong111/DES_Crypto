import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DES Explorer",
  description: "Explore DES encryption, decryption, and key scheduling.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#f8f9ff] font-sans text-[#192139]">
        <header className="border-b border-indigo-100 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
            <Link
              href="/encryption"
              className="flex items-center gap-3 font-bold"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-xl text-blue-600">
                ◈
              </span>
              DES Explorer
            </Link>

            <span className="text-xs text-slate-500">
              An interactive cryptography lab
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-indigo-100 bg-white px-6 py-6 text-center text-xs text-slate-500">
          DES is a legacy algorithm for education, not modern security.
        </footer>
      </body>
    </html>
  );
}