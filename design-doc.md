
1) DESIGN TOKENS (THEME)
Color palette (technology-agnostic tokens)
Primary + surfaces + semantic risk/status colors (extracted from app/styles/theme.py and risk badge usage in app/components/ui.py):

Background
bg: #0D0D0D
Surface
surface: #141414
surface-2: #1C1C1C
Borders
border: #2A2A2A
border-bright: #3A3A3A
Accents (primary)
primary: #E8A838 (amber)
primary-dim: #C4892A
Accents (secondary)
ice: #38C8E8
chartreuse: #C8F135
Semantic risk/status
critical: #FF4545
high: #FF8C42
medium: #E8C838
low: #4FD180
Text
text: #F0EDE6
text-muted: #7A7A7A
Typography (font roles)
Extracted from the theme bootstrap:

UI font (body / general)
font-ui: DM Sans (regular/medium/semibold)
Display font (titles / labels)
font-display: Space Mono
Code/metrics font
font-mono: JetBrains Mono
Heading + body styles (generalized)
Based on how pages/components render:

Caption / section label
uppercase, letter-spaced, font-display, small (≈13px), color text-muted
H1 (module/title)
font-display, bold, large (≈33px), color text
amber-emphasis uses primary on part of the title
Body
font-ui, normal/muted text for paragraphs (≈16–17px), text-muted for secondary copy
Data/metrics
font-mono, large bold numbers (≈29–33px), color maps to risk colors or primary
Radii / spacing scale
Radii
r-sm: 2px
r-md: 3px
r-lg: 4px
Border system
Most panels: 1px solid border
Some banners/cards: border-left: 3px solid <semantic>
Shadows / borders
Default: no heavy shadows, just borders
Hover accents: optional glow using primary (amber) with alpha
Animation tokens (keyframes + usage)
Theme defines (keep names as design tokens even if not all used yet):

fadeSlideUp → for entrance: .animate-fadein*
blink → terminal loading cursor
ticker → scrolling ticker strip
Other defined but less evidenced:
scanLine, glitch, typewriter, counterUp, shimmer, pulseDot
2) UI IDENTITY RULES (“LOOK”)
Dark operational console: background bg, panels surface, subtle separators border.
Amber as authority: anything primary/interactive/highlight uses primary (amber).
Mono hierarchy: titles + labels use font-display (Space Mono), while body is font-ui.
Risk is never only text: every risk level is represented with both
semantic color +
a badge element (dot + uppercase label).
Panels are uniform: consistent 1px borders + small radius (2–4px).
Tables/data are monospaced: dataframe headers are uppercase mono; cells are font-mono.
Micro-motifs: “war-room” microcopy patterns exist (terminal block, sarcastic empty state).
3) LAYOUT ARCHITECTURE
Global page skeleton
Sidebar + content (destination should emulate this)
Sidebar: dark background, amber section headings
Content: “wide” layout, max width not constrained aggressively
Common top-level pattern
inject global theme early
render sidebar branding + configuration expander
then page content
Standard module header pattern (“ModuleHeader”)
Use the repo’s repeated pattern:

caption label: MODULE <n>
H1: mono, large, primary emphasized spans
subtitle: muted paragraph
(Repo implementation exists as section_header(module_num, title, subtitle) in app/components/ui.py.)

Grid conventions
Metric strip / tiled metrics
CSS grid with repeat(N, 1fr) and 1px border “gridline” look
Issue breakdown
4-column equal tiles (PII/Confidentiality/Encoding/Abuse) using semantic left border accents
Section patterns
Dividers
full-width 1px line in border
optional centered label between two 1px lines
Empty states
dashed border container, large “□” icon, sarcastic italic line
Alert banners
left border 3px in semantic color; semi-transparent background fill
4) COMPONENT CATALOG (REUSABLE)
Only components/patterns confirmed in the repo are listed; if something is not found, it’s marked [UNKNOWN].

A) RiskBadge
Name: RiskBadge
Purpose: show risk level consistently across headers, badges, chart legends.
Structure (HTML skeleton):

<span class="badge badge-critical">● CRITICAL</span>
Selectors/classes
.badge, .badge-critical, .badge-high, .badge-medium, .badge-low, .badge-info
Tokens
--red/--high/--medium/--low/--ice/--text-muted
Example usage

<span class="badge badge-high">● HIGH</span>
B) MetricGrid
Name: MetricGrid
Purpose: N-tile metric row (cards that look like “console counters”).
Structure

<div style="display:grid;grid-template-columns:repeat(N,1fr);gap:1px;background:var(--border);border:1px solid var(--border)">
  <div style="background:var(--surface);padding:16px 12px;text-align:center">
    <div class="caption-label">LABEL</div>
    <div class="metric-value">VALUE</div>
</div>
Tokens
surface, border, .caption-label, font-mono, primary or semantic colors
C) SectionHeader (ModuleHeader)
Name: SectionHeader
Purpose: consistent module/title block.
Structure

<div class="section-header">
  <div class="caption-label">MODULE 01</div>
  <h1>Title <span class="accent">...</span></h1>
  <p class="subtitle">...</p>
</div>
Tokens
font-display, text, text-muted, primary, spacing
D) SectionDivider
Name: SectionDivider
Purpose: horizontal separation with optional centered label.
Structure

<div style="display:flex;align-items:center;gap:12px;margin:20px 0">
  <div style="flex:1;height:1px;background:var(--border)"></div>
  <div class="caption-label">LABEL</div>
  <div style="flex:1;height:1px;background:var(--border)"></div>
Tokens
border, .caption-label
E) EmptyState
Name: EmptyState
Purpose: “no data” placeholder with console flavor.
Structure

<div style="text-align:center;padding:64px 24px;border:1px dashed var(--border);border-radius:4px">
  <div class="empty-icon">□</div>
  <div class="empty-title">NO ...</div>
  <div class="empty-subtitle">...<br><span class="sarcasm">...</span></div>
Tokens
border, border-bright, text-muted
F) AlertBanner
Name: AlertBanner
Purpose: info/warning/error/success banners.
Structure

<div style="background:rgba(...);border-left:3px solid var(--ice);border-radius:0 3px 3px 0;padding:12px 16px;display:flex;gap:10px">
  <span class="alert-icon">ℹ</span>
  <span class="alert-message">Message</span>
</div>
Tokens
ice / medium / red / low + semi-transparent fills
G) ScanResultHeader
Name: ScanResultHeader
Purpose: completion header with filename, id, elapsed time, highest risk.
Structure

<div style="background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
  <div>...caption... file ... ID/time...</div>
  <div style="text-align:right">
    <span class="badge ...">● RISK</span>
    <div class="caption-label">HIGHEST RISK LEVEL</div>
</div>
Tokens
surface, border, .caption-label, risk badge tokens
H) DataTable / DataFrame theme
Name: DataTableTheme (repo uses Streamlit’s dataframe styling)
Purpose: unify tables visually with surfaces/borders/colors.
Selectors
.stDataFrame, .stDataFrame thead th, .stDataFrame tbody td
Tokens
surface-2, surface, border, amber, text-muted, text
I) Progress bar theme
Name: ProgressBarTheme
Purpose: amber filled progress bar on dark track.
Selectors
.stProgress ...
Tokens
primary for fill and border for track
J) Tabs style
Name: TabsTheme
Purpose: uppercase mono tabs with amber underline on selection.
Selectors
.stTabs [data-baseweb="tab"] and [aria-selected="true"]
Tokens
text-muted, primary, borders
K) Plot/chart container theme
Name: ChartContainerTheme
Purpose: charts sit inside bordered dark containers.
Selectors
.stPlotlyChart > div
Tokens
surface look, border, border-radius
5) ADAPTER LAYER (TARGET = Next.js + TypeScript)
A) Token injection strategy
Create global CSS variables in a file like:
styles/tokens.css (or src/styles/tokens.ts if you prefer runtime)
Define variables equivalent to:
--bg --surface --surface-2 --border --amber --ice --text --text-muted --red --high --medium --low ...
B) Where CSS lives
Global stylesheet (recommended for universality):
app/globals.css (Next App Router) or pages/_app.tsx import (Pages Router)
Keep the “base resets” minimal:
body background, base font families, text color
C) Component creation approach
Implement components as framework UI building blocks:

RiskBadge({ level })
SectionHeader({ moduleNum, title, subtitle })
SectionDivider({ label? })
EmptyState({ title, subtitle, icon? })
AlertBanner({ type, message })
MetricGrid({ metrics })
ScanResultHeader({ ... })
All components should:

use semantic class names (badge badge-critical, etc.)
rely on tokens only (no hardcoded colors except where repo already did)
D) Styling methodology (to keep adapter portable)
Use CSS variables + semantic classes
Avoid framework-specific selectors (like Streamlit’s data-testid) in the destination.
Convert “Streamlit-specific” rules into generic styles:
dataframe → <table> theme classes in your own component
progress bar → your own progress component
tabs → your own tabs component
6) IMPLEMENTATION PLAN (STEP-BY-STEP)
Create tokens module
tokens.css (or a TS theme object that compiles to CSS vars)
expose semantic names: primary, text-muted, risk.critical, etc.
Create base theme styles
set body background and base text color
declare font-family roles (font-ui, font-display, font-mono)
Implement foundational components
RiskBadge, SectionHeader, SectionDivider, EmptyState, AlertBanner
Implement data-heavy components
MetricGrid, DataTable, ProgressBar, Tabs, ChartContainer (layout-only wrapper)
Refactor pages
replace repeated inline markup with component calls
Add theming overrides (optional)
allow future “skin” via token overrides (still same visual identity)
7) VERIFICATION CHECKLIST
Visual identity
amber highlights appear in headers/buttons/selected tabs
all risk levels map correctly to badge + chart colors
Layout
consistent card/panel borders and radii
module headers spacing matches the original pattern (caption → h1 → subtitle)
Contrast sanity
ensure text-muted on surface is still readable
Font loading
ensure Space Mono + DM Sans + JetBrains Mono load before render (Next font strategy)
Component parity
empty state + alert banners + metric grids match the original spacing and hierarchy
Universal, reusable “destination-flexible” prompt (copy/paste)
Use this to adapt to any target framework without locking into specifics:

Prompt:

“Reconstruct a complete UI design system from the given repository. Extract and normalize theme tokens (colors, typography, spacing, radii, border, shadows, animation keyframes). Identify and formalize the UI identity rules (what makes the app look unique). Catalog reusable UI components found in the repo and describe them in an implementation-agnostic way (name, purpose, HTML skeleton, required selectors/classes, tokens used, and example usage). Then provide an Adapter Layer that maps the extracted design system into a destination TypeScript UI framework (Next.js recommended) using CSS variables and semantic class names. Prefer a token-first approach (CSS variables) so the system can be ported to other frameworks without losing visual identity. If an element isn’t found, mark it as [UNKNOWN] and propose a reasonable default consistent with the established visual language.”