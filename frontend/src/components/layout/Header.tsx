import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

const MOBILE_MENU_ID = "mobile-menu";

// surface is a CSS-variable hex color, so Tailwind's /opacity modifier can't
// apply to it directly; color-mix produces the same translucent effect.
const SOLID_BG = "bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)]";

export function Header({ overlay = false, fixed = false }: { overlay?: boolean; fixed?: boolean }) {
  // The header only goes transparent-over-the-hero when it's both fixed (on
  // the home page) and still positioned over the hero (not scrolled past).
  const isOverlay = fixed && overlay;
  const headerClass = !fixed
    ? "border-b border-surface-border"
    : isOverlay
      ? "fixed inset-x-0 top-0 z-20"
      : `fixed inset-x-0 top-0 z-20 ${SOLID_BG} backdrop-blur border-b border-surface-border motion-safe:transition-colors`;
  const brandClass = isOverlay ? "text-cellar-ink" : "text-ink";
  const idleLinkClass = isOverlay ? "text-cellar-muted hover:text-cellar-ink" : "text-ink-muted hover:text-ink";
  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "text-accent" : idleLinkClass);

  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close on route change, wherever it came from (nav link, back/forward, etc).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={headerClass}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/" className={`font-serif text-lg tracking-wide ${brandClass}`}>
          VinoScope
        </NavLink>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={MOBILE_MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
          className={`md:hidden inline-flex items-center justify-center rounded p-1 ${idleLinkClass}`}
        >
          <span className="sr-only">Menu</span>
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden md:flex items-center gap-4 flex-wrap">
          <nav className="flex items-center gap-4 text-sm flex-wrap">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSwitcher variant={isOverlay ? "overlay" : "default"} />
            <NavLink to="/admin" className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}>
              Admin
            </NavLink>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div id={MOBILE_MENU_ID} className="md:hidden px-4 pb-4">
          <nav className="flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={closeMenu} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-between gap-3 pt-3">
            <ThemeSwitcher variant={isOverlay ? "overlay" : "default"} />
            <NavLink
              to="/admin"
              onClick={closeMenu}
              className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}
            >
              Admin
            </NavLink>
          </div>
        </div>
      )}
    </header>
  );
}
