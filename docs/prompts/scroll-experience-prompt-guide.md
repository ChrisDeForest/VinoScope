# VinoScope Scroll Experience — Prompt Guide

A playbook for turning the VinoScope home page into a scroll-driven, wine-themed showcase
(and later, giving the other pages the same treatment). It covers:

1. **How to work with Claude Code on this** — the workflow and habits that get the best results
2. **How to prompt Higgsfield** — asset specs, prompt anatomy, ready-to-use prompts, post-processing
3. **The master prompt** — paste-ready, for the home page build
4. **Follow-up prompts** — one per page, for the phase-two rollout
5. **Troubleshooting prompts** — what to say when something goes sideways

Chosen direction: **Hybrid (Option C)** — one cinematic Higgsfield-generated hero at the top,
then lightweight, code-driven illustrated stages below that showcase each feature and end on a
row of every CTA.

---

## Part 1 — Working with Claude Code

### The workflow that works best here

This project already uses the superpowers flow: **brainstorm → spec → plan → subagent-driven
build → one final whole-branch review**. Keep using it. Scroll animation is exactly the kind of
work where unexamined assumptions ("it'll just be a few CSS transitions") blow up later.

| Step | What you say | What you get |
|------|--------------|--------------|
| 1. Branch | "Create a branch `feature/home-scroll` off main." | Isolation from other work |
| 2. Assets | Part 2 prompts (can run before or in parallel with step 3) | Hero video/frames in the repo |
| 3. Design | The Part 3 master prompt | A spec in `docs/superpowers/specs/` |
| 4. Plan | "Spec approved — write the plan." | Task-by-task plan |
| 5. Build | "Execute the plan with subagent-driven development." | Commits per task |
| 6. Review | "Run the final whole-branch review on a strong model." | Findings + fix wave |
| 7. See it | "Run the app and screenshot each scroll stage in all three themes." | Visual proof, not just green tests |

### Habits that make prompts land

- **Point at this file.** Start prompts with `@docs/prompts/scroll-experience-prompt-guide.md`
  so Claude reads the whole brief instead of you retyping it.
- **Say what "done" looks like.** "Every CTA reachable with keyboard, works at 375px wide,
  reduced-motion users get a static page, Lighthouse perf ≥ 85" beats "make it cool."
- **Name the feeling, then the mechanics.** "Should feel like a sommelier walking you through
  the cellar — unhurried, warm, a little theatrical" gives Claude a taste target; the stage list
  gives it a build target. Give both.
- **One page at a time.** Don't ask for the home page and three other pages in one prompt.
  Each gets its own brainstorm → spec → plan cycle.
- **Ask for visual verification.** Tests in jsdom can't see animation. Ask Claude to launch the
  app and screenshot each stage (`/run`), in each theme, at desktop and phone widths.
- **Push back with specifics.** "Stage 3 feels rushed — give it 50% more scroll distance and
  delay the plate until the glass finishes filling" is far more useful than "it feels off."
- **Protect what works.** Say "don't change Explore/Discover/Pair/Compare behavior or their
  tests" when working on the home page so nothing drifts.

### Project facts Claude should respect (already true in the codebase)

- React 18 + Vite + TypeScript + Tailwind 3; tests run in Vitest + jsdom.
- **Three themes** via CSS variables in `frontend/src/theme/themes.css`:
  `dark-burgundy` (default), `cream-terracotta` (light), `charcoal-gold`.
  Tailwind tokens: `surface`, `surface-raised`, `surface-border`, `ink`, `ink-muted`, `accent`.
  **Anything new must look right in all three — including the cinematic hero.**
- Serif display font is Georgia/Cambria; there's no web font yet.
- Routes: `/explore`, `/discover`, `/pair`, `/compare`, `/learn` (Learn is still a stub),
  `/wines/:id`, `/admin`.
- No animation library installed yet, and no `frontend/public/` folder yet.

---

## Part 2 — Prompting Higgsfield

Claude has the Higgsfield MCP connected, so you can ask Claude to generate assets directly.
You can also use the Higgsfield site yourself — the prompts below work either way.

### What we need (the asset list)

| Asset | Purpose | Format | Notes |
|-------|---------|--------|-------|
| **Hero keyframe** | First frame, poster image, reduced-motion fallback | 16:9 still, ≥1920px wide | Generated first; everything else derives from it |
| **Hero pour clip** | The cinematic moment at the top | 16:9, 5–8 s, image-to-video from the keyframe | Converted to a frame sequence for scroll-scrubbing |
| **Hero mobile variant** | Phone layout | 9:16 still + clip | Same scene, reframed — Higgsfield `reframe`/`outpaint` can derive it |
| *(Optional)* Swirl clip | Alternate hero or Discover accent | 16:9, 4–6 s | Only if the pour looks great and you want more |

Keep the rest of the page illustrated (SVG/CSS). Don't generate stage art — that's what keeps
the page fast and theme-aware.

### Anatomy of a strong Higgsfield prompt

Write prompts in this order; each slot removes guesswork:

1. **Subject** — exactly what's in frame ("a single crystal Bordeaux glass").
2. **Action** — what happens, in time order ("red wine pours in, climbs the bowl, settles").
3. **Camera** — lens, movement, framing ("85mm macro, slow push-in, locked tripod").
4. **Lighting** — direction, quality, colour ("single warm key from upper left, gold rim light").
5. **Background & composition** — plain, dark, with **negative space for the headline**.
6. **Style** — "photoreal commercial product film," "shallow depth of field," "film grain subtle."
7. **Exclusions** — "no text, no labels, no logos, no hands, no people, no bottle branding."
8. **Technical** — aspect ratio, duration, "seamless loop," "ends on a still frame."

Rules of thumb:

- **Image first, then animate.** Generate and approve the still, then run image-to-video from it.
  You get control over composition; video models improvise less when anchored.
- **Keep backgrounds near-black and featureless.** The page fades the hero into
  `var(--color-surface)`; busy backgrounds can't blend into three different themes.
- **Leave the left third empty** on desktop (headline goes there); on mobile, leave the top third.
- **Generate 3–4 variants in a batch**, pick the best, don't iterate one at a time.
- **Check credits first** — ask Claude to run `balance` and state estimated cost before
  generating video.
- **Let Claude pick the model.** Model lineups change; ask it to use `models_explore` with
  action `recommend` rather than hard-coding a model name.

### Ready-to-use prompts

**A. Hero keyframe (16:9 still)**

> Photoreal commercial product photograph. A single elegant crystal Bordeaux wine glass,
> positioned on the right two-thirds of the frame, half-filled with deep ruby-red wine, a thin
> stream of wine still falling into the bowl from above the frame with a small crown of ripples
> at the surface. Background is a seamless near-black burgundy (#231416) that falls off to pure
> black at the edges — no table edge, no horizon, no props. Single warm key light from the upper
> left, a thin antique-gold rim light (#c9a86a) tracing the glass edge, light glowing through the
> wine to show its garnet core. 85mm macro, f/2.8, shallow depth of field, crisp focus on the
> wine surface. Left third of the frame is empty dark negative space. Moody, luxurious, calm.
> No text, no labels, no logos, no hands, no people, no bottle visible. Aspect ratio 16:9.

**B. Hero pour clip (image-to-video from A)**

> Starting from this exact frame: a slow-motion pour. The stream of red wine continues into the
> glass, the liquid rises and gently swirls up the inside of the bowl, catching the gold rim
> light, then the stream thins and stops and the surface settles to stillness. Camera: locked
> tripod with a very slow push-in (about 5% over the clip). Lighting and background unchanged
> throughout — near-black burgundy, no new objects enter frame. Duration 6 seconds. Final second
> is nearly still. No text, no logos, no hands, no people, no cuts.

**C. Mobile variant (9:16)**

> Ask Claude: "Reframe the approved hero keyframe to 9:16 with the glass in the lower
> two-thirds and empty dark space above for the headline, then generate the same pour clip from
> it." (Uses `reframe`/`outpaint`, then image-to-video with prompt B.)

**D. Optional swirl clip**

> Photoreal macro, 16:9. The same crystal Bordeaux glass, now two-thirds full of ruby wine,
> being gently swirled so the wine climbs the bowl in a smooth wave and "legs" run back down the
> glass. Same near-black burgundy background, warm upper-left key light, gold rim light. Locked
> camera. 5 seconds, seamless loop (last frame matches first). No text, no hands visible — the
> glass moves as if on a turntable. No logos.

### Post-processing (ask Claude to do this)

Scrubbing an MP4 by setting `video.currentTime` stutters on most browsers. Smooth scroll-scrub
needs an **image sequence drawn to a canvas**:

> "Download the approved hero clip. Use ffmpeg to extract ~90 frames (15 fps over 6 s) as WebP
> at quality ~70: a 1600px-wide desktop set and a 750px-wide mobile set from the 9:16 clip.
> Put them in `frontend/public/hero/desktop/` and `frontend/public/hero/mobile/` as
> `frame-001.webp`…, plus a `poster.webp` (the keyframe) for each. Report the total size of each
> set — target under ~3 MB desktop and ~1.2 MB mobile; reduce frame count or quality if over."

Fallback if frames are too heavy: autoplay the MP4 once (muted, `playsinline`) on load instead
of scrubbing it, and let only the illustrated stages respond to scroll.

---

## Part 3 — Master Prompt: Home Page

Paste this into Claude Code (after the hero assets exist, or tell it they're coming):

```
@docs/prompts/scroll-experience-prompt-guide.md

Use superpowers:brainstorming. I want to rebuild the VinoScope home page
(frontend/src/pages/HomePage.tsx) as a scroll-driven showcase. We already chose the
Hybrid direction: one cinematic Higgsfield hero at the top, then illustrated,
code-driven stages. Work on branch feature/home-scroll.

THE FEELING
A sommelier walking you through the cellar: unhurried, warm, a little theatrical.
Each stage teaches what one feature does and ends with its button. By the bottom,
the visitor has seen everything the app can do and every button is in reach.

THE STORY (scroll order)
0. Hero — the cinematic pour, scrubbed by scroll (canvas + frame sequence from
   frontend/public/hero/). Headline "Find a wine you'll actually enjoy." in the
   negative space, primary CTA "Explore Wines", and a subtle "scroll" cue. The
   hero's edges fade into var(--color-surface) so it works in all three themes.
1. Explore — the poured glass hands off to an illustrated SVG glass. Bottles fan
   out behind it; small cards show REAL wines from our API (type, country, price).
   CTA → /explore.
2. Discover — the glass swirls; a taste-profile readout (body, tannin, acidity,
   sweetness) fills in like a meter as you scroll. CTA → /discover.
3. Pair — a plate slides in beside the glass; food ↔ wine pairing chips pop in
   (use the existing food-pairing constants). CTA → /pair.
4. Compare — the glass splits into two glasses side by side; a mini radar shape
   morphs between them (echo CompareRadarChart's look). CTA → /compare.
5. Learn — the glass fades into line-art vineyard rows / a simple map with a
   few region labels. CTA → /learn.
6. Finale — every destination as a clean button grid (Explore, Discover, Pair,
   Compare, Learn), plus a line of copy that closes the story.

The wine in the illustrated glass should be driven by one "wine color" value
that can shift (ruby → gold → rosé) between stages — it's the visual thread.

HARD REQUIREMENTS
- Works in all three themes (dark-burgundy, cream-terracotta, charcoal-gold).
  Illustrations use theme CSS variables; add wine-color tokens (red/white/rosé)
  to themes.css rather than hard-coding hex in components.
- prefers-reduced-motion: no scroll-linked motion; render every stage as a
  static, readable section with the poster image. All content and CTAs present.
- Phones (375px wide) get a real layout, not a squeezed desktop one; the
  mobile hero uses the 9:16 frame set.
- Every CTA is a real <Link>, keyboard reachable, visible focus state, and a
  "Skip to all features" link at the top jumps to the finale.
- Performance: no layout thrash on scroll (transform/opacity only), lazy-load
  frames, show poster until frames are ready, don't block first paint.
  Target Lighthouse performance ≥ 85 on desktop.
- Don't change behavior or tests of other pages.

DECISIONS I WANT YOU TO BRING ME (with a recommendation)
- Animation approach: `motion` (Framer Motion) useScroll/useTransform vs GSAP
  ScrollTrigger vs native CSS scroll-driven animations with a JS fallback.
  Consider bundle size, React fit, browser support, and testability.
- How stages are structured as components (I want one component per stage,
  small and independently testable, plus a shared scroll-progress hook).
- How real wine data gets into the Explore stage (reuse existing services/cache)
  and what shows while it loads or if the API is down.

TESTING
- Unit tests for: reduced-motion path renders every stage + every CTA with
  correct hrefs; skip link targets the finale; Explore stage handles loading,
  success, and API failure; scroll-progress hook math (pure functions).
- Mock IntersectionObserver / matchMedia in jsdom as needed; don't assert on
  animation frame values.
- After the build, launch the app and screenshot each stage in all three
  themes at 1440px and 375px wide so I can see it.

Ask me questions one at a time before writing the spec. Offer the visual
companion when a layout question comes up.
```

---

## Part 4 — Follow-up Prompts: The Other Pages

Once the home page ships, reuse its pieces (scroll hook, wine-color tokens, SVG glass,
reduced-motion pattern). The other pages are **tools**, so motion there should be
*supportive, not showy* — use this framing in every follow-up:

```
@docs/prompts/scroll-experience-prompt-guide.md

Use superpowers:brainstorming. Bring the home page's motion language to the
<PAGE> page. This page is a tool people use repeatedly, so motion must be
supportive and fast (≤ 300ms micro-interactions, nothing that delays results).
Reuse the shared scroll hook, wine-color tokens, SVG glass and reduced-motion
pattern from the home page. Don't change the page's data behavior or break its
existing tests. Ideas to evaluate (pick, cut, or improve): <IDEAS BELOW>
```

Idea lists to drop into `<IDEAS BELOW>`:

- **Explore** — cards rise in with a short stagger as they enter view; the filter drawer pours
  open; a thin wine-colored progress line fills as you scroll the results; hovering a card
  tints it with that wine's type color.
- **Wine Detail** — a header with the illustrated glass filled in *this* wine's color; the taste
  profile bars fill when scrolled into view; a gentle parallax on the hero area.
- **Discover** — the quiz becomes a guided pour: each answer adds to the glass; the result
  reveal swirls the glass to its final color before the recommendations slide in.
- **Pair** — pick a dish and the plate/glass pair animates together; matched wines fan out like
  a hand of cards.
- **Compare** — the two glasses from the home finale become the page header, filled with the
  selected wines' colors; the radar chart draws its outline on load.
- **Learn** (still a stub — good candidate for the most scrollytelling) — a scroll story
  through grape → vineyard → region → glass, with each term (tannin, acidity, body, terroir)
  illustrated as you reach it. Consider a small Higgsfield clip here too (vineyard flyover),
  using the Part 2 prompt anatomy.

---

## Part 5 — Troubleshooting Prompts

- **Janky scrolling:** "Profile scroll performance on the home page. Find anything animating
  non-transform/opacity properties or doing work per scroll event without rAF, and fix it."
- **Hero looks wrong in cream theme:** "The hero's dark video clashes with cream-terracotta.
  Propose 2 fixes (framed card with vignette vs. theme-specific overlay) and show screenshots."
- **Too long / too slow:** "Total scroll length should be about N viewport heights. Rebalance
  stage durations; Explore and Discover get the most, Learn the least."
- **Higgsfield output isn't right:** "The pour looks <too fast / plastic / has artifacts>. Keep
  the keyframe, regenerate the clip with <specific change>, 3 variants, show them side by side."
- **Tests flaky in jsdom:** "Move scroll math into pure functions and test those; keep
  component tests on structure and the reduced-motion path only."
