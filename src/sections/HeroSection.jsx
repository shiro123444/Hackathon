import { forwardRef, lazy, Suspense } from "react";
import { HERO_COPY, HERO_FACTS, HERO_META } from "../content/siteContent";

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
          {HERO_META.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <h1 className="hero__layer hero__layer--2">{HERO_COPY.title}</h1>
        <p className="hero__lede hero__layer hero__layer--3">
          {HERO_COPY.lede}
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
            报名
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
          {HERO_FACTS.map((fact) => (
            <div key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
