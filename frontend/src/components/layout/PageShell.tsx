import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  const isHome = useLocation().pathname === "/";

  return (
    <div className="relative min-h-screen flex flex-col bg-surface text-ink">
      {isHome && (
        <a
          href="#all-features"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded focus:bg-cellar-bg focus:px-4 focus:py-2 focus:text-cellar-ink"
        >
          Skip to all features
        </a>
      )}
      <Header overlay={isHome} />
      <main className={isHome ? "flex-1 w-full" : "flex-1 max-w-6xl w-full mx-auto px-4 py-8"}>{children}</main>
      <Footer />
    </div>
  );
}
