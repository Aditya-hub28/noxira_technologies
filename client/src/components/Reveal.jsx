import React, { useEffect, useRef } from 'react';

/**
 * Scroll-reveal wrapper: fades/slides children in once when they enter the viewport.
 * Uses IntersectionObserver + CSS classes (see index.css). Content is visible by
 * default; the hidden start state is applied only when IO is available and motion
 * is allowed, so content can never be stranded invisible.
 */
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return undefined;

    el.classList.add('reveal-hidden');
    el.style.transitionDelay = `${delay}s`;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      el.classList.remove('reveal-hidden', 'reveal-visible');
      el.style.transitionDelay = '';
    };
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
