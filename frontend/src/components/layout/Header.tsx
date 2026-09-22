import { NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

export function Header() {
  return (
    <header className="border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <NavLink to="/" className="font-serif text-lg tracking-wide text-ink">
          VinoScope
        </NavLink>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-accent" : "text-ink-muted hover:text-ink")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
