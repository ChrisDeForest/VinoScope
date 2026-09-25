import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { prefersLightweightMedia } from "../../utils/connection";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import {
  HERO_FRAME_COUNT,
  frameIndexForProgress,
  MAX_PIXEL_RATIO,
  frameSetForViewport,
  frameUrl,
  nearestLoadedFrame,
  placeFrame,
  placementForSet,
  posterUrl,
  stillUrl,
  type FrameSet,
} from "../../utils/frameSequence";

const PRELOAD_CONCURRENCY = 8;
const CUE_HIDE_PROGRESS = 0.05;
const MEDIA_LABEL = "Red wine being poured into a glass";

function HeroCopy({ showCue }: { showCue: boolean }) {
  return (
    <div className="relative z-10 h-full max-w-6xl mx-auto px-4 pt-24 flex flex-col justify-start md:pt-0 md:justify-center">
      <div className="max-w-md">
        <h1 id="hero-title" className="font-serif text-4xl md:text-5xl text-cellar-ink mb-4">
          Find a wine you'll actually enjoy.
        </h1>
        <p className="text-cellar-muted mb-6">
          Browse a real catalog by type, country, grape, and price — then let VinoScope help you choose.
        </p>
        <Link
          to="/explore"
          className="inline-block bg-accent text-surface font-semibold px-6 py-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cellar-ink"
        >
          Explore Wines
        </Link>
      </div>
      <p
        aria-hidden="true"
        data-testid="scroll-cue"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-cellar-muted transition-opacity duration-300 ${showCue ? "opacity-100" : "opacity-0"}`}
      >
        Scroll
      </p>
    </div>
  );
}

// Shared by the poster (motion branch's loading placeholder) and the still
// (static branch's only image): both are a single frame laid out the same
// way as the frame sequence itself.
function mediaClass(frameSet: FrameSet): string {
  return `absolute inset-0 h-full w-full ${frameSet === "mobile" ? "object-contain object-bottom" : "object-cover"}`;
}

const CELLAR_FADE = (
  <div aria-hidden="true" className="h-[30vh] bg-gradient-to-b from-cellar-bg to-surface" />
);

// Marks the end of the hero for useScrolledPast: once this scrolls above the
// viewport top, the sticky header switches from its overlay state to solid.
const HERO_END_SENTINEL = <div id="hero-end" aria-hidden="true" />;

// The mobile frame set is placed "fit-width-bottom": full width, anchored to
// the viewport bottom (aspect-[3/4] mirrors that geometry, since height =
// width * 4/3). The frame's own background near its top edge is a slightly
// lighter burgundy than the cellar band above it, so without this the frame's
// top edge shows as a hard seam. This fades the band color down over the
// frame's top quarter so the transition reads as continuous instead.
const MOBILE_SEAM_FADE = (
  <div
    aria-hidden="true"
    data-testid="mobile-seam-fade"
    className="pointer-events-none absolute inset-x-0 bottom-0 aspect-[3/4] w-full bg-gradient-to-b from-cellar-bg from-0% via-transparent via-25% to-transparent"
  />
);

export function HeroPour() {
  const reducedMotion = usePrefersReducedMotion();
  // Read once at mount: a live-updating connection has nothing worth
  // reacting to mid-session, and re-reading on every render would risk
  // flipping the hero between variants while the visitor is scrolling it.
  const [lightweight] = useState<boolean>(prefersLightweightMedia);
  // True when the hero should skip motion entirely: reduced-motion
  // preference or a data-saver / slow connection. Renders a single still
  // image instead of the scroll-scrubbed canvas.
  const isStatic = reducedMotion || lightweight;
  // Chosen once so a resize never triggers a second download of the other set.
  const [frameSet] = useState<FrameSet>(() =>
    frameSetForViewport({ width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio })
  );
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const targetFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showCue, setShowCue] = useState(true);

  const draw = useCallback(
    (force = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Cache the 2D context: it never changes for a given canvas, and draw()
      // runs on every scroll-driven animation frame. Re-acquire it whenever
      // the canvas element itself has changed (e.g. reduced motion toggled
      // off and on, remounting a fresh <canvas>), since a cached context tied
      // to a detached canvas would silently paint nothing visible.
      const context =
        contextRef.current && contextRef.current.canvas === canvas
          ? contextRef.current
          : canvas.getContext("2d");
      contextRef.current = context;
      if (!context) return;
      const frames = framesRef.current;
      const index = nearestLoadedFrame(targetFrameRef.current, frames.map(Boolean));
      if (index === null || (!force && index === drawnFrameRef.current)) return;
      const image = frames[index];
      if (!image) return;
      const rect = placeFrame(
        placementForSet(frameSet),
        image.naturalWidth,
        image.naturalHeight,
        canvas.width,
        canvas.height
      );
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      drawnFrameRef.current = index;
    },
    [frameSet]
  );

  useScrollProgress(
    sectionRef,
    (progress) => {
      targetFrameRef.current = frameIndexForProgress(progress, HERO_FRAME_COUNT);
      setShowCue(progress < CUE_HIDE_PROGRESS);
      draw();
    },
    !isStatic
  );

  // Keep the canvas backing store matched to its CSS size.
  useEffect(() => {
    if (isStatic) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      draw(true);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isStatic, draw]);

  // Preload frames in order, a few at a time; the poster covers the gap.
  useEffect(() => {
    if (isStatic) return;
    let cancelled = false;
    let next = 0;
    let shownFirstFrame = false;
    const frames: (HTMLImageElement | null)[] = new Array(HERO_FRAME_COUNT).fill(null);
    framesRef.current = frames;

    const loadNext = () => {
      if (cancelled || next >= HERO_FRAME_COUNT) return;
      const index = next++;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (cancelled) return;
        frames[index] = image;
        // Reveal the canvas once the first frame to actually load has
        // decoded, not specifically frame 0 — if frame 0's request fails,
        // later frames still load and draw, and the canvas should still
        // replace the poster instead of staying hidden forever.
        if (!shownFirstFrame && canvasRef.current?.getContext("2d")) {
          shownFirstFrame = true;
          setCanvasReady(true);
        }
        draw();
        loadNext();
      };
      image.onerror = () => loadNext();
      image.src = frameUrl(frameSet, index);
    };

    for (let i = 0; i < PRELOAD_CONCURRENCY; i++) loadNext();
    return () => {
      cancelled = true;
      // Reset the reveal/draw state so a later remount (e.g. reduced motion
      // toggling off after having been turned on) starts clean instead of
      // reusing a context/frame index tied to a now-detached canvas.
      setCanvasReady(false);
      drawnFrameRef.current = -1;
      contextRef.current = null;
    };
  }, [isStatic, frameSet, draw]);

  if (isStatic) {
    return (
      <>
        <section aria-labelledby="hero-title" className="relative h-[100svh] overflow-hidden bg-cellar-bg">
          <div role="img" aria-label={MEDIA_LABEL} className="absolute inset-0">
            <img src={stillUrl(frameSet)} alt="" className={mediaClass(frameSet)} decoding="async" />
            {frameSet === "mobile" && MOBILE_SEAM_FADE}
          </div>
          <HeroCopy showCue={false} />
        </section>
        {HERO_END_SENTINEL}
        {CELLAR_FADE}
      </>
    );
  }

  return (
    <>
      <section ref={sectionRef} aria-labelledby="hero-title" className="relative h-[200vh] bg-cellar-bg">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div role="img" aria-label={MEDIA_LABEL} className="absolute inset-0">
            <img src={posterUrl(frameSet)} alt="" className={mediaClass(frameSet)} decoding="async" />
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${canvasReady ? "opacity-100" : "opacity-0"}`}
            />
            {frameSet === "mobile" && MOBILE_SEAM_FADE}
          </div>
          <HeroCopy showCue={showCue} />
        </div>
      </section>
      {HERO_END_SENTINEL}
      {CELLAR_FADE}
    </>
  );
}
