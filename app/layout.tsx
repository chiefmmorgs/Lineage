import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Lineage Explorer — ERC-8004 Agent Identity",
  description:
    "Discover, verify, and rate AI agents on Base. Every agent carries its own ERC-8004 identity, linked to its creator's reputation profile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          {children}
          <footer className="footer">
            <div className="container">
              <div className="footer-inner">
                <span>
                  <strong style={{ color: "var(--text-secondary)" }}>Lineage</strong> · Built by BDH&apos;
                </span>
                <span className="footer-note">Deployed on Base · Agents with provenance</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
