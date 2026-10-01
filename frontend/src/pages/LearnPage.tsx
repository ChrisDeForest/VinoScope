import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChapterNav } from "../components/learn/ChapterNav";
import { ChapterSection } from "../components/learn/ChapterSection";
import { LEARN_CHAPTERS } from "../components/learn/chapters";
import { LearnIntro } from "../components/learn/LearnIntro";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import "../components/learn/learn.css";

export function LearnPage() {
  const { hash } = useLocation();
  const reducedMotion = usePrefersReducedMotion();

  // Only on arrival: the chapter doesn't exist yet when the browser tries its own
  // hash scroll. Later hash changes come from in-page anchors, which scroll natively.
  useEffect(() => {
    if (!hash) return;
    document
      .getElementById(decodeURIComponent(hash.slice(1)))
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, []);

  return (
    <div className="learn-page">
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
