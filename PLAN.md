# CodeShift AI — Implementation Plan

## PHASE 1: Critical Bug Fixes (P0)

| # | Bug | File | Fix |
|---|---|---|---|
| 1 | `print >>` regex fires AFTER general `print` rule — produces `print(>> sys.stderr, ...)` (invalid syntax) | `transformer.py:21-22` | Swap rule order: `print >>` BEFORE general `print` |
| 2 | `raise` regex produces unclosed parenthesis: `raise ValueError("bad"` missing `)` | `transformer.py:35` | Change to `r'\braise\s+(\w+)\s*,\s*(.*?)$'` → `r'raise \1(\2)'` |
| 3 | **Path traversal vulnerability** — malicious filename `../../etc/passwd` writes outside project dir | `project_manager.py:81` | Sanitize with `os.path.basename()` + `os.path.realpath()` prefix check |
| 4 | `has_key` regex only captures `\w+`, misses `self.cache.has_key(key)` → produces `key in cache` not `key in self.cache` | `transformer.py:25` | Change to `([\w.]+)\.has_key\(([^)]+)\)` |

## PHASE 2: High-Priority Fixes (P1)

| # | Bug | File | Fix |
|---|---|---|---|
| 5 | No file size limit enforced despite `max_file_size_mb=10` in config | `routes.py:79` | Add `len(content) > settings.max_file_size_mb * 1024 * 1024` check |
| 6 | Status never transitions to COMPLETED/FAILED after transform | `project_manager.py:157` | Add status transitions in try/except |
| 7 | `_apply_transformations` ignores multiline spans | `project_manager.py:309` | Use `lines[start:end]` slice replacement |
| 8 | Snapshot test files overwritten in loop — only last test survives | `project_manager.py:195` | Concatenate all tests into one file |
| 9 | Dead code detector misses class methods (e.g., `format` on dead class matches builtin `format`) | `dead_code.py:119` | Qualify as `ClassName.method_name` |
| 10 | `from __future__ import` increases risk score but it's a positive signal | `risk_assessor.py:33` | Move to separate category, subtract from risk |
| 11 | CORS `allow_origins=["*"]` + `allow_credentials=True` is invalid | `main.py:22-23` | Remove `allow_credentials=True` |
| 12 | `open().read()` without context manager (4 files) | Multiple | Use `with open() as f:` everywhere |

## PHASE 3: Missing API Endpoints (Jury Impact)

| Endpoint | Purpose | Priority |
|---|---|---|
| `GET /projects/{id}/diff/{file}` | Unified diff with confidence annotations — the killer demo endpoint | Critical |
| `GET /projects/{id}/export` | Download migrated project as ZIP — tangible deliverable | Critical |
| `GET /projects/{id}/files` | List uploaded files | High |
| `GET /projects/{id}/files/{file}` | Get file content (original or migrated) | High |
| `DELETE /projects/{id}` | Clean up projects | Medium |
| `POST /projects/{id}/transformations/{id}/feedback` | Approve/reject individual transforms | Medium |
| `GET /projects/{id}/transform-stream` (SSE) | Real-time batch progress streaming | Wow factor |

## PHASE 4: Competitive Demo Script (5 min)

| Minute | Action | Metric to show |
|---|---|---|
| 0-1 | Show 3 legacy Python 2 files, highlight the pain | "278 lines of real enterprise code" |
| 1-2 | One-click analysis: dead code, dependency graph, risk heatmap | "12% dead code identified BEFORE migration" |
| 2-3 | Transform with confidence tiers, show reasoning | "73% Tier 1 auto-apply, 4% Tier 4 manual" |
| 3-4 | Show generated snapshot tests | "Tests created BEFORE code was changed" |
| 4-5 | Batch migrate in dependency order, show dashboard | "100% migrated, zero breakage" |

### Key Competitive Comparison

| Feature | CodeShift AI | 2to3 | Grit.io | AWS Q |
|---|---|---|---|---|
| Dead code detection before migration | **Yes** | No | No | No |
| Per-transformation confidence score | **Yes (0.0-1.0)** | No | No | No |
| 4-tier confidence classification | **Yes** | No | No | No |
| Pre-migration behavioral tests | **Yes** | No | No | No |
| Risk assessment per file | **Yes** | No | Partial | Partial |
| Dependency-ordered migration | **Yes** | No | No | Yes |

---

# Frontend UI Specification

## Document Metadata

- **Product**: CodeShift AI — AI-Powered Legacy Code Migration Platform
- **Version**: 1.0.0
- **Backend API Base**: `http://localhost:8000/api/v1`
- **Target Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS 3.x with custom design tokens
- **State Management**: Zustand or React Query (TanStack Query v5)

## 1. Application Structure

### 1.1 Page Hierarchy and Navigation

```
CodeShift AI
|
+-- / ................................ Landing / Projects List
+-- /projects/new .................... Create Project (modal overlay on /)
+-- /projects/:id .................... Project Detail / Analysis
|   +-- /projects/:id/analysis ....... Analysis Results (sub-tab)
+-- /projects/:id/transform/:file .... Transformation View (single file)
+-- /projects/:id/batch .............. Batch Migration Page
+-- /projects/:id/dashboard .......... Migration Dashboard
```

### 1.2 URL Routing Table

| Route | Component | API Endpoints Used | Description |
|---|---|---|---|
| `/` | `ProjectsPage` | `GET /projects` | List all projects, quick stats |
| `/projects/new` | `CreateProjectModal` | `POST /projects` | Modal overlay to create project |
| `/projects/:id` | `ProjectDetailPage` | `GET /projects/:id`, `POST /files`, `POST /analyze` | Upload files, run analysis |
| `/projects/:id/analysis` | `AnalysisResultsView` | (cached from parent) | Deep-dive into analysis results |
| `/projects/:id/transform/:filePath` | `TransformationView` | `POST /transform/:filePath` | Side-by-side diff — the killer page |
| `/projects/:id/batch` | `BatchMigrationPage` | `POST /transform-batch` | Batch migration with progress |
| `/projects/:id/dashboard` | `MigrationDashboard` | `GET /dashboard` | Charts and metrics — the impact page |

### 1.3 Layout System

```
+---------------------------------------------------------------+
| AppHeader (64px)                                              |
| [Logo] [CodeShift AI]              [Project Selector] [Theme] |
+----------+----------------------------------------------------+
| Sidebar  | ContentArea                                        |
| (240px)  |                                                    |
| [Collaps-| +------------------------------------------------+ |
|  ible]   | | PageHeader (breadcrumbs, actions)               | |
|          | +------------------------------------------------+ |
| [Nav     | |                                                | |
|  Items]  | | PageContent                                    | |
|          | |                                                | |
|          | +------------------------------------------------+ |
+----------+----------------------------------------------------+
```

- **AppHeader**: fixed top, z-50, dark background (`#0F1117`)
- **Sidebar**: collapsible (240px → 64px), navigation items with icons, active state highlight
- **ContentArea**: scrollable, max-width 1440px centered, responsive padding

## 2. Design System

### 2.1 Color Palette

```
Background:
  --bg-primary:    #0F1117    (app background)
  --bg-secondary:  #1A1D27    (cards, panels)
  --bg-tertiary:   #242836    (hover states, elevated)
  --bg-code:       #1E2028    (code editor background)

Text:
  --text-primary:  #E8EAED    (main text)
  --text-secondary:#9AA0A6    (secondary, labels)
  --text-muted:    #5F6368    (disabled, hints)

Accent:
  --accent:        #7C5CFC    (primary actions, links)
  --accent-hover:  #9B7FFF    (hover state)

Confidence Tiers:
  --tier-1:        #34D399    (green — auto-apply)
  --tier-2:        #60A5FA    (blue — spot-check)
  --tier-3:        #FBBF24    (amber — review required)
  --tier-4:        #F87171    (red — manual only)

Risk Levels:
  --risk-low:      #34D399    (green)
  --risk-medium:   #FBBF24    (amber)
  --risk-high:     #F97316    (orange)
  --risk-critical: #EF4444    (red)

Status:
  --status-success:#34D399
  --status-warning:#FBBF24
  --status-error:  #EF4444
  --status-info:   #60A5FA
```

### 2.2 Typography

```
Font Family: "JetBrains Mono" (code), "Inter" (UI)
Scale:
  --text-xs:   12px / 16px
  --text-sm:   14px / 20px
  --text-base: 16px / 24px
  --text-lg:   18px / 28px
  --text-xl:   20px / 28px
  --text-2xl:  24px / 32px
  --text-3xl:  30px / 36px
```

### 2.3 Component Tokens

```
Border Radius:
  --radius-sm: 4px    (badges, small elements)
  --radius-md: 8px    (cards, inputs)
  --radius-lg: 12px   (modals, large panels)

Shadows:
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.3)
  --shadow-md:  0 4px 12px rgba(0,0,0,0.4)
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.5)
  --shadow-glow: 0 0 20px rgba(124,92,252,0.3)  (accent glow)

Spacing: 4px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
```

## 3. Pages — Detailed Specifications

### 3.1 Projects Page (`/`)

```
+---------------------------------------------------------------+
| [+ New Project]                          [Search] [Sort: Date] |
+---------------------------------------------------------------+
| Quick Stats Bar                                                |
| [3 Projects] [12 Files Migrated] [1,240 Lines Saved] [87% Avg]|
+---------------------------------------------------------------+
|                                                                |
| +---------------------------+  +---------------------------+   |
| | Legacy ERP System         |  | Payment Gateway v2        |   |
| | Python 2 → Python 3       |  | Python 2 → Python 3       |   |
| |                           |  |                           |   |
| | [████████░░] 78%          |  | [██░░░░░░░░] 23%          |   |
| | 12 files · 3,400 lines    |  | 8 files · 1,800 lines     |   |
| | 340 dead code lines       |  | Analyzing...              |   |
| |                           |  |                           |   |
| | Risk: ●2 High ●4 Med     |  | Risk: Not analyzed        |   |
| | [View Dashboard]          |  | [Continue Analysis]       |   |
| +---------------------------+  +---------------------------+   |
+---------------------------------------------------------------+
```

**Project Card Component** (`ProjectCard.tsx`):
- Status badge (top-right): colored dot + label matching `MigrationStatus`
- Progress bar: segmented by confidence tier colors
- Bottom row: risk distribution as small colored dots
- Click navigates to `/projects/:id`
- Hover: subtle `--bg-tertiary` background, `--shadow-md`

### 3.2 Project Detail Page (`/projects/:id`)

```
+---------------------------------------------------------------+
| Legacy ERP System                    [Analyze] [Migrate All]   |
| Python 2 → Python 3 · Created Feb 21                          |
+---------------------------------------------------------------+
| [Upload Files]  [Analysis]  [Migration Plan]                   |
+---------------------------------------------------------------+

--- Upload Tab ---
+---------------------------------------------------------------+
| +-----------------------------------------------------------+ |
| |                                                           | |
| |   ┌─────────────────────────────────────┐                 | |
| |   │         Drop .py files here         │                 | |
| |   │      or click to browse             │                 | |
| |   └─────────────────────────────────────┘                 | |
| |                                                           | |
| | Uploaded Files:                                           | |
| | ┌──────────────────────────────────────────────────────┐  | |
| | │ ● user_manager.py           152 lines    [✓ Ready]   │  | |
| | │ ● payment_processor.py      102 lines    [✓ Ready]   │  | |
| | │ ● report_generator.py        78 lines    [✓ Ready]   │  | |
| | └──────────────────────────────────────────────────────┘  | |
| +-----------------------------------------------------------+ |
+---------------------------------------------------------------+

--- Analysis Tab (after POST /analyze) ---
+---------------------------------------------------------------+
| Summary: 3 files, 332 lines. 34 dead code lines (10.2%).      |
| Risk: 1 critical, 2 high, 0 medium, 0 low.                    |
+---------------------------------------------------------------+
| [Dead Code]  [Dependencies]  [Risk Map]  [Migration Plan]      |
+---------------------------------------------------------------+
```

**Dead Code Sub-tab**:
```
+---------------------------------------------------------------+
| Dead Code Detected: 34 lines (10.2%)     [Remove All Dead Code]|
+---------------------------------------------------------------+
| ▼ user_manager.py                              22 lines saved  |
|   ├─ _unused_helper_function()    fn   L97-100    "Never called"|
|   └─ DeprecatedUserFormatter      cls  L103-109   "Never used" |
| ▼ payment_processor.py                         12 lines saved  |
|   └─ _unused_tax_calculator()     fn   L98-100    "Never called"|
+---------------------------------------------------------------+
```

**Dependency Graph Sub-tab** (D3.js force-directed):
```
+---------------------------------------------------------------+
|                    [Play Migration ▶]                          |
|                                                                |
|        ┌──────────────────┐                                   |
|        │ user_manager.py  │ ◄── Migration Order: 1            |
|        │ Risk: CRITICAL   │                                   |
|        └────────┬─────────┘                                   |
|                 │                                              |
|        ┌────────▼─────────┐                                   |
|        │payment_processor │ ◄── Migration Order: 2            |
|        │ Risk: HIGH       │                                   |
|        └────────┬─────────┘                                   |
|                 │                                              |
|        ┌────────▼─────────┐                                   |
|        │report_generator  │ ◄── Migration Order: 3            |
|        │ Risk: HIGH       │                                   |
|        └──────────────────┘                                   |
+---------------------------------------------------------------+
```

- Nodes colored by risk level
- Node size proportional to line count
- Edges show import direction
- Click node → sidebar with file details
- **"Play Migration" button**: animates nodes in migration order with glow effects

**Risk Heat Map Sub-tab**:
```
+---------------------------------------------------------------+
| File Risk Assessment                                           |
+---------------------------------------------------------------+
| user_manager.py         [████████████████████] 0.95  CRITICAL  |
|   · basestring usage · cPickle · cStringIO · xrange           |
|   · dict.iteritems · __metaclass__ · sys.maxint               |
|   · No tests found                                            |
|                                                                |
| payment_processor.py    [████████████░░░░░░░░] 0.46  HIGH     |
|   · dict.has_key · reduce() · Syntax errors · No tests        |
|                                                                |
| report_generator.py     [████████████░░░░░░░░] 0.46  HIGH     |
|   · dict.has_key · reduce() · Syntax errors · No tests        |
+---------------------------------------------------------------+
```

### 3.3 Transformation View — THE KILLER PAGE (`/projects/:id/transform/:file`)

```
+---------------------------------------------------------------+
| user_manager.py          Confidence: 0.87    Tier: SPOT CHECK  |
| [◄ Back] [Approve All Tier 1] [Approve All] [Reject Remaining]|
+---------------------------------------------------------------+
| Transformations: 21 total                                      |
| [●15 Auto] [●3 Spot] [●2 Review] [●1 Manual]                 |
+---------------------------------------------------------------+
|                                                                |
| ORIGINAL (Python 2)             | MIGRATED (Python 3)          |
| ────────────────────────────────|──────────────────────────────|
|  4│                             |  4│                          |
|  5│ import cPickle          ◄───|──►import pickle              |
|  6│ import cStringIO        ◄───|──►import io                  |
|  7│ import sys                  |  7│ import sys               |
|  ...                            |  ...                         |
| 22│ self.max_users = sys.maxint |  22│ self.max_users = sys.   |
|   │                         ◄───|──►    maxsize                |
|  ...                            |  ...                         |
| 25│ if self.users.has_key(  ◄───|──►if username in self.users: |
|   │     username):              |                              |
| ────────────────────────────────|──────────────────────────────|
|                                                                |
| Selected Transformation:                                       |
| ┌────────────────────────────────────────────────────────────┐ |
| │ Line 5: import cPickle → import pickle                     │ |
| │ Tier: AUTO-APPLY (0.95)    Type: syntax                    │ |
| │ Reasoning: Deterministic rule: cPickle merged into pickle  │ |
| │ Requires test: No                                          │ |
| │                              [✓ Approve]  [✗ Reject]       │ |
| └────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------+
| Snapshot Tests Generated: 4                                    |
| ┌──────────────────────────────────────────────────────────┐   |
| │ test_add_user_exists         covers: [add_user]          │   |
| │ test_UserManager_class       covers: [UserManager, ...]  │   |
| │ test_calculate_user_stats    covers: [calculate_user_st] │   |
| │ test_batch_process_users     covers: [batch_process_use] │   |
| └──────────────────────────────────────────────────────────┘   |
+---------------------------------------------------------------+
```

**Implementation details**:
- Dual Monaco Editor instances with synchronized scrolling
- Changed lines highlighted with tier-colored backgrounds
- Click a highlighted line to see transformation details in panel below
- "Approve All Tier 1" button batch-approves all green (0.9+) changes
- Transformation detail panel shows reasoning, change type, test requirement
- Tier badge colors: green (#34D399), blue (#60A5FA), amber (#FBBF24), red (#F87171)

### 3.4 Migration Dashboard — THE IMPACT PAGE (`/projects/:id/dashboard`)

```
+---------------------------------------------------------------+
| Migration Dashboard: Legacy ERP System         Status: 78%     |
+---------------------------------------------------------------+
|                                                                |
| ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐|
| │  Progress    │ │ Dead Code   │ │ Lines After  │ │  Files    │|
| │   ╭───╮     │ │  Removed    │ │  Cleanup     │ │  Done     │|
| │   │78%│     │ │   34        │ │   298        │ │  2/3      │|
| │   ╰───╯     │ │  lines      │ │  (was 332)   │ │           │|
| └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘|
|                                                                |
| ┌──────────────────────────┐ ┌──────────────────────────────┐ |
| │ Risk Distribution        │ │ Confidence Distribution       │ |
| │                          │ │                               │ |
| │ Critical ██ 1            │ │ Tier 1 ████████████████ 15    │ |
| │ High     ████ 2          │ │ Tier 2 ████ 3                 │ |
| │ Medium   0               │ │ Tier 3 ███ 2                  │ |
| │ Low      0               │ │ Tier 4 █ 1                    │ |
| └──────────────────────────┘ └──────────────────────────────┘ |
|                                                                |
| ┌──────────────────────────────────────────────────────────┐  |
| │ Migration Plan                                            │  |
| │                                                           │  |
| │ ✅ 1. report_generator.py    HIGH     [Migrated]          │  |
| │ ✅ 2. payment_processor.py   HIGH     [Migrated]          │  |
| │ ⬜ 3. user_manager.py        CRITICAL [Pending]           │  |
| └──────────────────────────────────────────────────────────┘  |
|                                                                |
| ┌──────────────────────────────────────────────────────────┐  |
| │ Money Saved Calculator                                    │  |
| │                                                           │  |
| │ Dead code removed: 34 lines                               │  |
| │ Avg developer rate: $75/hr                                │  |
| │ Avg lines reviewed/hr: 50                                 │  |
| │ ─────────────────────                                     │  |
| │ Estimated savings: $51 in review time                     │  |
| │ + avoided migration of dead code: $204                    │  |
| │ = Total savings: ~$255 on this project alone              │  |
| └──────────────────────────────────────────────────────────┘  |
+---------------------------------------------------------------+
```

## 4. Interactive / Wow Factor Elements

### 4.1 Animated Dependency Graph Playback
- "Play Migration" button above dependency graph
- Nodes desaturate to 40%, then activate one-by-one in migration order
- Each activation: `scale(1.15) → scale(1.0)` with radial glow
- Edges animate with directional stroke-dasharray
- Counter shows "Step {n} of {total}"

### 4.2 Live Transformation Counter
- Compact counter in AppHeader during batch migration
- Count-up animation with pulse glow on each increment
- Breathing animation with accent color during active migration

### 4.3 Before/After Smooth Transitions
- Approve: left (original) fades to 30%, right gets green border flash + particle effect
- Reject: right cross-fades back to original, desaturated red-gray highlight
- Tier badge morphs to green "Approved" badge

### 4.4 Risk-to-Confidence Pipeline
- Horizontal pipeline diagram on dashboard
- Animated flow: Risk Assessment → Dead Code Removal → Transformation → Confidence Scoring → Verification
- Each stage shows count of items flowing through
- Particles animate along connecting arrows

### 4.5 Completion Confetti
- When all files reach 100% migrated, trigger confetti animation
- Auto-dismiss after 3 seconds
- Toast: "Migration complete! All {n} files migrated successfully."

## 5. Component File Structure

```
src/
├── App.tsx
├── routes.tsx
├── api/
│   └── client.ts                    -- Axios/fetch wrapper for /api/v1
├── components/
│   ├── layout/
│   │   ├── AppHeader.tsx
│   │   ├── Sidebar.tsx
│   │   └── ContentArea.tsx
│   ├── common/
│   │   ├── TierBadge.tsx            -- Confidence tier colored badge
│   │   ├── RiskBadge.tsx            -- Risk level colored badge
│   │   ├── StatusBadge.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── ProgressRing.tsx
│   │   ├── AnimatedCounter.tsx      -- Count-up number animation
│   │   ├── ConfettiOverlay.tsx
│   │   ├── Spinner.tsx
│   │   └── Skeleton.tsx
│   ├── projects/
│   │   ├── ProjectCard.tsx
│   │   ├── CreateProjectModal.tsx
│   │   └── QuickStatsBar.tsx
│   ├── analysis/
│   │   ├── AnalysisTabs.tsx
│   │   ├── DeadCodePanel.tsx
│   │   ├── DependencyGraph.tsx      -- D3 force-directed graph
│   │   ├── RiskHeatMap.tsx
│   │   └── MigrationPlan.tsx
│   ├── transformation/
│   │   ├── CodeDiffView.tsx         -- Dual Monaco editors
│   │   ├── TransformationSummaryBar.tsx
│   │   ├── TransformationDetail.tsx
│   │   ├── TransformationActions.tsx
│   │   ├── SnapshotTestsPanel.tsx
│   │   └── SnapshotTestCard.tsx
│   ├── batch/
│   │   ├── BatchProgressBar.tsx
│   │   ├── FileQueueTable.tsx
│   │   └── LiveLog.tsx
│   └── dashboard/
│       ├── ProgressRing.tsx
│       ├── RiskDistributionChart.tsx
│       ├── ConfidenceDistributionChart.tsx
│       ├── MigrationVelocityChart.tsx
│       ├── MigrationChecklist.tsx
│       ├── BlockersPanel.tsx
│       ├── RecentTransformations.tsx
│       ├── MoneySavedCalculator.tsx
│       └── MigrationPipeline.tsx
├── stores/
│   ├── transformationStore.ts
│   └── uiStore.ts
└── utils/
    ├── formatters.ts
    └── tierColors.ts
```

## 6. Responsive Behavior

- **Desktop** (1440px primary): full sidebar + content layout
- **Tablet** (1024px): collapsed sidebar (icons only), single-column analysis tabs
- **Mobile** (768px): hidden sidebar, hamburger menu, read-only dashboard view, no Monaco editors (show plain diff instead)
