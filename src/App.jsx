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

gsap.registerPlugin(Observer);

const DESKTOP_BREAKPOINT = 768;
const SNAP_DELAY_MS = 180;
const CHAPTERS = [
  { key: "hero", id: "top", label: "hero" },
  { key: "manifest", id: "manifest", label: "manifest" },
  { key: "tracks", id: "tracks", label: "tracks" },
  { key: "schedule", id: "schedule", label: "schedule" },
  { key: "apply", id: "apply", label: "apply" }
];

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
  const snapTimeoutRef = useRef(0);
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

  const handlers = useMemo(() => ({
    onPointerMove(event) {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      pointer.current.x = x;
      pointer.current.y = y;
    },
    onPointerLeave() {
      pointer.current.x = 0;
      pointer.current.y = 0;
    }
  }), []);

  useEffect(() => {
    let frameId;
    const syncPointer = () => {
      document.documentElement.style.setProperty("--pointer-x", pointer.current.x.toFixed(4));
      document.documentElement.style.setProperty("--pointer-y", pointer.current.y.toFixed(4));
      const magnitude = Math.min(1, Math.sqrt(pointer.current.x ** 2 + pointer.current.y ** 2) * 0.72);
      document.documentElement.style.setProperty("--pointer-mag", magnitude.toFixed(4));
      frameId = window.requestAnimationFrame(syncPointer);
    };
    frameId = window.requestAnimationFrame(syncPointer);

    window.addEventListener("pointermove", handlers.onPointerMove);
    window.addEventListener("pointerleave", handlers.onPointerLeave, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlers.onPointerMove);
      window.removeEventListener("pointerleave", handlers.onPointerLeave);
    };
  }, [handlers]);

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
      if (Math.abs(diff) < 0.0008) {
        applyStageProgress(targetProgressRef.current);
        frameRef.current = 0;
        return;
      }

      const eased = progressRef.current + diff * 0.11;
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

  const clearSnapTimeout = useCallback(() => {
    if (!snapTimeoutRef.current) return;
    window.clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = 0;
  }, []);

  const snapToNearestChapter = useCallback(() => {
    const nearest = clampProgress(Math.round(targetProgressRef.current));
    targetProgressRef.current = nearest;

    if (reducedMotion) {
      applyStageProgress(nearest);
      activeIndexRef.current = nearest;
      setActiveIndex(nearest);
      return;
    }

    startProgressLoop();
  }, [applyStageProgress, clampProgress, reducedMotion, startProgressLoop]);

  const scheduleSnapToNearestChapter = useCallback(() => {
    clearSnapTimeout();
    snapTimeoutRef.current = window.setTimeout(() => {
      snapTimeoutRef.current = 0;
      snapToNearestChapter();
    }, SNAP_DELAY_MS);
  }, [clearSnapTimeout, snapToNearestChapter]);

  const nudgeProgress = useCallback((delta) => {
    const scale = reducedMotion ? 0.0012 : 0.0019;
    targetProgressRef.current = clampProgress(targetProgressRef.current + delta * scale);
    startProgressLoop();
    scheduleSnapToNearestChapter();
  }, [clampProgress, reducedMotion, scheduleSnapToNearestChapter, startProgressLoop]);

  const scrollToChapter = useCallback((index) => {
    const chapter = CHAPTERS[index];
    if (!chapter) return;

    if (isDesktopStory) {
      goToChapter(index);
      return;
    }

    const target = document.getElementById(chapter.id);
    if (!target) return;

    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start"
    });
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, [goToChapter, isDesktopStory, reducedMotion]);

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
      clearSnapTimeout();
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
      type: "wheel,touch,pointer",
      wheelSpeed: 1,
      tolerance: 2,
      preventDefault: true,
      onChangeY: (self) => nudgeProgress(self.deltaY),
      onChangeX: (self) => nudgeProgress(self.deltaX)
    });

    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

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
      clearSnapTimeout();
    };
  }, [clearSnapTimeout, goToChapter, isDesktopStory, nudgeProgress]);

  useEffect(() => {
    if (isDesktopStory) return undefined;

    const sectionMap = CHAPTERS.map((chapter, index) => ({
      index,
      element: document.getElementById(chapter.id)
    })).filter((entry) => entry.element);

    if (!sectionMap.length) return undefined;

    const syncActiveSection = () => {
      const threshold = 160;
      let nextIndex = 0;

      sectionMap.forEach((entry) => {
        const top = entry.element.getBoundingClientRect().top;
        if (top - threshold <= 0) {
          nextIndex = entry.index;
        }
      });

      if (nextIndex === activeIndexRef.current) return;

      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    };

    syncActiveSection();
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
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
      clearSnapTimeout();
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [clearSnapTimeout]);

  return (
    <div className={`site-root ${introDone ? "is-intro-done" : "is-intro-active"}`}>
      <IntroOverlay done={introDone} reducedMotion={reducedMotion} />

      <header className="site-header">
        <button
          className={`site-logo ${activeIndex === 0 ? "is-active" : ""}`}
          type="button"
          onClick={() => scrollToChapter(0)}
        >
          WBU AI HACKATHON
        </button>
        <nav className="site-nav" aria-label="Primary">
          {CHAPTERS.map((chapter, chapterIndex) => {
            return (
              <button
                key={chapter.key}
                type="button"
                className={activeIndex === chapterIndex ? "is-active" : ""}
                aria-current={activeIndex === chapterIndex ? "page" : undefined}
                onClick={() => scrollToChapter(chapterIndex)}
              >
                {chapter.label}
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

      <main ref={stageRef} className={`story-stage ${isDesktopStory ? "" : "story-stage--stacked"}`}>
        <HeroSection
          ref={heroSectionRef}
          pointer={pointer}
          reducedMotion={reducedMotion}
          introDone={introDone}
          isActive={isDesktopStory ? storyProgress < 0.72 : true}
          showCanvas={isDesktopStory && introDone && canLoadHeroCanvas}
          progressRef={progressRef}
          onGoToPanel={scrollToChapter}
        />
        {isDesktopStory ? (
          <StoryChapterOverlay
            progress={storyProgress}
            isApplyFocused={storyProgress > 3.45}
            onGoToChapter={goToChapter}
          />
        ) : (
          <>
            <ManifestSection forceVisible />
            <TracksSection forceVisible />
            <TimelineSection forceVisible />
            <ApplySection forceVisible onBackToTop={() => scrollToChapter(0)} />
          </>
        )}
      </main>
    </div>
  );
}
