---
status: resolved
trigger: "The Download PDF button on the migration dashboard does not work"
created: 2026-02-21T00:00:00Z
updated: 2026-02-21T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - html2canvas 1.4.1 cannot parse oklch() colors used by Tailwind CSS v4
test: verified via known GitHub issues and web research
expecting: replacing html2canvas with html2canvas-pro (which supports oklch) will fix the issue
next_action: DONE - fix applied and verified

## Symptoms

expected: Clicking "Download PDF" should capture the dashboard as an image and produce a downloadable PDF
actual: Button does not work (no PDF generated) - html2canvas throws runtime error parsing oklch() colors
errors: "Attempting to parse an unsupported color function 'oklch'" (runtime)
reproduction: Click "Download PDF" button on dashboard page
started: recently added feature

## Eliminated

- hypothesis: Import/export mismatch (wrong import style for library version)
  evidence: html2canvas 1.4.1 has "export default html2canvas", jspdf 4.2.0 has "export default jsPDF" - both match the import styles used
  timestamp: 2026-02-21T00:02:00Z

- hypothesis: jspdf v4 API breaking changes (addImage, internal.pageSize)
  evidence: jspdf v4 types confirm addImage(imageData, format, x, y, w, h) overload exists, internal.pageSize.getWidth()/getHeight() present
  timestamp: 2026-02-21T00:03:00Z

- hypothesis: Build/bundling issue
  evidence: tsc --noEmit passes, vite build succeeds, html2canvas found in built bundle
  timestamp: 2026-02-21T00:01:00Z

- hypothesis: TypeScript config issue (verbatimModuleSyntax)
  evidence: Value imports are correct (not type-only), tsc passes
  timestamp: 2026-02-21T00:04:00Z

## Evidence

- timestamp: 2026-02-21T00:01:00Z
  checked: TypeScript compilation (npx tsc --noEmit)
  found: Compiles cleanly, no errors
  implication: Not a type-level issue

- timestamp: 2026-02-21T00:01:00Z
  checked: Vite build (npx vite build)
  found: Builds successfully
  implication: Not a build-time issue

- timestamp: 2026-02-21T00:02:00Z
  checked: html2canvas version and exports
  found: v1.4.1 installed, has "export default html2canvas" in ESM build
  implication: Import style is correct for this version

- timestamp: 2026-02-21T00:02:00Z
  checked: jspdf version and exports
  found: v4.2.0 installed, has "export default jsPDF" in types
  implication: Import style is correct for this version

- timestamp: 2026-02-21T00:03:00Z
  checked: jspdf v4 addImage API and constructor options
  found: All match the code's usage - addImage(string, format, x, y, w, h) overload exists
  implication: jspdf API is not the problem

- timestamp: 2026-02-21T00:04:00Z
  checked: Tailwind CSS version
  found: v4.2.0 installed - uses oklch() color format by default
  implication: All computed styles on DOM elements use oklch() colors

- timestamp: 2026-02-21T00:05:00Z
  checked: html2canvas + Tailwind v4 compatibility (web research)
  found: Known issue - html2canvas 1.4.1 throws "Attempting to parse an unsupported color function 'oklch'" at runtime. Multiple GitHub issues: #3148, #3150, #3269
  implication: ROOT CAUSE - html2canvas cannot parse oklch() colors that Tailwind v4 generates

- timestamp: 2026-02-21T00:06:00Z
  checked: html2canvas-pro as replacement
  found: Drop-in replacement with same API, supports oklch(), oklab(), lch(), lab(), and color() functions
  implication: Direct fix available

- timestamp: 2026-02-21T00:08:00Z
  checked: Post-fix TypeScript compilation and Vite build
  found: Both pass cleanly with html2canvas-pro
  implication: Fix is verified at compile and build level

## Resolution

root_cause: html2canvas v1.4.1 does not support the oklch() CSS color function. Tailwind CSS v4 (v4.2.0) uses oklch() as its default color output format. When html2canvas attempts to parse the computed styles of dashboard DOM elements, it encounters oklch() color values and throws a runtime error: "Attempting to parse an unsupported color function 'oklch'". This causes the handleDownloadPdf async function to fail silently (the try/finally block has no catch, and the async function is called from onClick without .catch()).

fix: Replaced html2canvas v1.4.1 with html2canvas-pro v2.0.0, a maintained fork that supports modern CSS color functions including oklch(). Changed import from "html2canvas" to "html2canvas-pro" in DashboardPage.tsx. Updated package.json dependencies accordingly.

verification: TypeScript compiles cleanly (tsc --noEmit), Vite build succeeds. html2canvas-pro has identical default export API (html2canvas(element, options) -> Promise<HTMLCanvasElement>).

files_changed:
  - frontend/package.json (html2canvas -> html2canvas-pro)
  - frontend/src/pages/DashboardPage.tsx (import updated)
  - frontend/package-lock.json (dependency resolution)
