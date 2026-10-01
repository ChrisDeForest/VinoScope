import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ChapterNav } from "../components/learn/ChapterNav";
import { ChapterSection } from "../components/learn/ChapterSection";
import { LEARN_CHAPTERS } from "../components/learn/chapters";
import { LearnIntro } from "../components/learn/LearnIntro";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import "../components/learn/learn.css";

const SETTLE_MS = 4000;
const USER_INPUT_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

export function LearnPage() {
  const { hash } = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);

  // Only on arrival: the chapter doesn't exist yet when the browser tries its own
  // hash scroll. Later hash changes come from in-page anchors, which scroll natively.
  useEffect(() => {
    if (!hash) {
      // The app doesn't reset scroll on navigation, so arriving from deep in another page would land mid-chapter.
      try {
        window.scrollTo(0, 0);
      } catch {
        // jsdom doesn't implement scrollTo
      }
      return;
    }
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // malformed escape (e.g. %zz): fall back to the raw fragment
    }
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });

    // Cards load in after arrival and shift the target; keep it pinned until things settle or the reader takes over.
    const page = pageRef.current;
    if (!page || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => target.scrollIntoView({ behavior: "auto", block: "start" }));
    const stop = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      USER_INPUT_EVENTS.forEach((type) => window.removeEventListener(type, stop));
    };
    const timer = window.setTimeout(stop, SETTLE_MS);
    USER_INPUT_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    observer.observe(page);
    return stop;
  }, []);

  return (
    <div ref={pageRef} className="learn-page">
      <LearnIntro />
      <ChapterNav chapters={LEARN_CHAPTERS} />
      {LEARN_CHAPTERS.map(({ id, label, title, lead, Component }, i) => (
        <ChapterSection key={id} id={id} index={i + 1} label={label} title={title} lead={lead}>
          <Component />
        </ChapterSection>
      ))}
    </div>
  );
}
