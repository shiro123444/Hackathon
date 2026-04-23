import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { HeroSection } from "./sections/HeroSection";
import { ManifestSection } from "./sections/ManifestSection";
import { TracksSection } from "./sections/TracksSection";
import { TimelineSection } from "./sections/TimelineSection";
import { ApplySection } from "./sections/ApplySection";
import { StoryChapterOverlay } from "./components/StoryChapterOverlay";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { IntroOverlay } from "./components/IntroOverlay";
import { CHAPTERS } from "./content/siteContent";

gsap.registerPlugin(Observer);

const DESKTOP_BREAKPOINT = 860;
const MOBILE_SECTION_IDS = CHAPTERS.slice(1);
const SCROLL_NUDGE_SCALE = 0.0019;
const REDUCED_NUDGE_SCALE = 0.0012;
const SNAP_DELAY_MS = 400;

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const heroSectionRef = useRef(null);
  const observerRef = useRef(null);
  const heroLoadObserverRef = useRef(null);
  const frameRef = useRef(0);
  const snapTimerRef = useRef(0);
  const lastNudgeAtRef = useRef(0);

  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const activeIndexRef = useRef(0);
  const [introDone, setIntroDone] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [canLoadHeroCanvas, setCanLoadHeroCanvas] = useState(false);
  const [isDesktopStory, setIsDesktopStory] = useState(
    () => typeof window !== "undefined" && window.innerWidth > DESKTOP_BREAKPOINT
  );

  const syncPointerStyles = useCallback(() => {
    const root = document.documentElement.style;
    root.setProperty("--pointer-x", pointer.current.x.toFixed(4));
    root.setProperty("--pointer-y", pointer.current.y.toFixed(4));
    const magnitude = Math.min(1, Math.sqrt(pointer.current.x ** 2 + pointer.current.y ** 2) * 0.72);
    root.setProperty("--pointer-mag", magnitude.toFixed(4));
  }, []);

  const handlers = useMemo(() => ({
    onPointerMove(event) {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      pointer.current.x = x;
      pointer.current.y = y;
      syncPointerStyles();
    },
    onPointerLeave() {
      pointer.current.x = 0;
      pointer.current.y = 0;
      syncPointerStyles();
    }
  }), [syncPointerStyles]);

  useEffect(() => {
    syncPointerStyles();
    window.addEventListener("pointermove", handlers.onPointerMove);
    window.addEventListener("pointerleave", handlers.onPointerLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlers.onPointerMove);
      window.removeEventListener("pointerleave", handlers.onPointerLeave);
    };
  }, [handlers, syncPointerStyles]);

  const applyStageProgress = useCallback((value) => {
    const stage = stageRef.current;
    progressRef.current = value;
    setStoryProgress((prev) => (Math.abs(prev - value) > 0.001 ? value : prev));
    if (!stage) return;

    const normalized = value / (CHAPTERS.length - 1);
    stage.style.setProperty("--story-progress", normalized.toFixed(4));
  }, []);

  const clampProgress = useCallback((value) => {
    return Math.max(0, Math.min(CHAPTERS.length - 1, value));
  }, []);

  const startProgressLoop = useCallback(() => {
    if (frameRef.current) return;

    const tick = () => {
      const diff = targetProgressRef.current - progressRef.current;
      if (Math.abs(diff) < 0.002) {
        applyStageProgress(targetProgressRef.current);
        frameRef.current = 0;
        return;
      }

      const eased = progressRef.current + diff * 0.22;
      applyStageProgress(eased);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [applyStageProgress]);

  const goToChapter = useCallback((index) => {
    const next = clampProgress(index);
    targetProgressRef.current = next;
    if (reducedMotion) {
      applyStageProgress(next);
      setActiveIndex(next);
      activeIndexRef.current = next;
      return;
    }
    startProgressLoop();
  }, [applyStageProgress, clampProgress, reducedMotion, startProgressLoop]);

  const settleToChapter = useCallback((index) => {
    const next = clampProgress(index);
    targetProgressRef.current = next;
    activeIndexRef.current = next;
    setActiveIndex(next);
    startProgressLoop();
  }, [clampProgress, startProgressLoop]);

  const scheduleChapterSnap = useCallback(() => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
    }

    const attemptSnap = () => {
      const now = performance.now();
      const nearest = Math.round(targetProgressRef.current);
      const idleFor = now - lastNudgeAtRef.current;

      // When the user stops scrolling for enough time, snap to nearest chapter.
      if (idleFor >= SNAP_DELAY_MS) {
        snapTimerRef.current = 0;
        settleToChapter(nearest);
        return;
      }

      // If we are extremely close to an edge while coasting, just snap it immediately.
      const distanceToNearest = Math.abs(targetProgressRef.current - nearest);
      if (distanceToNearest < 0.02 && idleFor > 100) {
        snapTimerRef.current = 0;
        settleToChapter(nearest);
        return;
      }

      snapTimerRef.current = window.setTimeout(attemptSnap, 100);
    };

    snapTimerRef.current = window.setTimeout(attemptSnap, 150);
  }, [settleToChapter]);

  const scrollToSection = useCallback((sectionId) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [reducedMotion]);

  const navigateToChapter = useCallback((index) => {
    if (isDesktopStory) {
      goToChapter(index);
      return;
    }

    if (index <= 0) {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      setActiveIndex(0);
      return;
    }

    const sectionId = CHAPTERS[index];
    setActiveIndex(index);
    scrollToSection(sectionId);
  }, [goToChapter, isDesktopStory, reducedMotion, scrollToSection]);

  const nudgeProgress = useCallback((delta) => {
    const scale = reducedMotion ? REDUCED_NUDGE_SCALE : SCROLL_NUDGE_SCALE;
    const now = performance.now();
    const magnitude = Math.abs(delta);
    lastNudgeAtRef.current = now;

    targetProgressRef.current = clampProgress(targetProgressRef.current + delta * scale);
    startProgressLoop();
    scheduleChapterSnap();
  }, [clampProgress, reducedMotion, scheduleChapterSnap, startProgressLoop]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), reducedMotion ? 60 : 1200);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (!isDesktopStory) {
      setCanLoadHeroCanvas(false);
      if (heroLoadObserverRef.current) {
        heroLoadObserverRef.current.disconnect();
        heroLoadObserverRef.current = null;
      }
      return undefined;
    }

    const heroElement = heroSectionRef.current;
    if (!heroElement) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setCanLoadHeroCanvas(true);
      return undefined;
    }

    heroLoadObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setCanLoadHeroCanvas(true);
        if (heroLoadObserverRef.current) {
          heroLoadObserverRef.current.disconnect();
          heroLoadObserverRef.current = null;
        }
      },
      {
        root: null,
        rootMargin: "240px 0px",
        threshold: 0.01
      }
    );

    heroLoadObserverRef.current.observe(heroElement);

    return () => {
      if (heroLoadObserverRef.current) {
        heroLoadObserverRef.current.disconnect();
        heroLoadObserverRef.current = null;
      }
    };
  }, [isDesktopStory]);

  useEffect(() => {
    const onResize = () => setIsDesktopStory(window.innerWidth > DESKTOP_BREAKPOINT);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    applyStageProgress(activeIndexRef.current);
    targetProgressRef.current = activeIndexRef.current;
  }, [applyStageProgress]);

  useEffect(() => {
    if (!isDesktopStory) {
      if (observerRef.current) {
        observerRef.current.kill();
        observerRef.current = null;
      }
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    observerRef.current = Observer.create({
      target: window,
      type: "wheel,touch",
      wheelSpeed: 1,
      tolerance: 2,
      preventDefault: true,
      onChangeY: (self) => nudgeProgress(self.deltaY),
      onChangeX: (self) => nudgeProgress(self.deltaX)
    });

    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goToChapter(activeIndexRef.current + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToChapter(activeIndexRef.current - 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToChapter(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goToChapter(CHAPTERS.length - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (observerRef.current) {
        observerRef.current.kill();
        observerRef.current = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [goToChapter, isDesktopStory, nudgeProgress]);

  useEffect(() => {
    if (isDesktopStory) return undefined;

    const sections = MOBILE_SECTION_IDS
      .map((id, offset) => {
        const element = document.getElementById(id);
        if (!element) return null;
        return { element, index: offset + 1 };
      })
      .filter(Boolean);

    if (sections.length === 0 || !("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (window.scrollY < 24) {
          setActiveIndex(0);
          return;
        }

        if (visibleEntries.length === 0) return;

        const match = sections.find(({ element }) => element === visibleEntries[0].target);
        if (match) {
          setActiveIndex(match.index);
        }
      },
      {
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-20% 0px -45% 0px"
      }
    );

    sections.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, [isDesktopStory]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const nearest = clampProgress(Math.round(storyProgress));
    if (nearest !== activeIndexRef.current) {
      activeIndexRef.current = nearest;
      setActiveIndex(nearest);
    }
  }, [clampProgress, storyProgress]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (snapTimerRef.current) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`site-root ${introDone ? "is-intro-done" : "is-intro-active"}`}>
      <IntroOverlay done={introDone} reducedMotion={reducedMotion} />

      <header className="site-header">
        <button className="site-logo" type="button" onClick={() => navigateToChapter(0)}>
          WBU AI HACKATHON
        </button>
        <nav className="site-nav" aria-label="Primary">
          {CHAPTERS.slice(1).map((key, index) => {
            const chapterIndex = index + 1;
            return (
              <button
                key={key}
                type="button"
                className={activeIndex === chapterIndex ? "is-active" : ""}
                aria-current={activeIndex === chapterIndex ? "page" : undefined}
                onClick={() => navigateToChapter(chapterIndex)}
              >
                {key}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="story-progress" aria-hidden="true">
        <span>{String(Math.round(storyProgress) + 1).padStart(2, "0")}</span>
        <div className="story-progress__bar">
          <i style={{ transform: `scaleX(${(storyProgress + 1) / CHAPTERS.length})` }} />
        </div>
        <span className="story-progress__total">/ {String(CHAPTERS.length).padStart(2, "0")}</span>
      </div>

      <main ref={stageRef} className="story-stage">
        <HeroSection
          ref={heroSectionRef}
          pointer={pointer}
          reducedMotion={reducedMotion}
          introDone={introDone}
          isActive={isDesktopStory ? storyProgress < 0.72 : true}
          showCanvas={isDesktopStory && introDone && canLoadHeroCanvas}
          progressRef={progressRef}
          onGoToPanel={navigateToChapter}
        />
        {isDesktopStory ? (
          <StoryChapterOverlay
            progress={storyProgress}
            isApplyFocused={storyProgress > 3.45}
            onGoToChapter={navigateToChapter}
          />
        ) : (
          <>
            <ManifestSection />
            <TracksSection />
            <TimelineSection />
            <ApplySection onBackToTop={() => navigateToChapter(0)} />
          </>
        )}
      </main>
    </div>
  );
}
