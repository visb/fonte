// ─── Shared document print styles ──────────────────────────────────────────────
// Single source of truth for the document typography/layout used in BOTH places:
//   • backend: injected into the <style> of `renderForResident` (puppeteer PDF).
//   • frontend: injected into the A4 page frame of the template editor.
// Keeping ONE definition is what makes the on-screen page break match the PDF
// page break (story 24 DoD). Do not duplicate these rules anywhere else.
//
// Consolidates the rules the previous stories scattered across the editor and
// the PDF service:
//   • base body font 12pt + line-height 1.2  (story 23 — unified font unit)
//   • table rules (doc-table / no-border)     (story 21 — tables / columns)
//   • image guard `max-width: 100%`           (story 22 — image inserted untouched)

// ─── A4 geometry (96 dpi) ───────────────────────────────────────────────────────
// A4 at 96 dpi = 794 × 1123 px. There is still ONE margin convention (story 24),
// but since story 154 it lives on the PAGE box, not on the flow box: the margin
// is declared by `@page` in DOCUMENT_PRINT_CSS and repeated (same constants) in
// the puppeteer `page.pdf` call, which takes precedence over `@page` in Chrome.
//
// Why it moved: `padding` on `body` is a box OF THE FLOW — in paged media it
// only materialises at the top of the FIRST page and at the bottom of the LAST
// one, so every intermediate page bled to the paper edge. A page margin repeats
// on every page. With the change, A4_CONTENT_HEIGHT_PX (1027px) is the usable
// height of EVERY page, not an approximation of the first one — which is what
// finally makes the editor's on-screen page break match the PDF break in
// multi-page documents.
//
// The editor's `.a4-page` keeps the 794px width and the 48/40 padding: on screen
// there is no page box to hang a margin on, so the padding IS the visual margin,
// and it reserves exactly the same content box (714 × 1027) as the printed page.

export const A4_PAGE_WIDTH_PX = 794; // 210mm @ 96dpi
export const A4_PAGE_HEIGHT_PX = 1123; // 297mm @ 96dpi

// Page margin. Vertical 48px, horizontal 40px — same values the PDF body used
// before, now applied to the page box (`@page` + puppeteer margin) instead of the
// body padding. Keeping the numbers is what lets the editor stay untouched: the
// usable content height remains A4_PAGE_HEIGHT_PX − 2×48 = 1027px.
export const A4_MARGIN_TOP_PX = 48;
export const A4_MARGIN_X_PX = 40;

// Usable content box inside one page (where the text flows before breaking).
// Since story 154 both hold for EVERY page of the document.
export const A4_CONTENT_HEIGHT_PX = A4_PAGE_HEIGHT_PX - 2 * A4_MARGIN_TOP_PX; // 1027
export const A4_CONTENT_WIDTH_PX = A4_PAGE_WIDTH_PX - 2 * A4_MARGIN_X_PX; // 714

export const A4_PADDING = `${A4_MARGIN_TOP_PX}px ${A4_MARGIN_X_PX}px`;

// ─── Document body CSS rules ────────────────────────────────────────────────────
// The typography/table/image rules, WITHOUT page-box geometry (no width/padding/
// margin on `body`) so the same rules can be hosted by:
//   • the PDF `<body>` (geometry added in DOCUMENT_PRINT_CSS below), and
//   • the editor `.a4-page` (geometry added by the React A4 frame component).
export const DOCUMENT_CONTENT_CSS = `
font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.2;color:#000;
`.trim();

// Element rules shared by PDF and editor. Selectors are scoped-agnostic: the PDF
// applies them globally; the editor nests them under `.a4-page`.
function elementRules(scope = ''): string {
  const s = scope ? `${scope} ` : '';
  return `
${s}h1,${s}h2,${s}h3{margin-bottom:14px}
${s}p{margin-bottom:10px;overflow:hidden}
${s}a,${s}a.doc-link{color:#0645ad;text-decoration:underline}
${s}p:empty{min-height:1.2em}
${s}p:empty::before{content:"\\00a0"}
${s}ol,${s}ul{margin-left:28px;margin-bottom:10px}
${s}li{margin-bottom:6px}
${s}img{max-width:100%}
${s}table.doc-table{border-collapse:collapse;width:100%;margin-bottom:10px;table-layout:fixed}
${s}table.doc-table td,${s}table.doc-table th{border:1px solid #000;padding:4px 6px;vertical-align:top}
${s}table.doc-table.no-border td,${s}table.doc-table.no-border th{border:none;padding:0 8px}
${s}table.doc-table th{font-weight:700;text-align:left}
`.trim();
}

// CSS for the PDF document (puppeteer). The page margin lives on `@page` so it
// repeats on EVERY page (story 154); the body only carries the typography and
// fills the printable area (`width:100%` = the 714px left by the page margin —
// keeping 794px here would overflow it). The `*{...}` reset + print button rules
// live alongside since they're PDF-document concerns.
//
// `@page` also covers the second print path: the HTML served by `wrapPage` has an
// "Imprimir" button calling `window.print()`, which never goes through the
// puppeteer `margin` option.
//
// The body's `overflow:hidden` went away with the fixed width it was clipping:
// on the root box it propagates to the viewport and can only work against
// pagination — the image/table guards are `max-width:100%` / `table-layout:fixed`.
export const DOCUMENT_PRINT_CSS = `
@page{size:A4;margin:${A4_MARGIN_TOP_PX}px ${A4_MARGIN_X_PX}px}
*{box-sizing:border-box;margin:0;padding:0}
body{${DOCUMENT_CONTENT_CSS}width:100%;margin:0 auto}
${elementRules('')}
`.trim();

// CSS for the editor A4 page. The element rules are scoped under `.a4-page` and
// the page geometry (width/padding/min-height) is applied to `.a4-page` itself.
// It mirrors the printed SHEET (794×1123 with a 48/40 margin), not the PDF body:
// since story 154 the PDF margin lives on `@page`, which has no equivalent on
// screen. Both end up with the same 714 × 1027 content box — that equality is
// what keeps the break guides honest. Unchanged by story 154 on purpose.
export const EDITOR_PAGE_CSS = `
.a4-page{${DOCUMENT_CONTENT_CSS}width:${A4_PAGE_WIDTH_PX}px;min-height:${A4_PAGE_HEIGHT_PX}px;padding:${A4_PADDING};background:#fff;}
${elementRules('.a4-page')}
.a4-page table.doc-table.no-border td,.a4-page table.doc-table.no-border th{border:1px dashed #c8c8c8}
`.trim();
