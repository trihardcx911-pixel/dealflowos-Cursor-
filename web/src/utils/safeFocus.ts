/**
 * Safely focus an element without triggering viewport scroll.
 *
 * Uses `preventScroll: true` option (supported in modern browsers).
 * For older browsers that don't support it, captures and restores scroll position.
 *
 * @param element - The HTML element to focus
 * @param options - Optional focus options (forwarded to element.focus())
 */
export function safeFocus(
  element: HTMLElement | null | undefined,
  options?: FocusOptions
): void {
  if (!element) return;

  // Try modern preventScroll option first
  try {
    element.focus({ ...options, preventScroll: true });
    return;
  } catch (e) {
    // Fallback for browsers that don't support preventScroll option
  }

  // Fallback: capture scroll position, focus, then restore
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  element.focus(options);

  // Restore scroll position in next microtask to ensure it applies after browser's auto-scroll
  queueMicrotask(() => {
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo(scrollX, scrollY);
    }
  });
}
