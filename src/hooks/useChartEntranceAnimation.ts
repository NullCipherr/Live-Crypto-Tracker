import { useEffect, useRef, type RefObject } from 'react';
import { usePreferences } from './usePreferences';

/**
 * Animates a chart container on first viewport entry using the Web Animations API.
 */
export function useChartEntranceAnimation<T extends HTMLElement>(
  externalRef?: RefObject<T | null>
): RefObject<T | null> {
  const internalRef = useRef<T | null>(null);
  const targetRef = externalRef ?? internalRef;
  const hasAnimatedRef = useRef(false);
  const { preferences } = usePreferences();

  useEffect(() => {
    const el = targetRef.current;
    if (!el || hasAnimatedRef.current) return;

    const reduceMotion =
      preferences.reduceMotion === 'reduce' ||
      (preferences.reduceMotion === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (reduceMotion || typeof el.animate !== 'function') {
      hasAnimatedRef.current = true;
      return;
    }

    const playEntrance = () => {
      if (hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;
      el.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 14px, 0) scale(0.985)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
        ],
        {
          duration: 380,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        }
      );
    };

    if (typeof IntersectionObserver !== 'function') {
      playEntrance();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            playEntrance();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.06 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [preferences.reduceMotion, targetRef]);

  return targetRef;
}
