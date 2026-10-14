// Separate show/hide thresholds prevent flicker around the reveal point.
export function trackBackToTop(target, onChange) {
  let visible = false;
  function update() {
    const next = visible ? target.scrollY > 300 : target.scrollY > 400;
    if (next !== visible) {
      visible = next;
      onChange(next);
    }
  }
  target.addEventListener('scroll', update, { passive: true });
  target.addEventListener('resize', update);
  update();
  return () => {
    target.removeEventListener('scroll', update);
    target.removeEventListener('resize', update);
  };
}

export function scrollBackToTop(target) {
  const reducedMotion = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
}
