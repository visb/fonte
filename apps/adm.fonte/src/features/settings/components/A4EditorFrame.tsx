import { useState } from 'react';
import {
  A4_PAGE_WIDTH_PX,
  A4_PAGE_HEIGHT_PX,
  A4_CONTENT_HEIGHT_PX,
  A4_MARGIN_TOP_PX,
  EDITOR_PAGE_CSS,
} from '@fonte/doc-styles';

// ─── A4EditorFrame ──────────────────────────────────────────────────────────────
// Wraps the TipTap EditorContent in a real A4 page (story 24): gray canvas that
// centers the sheet and applies a zoom scale, a white 794px sheet with the SAME
// geometry/typography as the PDF (EDITOR_PAGE_CSS, sourced from @fonte/doc-styles),
// and dashed page-break guides drawn at each usable-content height so the user
// sees where each printed page ends.
//
// Pagination approach: MVP visual (page-break guides) — see report. We do NOT use
// a third-party TipTap pagination extension because the break must coincide with
// the puppeteer PDF break exactly; drawing guides from the SAME calibrated
// geometry constants is deterministic, whereas DOM-measuring extensions reflow
// independently and also conflict with our custom NodeViews (image/table).

const ZOOM_OPTIONS = [0.5, 0.75, 1] as const;

interface Props {
  children: React.ReactNode;
}

export function A4EditorFrame({ children }: Props) {
  const [zoom, setZoom] = useState<number>(0.75);

  // The first page-break sits at top-padding + content-height; subsequent ones
  // repeat every full A4 page height. A `repeating-linear-gradient` starting at
  // that offset draws a thin dashed line at each page boundary.
  const firstBreak = A4_MARGIN_TOP_PX + A4_CONTENT_HEIGHT_PX;
  const pageBreakGuides: React.CSSProperties = {
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent ' +
      `${A4_PAGE_HEIGHT_PX - 2}px, rgba(0,0,0,0.18) ${A4_PAGE_HEIGHT_PX - 2}px, ` +
      `rgba(0,0,0,0.18) ${A4_PAGE_HEIGHT_PX}px)`,
    backgroundPosition: `0 ${firstBreak - (A4_PAGE_HEIGHT_PX - 2)}px`,
    backgroundRepeat: 'repeat-y',
  };

  return (
    <div className="space-y-2">
      <style>{EDITOR_PAGE_CSS}</style>

      {/* Zoom ruler — UX decision story 24 §5 (50/75/100%). */}
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-muted-foreground mr-1 select-none">Zoom</span>
        {ZOOM_OPTIONS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            className={
              'rounded px-2 py-0.5 text-[11px] font-mono tabular-nums transition-colors ' +
              (zoom === z
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground')
            }
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      {/* Canvas — neutral gray background, centers the sheet, scrolls. */}
      <div className="a4-canvas overflow-auto rounded-md border bg-muted/40 p-6">
        <div
          className="mx-auto"
          style={{
            width: A4_PAGE_WIDTH_PX * zoom,
            // Keep the scaled sheet from being clipped by zoom origin.
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            className="a4-page shadow-lg"
            // flexShrink:0 keeps the sheet at its real 794px width inside the
            // narrower (scaled) flex container — the visual width is then driven
            // purely by the zoom transform, not by flex shrinking.
            style={{ flexShrink: 0, transform: `scale(${zoom})`, transformOrigin: 'top center', ...pageBreakGuides }}
            data-testid="a4-page"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
