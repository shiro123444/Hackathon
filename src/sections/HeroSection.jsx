import { forwardRef, lazy, Suspense } from "react";

const HeroCanvas = lazy(() =>
  import("../components/HeroCanvas").then((module) => ({ default: module.HeroCanvas }))
);

export const HeroSection = forwardRef(function HeroSection(
  {
    pointer,
    reducedMotion,
    introDone,
    isActive,
    showCanvas,
    progressRef,
    onGoToPanel
  },
  ref
) {
  return (
    <section className="hero" id="top" ref={ref}>
      {!showCanvas ? <div className="hero__beam-origin" aria-hidden="true" /> : null}
      <div className="hero__canvas" aria-hidden="true">
        {showCanvas ? (
          <Suspense fallback={<div className="hero__canvas-fallback" />}>
            <HeroCanvas pointer={pointer} reducedMotion={reducedMotion} progressRef={progressRef} />
          </Suspense>
        ) : (
          <div className="hero__canvas-fallback" />
        )}
      </div>
      <div className={`hero__content shell ${introDone && isActive ? "is-ready" : ""} ${isActive ? "is-current" : "is-dimmed"}`}>
        <div className="hero__meta hero__layer hero__layer--1">
          <span>WBU AI · 2026</span>
          <span>05.01 — 05.15</span>
          <span>武汉</span>
        </div>
        <h1 className="hero__layer hero__layer--2">一场把想法照亮的黑客松。</h1>
        <p className="hero__lede hero__layer hero__layer--3">
          黑底、一道光、持续展开的协作。我们不追求把概念堆成口号，
          而是让原型、叙事与判断在同一个现场慢慢对焦。
        </p>
        <div className="hero__actions hero__layer hero__layer--4">
          <a
            className="button button--primary"
            href="#apply"
            onClick={(event) => {
              event.preventDefault();
              onGoToPanel(4);
            }}
          >
            立即报名
          </a>
          <a
            className="button button--ghost"
            href="#tracks"
            onClick={(event) => {
              event.preventDefault();
              onGoToPanel(2);
            }}
          >
            查看方向
          </a>
        </div>
        <div className="hero__facts hero__layer hero__layer--5">
          <div>
            <strong>04.25</strong>
            <span>报名截止</span>
          </div>
          <div>
            <strong>05.01–05.15</strong>
            <span>正式活动</span>
          </div>
          <div>
            <strong>20+</strong>
            <span>参与名额</span>
          </div>
        </div>
      </div>
      {showCanvas ? <div className="hero__hint">Move near the light</div> : null}
    </section>
  );
});
