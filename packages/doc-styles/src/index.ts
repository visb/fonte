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
// A4 at 96 dpi = 794 × 1123 px. We pick ONE margin convention so the usable
// height is unambiguous: the puppeteer `page.pdf` margin is ZEROED and the whole
// page margin lives in the body `padding` below. The editor's `.a4-page` uses
// the exact same width/padding, so a paragraph breaks to page 2 on screen at the
// same offset puppeteer breaks it in the PDF.

export const A4_PAGE_WIDTH_PX = 794; // 210mm @ 96dpi
export const A4_PAGE_HEIGHT_PX = 1123; // 297mm @ 96dpi

// Page margin (= body padding). Vertical 48px, horizontal 40px — same values the
// PDF body used before consolidation, now the ONLY source of the page margin
// (puppeteer margin is 0). Calibrated empirically against a reference PDF: with
// puppeteer margin zeroed and these paddings, the usable content height is
// A4_PAGE_HEIGHT_PX − 2×48 = 1027px, which matches where puppeteer breaks pages.
export const A4_MARGIN_TOP_PX = 48;
export const A4_MARGIN_X_PX = 40;

// Usable content height inside one page (where text flows before breaking).
export const A4_CONTENT_HEIGHT_PX = A4_PAGE_HEIGHT_PX - 2 * A4_MARGIN_TOP_PX; // 1027

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
${s}p:empty::before{content:"\\00200b"}
${s}ol,${s}ul{margin-left:28px;margin-bottom:10px}
${s}li{margin-bottom:6px}
${s}img{max-width:100%}
${s}table.doc-table{border-collapse:collapse;width:100%;margin-bottom:10px;table-layout:fixed}
${s}table.doc-table td,${s}table.doc-table th{border:1px solid #000;padding:4px 6px;vertical-align:top}
${s}table.doc-table.no-border td,${s}table.doc-table.no-border th{border:none;padding:0 8px}
${s}table.doc-table th{font-weight:700;text-align:left}
`.trim();
}

// CSS for the PDF document (puppeteer). Body carries the page geometry/margin and
// the typography; element rules are global. The `*{...}` reset + print button
// rules live alongside since they're PDF-document concerns.
export const DOCUMENT_PRINT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{${DOCUMENT_CONTENT_CSS}width:${A4_PAGE_WIDTH_PX}px;margin:0 auto;padding:${A4_PADDING};overflow:hidden}
${elementRules('')}
`.trim();

// CSS for the editor A4 page. The element rules are scoped under `.a4-page` and
// the page geometry (width/padding/min-height) is applied to `.a4-page` itself,
// mirroring the PDF body 1:1.
export const EDITOR_PAGE_CSS = `
.a4-page{${DOCUMENT_CONTENT_CSS}width:${A4_PAGE_WIDTH_PX}px;min-height:${A4_PAGE_HEIGHT_PX}px;padding:${A4_PADDING};background:#fff;}
${elementRules('.a4-page')}
`.trim();
