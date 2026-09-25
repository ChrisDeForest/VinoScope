import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useInView } from "../../hooks/useInView";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import "./home.css";

interface SceneProps {
  id: string;
  index: number;
  label: string;
  title: string;
  side: "left" | "right";
  art: ReactNode;
  children: ReactNode;
}

export function Scene({ id, index, label, title, side, art, children }: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref);
  const titleId = `${id}-title`;

  const classes = ["scene grid items-center gap-10 py-16 md:py-24 md:grid-cols-2"];
  if (!reducedMotion) classes.push("scene-animate");
  if (inView) classes.push("is-visible");

  return (
    <section ref={ref} id={id} aria-labelledby={titleId} data-side={side} className={classes.join(" ")}>
      <div data-testid="scene-art" aria-hidden="true" className={side === "right" ? "md:order-last" : undefined}>
        {art}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">
          {String(index).padStart(2, "0")} · {label}
        </p>
        <h2 id={titleId} className="font-serif text-3xl md:text-4xl text-ink mb-4">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function SceneCta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-block border border-accent text-accent font-semibold px-5 py-2.5 rounded hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
