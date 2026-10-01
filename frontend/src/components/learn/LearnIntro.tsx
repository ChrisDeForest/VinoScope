import { useRef } from "react";
import { useReveal } from "../../hooks/useReveal";
import { cssVars } from "../home/art/cssVars";
import "../home/home.css";

function Flourish() {
  return (
    <svg viewBox="0 0 240 40" className="w-48 mb-6" focusable="false" aria-hidden="true">
      <path
        className="draw stroke-accent"
        pathLength={1}
        d="M4 20 H96 q12 -14 24 0 q12 14 24 0 H236"
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle className="pop fill-wine-rose" style={cssVars({ "--delay": "0.9s" })} cx="120" cy="20" r="3" />
    </svg>
  );
}

export function LearnIntro() {
  const ref = useRef<HTMLElement>(null);
  const reveal = useReveal(ref);
  return (
    <header ref={ref} className={["scene pt-8 pb-10 max-w-2xl", ...reveal].join(" ")}>
      <Flourish />
      <h1 className="font-serif text-4xl md:text-5xl text-ink mb-4">Learn what's in your glass.</h1>
      <p className="text-ink-muted text-lg">
        A short guide to the words behind the wine, starting with how to taste. Every term here is one you'll meet across
        VinoScope.
      </p>
    </header>
  );
}
