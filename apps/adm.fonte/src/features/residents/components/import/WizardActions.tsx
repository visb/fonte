import { type ReactNode } from 'react';

/**
 * Sticky bottom action bar shared by the import wizard steps. Keeps the
 * back/next buttons pinned to the bottom of the viewport while the step content
 * scrolls, for quicker navigation through long forms.
 */
export function WizardActions({ children }: { children: ReactNode }) {
  // The scroll container (AppLayout <main>) has padding p-4 sm:p-8. A plain
  // `sticky bottom-0` sticks to the container's content edge, leaving a gap equal
  // to its bottom padding. To overcome it: a NEGATIVE sticky offset (-bottom-*)
  // equal to that padding makes the bar stick flush to the real bottom edge, the
  // inner pb-* fills the bar down to the edge, and the negative side/bottom margins
  // cancel the container padding so the bar spans full width with no trailing space.
  return (
    <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-6 flex justify-between gap-3 border-t bg-background/95 px-4 pt-3 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pt-4 sm:pb-8">
      {children}
    </div>
  );
}
