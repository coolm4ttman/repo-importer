Now I have a complete understanding of every backend model, every API endpoint, every data field, and the sample data that flows through the system. Let me produce the comprehensive UI specification.

---

# CodeShift AI -- Frontend UI Specification

## Document Metadata

- **Product**: CodeShift AI -- AI-Powered Legacy Code Migration Platform
- **Version**: 1.0.0
- **Backend API Base**: `http://localhost:8000/api/v1`
- **Backend Source**: `/Users/paulaldea/git/code-analysis/app/`
- **Schemas Source**: `/Users/paulaldea/git/code-analysis/app/models/schemas.py`
- **Routes Source**: `/Users/paulaldea/git/code-analysis/app/api/routes.py`
- **Target Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS 3.x with custom design tokens
- **State Management**: Zustand or React Query (TanStack Query v5)

---

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
| `/projects/:id` | `ProjectDetailPage` | `GET /projects/:id`, `POST /projects/:id/files`, `POST /projects/:id/analyze` | Upload files, run analysis |
| `/projects/:id/analysis` | `AnalysisResultsView` | (uses cached analysis from parent) | Deep-dive into analysis results |
| `/projects/:id/transform/:filePath` | `TransformationView` | `POST /projects/:id/transform/:filePath` | The "killer page" -- side-by-side diff |
| `/projects/:id/batch` | `BatchMigrationPage` | `POST /projects/:id/transform-batch` | Batch file migration with progress |
| `/projects/:id/dashboard` | `MigrationDashboard` | `GET /projects/:id/dashboard` | The "impact page" -- charts and metrics |

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
|  Items]  | | MainContent                                    | |
|          | | (scrollable, padded 32px)                      | |
| [Project | |                                                | |
|  Info]   | |                                                | |
|          | |                                                | |
| [Quick   | |                                                | |
|  Stats]  | |                                                | |
+----------+----------------------------------------------------+
| StatusBar (32px, optional during batch operations)            |
+---------------------------------------------------------------+
```

**Component Details:**

- **AppHeader** (`<header class="cs-header">`): Fixed top, `height: 64px`, `background: var(--surface-0)`, `border-bottom: 1px solid var(--border-subtle)`. Contains logo, product name, a project quick-switcher dropdown (bound to `GET /projects`), and a dark/light theme toggle.

- **Sidebar** (`<aside class="cs-sidebar">`): Fixed left, `width: 240px` (collapsible to `64px` icon-only mode). Contains:
  - Navigation links with icons (active state: left `3px` accent border + `background: var(--surface-active)`)
  - Project metadata panel (name, language pair, status badge)
  - Quick stats mini-cards (only visible when viewing a specific project)

- **ContentArea** (`<main class="cs-content">`): `margin-left: 240px`, `margin-top: 64px`, `padding: 32px`. Scrollable. Contains page-specific content.

- **StatusBar** (`<footer class="cs-statusbar">`): Only visible during active batch operations. Shows overall progress and elapsed time. Fixed bottom, `height: 32px`.

### 1.4 Sidebar Navigation Items

When on `/` (no project selected):
```
[icon] All Projects        --> /
```

When viewing a specific project (`/projects/:id/*`):
```
[icon] All Projects        --> /
---separator---
[icon] Overview            --> /projects/:id
[icon] Analysis            --> /projects/:id/analysis
[icon] Transformations     --> /projects/:id/batch
[icon] Dashboard           --> /projects/:id/dashboard
```

The active nav item is determined by the current route. Each item uses:
- `class="cs-nav-item"` (default)
- `class="cs-nav-item cs-nav-item--active"` (active)

---

## 2. Pages and Components

---

### 2.1 Landing / Projects Page (`/`)

**Purpose**: Show all migration projects, provide quick stats across the portfolio, and funnel users to create new projects.

**ASCII Wireframe:**
```
+---------------------------------------------------------------+
| HEADER: CodeShift AI                           [+ New Project] |
+---------------------------------------------------------------+
|                                                                |
|  QUICK STATS BAR                                               |
|  +-------------+ +-------------+ +-------------+              |
|  | 12           | | 847         | | 23,491      |              |
|  | Projects     | | Files       | | Lines Saved |              |
|  |              | | Migrated    | |             |              |
|  +-------------+ +-------------+ +-------------+              |
|                                                                |
|  PROJECTS GRID (3 columns on 1440px, 2 on 1024px)             |
|  +-------------------+ +-------------------+ +--------------+ |
|  | [Py2->Py3]        | | [Py2->Py3]        | | [Py2->Py3]   | |
|  | Payment Service   | | User Auth Module  | | Reports API  | |
|  | "Legacy payment..." | "Authentication..."| | "Quarterly.."| |
|  |                   | |                   | |              | |
|  | 24 files  3,200 ln| | 8 files   1,100 ln| | 15 files     | |
|  | [====75%====    ]  | | [==30%==        ]  | | [PENDING   ] | |
|  | Status: IN_PROG   | | Status: READY     | | Status: NEW  | |
|  | [||||] risk: med   | | [||||] risk: low  | | [   ] --     | |
|  +-------------------+ +-------------------+ +--------------+ |
|                                                                |
|  +-------------------+                                         |
|  | [+]               |                                         |
|  | Create New Project|                                         |
|  | "Start a new..."  |                                         |
|  +-------------------+                                         |
|                                                                |
+---------------------------------------------------------------+
```

#### 2.1.1 Quick Stats Bar

**Component**: `<QuickStatsBar />`

**Data binding**: Derived by iterating the array returned from `GET /api/v1/projects` (each item is a `ProjectResponse`).

```typescript
interface QuickStats {
  totalProjects: number;           // projects.length
  filesMigrated: number;           // sum of projects[].migrated_files
  linesSaved: number;              // sum of projects[].dead_code_lines
}
```

**Layout**: Three `<StatCard />` components in a horizontal flex row.

Each `<StatCard />`:
```html
<div class="cs-stat-card">
  <span class="cs-stat-card__value"><!-- animated counter --></span>
  <span class="cs-stat-card__label"><!-- label text --></span>
</div>
```

- `.cs-stat-card`: `background: var(--surface-1)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `padding: 24px 32px`, `min-width: 200px`.
- `.cs-stat-card__value`: `font-size: 36px`, `font-weight: 700`, `color: var(--text-primary)`, `font-variant-numeric: tabular-nums`. Uses a count-up animation (`requestAnimationFrame` based, 1.2s duration, ease-out).
- `.cs-stat-card__label`: `font-size: 14px`, `color: var(--text-secondary)`, `text-transform: uppercase`, `letter-spacing: 0.05em`.

#### 2.1.2 Project Cards

**Component**: `<ProjectCard project={ProjectResponse} />`

**Data source**: Each element from `GET /api/v1/projects`.

```typescript
// Maps directly to ProjectResponse from schemas.py
interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  source_language: string;        // e.g., "python2"
  target_language: string;        // e.g., "python3"
  status: MigrationStatus;        // "pending" | "analyzing" | "ready" | "in_progress" | "completed" | "failed"
  created_at: string;             // ISO datetime
  file_count: number;
  total_lines: number;
  dead_code_lines: number;
  migrated_files: number;
}
```

**Card structure:**
```html
<div class="cs-project-card" data-status="{status}">
  <div class="cs-project-card__header">
    <span class="cs-language-badge">{source_language} -> {target_language}</span>
    <StatusIndicator status={status} />
  </div>
  <h3 class="cs-project-card__title">{name}</h3>
  <p class="cs-project-card__desc">{description}</p>
  <div class="cs-project-card__stats">
    <span>{file_count} files</span>
    <span>{total_lines.toLocaleString()} lines</span>
  </div>
  <ProgressBar value={migrated_files} max={file_count} />
  <div class="cs-project-card__footer">
    <StatusBadge status={status} />
    <RiskMiniBar riskDistribution={...} />  <!-- only if analysis exists -->
  </div>
</div>
```

**Status indicator colors** (applied via `data-status` attribute):
| Status | Left border color | Badge background |
|---|---|---|
| `pending` | `var(--neutral-500)` `#6B7280` | `#374151` |
| `analyzing` | `var(--blue-400)` `#60A5FA` | `#1E3A5F` (pulsing animation) |
| `ready` | `var(--green-400)` `#4ADE80` | `#14532D` |
| `in_progress` | `var(--amber-400)` `#FBBF24` | `#78350F` |
| `completed` | `var(--emerald-500)` `#10B981` | `#064E3B` |
| `failed` | `var(--red-500)` `#EF4444` | `#7F1D1D` |

**Card styling:**
- `.cs-project-card`: `background: var(--surface-1)`, `border: 1px solid var(--border-subtle)`, `border-left: 4px solid {status-color}`, `border-radius: 12px`, `padding: 24px`, `cursor: pointer`, `transition: transform 0.15s ease, box-shadow 0.15s ease`.
- Hover: `transform: translateY(-2px)`, `box-shadow: 0 8px 24px rgba(0,0,0,0.3)`.
- Click navigates to `/projects/:id`.

#### 2.1.3 Create Project Card / Button

The last card in the grid is always a "Create New Project" ghost card:

```html
<div class="cs-project-card cs-project-card--create">
  <PlusCircleIcon size={48} />
  <span>Create New Project</span>
</div>
```

- `.cs-project-card--create`: `border: 2px dashed var(--border-muted)`, `background: transparent`, text centered vertically and horizontally.
- On click: opens `<CreateProjectModal />`.

Also: a `[+ New Project]` button in the page header (top right), `class="cs-btn cs-btn--primary"`.

#### 2.1.4 Create Project Modal

**Component**: `<CreateProjectModal onClose={fn} />`

**Triggered by**: clicking the create card or the header button.

**API**: `POST /api/v1/projects` with body `ProjectCreate`.

```
+---------------------------------------------+
| Create New Project                    [x]    |
+---------------------------------------------+
|                                              |
|  Project Name *                              |
|  [_____________________________________]     |
|                                              |
|  Description                                 |
|  [_____________________________________]     |
|  [_____________________________________]     |
|                                              |
|  Source Language          Target Language     |
|  [Python 2      v]       [Python 3      v]   |
|                                              |
|              [Cancel]  [Create Project]       |
+---------------------------------------------+
```

**Form fields:**
| Field | HTML | Maps to `ProjectCreate` field | Validation |
|---|---|---|---|
| Project Name | `<input type="text" class="cs-input" />` | `name` | Required, 3-100 chars |
| Description | `<textarea class="cs-textarea" rows="2" />` | `description` | Optional, max 500 chars |
| Source Language | `<select class="cs-select">` | `source_language` | Default: `"python2"` |
| Target Language | `<select class="cs-select">` | `target_language` | Default: `"python3"` |

**Language options** (for both dropdowns): `python2`, `python3`, `java8`, `java17`, `javascript`, `typescript`. (Backend currently supports python2->python3 only; others are disabled with a tooltip "Coming soon".)

**Buttons:**
- Cancel: `class="cs-btn cs-btn--ghost"`, closes modal.
- Create Project: `class="cs-btn cs-btn--primary"`, submits form. On success, navigates to `/projects/:id`.

**Modal styling:**
- Overlay: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.6)`, `backdrop-filter: blur(4px)`, `z-index: 50`.
- Modal box: `max-width: 520px`, `background: var(--surface-1)`, `border: 1px solid var(--border-subtle)`, `border-radius: 16px`, `padding: 32px`.

---

### 2.2 Project Detail / Analysis Page (`/projects/:id`)

**Purpose**: Upload files, trigger analysis, and view comprehensive pre-migration intelligence.

**Data**: `GET /api/v1/projects/:id` for project info. Analysis results from `POST /api/v1/projects/:id/analyze` (cached in client state after first call).

**ASCII Wireframe:**
```
+---------------------------------------------------------------+
| <- All Projects / Payment Service                              |
|                                              [Analyze] [Batch] |
+---------------------------------------------------------------+
|                                                                |
|  PROJECT HEADER                                                |
|  Payment Service              Status: [READY]                  |
|  Python 2 -> Python 3         24 files | 3,200 lines           |
|                                                                |
+---------------------------------------------------------------+
|                                                                |
|  FILE UPLOAD ZONE (if file_count == 0 or always available)     |
|  +----------------------------------------------------------+ |
|  |  +------+                                                 | |
|  |  |      |  Drag & drop Python files here                  | |
|  |  | ICON |  or click to browse                             | |
|  |  |      |  Accepts: .py files, max 10MB each              | |
|  |  +------+                                                 | |
|  +----------------------------------------------------------+ |
|                                                                |
|  UPLOADED FILES LIST (collapsible)                             |
|  +----------------------------------------------------------+ |
|  | user_manager.py          152 lines  [Transform]           | |
|  | payment_processor.py     201 lines  [Transform]           | |
|  | report_generator.py      180 lines  [Transform]           | |
|  +----------------------------------------------------------+ |
|                                                                |
+---------------------------------------------------------------+
|                                                                |
|  ANALYSIS RESULTS (shown after POST /analyze completes)        |
|                                                                |
|  [Dead Code] [Dependencies] [Risk Map] [Migration Plan]       |
|                                                                |
|  (tab content below)                                           |
|                                                                |
+---------------------------------------------------------------+
```

#### 2.2.1 File Upload Area

**Component**: `<FileUploadZone projectId={string} />`

**API**: `POST /api/v1/projects/:id/files` (multipart form data, field name `files`).

**Implementation:**
- Uses HTML5 drag-and-drop events (`onDragEnter`, `onDragOver`, `onDrop`) and a hidden `<input type="file" multiple accept=".py" />`.
- Visual states:
  - **Default**: Dashed border (`2px dashed var(--border-muted)`), muted upload icon.
  - **Drag hover**: Border becomes `var(--accent-primary)`, background shifts to `rgba(99, 102, 241, 0.05)`, icon animates (scale pulse).
  - **Uploading**: Progress bar replaces instruction text, file names listed as they upload.
  - **Complete**: Checkmark icon, "N files uploaded" confirmation, auto-fades after 3 seconds.

```html
<div class="cs-upload-zone" data-state="default|hover|uploading|complete">
  <UploadCloudIcon class="cs-upload-zone__icon" />
  <p class="cs-upload-zone__text">Drag & drop Python files here</p>
  <p class="cs-upload-zone__subtext">or click to browse -- .py files, max 10MB each</p>
  <input type="file" class="cs-upload-zone__input" multiple accept=".py" />
</div>
```

#### 2.2.2 Uploaded Files List

**Component**: `<FileList files={FileInfo[]} projectId={string} />`

**Data**: Derived from the upload response `{ uploaded: number, files: [{ filename, lines }] }` and stored in client state.

Each row:
```html
<div class="cs-file-row">
  <FileIcon />
  <span class="cs-file-row__name">{filename}</span>
  <span class="cs-file-row__lines">{lines} lines</span>
  <button class="cs-btn cs-btn--sm cs-btn--ghost" onClick={navigateToTransform}>
    Transform
  </button>
</div>
```

The "Transform" button navigates to `/projects/:id/transform/{filename}`.

#### 2.2.3 Analyze Button

**Component**: `<AnalyzeButton projectId={string} disabled={boolean} />`

Located in the page header area, right-aligned.

```html
<button class="cs-btn cs-btn--primary cs-btn--lg" onClick={triggerAnalysis}>
  {isLoading ? <Spinner /> : <ScanIcon />}
  {isLoading ? "Analyzing..." : "Analyze"}
</button>
```

**States:**
- **Default**: `background: var(--accent-primary)`, clickable.
- **Disabled** (no files uploaded): `opacity: 0.5`, `cursor: not-allowed`.
- **Loading**: Button shows a spinner icon, text changes to "Analyzing...", button is disabled. A full-width progress indicator (indeterminate) appears below the button.
- **Complete**: Button text changes to "Re-analyze" with a refresh icon.

**API call**: `POST /api/v1/projects/:id/analyze`. The response (`AnalysisResponse`) is stored in client state and populates the four analysis tabs below.

#### 2.2.4 Analysis Results Tabs

**Component**: `<AnalysisTabs analysis={AnalysisResponse} />`

Four tabs, each rendered as a sub-view. The tab bar uses:
```html
<div class="cs-tabs">
  <button class="cs-tab cs-tab--active">Dead Code</button>
  <button class="cs-tab">Dependencies</button>
  <button class="cs-tab">Risk Map</button>
  <button class="cs-tab">Migration Plan</button>
</div>
<div class="cs-tab-content">
  {/* active tab content */}
</div>
```

Tab styling:
- `.cs-tab`: `padding: 12px 24px`, `border-bottom: 2px solid transparent`, `color: var(--text-secondary)`, `font-weight: 500`.
- `.cs-tab--active`: `border-bottom-color: var(--accent-primary)`, `color: var(--text-primary)`.

---

##### Tab 1: Dead Code Summary

**Component**: `<DeadCodePanel items={DeadCodeItem[]} totalLines={number} deadCodeLines={number} deadCodePercentage={number} />`

**Data binding** (from `AnalysisResponse`):
```typescript
interface DeadCodeItem {
  file_path: string;
  name: string;
  kind: string;           // "function" | "class" | "import" | "variable"
  line_start: number;
  line_end: number;
  reason: string;
  lines_saved: number;
}
```

**Layout:**
```
+---------------------------------------------------------------+
|  DEAD CODE SUMMARY                                             |
|                                                                |
|  +------------------+  +------------------+                    |
|  |   247            |  |   18.3%          |                    |
|  |   Lines of       |  |   of total       |                    |
|  |   Dead Code      |  |   codebase       |                    |
|  +------------------+  +------------------+                    |
|                                                                |
|  +----------------------------------------------------------+ |
|  | [v] user_manager.py           3 items    87 lines saved   | |
|  |   [fn] _unused_helper_function   L96-L99    4 lines       | |
|  |        "Function is defined but never used..."             | |
|  |   [cl] DeprecatedUserFormatter   L102-L109  8 lines       | |
|  |        "Class is defined but never used..."                | |
|  |   [im] string                    L9         1 line        | |
|  |        "Import 'string' is never used"                     | |
|  +----------------------------------------------------------+ |
|  | [>] payment_processor.py      1 item     12 lines saved   | |
|  +----------------------------------------------------------+ |
|  | [>] report_generator.py       2 items    23 lines saved   | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

The summary stat cards at the top use the same `<StatCard />` component from the landing page but with a `var(--warning-400)` `#FBBF24` accent color.

The expandable list groups `DeadCodeItem`s by `file_path`. Each group header shows the file name, item count, and total `lines_saved` for that file. Clicking the header toggles expansion.

Each item row shows:
- Kind icon: `[fn]` for function (purple), `[cl]` for class (blue), `[im]` for import (gray), `[var]` for variable (orange).
- Name in monospace font.
- Line range: `L{line_start}-L{line_end}` or `L{line_start}` if single line.
- Lines saved count.
- Reason text in `var(--text-secondary)`.

**Kind badge component:**
```html
<span class="cs-kind-badge cs-kind-badge--{kind}">
  {kind === "function" ? "fn" : kind === "class" ? "cl" : kind === "import" ? "im" : "var"}
</span>
```

---

##### Tab 2: Dependency Graph Visualization

**Component**: `<DependencyGraph graph={Record<string, DependencyNode>} />`

**Data binding** (from `AnalysisResponse.dependency_graph`):
```typescript
interface DependencyNode {
  file_path: string;
  imports: string[];           // files this file imports
  imported_by: string[];       // files that import this file
  external_deps: string[];     // external packages
  migration_order: number | null;
}
```

**Implementation**: D3.js v7 force-directed graph.

**Rendering specification:**

```
+---------------------------------------------------------------+
|  DEPENDENCY GRAPH                           [Zoom+] [Zoom-]   |
|                                             [Reset] [Export]   |
|  +----------------------------------------------------------+ |
|  |                                                           | |
|  |        (report_generator.py)                              | |
|  |              |                                            | |
|  |              v                                            | |
|  |    (user_manager.py) -----> (payment_processor.py)        | |
|  |         ^                          |                      | |
|  |         |                          v                      | |
|  |         +-------------- (utils.py)                        | |
|  |                                                           | |
|  |   Legend:                                                 | |
|  |   [Order 1] [Order 2] [Order 3]                          | |
|  |   (migrate first) ---------> (migrate last)               | |
|  |                                                           | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

**Node specification:**
- Shape: Rounded rectangle, `width: 160px`, `height: 40px`, `rx: 8`.
- Fill: Based on `migration_order`. Lower order = lighter shade of `var(--accent-primary)`. The color scale uses `d3.scaleSequential(d3.interpolateViridis)` mapped from `0` to `max(migration_order)`.
- Label: File name (without path prefix if in root), `font-size: 12px`, `font-family: var(--font-mono)`.
- Border: `2px solid` with color matching fill but at 80% lightness.
- Hover: Highlight node, dim all non-connected nodes to 20% opacity, show tooltip with full path, import count, dependent count.
- Click: Select node -- shows detail panel on the right with `imports`, `imported_by`, `external_deps` lists.

**Edge specification:**
- Directed arrows from importer to imported file (matches `imports` array direction).
- Stroke: `1.5px`, `var(--border-muted)`.
- Arrowhead: Small triangle marker.
- Hover on edge: highlight both connected nodes.

**Interaction:**
- **Drag**: `d3.drag()` on nodes to reposition.
- **Zoom**: `d3.zoom()` with `scaleExtent([0.3, 3])`. Zoom buttons in the top-right corner.
- **Reset**: Resets zoom and positions to initial simulation state.
- **Export**: Downloads the graph as SVG.
- **Migration order animation** (wow factor): A "Play Migration Order" button triggers a sequential animation where nodes light up in `migration_order` sequence, with a 500ms delay between each step. Each node transitions from gray to its final color with a `scale(1.2)` pop effect. Edges highlight as the migration wavefront passes.

**D3 Force configuration:**
```javascript
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.file_path).distance(180))
  .force("charge", d3.forceManyBody().strength(-400))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide().radius(90));
```

**Container**: `<svg class="cs-dep-graph">` inside a div with `overflow: hidden`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `background: var(--surface-0)`, `min-height: 500px`.

---

##### Tab 3: Risk Heat Map

**Component**: `<RiskHeatMap assessments={RiskAssessment[]} />`

**Data binding** (from `AnalysisResponse.risk_assessment`):
```typescript
interface RiskAssessment {
  file_path: string;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_score: number;              // 0.0 - 1.0
  factors: string[];
  test_coverage_estimate: string;  // "has_tests" | "no_tests_found"
  semantic_complexity: string;     // "low" | "medium" | "high"
  recommended_tier: ConfidenceTier;
}
```

**Layout**: A treemap visualization where each rectangle represents a file, sized by line count and colored by risk level.

```
+---------------------------------------------------------------+
|  RISK HEAT MAP                                                 |
|                                                                |
|  +----------------------------------------------------------+ |
|  | user_manager.py    | payment_processor.py                 | |
|  | (MEDIUM - 0.35)    |                                      | |
|  | [orange fill]      | (HIGH - 0.58)                       | |
|  |                    | [red-orange fill]                    | |
|  |                    |                                      | |
|  +--------------------+--------------------+-----------------+ |
|  | report_generator.py                     | utils.py        | |
|  | (LOW - 0.12)                            | (LOW - 0.08)    | |
|  | [green fill]                            | [green fill]    | |
|  +------------------------------------------+-----------------+ |
|                                                                |
|  FILE RISK DETAILS (shown on click)                            |
|  +----------------------------------------------------------+ |
|  | payment_processor.py         Risk Score: 0.58 [===HIGH]   | |
|  |                                                           | |
|  | Risk Factors:                                             | |
|  |   * Py2 pattern: basestring usage (str/unicode split)     | |
|  |   * Semantic risk: isinstance str check                   | |
|  |   * Moderate dependency fan-out (3 dependents)            | |
|  |   * No corresponding test file found                      | |
|  |                                                           | |
|  | Test Coverage: no_tests_found                             | |
|  | Semantic Complexity: high                                 | |
|  | Recommended Approach: tier_3_review_required              | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

**Risk level colors:**
| Level | Fill color | Border color | Text color |
|---|---|---|---|
| `low` | `#064E3B` (10% opacity overlay on dark) | `#10B981` | `#6EE7B7` |
| `medium` | `#78350F` (10% opacity) | `#F59E0B` | `#FCD34D` |
| `high` | `#7F1D1D` (10% opacity) | `#EF4444` | `#FCA5A5` |
| `critical` | `#450A0A` (15% opacity) | `#DC2626` | `#FCA5A5` (pulsing) |

Alternatively to the treemap, a simpler table view with color-coded rows is also acceptable (toggle between "Map" and "Table" views):

**Table columns:**
| Column | Width | Content |
|---|---|---|
| File | 30% | File path in monospace |
| Risk | 10% | Color-coded badge with risk level |
| Score | 10% | `risk_score` displayed as bar fill |
| Factors | 30% | Truncated, expandable on click |
| Tests | 10% | Checkmark or warning icon |
| Tier | 10% | Recommended confidence tier badge |

---

##### Tab 4: Migration Plan Timeline

**Component**: `<MigrationPlan steps={MigrationPlanStep[]} />`

**Data binding** (from `AnalysisResponse.migration_plan`):
```typescript
interface MigrationPlanStep {
  order: number;
  file_path: string;
  risk_level: "low" | "medium" | "high" | "critical";
  estimated_transformations: number;
  dependencies: string[];
  blocking: string[];
}
```

**Layout**: Vertical timeline with step cards.

```
+---------------------------------------------------------------+
|  MIGRATION PLAN                                                |
|  Recommended order based on dependency analysis                |
|                                                                |
|  Step 1 ---- [LOW] ----- utils.py                             |
|  |           Leaf module, no dependencies                      |
|  |           Est. transformations: 3                           |
|  |           Blocking: user_manager.py, payment_processor.py   |
|  |           [Transform Now -->]                               |
|  |                                                             |
|  Step 2 ---- [MEDIUM] -- user_manager.py                       |
|  |           Depends on: utils.py                              |
|  |           Est. transformations: 12                          |
|  |           Blocking: report_generator.py                     |
|  |           [Transform Now -->]                               |
|  |                                                             |
|  Step 3 ---- [HIGH] ---- payment_processor.py                  |
|  |           Depends on: utils.py                              |
|  |           Est. transformations: 8                           |
|  |           Blocking: report_generator.py                     |
|  |           [Transform Now -->]                               |
|  |                                                             |
|  Step 4 ---- [MEDIUM] -- report_generator.py                   |
|              Depends on: user_manager.py, payment_processor.py |
|              Est. transformations: 6                           |
|              [Transform Now -->]                               |
|                                                                |
|  +----------------------------------------------------------+ |
|  |              [Migrate All in Order]                        | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

Each step card:
```html
<div class="cs-plan-step" data-risk="{risk_level}">
  <div class="cs-plan-step__order">Step {order}</div>
  <div class="cs-plan-step__connector"></div>  <!-- vertical line -->
  <div class="cs-plan-step__card">
    <div class="cs-plan-step__header">
      <RiskBadge level={risk_level} />
      <code class="cs-plan-step__file">{file_path}</code>
    </div>
    <div class="cs-plan-step__details">
      <!-- dependencies, blocking, est. transformations -->
    </div>
    <button class="cs-btn cs-btn--sm cs-btn--outline" onClick={navigateToTransform}>
      Transform Now
    </button>
  </div>
</div>
```

- The "Transform Now" button navigates to `/projects/:id/transform/{file_path}`.
- The "Migrate All in Order" button at the bottom navigates to `/projects/:id/batch`.
- The vertical connector line uses `border-left: 2px solid var(--border-muted)` with risk-colored dots at each step.

---

### 2.3 Transformation View -- THE KILLER PAGE (`/projects/:id/transform/:filePath`)

**Purpose**: Show the side-by-side code diff with confidence-tiered transformations, allow individual approval/rejection, and display generated snapshot tests.

**API**: `POST /api/v1/projects/:id/transform/:filePath` returns `FileTransformationResponse`.

**Data binding:**
```typescript
interface FileTransformationResponse {
  project_id: string;
  file_path: string;
  transformations: Transformation[];
  snapshot_tests: SnapshotTest[];
  overall_confidence: number;       // 0.0 - 1.0
  overall_tier: ConfidenceTier;
  original_lines: number;
  transformed_lines: number;
}

interface Transformation {
  id: string;                       // 8-char UUID
  file_path: string;
  line_start: number;
  line_end: number;
  original_code: string;
  transformed_code: string;
  confidence_tier: ConfidenceTier;   // "tier_1_auto_apply" | "tier_2_spot_check" | "tier_3_review_required" | "tier_4_manual_only"
  confidence_score: number;
  reasoning: string;
  change_type: string;              // "syntax" | "semantic" | "api_change" | "behavioral"
  requires_test: boolean;
}

interface SnapshotTest {
  file_path: string;
  test_name: string;
  test_code: string;
  covers_functions: string[];
}
```

**ASCII Wireframe:**
```
+---------------------------------------------------------------+
| <- Project / user_manager.py         Overall: [TIER 2] 0.82   |
|                [Batch Approve Tier 1 (8)]  [Accept All] [Reject All] |
+---------------------------------------------------------------+
|                                                                |
|  TRANSFORMATION SUMMARY BAR                                    |
|  [T1: 8 auto] [T2: 3 spot] [T3: 1 review] [T4: 0 manual]     |
|  Original: 152 lines -> Transformed: 148 lines (-4 lines)     |
|                                                                |
+-------------------------------+-------------------------------+
| ORIGINAL (Python 2)           | MIGRATED (Python 3)           |
| user_manager.py               | user_manager.py               |
+-------------------------------+-------------------------------+
|  1 | #!/usr/bin/env python     |  1 | #!/usr/bin/env python    |
|  2 | # -*- coding: utf-8 -*-   |  2 | # -*- coding: utf-8 -*- |
|  3 | """User management..."""   |  3 | """User management..."""|
|  4 |                           |  4 |                         |
|  5 | import cPickle            |  5 | import pickle           |
|    | [T1 ][0.95][ syntax  ]    |    | [GREEN HIGHLIGHT]       |
|    | [v Approve] [x Reject]    |    |                         |
|  6 | import cStringIO          |  6 | import io               |
|    | [T1 ][0.95][ syntax  ]    |    | [GREEN HIGHLIGHT]       |
| ...                           | ...                           |
| 25 |   if self.users.has_key(  | 25 |   if username in self.  |
|    | [T1 ][0.95][ syntax  ]    |    | [GREEN HIGHLIGHT]       |
| ...                           | ...                           |
| 50 |   return filter(lambda u  | 50 |   return filter(lambda  |
|    | [T2 ][0.75][semantic ]    |    | [BLUE HIGHLIGHT]        |
|    | "filter() returns iterat- |    |                         |
|    |  or in Py3, may need     |    |                         |
|    |  list() wrapper"         |    |                         |
|    | [v Approve] [x Reject]    |    |                         |
| ...                           | ...                           |
+-------------------------------+-------------------------------+
|                                                                |
|  TRANSFORMATION DETAIL (shown when a transformation is clicked)|
|  +----------------------------------------------------------+ |
|  | Transformation #a1b2c3d4                                  | |
|  | Type: syntax        Confidence: 0.95       Tier: TIER 1   | |
|  |                                                           | |
|  | Reasoning:                                                | |
|  | "Deterministic rule: cPickle to pickle"                   | |
|  |                                                           | |
|  | Original:  import cPickle                                 | |
|  | Changed:   import pickle                                  | |
|  |                                                           | |
|  | Requires Test: No                                         | |
|  |                                                           | |
|  | [v Approve] [x Reject] [Edit Manually]                    | |
|  +----------------------------------------------------------+ |
|                                                                |
+---------------------------------------------------------------+
|                                                                |
|  SNAPSHOT TESTS (collapsible panel)                             |
|  +----------------------------------------------------------+ |
|  | [v] test_UserManager_class_snapshot                        | |
|  |     Covers: UserManager, add_user, remove_user, ...       | |
|  |     +--------------------------------------------------+  | |
|  |     | import pytest                                     |  | |
|  |     | from user_manager import UserManager              |  | |
|  |     |                                                   |  | |
|  |     | def test_UserManager_class_exists():              |  | |
|  |     |     assert UserManager is not None                |  | |
|  |     +--------------------------------------------------+  | |
|  +----------------------------------------------------------+ |
|  | [>] test_calculate_user_stats_snapshot                     | |
|  | [>] test_batch_process_users_snapshot                      | |
|  +----------------------------------------------------------+ |
|                                                                |
+---------------------------------------------------------------+
```

#### 2.3.1 Split-Pane Code Diff View

**Component**: `<CodeDiffView original={string} transformed={string} transformations={Transformation[]} />`

**Implementation**: Two synchronized Monaco Editor instances (or CodeMirror 6 if bundle size is a concern). Both are read-only. They are placed side-by-side in a `display: grid; grid-template-columns: 1fr 1fr; gap: 0;` container.

**Monaco configuration:**
```javascript
const editorOptions = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  theme: "codeshift-dark",    // custom theme (see Section 3)
  wordWrap: "off",
  renderWhitespace: "none",
  glyphMargin: true,          // for tier icons in the gutter
  folding: false,
};
```

**Synchronization**: Both editors share a single scroll listener. When one scrolls, the other matches via `editor.setScrollTop()`. Lines are aligned 1:1 (the backend preserves line counts by replacing lines in place; when line counts differ, blank placeholder lines are inserted on the shorter side).

**Transformation highlighting:**

For each `Transformation`, the corresponding lines in the left editor get a background decoration and the corresponding lines in the right editor get a different background decoration. The color is determined by `confidence_tier`:

| Tier | Left (original) background | Right (transformed) background | Gutter icon |
|---|---|---|---|
| `tier_1_auto_apply` | `rgba(34, 197, 94, 0.08)` | `rgba(34, 197, 94, 0.15)` | Green circle `#22C55E` |
| `tier_2_spot_check` | `rgba(59, 130, 246, 0.08)` | `rgba(59, 130, 246, 0.15)` | Blue circle `#3B82F6` |
| `tier_3_review_required` | `rgba(249, 115, 22, 0.08)` | `rgba(249, 115, 22, 0.15)` | Orange triangle `#F97316` |
| `tier_4_manual_only` | `rgba(239, 68, 68, 0.08)` | `rgba(239, 68, 68, 0.15)` | Red diamond `#EF4444` |

Using Monaco decorations API:
```javascript
editor.deltaDecorations([], [
  {
    range: new monaco.Range(lineStart, 1, lineEnd, 1),
    options: {
      isWholeLine: true,
      className: `cs-diff-highlight--${tier}`,
      glyphMarginClassName: `cs-diff-glyph--${tier}`,
    },
  },
]);
```

**Click interaction**: Clicking on a highlighted line (or the gutter icon) in either editor opens the `<TransformationDetail />` panel below, scrolling it into view. The clicked transformation's lines get an additional `outline: 2px solid var(--accent-primary)` decoration.

#### 2.3.2 Transformation Summary Bar

**Component**: `<TransformationSummaryBar transformations={Transformation[]} originalLines={number} transformedLines={number} />`

Sits between the page header and the code diff. Shows counts per tier and the line count delta.

```html
<div class="cs-transform-summary">
  <TierBadge tier="tier_1_auto_apply" count={8} />
  <TierBadge tier="tier_2_spot_check" count={3} />
  <TierBadge tier="tier_3_review_required" count={1} />
  <TierBadge tier="tier_4_manual_only" count={0} />
  <span class="cs-transform-summary__delta">
    {originalLines} lines -> {transformedLines} lines
    ({transformedLines - originalLines > 0 ? "+" : ""}{transformedLines - originalLines} lines)
  </span>
</div>
```

Each `<TierBadge />`:
```html
<span class="cs-tier-badge cs-tier-badge--{tier}">
  <span class="cs-tier-badge__dot"></span>
  T{tierNumber}: {count} {label}
</span>
```

#### 2.3.3 Approve / Reject Controls

**Per-transformation** (inline with each highlighted block in the left editor):

Using Monaco's "content widget" API to render React components at specific line positions:
```html
<div class="cs-transform-actions" data-line="{line_start}">
  <TierBadge tier={confidence_tier} />
  <span class="cs-confidence-score">{confidence_score.toFixed(2)}</span>
  <span class="cs-change-type">{change_type}</span>
  <button class="cs-btn cs-btn--xs cs-btn--approve" onClick={approve}>
    <CheckIcon size={14} /> Approve
  </button>
  <button class="cs-btn cs-btn--xs cs-btn--reject" onClick={reject}>
    <XIcon size={14} /> Reject
  </button>
</div>
```

**Batch controls** (in the page header):
- `[Batch Approve Tier 1 (N)]`: Approves all `tier_1_auto_apply` transformations at once. `class="cs-btn cs-btn--success"`.
- `[Accept All]`: Approves all remaining transformations. `class="cs-btn cs-btn--outline"`.
- `[Reject All]`: Rejects all unapproved transformations. `class="cs-btn cs-btn--outline cs-btn--danger"`.

**State management**: Each transformation has a local `status` field: `"pending" | "approved" | "rejected"`. Approved transformations get a green checkmark overlay. Rejected ones get a red strikethrough and the right-side diff reverts to the original code for that block with a fade animation.

#### 2.3.4 Transformation Detail Panel

**Component**: `<TransformationDetail transformation={Transformation} />`

Slides up from below the diff view when a transformation is clicked. Uses a `transition: max-height 0.3s ease`.

Fields displayed:
| Label | Value | Source |
|---|---|---|
| ID | `#{id}` | `transformation.id` |
| Type | Badge | `transformation.change_type` |
| Confidence | Score bar + number | `transformation.confidence_score` |
| Tier | Colored badge | `transformation.confidence_tier` |
| Reasoning | Text block | `transformation.reasoning` |
| Original | Code block (monospace) | `transformation.original_code` |
| Transformed | Code block (monospace) | `transformation.transformed_code` |
| Requires Test | Yes/No badge | `transformation.requires_test` |

Action buttons: `[Approve]`, `[Reject]`, `[Edit Manually]` (opens an inline Monaco editor for the transformed code).

#### 2.3.5 Snapshot Tests Panel

**Component**: `<SnapshotTestsPanel tests={SnapshotTest[]} />`

Collapsible panel below the diff view. Default state: collapsed with header showing count.

```html
<div class="cs-panel cs-panel--collapsible">
  <button class="cs-panel__header" onClick={toggle}>
    <ChevronIcon direction={isOpen ? "down" : "right"} />
    <span>Snapshot Tests ({tests.length})</span>
  </button>
  <div class="cs-panel__body">
    {tests.map(test => <SnapshotTestCard test={test} />)}
  </div>
</div>
```

Each `<SnapshotTestCard />`:
```html
<div class="cs-test-card">
  <div class="cs-test-card__header">
    <TestTubeIcon />
    <code>{test.test_name}</code>
    <span class="cs-test-card__covers">
      Covers: {test.covers_functions.join(", ")}
    </span>
  </div>
  <pre class="cs-code-block">
    <code>{test.test_code}</code>
  </pre>
</div>
```

The code block uses syntax highlighting (PrismJS or the same Monaco instance in read-only mode).

---

### 2.4 Migration Dashboard -- THE IMPACT PAGE (`/projects/:id/dashboard`)

**Purpose**: Real-time overview of migration progress, risk distribution, and impact metrics. The "executive summary" page.

**API**: `GET /api/v1/projects/:id/dashboard` returns `DashboardResponse`.

**Data binding:**
```typescript
interface DashboardResponse {
  project_id: string;
  project_name: string;
  status: MigrationStatus;
  total_files: number;
  migrated_files: number;
  migration_percentage: number;        // 0.0 - 100.0
  total_lines: number;
  dead_code_lines: number;
  lines_after_cleanup: number;
  risk_distribution: Record<string, number>;    // { low: 5, medium: 3, high: 1, critical: 0 }
  confidence_distribution: Record<string, number>; // { tier_1_auto_apply: 12, tier_2_spot_check: 5, ... }
  migration_plan: MigrationPlanStep[];
  blockers: string[];
  recent_transformations: Transformation[];
}
```

**ASCII Wireframe:**
```
+---------------------------------------------------------------+
| <- Project / Dashboard                    [Refresh] [Export]   |
+---------------------------------------------------------------+
|                                                                |
| TOP METRICS ROW                                                |
| +----------+ +----------+ +----------+ +----------+           |
| |   75%    | |    247   | |   3,200  | |  $18,700 |           |
| |  [ring]  | | Lines of | |  Lines   | |  Est.    |           |
| | Migrated | | Dead Code| |  After   | |  Savings |           |
| |          | | Removed  | |  Cleanup | |          |           |
| +----------+ +----------+ +----------+ +----------+           |
|                                                                |
| CHARTS ROW                                                     |
| +---------------------------+ +------------------------------+ |
| | RISK DISTRIBUTION         | | CONFIDENCE DISTRIBUTION      | |
| |                           | |                              | |
| | [====] Low        5       | |   [===] T1 Auto    12        | |
| | [===]  Medium     3       | |   [==]  T2 Spot     5        | |
| | [=]    High       1       | |   [=]   T3 Review   2        | |
| | []     Critical   0       | |   []    T4 Manual   1        | |
| |                           | |                              | |
| +---------------------------+ +------------------------------+ |
|                                                                |
| +------------------------------------------------------------+|
| | MIGRATION VELOCITY                                          ||
| |                                                             ||
| |  files ^                                                    ||
| |  /day  |          *                                         ||
| |        |      *       *                                     ||
| |        |  *               *   *                             ||
| |        +--------------------------->                        ||
| |         Day 1  Day 2  Day 3  Day 4  Day 5                  ||
| +------------------------------------------------------------+|
|                                                                |
| +----------------------------+ +-----------------------------+ |
| | MIGRATION PLAN CHECKLIST   | | BLOCKERS                    | |
| |                            | |                             | |
| | [x] 1. utils.py       LOW | | (!) payment_processor.py   | |
| | [x] 2. user_mgr.py    MED | |     requires manual review | |
| | [ ] 3. payment.py    HIGH | |     of bytes/str boundary  | |
| | [ ] 4. reports.py     MED | |                             | |
| |                            | | (!) report_generator.py    | |
| |                            | |     circular dependency    | |
| +----------------------------+ +-----------------------------+ |
|                                                                |
| RECENT TRANSFORMATIONS                                         |
| +------------------------------------------------------------+|
| | user_manager.py L5   import cPickle -> import pickle  [T1] ||
| | user_manager.py L25  has_key() -> in operator         [T1] ||
| | user_manager.py L50  filter() iterator semantics      [T2] ||
| +------------------------------------------------------------+|
|                                                                |
+---------------------------------------------------------------+
```

#### 2.4.1 Top Metrics Row

Four `<MetricCard />` components.

**Card 1: Progress Ring**

**Component**: `<ProgressRing percentage={number} />`

SVG-based circular progress indicator.

```html
<div class="cs-metric-card cs-metric-card--ring">
  <svg viewBox="0 0 120 120" class="cs-progress-ring">
    <circle class="cs-progress-ring__bg" cx="60" cy="60" r="52" />
    <circle class="cs-progress-ring__fill" cx="60" cy="60" r="52"
      stroke-dasharray="{circumference}"
      stroke-dashoffset="{circumference * (1 - percentage / 100)}" />
    <text x="60" y="60" class="cs-progress-ring__text">{percentage}%</text>
  </svg>
  <span class="cs-metric-card__label">Files Migrated</span>
  <span class="cs-metric-card__detail">{migrated_files}/{total_files}</span>
</div>
```

- Background circle: `stroke: var(--surface-2)`, `stroke-width: 8`.
- Fill circle: `stroke: var(--accent-primary)`, `stroke-width: 8`, `stroke-linecap: round`, `transition: stroke-dashoffset 1.5s ease-out`.
- At 100%: stroke color changes to `var(--success-400)` `#4ADE80` and a confetti animation triggers (using canvas-confetti library).

**Card 2: Dead Code Lines Counter**

**Component**: `<AnimatedCounter value={number} label={string} />`

```
Data binding: dashboard.dead_code_lines
```

Uses `requestAnimationFrame` to animate from 0 to `dead_code_lines` over 1.5 seconds with an ease-out curve. Value displayed in `font-variant-numeric: tabular-nums` for stable width. Color: `var(--warning-400)` `#FBBF24`.

**Card 3: Lines After Cleanup**

```
Data binding: dashboard.lines_after_cleanup
```

Shows `lines_after_cleanup` with a small delta indicator: `(-{total_lines - lines_after_cleanup})` in green, indicating lines eliminated.

**Card 4: Money Saved Calculator (Wow Factor)**

**Component**: `<MoneySavedCalculator deadCodeLines={number} />`

Formula: `deadCodeLines * avgLinesPerHour * hourlyRate`
- `avgLinesPerHour`: 10 lines/hour (industry average for understanding/maintaining legacy code).
- `hourlyRate`: $75/hour (default, configurable via a small gear icon that opens a popover).
- Calculation: `(deadCodeLines / 10) * 75`.

```html
<div class="cs-metric-card cs-metric-card--money">
  <span class="cs-metric-card__value cs-metric-card__value--animated">
    ${(deadCodeLines / 10 * hourlyRate).toLocaleString()}
  </span>
  <span class="cs-metric-card__label">Est. Developer Time Saved</span>
  <button class="cs-btn cs-btn--icon cs-btn--xs" onClick={openConfig}>
    <GearIcon size={12} />
  </button>
</div>
```

The value animates with count-up, same as other counters. The dollar sign has a subtle golden glow: `text-shadow: 0 0 12px rgba(251, 191, 36, 0.4)`.

#### 2.4.2 Risk Distribution Chart

**Component**: `<RiskDistributionChart data={Record<string, number>} />`

**Implementation**: Horizontal bar chart using Recharts.

```typescript
// Transform API data to chart format
const chartData = [
  { level: "Low", count: data.low, fill: "#10B981" },
  { level: "Medium", count: data.medium, fill: "#F59E0B" },
  { level: "High", count: data.high, fill: "#EF4444" },
  { level: "Critical", count: data.critical, fill: "#DC2626" },
];
```

```jsx
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={chartData} layout="vertical">
    <XAxis type="number" />
    <YAxis type="category" dataKey="level" width={80} />
    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
      {chartData.map((entry, i) => (
        <Cell key={i} fill={entry.fill} />
      ))}
    </Bar>
    <Tooltip />
  </BarChart>
</ResponsiveContainer>
```

Container: `class="cs-chart-card"`, `background: var(--surface-1)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, `padding: 24px`.

#### 2.4.3 Confidence Distribution Chart

**Component**: `<ConfidenceDistributionChart data={Record<string, number>} />`

**Implementation**: Donut chart (pie chart with inner radius) using Recharts.

```typescript
const chartData = [
  { name: "T1 Auto",    value: data.tier_1_auto_apply,      fill: "#22C55E" },
  { name: "T2 Spot",    value: data.tier_2_spot_check,      fill: "#3B82F6" },
  { name: "T3 Review",  value: data.tier_3_review_required, fill: "#F97316" },
  { name: "T4 Manual",  value: data.tier_4_manual_only,     fill: "#EF4444" },
];
```

```jsx
<ResponsiveContainer width="100%" height={200}>
  <PieChart>
    <Pie data={chartData} innerRadius={50} outerRadius={80}
         dataKey="value" paddingAngle={3}>
      {chartData.map((entry, i) => (
        <Cell key={i} fill={entry.fill} />
      ))}
    </Pie>
    <Legend />
    <Tooltip />
  </PieChart>
</ResponsiveContainer>
```

#### 2.4.4 Migration Velocity Chart

**Component**: `<MigrationVelocityChart />`

**Data**: This chart requires time-series data that the current API does not directly provide. The frontend should track timestamps when transformations complete (stored in local state or localStorage) and plot `files migrated per day` over time.

```typescript
interface VelocityDataPoint {
  date: string;        // "2026-02-21"
  filesMigrated: number;
}
```

**Implementation**: Line chart using Recharts with area fill.

```jsx
<ResponsiveContainer width="100%" height={250}>
  <AreaChart data={velocityData}>
    <defs>
      <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
      </linearGradient>
    </defs>
    <XAxis dataKey="date" />
    <YAxis />
    <Area dataKey="filesMigrated" stroke="#6366F1" strokeWidth={2}
          fill="url(#velocityGradient)" />
    <Tooltip />
  </AreaChart>
</ResponsiveContainer>
```

#### 2.4.5 Migration Plan Checklist

**Component**: `<MigrationChecklist steps={MigrationPlanStep[]} migratedFiles={Set<string>} />`

A vertical checklist that shows each step from the migration plan with completion status.

```html
<div class="cs-checklist">
  {steps.map(step => (
    <div class="cs-checklist__item" data-completed={migratedFiles.has(step.file_path)}>
      <span class="cs-checklist__check">
        {migratedFiles.has(step.file_path) ? <CheckCircleIcon /> : <CircleIcon />}
      </span>
      <span class="cs-checklist__order">{step.order}.</span>
      <code class="cs-checklist__file">{step.file_path}</code>
      <RiskBadge level={step.risk_level} />
    </div>
  ))}
</div>
```

Completed items: `text-decoration: line-through`, `opacity: 0.6`, checkmark is `var(--success-400)`.

#### 2.4.6 Blockers Panel

**Component**: `<BlockersPanel blockers={string[]} />`

```html
<div class="cs-blockers">
  {blockers.length === 0 ? (
    <div class="cs-blockers__empty">
      <CheckCircleIcon /> No blockers detected
    </div>
  ) : (
    blockers.map(blocker => (
      <div class="cs-blocker-item">
        <AlertTriangleIcon class="cs-blocker-item__icon" />
        <span>{blocker}</span>
      </div>
    ))
  )}
</div>
```

Each blocker item: `background: rgba(239, 68, 68, 0.05)`, `border-left: 3px solid var(--danger-400)`, `padding: 12px 16px`.

#### 2.4.7 Recent Transformations Feed

**Component**: `<RecentTransformations transformations={Transformation[]} />`

Shows the last 10 transformations as a compact feed.

```html
<div class="cs-transform-feed">
  {transformations.map(t => (
    <div class="cs-transform-feed__item" onClick={navigateToTransform}>
      <code class="cs-transform-feed__file">{t.file_path}</code>
      <span class="cs-transform-feed__line">L{t.line_start}</span>
      <span class="cs-transform-feed__change">
        <del>{truncate(t.original_code, 30)}</del>
        <span> -> </span>
        <ins>{truncate(t.transformed_code, 30)}</ins>
      </span>
      <TierBadge tier={t.confidence_tier} compact={true} />
    </div>
  ))}
</div>
```

---

### 2.5 Batch Migration Page (`/projects/:id/batch`)

**Purpose**: Transform multiple files in dependency order with real-time progress tracking.

**API**: `POST /api/v1/projects/:id/transform-batch` with optional body `MigrateBatchRequest`.

**ASCII Wireframe:**
```
+---------------------------------------------------------------+
| <- Project / Batch Migration                                   |
|                              [Pause] [Resume] [Cancel]         |
+---------------------------------------------------------------+
|                                                                |
|  OVERALL PROGRESS                                              |
|  +----------------------------------------------------------+ |
|  | Migrating 4 files in dependency order...                  | |
|  | [======================>               ]  3/4  75%        | |
|  | Elapsed: 00:02:34    Est. remaining: 00:00:45             | |
|  +----------------------------------------------------------+ |
|                                                                |
|  FILE QUEUE                                                    |
|  +----------------------------------------------------------+ |
|  |  # | File                   | Status     | Transforms    | |
|  +----------------------------------------------------------+ |
|  |  1 | utils.py               | [DONE]     | 3 changes     | |
|  |    |                        | Tier 1     | Score: 0.95    | |
|  +----------------------------------------------------------+ |
|  |  2 | user_manager.py        | [DONE]     | 12 changes    | |
|  |    |                        | Tier 2     | Score: 0.82    | |
|  +----------------------------------------------------------+ |
|  |  3 | payment_processor.py   | [RUNNING]  | ...           | |
|  |    |                        | [=====>  ] |               | |
|  +----------------------------------------------------------+ |
|  |  4 | report_generator.py    | [PENDING]  |               | |
|  +----------------------------------------------------------+ |
|                                                                |
|  LIVE LOG (scrollable, auto-scroll to bottom)                  |
|  +----------------------------------------------------------+ |
|  | [12:34:01] Starting utils.py...                           | |
|  | [12:34:03] utils.py: 3 transformations (all Tier 1)       | |
|  | [12:34:03] utils.py: Generated 2 snapshot tests           | |
|  | [12:34:03] utils.py complete. Score: 0.95                 | |
|  | [12:34:04] Starting user_manager.py...                    | |
|  | [12:34:08] user_manager.py: 12 transformations            | |
|  | [12:34:08] user_manager.py complete. Score: 0.82          | |
|  | [12:34:09] Starting payment_processor.py...               | |
|  | [12:34:09] Applying deterministic rules...                | |
|  +----------------------------------------------------------+ |
|                                                                |
+---------------------------------------------------------------+
```

#### 2.5.1 Overall Progress Bar

**Component**: `<BatchProgressBar current={number} total={number} elapsed={number} />`

```html
<div class="cs-batch-progress">
  <div class="cs-batch-progress__header">
    <span>Migrating {total} files in dependency order...</span>
    <span>{current}/{total}  {Math.round(current/total*100)}%</span>
  </div>
  <div class="cs-progress-bar">
    <div class="cs-progress-bar__fill" style="width: {percentage}%"></div>
  </div>
  <div class="cs-batch-progress__footer">
    <span>Elapsed: {formatTime(elapsed)}</span>
    <span>Est. remaining: {formatTime(estimated)}</span>
  </div>
</div>
```

- `.cs-progress-bar`: `height: 8px`, `background: var(--surface-2)`, `border-radius: 4px`, `overflow: hidden`.
- `.cs-progress-bar__fill`: `height: 100%`, `background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))`, `border-radius: 4px`, `transition: width 0.5s ease`.
- At 100%: fill becomes `var(--success-400)` and a subtle pulse animation plays.

#### 2.5.2 File Queue Table

**Component**: `<FileQueueTable files={BatchFileStatus[]} />`

```typescript
interface BatchFileStatus {
  file_path: string;
  order: number;
  status: "pending" | "running" | "success" | "error";
  transformations?: number;
  overall_confidence?: number;
  overall_tier?: string;
  error?: string;
}
```

Each row status:
| Status | Icon | Row background |
|---|---|---|
| `pending` | `ClockIcon` (gray) | Default |
| `running` | `Spinner` (blue, animated) | `rgba(59, 130, 246, 0.05)` |
| `success` | `CheckCircleIcon` (green) | `rgba(34, 197, 94, 0.05)` |
| `error` | `XCircleIcon` (red) | `rgba(239, 68, 68, 0.05)` |

The `running` row also shows an inline progress bar (indeterminate shimmer animation since the API does not provide per-file progress granularity).

Clicking a completed row navigates to `/projects/:id/transform/{file_path}` to view the transformation details.

#### 2.5.3 Live Log Panel

**Component**: `<LiveLog entries={LogEntry[]} />`

```typescript
interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "success" | "error";
}
```

- Container: `max-height: 300px`, `overflow-y: auto`, `background: var(--surface-0)`, `font-family: var(--font-mono)`, `font-size: 12px`.
- Auto-scrolls to bottom as new entries arrive.
- Log entries are generated client-side based on API call lifecycle (request sent, response received, errors).

#### 2.5.4 Batch Controls

**Pause**: Stops sending new file transformation requests. Current in-flight request completes. `class="cs-btn cs-btn--outline"`.

**Resume**: Continues processing the queue from where it stopped. `class="cs-btn cs-btn--primary"`.

**Cancel**: Stops all processing and marks remaining files as skipped. Shows confirmation dialog first. `class="cs-btn cs-btn--outline cs-btn--danger"`.

Since the backend `POST /transform-batch` processes files sequentially in a single request, the client-side approach for pause/resume is to use individual `POST /transform/{file}` calls in sequence, allowing the queue to be interrupted between files.

---

## 3. Visual Design System

### 3.1 Color Palette

**Dark mode is the default.** A light mode toggle is available but dark mode is the primary design target (code-focused product for developers).

#### 3.1.1 Core Palette (Dark Mode)

```css
:root {
  /* -- Surfaces (darkest to lightest) -- */
  --surface-0: #0F1117;          /* App background */
  --surface-1: #161925;          /* Cards, panels */
  --surface-2: #1E2233;          /* Elevated elements, inputs */
  --surface-3: #262B3D;          /* Hover states */
  --surface-active: #2A2F44;     /* Active/selected states */

  /* -- Text -- */
  --text-primary: #F1F5F9;       /* Primary text (slate-100) */
  --text-secondary: #94A3B8;     /* Secondary text (slate-400) */
  --text-tertiary: #64748B;      /* Muted text (slate-500) */
  --text-inverse: #0F172A;       /* Text on light backgrounds */

  /* -- Borders -- */
  --border-subtle: #2A2F44;      /* Default borders */
  --border-muted: #1E2233;       /* Very subtle dividers */
  --border-focus: #6366F1;       /* Focus rings */

  /* -- Accent (Indigo) -- */
  --accent-primary: #6366F1;     /* Primary action color */
  --accent-secondary: #818CF8;   /* Lighter accent */
  --accent-muted: #312E81;       /* Accent background */

  /* -- Semantic -- */
  --success-400: #4ADE80;
  --success-500: #22C55E;
  --success-bg: rgba(34, 197, 94, 0.1);

  --warning-400: #FBBF24;
  --warning-500: #F59E0B;
  --warning-bg: rgba(245, 158, 11, 0.1);

  --danger-400: #F87171;
  --danger-500: #EF4444;
  --danger-bg: rgba(239, 68, 68, 0.1);

  --info-400: #60A5FA;
  --info-500: #3B82F6;
  --info-bg: rgba(59, 130, 246, 0.1);
}
```

#### 3.1.2 Core Palette (Light Mode)

```css
[data-theme="light"] {
  --surface-0: #FFFFFF;
  --surface-1: #F8FAFC;
  --surface-2: #F1F5F9;
  --surface-3: #E2E8F0;
  --surface-active: #DBEAFE;

  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;

  --border-subtle: #E2E8F0;
  --border-muted: #F1F5F9;
}
```

#### 3.1.3 Confidence Tier Colors

These are the most important colors in the application. Used consistently everywhere a confidence tier appears.

```css
:root {
  /* Tier 1: Auto-apply (Green) */
  --tier-1-fg: #22C55E;
  --tier-1-bg: rgba(34, 197, 94, 0.12);
  --tier-1-border: rgba(34, 197, 94, 0.3);

  /* Tier 2: Spot-check (Blue) */
  --tier-2-fg: #3B82F6;
  --tier-2-bg: rgba(59, 130, 246, 0.12);
  --tier-2-border: rgba(59, 130, 246, 0.3);

  /* Tier 3: Review required (Orange) */
  --tier-3-fg: #F97316;
  --tier-3-bg: rgba(249, 115, 22, 0.12);
  --tier-3-border: rgba(249, 115, 22, 0.3);

  /* Tier 4: Manual only (Red) */
  --tier-4-fg: #EF4444;
  --tier-4-bg: rgba(239, 68, 68, 0.12);
  --tier-4-border: rgba(239, 68, 68, 0.3);
}
```

#### 3.1.4 Risk Level Colors

```css
:root {
  --risk-low: #10B981;
  --risk-medium: #F59E0B;
  --risk-high: #EF4444;
  --risk-critical: #DC2626;
}
```

### 3.2 Typography Scale

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;

  /* Scale (based on 1.25 ratio) */
  --text-xs:   0.75rem;    /* 12px - labels, badges */
  --text-sm:   0.875rem;   /* 14px - secondary text, table cells */
  --text-base: 1rem;       /* 16px - body text */
  --text-lg:   1.125rem;   /* 18px - section headers */
  --text-xl:   1.25rem;    /* 20px - card titles */
  --text-2xl:  1.5rem;     /* 24px - page titles */
  --text-3xl:  1.875rem;   /* 30px - hero numbers */
  --text-4xl:  2.25rem;    /* 36px - stat counters */

  /* Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

**Usage rules:**
- Page titles: `--text-2xl`, `--font-bold`
- Card titles: `--text-xl`, `--font-semibold`
- Body text: `--text-base`, `--font-normal`
- Code: `--font-mono`, `--text-sm`
- Labels/badges: `--text-xs`, `--font-medium`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- Stat counters: `--text-4xl`, `--font-bold`, `font-variant-numeric: tabular-nums`

### 3.3 Component Library

#### 3.3.1 Buttons

```css
.cs-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all 0.15s ease;
  cursor: pointer;
  border: 1px solid transparent;
}

/* Variants */
.cs-btn--primary {
  background: var(--accent-primary);
  color: white;
}
.cs-btn--primary:hover {
  background: #5558E6;      /* slightly darker */
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}

.cs-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.cs-btn--ghost:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.cs-btn--outline {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.cs-btn--success {
  background: var(--success-500);
  color: white;
}

.cs-btn--danger, .cs-btn--outline.cs-btn--danger {
  color: var(--danger-400);
  border-color: var(--danger-400);
}

/* Sizes */
.cs-btn--xs  { padding: 4px 8px;   font-size: var(--text-xs); }
.cs-btn--sm  { padding: 6px 12px;  font-size: var(--text-xs); }
.cs-btn--lg  { padding: 12px 24px; font-size: var(--text-base); }

.cs-btn--icon {
  padding: 8px;
  border-radius: 6px;
}
```

#### 3.3.2 Cards

```css
.cs-card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px;
}
.cs-card--hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.cs-card__title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: 8px;
}
.cs-card__subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

#### 3.3.3 Badges

```css
.cs-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* Risk badges */
.cs-badge--low      { background: rgba(16, 185, 129, 0.15); color: #6EE7B7; }
.cs-badge--medium   { background: rgba(245, 158, 11, 0.15); color: #FCD34D; }
.cs-badge--high     { background: rgba(239, 68, 68, 0.15);  color: #FCA5A5; }
.cs-badge--critical { background: rgba(220, 38, 38, 0.15);  color: #FCA5A5; border: 1px solid rgba(220, 38, 38, 0.3); }

/* Tier badges */
.cs-badge--tier1 { background: var(--tier-1-bg); color: var(--tier-1-fg); border: 1px solid var(--tier-1-border); }
.cs-badge--tier2 { background: var(--tier-2-bg); color: var(--tier-2-fg); border: 1px solid var(--tier-2-border); }
.cs-badge--tier3 { background: var(--tier-3-bg); color: var(--tier-3-fg); border: 1px solid var(--tier-3-border); }
.cs-badge--tier4 { background: var(--tier-4-bg); color: var(--tier-4-fg); border: 1px solid var(--tier-4-border); }

/* Status badges */
.cs-badge--pending     { background: #374151; color: #9CA3AF; }
.cs-badge--analyzing   { background: #1E3A5F; color: #60A5FA; animation: cs-pulse 2s infinite; }
.cs-badge--ready       { background: #14532D; color: #4ADE80; }
.cs-badge--in_progress { background: #78350F; color: #FBBF24; }
.cs-badge--completed   { background: #064E3B; color: #10B981; }
.cs-badge--failed      { background: #7F1D1D; color: #EF4444; }
```

#### 3.3.4 Code Blocks

```css
.cs-code-block {
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  tab-size: 4;
}
.cs-code-block code {
  color: var(--text-primary);
}
.cs-code-block--inline {
  display: inline;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
```

#### 3.3.5 Inputs and Forms

```css
.cs-input, .cs-textarea, .cs-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cs-input:focus, .cs-textarea:focus, .cs-select:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}
.cs-input::placeholder {
  color: var(--text-tertiary);
}
.cs-textarea {
  resize: vertical;
  min-height: 72px;
}
```

#### 3.3.6 Tabs

```css
.cs-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 24px;
}
.cs-tab {
  padding: 12px 24px;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}
.cs-tab:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
.cs-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
}
```

### 3.4 Monaco Editor Custom Theme

```javascript
monaco.editor.defineTheme("codeshift-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6A737D" },
    { token: "keyword", foreground: "C792EA" },
    { token: "string", foreground: "C3E88D" },
    { token: "number", foreground: "F78C6C" },
    { token: "function", foreground: "82AAFF" },
    { token: "variable", foreground: "F1F5F9" },
    { token: "type", foreground: "FFCB6B" },
    { token: "operator", foreground: "89DDFF" },
  ],
  colors: {
    "editor.background": "#0F1117",
    "editor.foreground": "#F1F5F9",
    "editor.lineHighlightBackground": "#1E223310",
    "editorLineNumber.foreground": "#4A5568",
    "editorLineNumber.activeForeground": "#94A3B8",
    "editor.selectionBackground": "#6366F140",
    "editorGutter.background": "#0F1117",
  },
});
```

### 3.5 Spacing System

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 3.6 Shadow System

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.3);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.3);  /* accent glow */
}
```

---

## 4. Interactive Elements

### 4.1 Dependency Graph (D3.js)

**Library**: D3.js v7 (`d3-force`, `d3-selection`, `d3-zoom`, `d3-drag`, `d3-scale`, `d3-transition`).

**Full implementation spec:**

```typescript
// Graph data transformation from API response
function buildGraphData(depGraph: Record<string, DependencyNode>) {
  const nodes = Object.values(depGraph).map(node => ({
    id: node.file_path,
    label: node.file_path.split("/").pop(),
    migrationOrder: node.migration_order,
    importCount: node.imports.length,
    dependentCount: node.imported_by.length,
    externalDeps: node.external_deps,
  }));

  const edges = Object.values(depGraph).flatMap(node =>
    node.imports.map(imp => ({
      source: node.file_path,
      target: imp,
    }))
  );

  return { nodes, edges };
}
```

**Interaction events:**
- `node:click` -- Select node, show detail sidebar, highlight connected edges.
- `node:dblclick` -- Navigate to `/projects/:id/transform/{file_path}`.
- `node:hover` -- Show tooltip, dim unconnected nodes.
- `edge:hover` -- Highlight edge and connected nodes.
- `background:click` -- Deselect all.
- `zoom` -- `d3.zoom()` with wheel and pinch.
- `drag` -- `d3.drag()` on nodes.

**Migration order animation sequence:**
1. All nodes start at 50% opacity with gray fill.
2. On "Play" button click, iterate through `migration_order` values 0, 1, 2, ...
3. For each step, the node transitions: `opacity: 1`, fill animates to its final color, `transform: scale(1.2)` then `scale(1.0)` (pop effect, 300ms).
4. Connected edges from completed nodes light up with a directional animation (stroke-dasharray + dashoffset animated).
5. 600ms delay between each step.
6. Sound effect: optional subtle "ping" on each node activation (Web Audio API, user can mute).

### 4.2 Code Diff (Monaco Editor)

**Library**: `@monaco-editor/react` v4.x

**Configuration for the split-pane view:**

The Transformation View uses two independent Monaco editor instances (not the built-in diff editor) for maximum control over decorations and inline widgets.

**Left editor** (original code): Read-only. Shows the full original source file. Transformation lines get background decorations and gutter icons.

**Right editor** (transformed code): Read-only. Shows the source with deterministic (Tier 1) transformations applied. Semantic (Tier 2-4) changes are shown as additional decorations.

**Scroll synchronization:**
```typescript
useEffect(() => {
  const leftEditor = leftEditorRef.current;
  const rightEditor = rightEditorRef.current;
  if (!leftEditor || !rightEditor) return;

  const disposable = leftEditor.onDidScrollChange((e) => {
    rightEditor.setScrollTop(e.scrollTop);
    rightEditor.setScrollLeft(e.scrollLeft);
  });

  return () => disposable.dispose();
}, []);
```

**Inline transformation widget** (rendered inside the editor gutter):
Using Monaco's `IContentWidget` interface to place React-rendered approve/reject buttons at transformation line positions.

### 4.3 Charts (Recharts)

**Library**: Recharts v2.x

**Common chart configuration:**
```typescript
const CHART_THEME = {
  fontFamily: "Inter, sans-serif",
  fontSize: 12,
  textColor: "#94A3B8",
  gridColor: "#2A2F44",
  tooltipBg: "#1E2233",
  tooltipBorder: "#2A2F44",
};
```

**Custom tooltip component** (shared across all charts):
```jsx
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="cs-chart-tooltip">
      <span className="cs-chart-tooltip__label">{label}</span>
      {payload.map(p => (
        <span key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </span>
      ))}
    </div>
  );
};
```

Charts used:
| Chart | Type | Component | Data Source |
|---|---|---|---|
| Risk Distribution | Horizontal Bar | `<BarChart layout="vertical">` | `dashboard.risk_distribution` |
| Confidence Distribution | Donut | `<PieChart>` with `innerRadius` | `dashboard.confidence_distribution` |
| Migration Velocity | Area Line | `<AreaChart>` | Client-side tracked |
| Progress Ring | Custom SVG | Custom `<ProgressRing>` | `dashboard.migration_percentage` |

### 4.4 Animations

**Count-up animation** (for stat counters):
```typescript
function useCountUp(target: number, duration: number = 1500): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);  // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return value;
}
```

**File migration completion effect**: When a file in the batch queue transitions from `running` to `success`, the row does:
1. A brief green flash (`background: rgba(34, 197, 94, 0.2)` -> fade out, 400ms).
2. The status icon morphs from spinner to checkmark with a scale pop.
3. The overall progress bar fill width updates with a smooth transition.

**Pulse animation** (for "analyzing" status):
```css
@keyframes cs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**Shimmer animation** (for loading states):
```css
@keyframes cs-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.cs-skeleton {
  background: linear-gradient(90deg,
    var(--surface-2) 25%,
    var(--surface-3) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: cs-shimmer 1.5s infinite;
  border-radius: 6px;
}
```

---

## 5. Responsive Behavior

### 5.1 Breakpoints

```css
/* Desktop-first approach */
--bp-desktop-lg: 1440px;    /* Primary design target */
--bp-desktop:    1280px;     /* Standard desktop */
--bp-desktop-sm: 1024px;    /* Minimum supported desktop */
--bp-tablet:     768px;      /* Tablet */
--bp-mobile:     480px;      /* Mobile */
```

### 5.2 Desktop (1440px -- Primary)

Full layout as described in all wireframes above. Three-column project grid. Full split-pane diff view. Side-by-side charts on dashboard.

### 5.3 Desktop Small (1024px)

- Project grid: 2 columns.
- Sidebar: Collapsed to icon-only mode (64px) by default, expandable on hover/click.
- Dashboard charts: Stack vertically instead of 2-column grid.
- Transformation View split pane: Both panes narrower but still side-by-side; horizontal scroll for long lines.
- Content padding: Reduced from 32px to 24px.

### 5.4 Tablet (768px)

- Project grid: 1 column (full-width cards).
- Sidebar: Hidden by default, accessible via hamburger menu (slide-over overlay).
- Transformation View: Tabs instead of split pane. `[Original]` and `[Migrated]` tabs above a single editor.
- Dashboard: All metric cards stack in 2x2 grid, charts stack vertically, full width.
- File upload zone: Simplified (no drag-and-drop messaging, just the click area).

### 5.5 Mobile (480px)

**Read-only dashboard view.** Transformation and batch migration pages show a message: "Use a desktop browser for code transformation features."

- Projects list: Compact card format, 1 column.
- Dashboard: Metric cards stack 1 column, simplified charts (numbers only, no charts), checklist is scrollable list.
- Navigation: Bottom tab bar instead of sidebar.
- No code editors, no diff views.

---

## 6. Key User Flows

### 6.1 Flow 1: New Project Creation through Migration

```
Step 1: User lands on "/"
        Sees project grid (empty state if first visit).
        Clicks "+ New Project" button or ghost card.

Step 2: Create Project Modal appears
        User enters: "Payment Service", "Legacy payment processing module"
        Source: Python 2, Target: Python 3
        Clicks "Create Project"
        API: POST /api/v1/projects
        On success: Redirect to /projects/:id

Step 3: Project Detail page loads
        File upload zone is prominently displayed (empty state).
        User drags .py files onto the upload zone.
        API: POST /api/v1/projects/:id/files (multipart)
        Upload progress shown per file.
        File list populates below the upload zone.

Step 4: User clicks "Analyze"
        API: POST /api/v1/projects/:id/analyze
        Loading state: Spinner on button, indeterminate progress bar.
        Takes 2-10 seconds depending on codebase size.
        On complete: Analysis tabs appear below.

Step 5: User reviews analysis results
        Tab 1: Dead Code -- sees 247 lines identified, expands to review.
        Tab 2: Dependencies -- explores interactive graph, understands migration order.
        Tab 3: Risk Map -- sees which files are high risk.
        Tab 4: Migration Plan -- sees recommended order.

Step 6: User clicks "Transform Now" on first file in migration plan
        Navigates to /projects/:id/transform/utils.py
        API: POST /api/v1/projects/:id/transform/utils.py
        Loading: Skeleton shimmer over the code areas.
        Results appear: split-pane diff with highlighted transformations.

Step 7: User reviews transformations
        Scans Tier 1 (green) changes -- all safe syntax fixes.
        Clicks "Batch Approve Tier 1" -- all 8 syntax changes approved.
        Reviews Tier 2 (blue) change -- clicks on it, reads reasoning.
        Approves it. No Tier 3 or 4 for this file.

Step 8: User returns to project page, clicks "Migrate All in Order"
        Navigates to /projects/:id/batch
        Batch migration starts automatically.
        Watches files process one by one in the queue.

Step 9: User navigates to Dashboard
        /projects/:id/dashboard
        Sees 100% progress ring.
        Sees 247 dead code lines eliminated.
        Sees estimated $1,852 in developer time saved.
        Views risk distribution -- all green post-migration.
```

### 6.2 Flow 2: Dashboard Monitoring During Batch Migration

```
Step 1: User has started a batch migration on /projects/:id/batch
        3 of 8 files complete, 1 in progress.

Step 2: User opens dashboard in a new tab: /projects/:id/dashboard
        Dashboard loads with current state via GET /api/v1/projects/:id/dashboard.
        Progress ring shows 37.5% (3/8 files).
        Confidence distribution shows tiers from completed files.
        Risk distribution reflects all files.

Step 3: User polls/refreshes dashboard periodically
        (Auto-refresh every 10 seconds via setInterval + React Query refetchInterval)
        Progress ring animates from 37.5% to 50% as file 4 completes.
        Counter values animate up.
        Recent transformations feed updates with new entries.

Step 4: Batch completes
        Progress ring reaches 100% with completion animation.
        Migration velocity chart shows spike on current day.
        Blocker list is empty -- green "No blockers" state.
        "Money saved" counter finishes at full amount.
```

### 6.3 Flow 3: Reviewing and Approving Individual Transformations

```
Step 1: User navigates to /projects/:id/transform/payment_processor.py
        Transformation View loads.
        Summary bar shows: T1: 6, T2: 2, T3: 1, T4: 0
        Overall Tier: TIER 3 (worst tier wins).

Step 2: User scrolls through the diff
        Green highlighted lines (Tier 1) are clearly safe.
        User clicks "Batch Approve Tier 1 (6)" button.
        All 6 green blocks get checkmark overlays.

Step 3: User clicks on a blue (Tier 2) highlighted section
        The Transformation Detail panel slides open below.
        Shows: "filter() returns an iterator in Python 3, may need list() wrapper"
        Confidence: 0.75
        User reads the reasoning, agrees.
        Clicks "Approve".

Step 4: User encounters the orange (Tier 3) transformation
        Shows: "Integer division / changed to true division in Python 3. This
                expression active_pct = active * 100 / total may produce float
                results instead of int."
        Confidence: 0.52
        Reasoning: "The calculation appears to expect integer result. Consider
                    using // operator."
        User clicks "Edit Manually" -- an inline editor opens.
        User changes "/" to "//".
        User clicks "Save & Approve".

Step 5: All transformations reviewed
        Summary bar shows all approved (green checkmarks).
        User scrolls down to Snapshot Tests panel.
        Reviews the 4 generated tests -- they cover the critical functions.
        Closes the panel.

Step 6: User navigates back to project page or dashboard
        The file shows as migrated in all views.
```

---

## 7. "Wow Factor" Elements for Hackathon Demo

### 7.1 Animated Dependency Graph with Migration Order Playback

**Location**: Analysis Page, Dependencies tab.

A "Play Migration" button appears above the graph. When clicked:
- All nodes desaturate and fade to 40% opacity.
- A timeline scrubber appears at the bottom of the graph area.
- Nodes activate in `migration_order` sequence (0 first, then 1, then 2...).
- Each activation: the node pops to full color with a `scale(1.15) -> scale(1.0)` transition, a subtle radial glow effect (`box-shadow: 0 0 20px {tier-color}`), and edges from the activated node to already-activated nodes highlight in the accent color with a directional stroke-dasharray animation (flowing from source to target).
- A counter in the corner shows "Step {n} of {total}".
- When complete, all nodes are fully colored and a "Migration order visualization complete" toast appears.

### 7.2 Live Transformation Counter

**Location**: AppHeader (always visible when a project is active).

A compact counter in the header that updates in real-time during batch migration:

```html
<div class="cs-live-counter">
  <span class="cs-live-counter__label">Transformations</span>
  <span class="cs-live-counter__value">{count}</span>
</div>
```

The counter uses the count-up animation and pulses briefly (glow effect) each time the value changes. During active migration, the counter has a subtle breathing animation with the accent color glow.

### 7.3 Side-by-Side Before/After with Smooth Transitions

**Location**: Transformation View.

When a user approves a transformation:
1. The left-side (original) highlighted block fades to 30% opacity over 300ms.
2. The right-side (transformed) block gets a brief green border flash (150ms).
3. A small particle effect (3-5 tiny green dots) radiates from the approve button.
4. The tier badge for that transformation changes from its tier color to a solid green "Approved" badge with a smooth morph transition.

When a user rejects a transformation:
1. The right-side transformed code cross-fades back to the original code (400ms).
2. The highlight on both sides fades to a desaturated red-gray.
3. A subtle "undo" icon appears on the block so the user can reverse.

### 7.4 Risk-to-Confidence Pipeline Visualization

**Location**: Dashboard page, below the main charts.

A horizontal "pipeline" diagram showing the flow from risk assessment to confidence tiers:

```
+---------------------------------------------------------------+
|  MIGRATION PIPELINE                                            |
|                                                                |
|  [Risk Assessment]  -->  [AI Analysis]  -->  [Confidence Tier] |
|                                                                |
|  9 files scanned        15 transforms        T1: 12 (60%)     |
|    2 high risk          identified            T2:  5 (25%)     |
|    3 medium                                   T3:  2 (10%)     |
|    4 low                                      T4:  1  (5%)     |
|                                                                |
|  [colored dots flow     [spinning gear       [color-coded      |
|   left to right]         animation]           funneling]       |
+---------------------------------------------------------------+
```

Implementation: Three connected SVG circles with animated dots (small circles) flowing along curved paths between them. The dots are colored by their risk level on the left and transition to their confidence tier color on the right. Uses `<animate>` SVG elements for the flowing motion. Speed increases when batch migration is active.

### 7.5 "Money Saved" Calculator

**Location**: Dashboard, top metrics row (card 4).

Displays estimated developer cost savings from dead code removal and automated migration.

**Formula:**
```typescript
const deadCodeHoursSaved = deadCodeLines / LINES_PER_HOUR;  // default: 10
const migrationHoursSaved = totalTransformations * MINUTES_PER_MANUAL_TRANSFORM / 60; // default: 15 min
const totalHoursSaved = deadCodeHoursSaved + migrationHoursSaved;
const moneySaved = totalHoursSaved * HOURLY_RATE;  // default: $75

// Display: "$18,700 saved"
// Subtitle: "~249 developer hours eliminated"
```

The dollar value uses a slot-machine style counter animation: each digit rolls down individually, creating a mechanical feeling. The entire card has a golden gradient border: `border-image: linear-gradient(135deg, #FBBF24, #F59E0B, #D97706) 1`.

**Configuration popover** (accessible via gear icon):
| Setting | Default | Input |
|---|---|---|
| Lines per hour | 10 | Number input |
| Minutes per manual transform | 15 | Number input |
| Developer hourly rate | $75 | Number input with currency |

### 7.6 Completion Celebration

When a project reaches 100% migration:

1. The progress ring fills completely with a pulse effect.
2. Canvas confetti (using `canvas-confetti` library) fires from the center of the ring.
3. A full-width banner slides down: "Migration Complete! {project_name} has been fully migrated from Python 2 to Python 3."
4. The banner has a gradient background: `linear-gradient(135deg, var(--success-500), var(--accent-primary))`.
5. Stats appear in the banner: "{N} files migrated, {M} dead code lines removed, {T} transformations applied".
6. A "View Final Report" button in the banner generates a summary export (JSON or PDF).

---

## Appendix A: API-to-Component Data Flow Matrix

| API Endpoint | Method | Response Type | Primary Component | Secondary Components |
|---|---|---|---|---|
| `/projects` | GET | `ProjectResponse[]` | `ProjectsPage` | `ProjectCard`, `QuickStatsBar` |
| `/projects` | POST | `ProjectResponse` | `CreateProjectModal` | -- |
| `/projects/:id` | GET | `ProjectResponse` | `ProjectDetailPage` | `ProjectHeader`, `StatusBadge` |
| `/projects/:id/files` | POST | `{ uploaded, files }` | `FileUploadZone` | `FileList` |
| `/projects/:id/analyze` | POST | `AnalysisResponse` | `AnalysisTabs` | `DeadCodePanel`, `DependencyGraph`, `RiskHeatMap`, `MigrationPlan` |
| `/projects/:id/transform/:file` | POST | `FileTransformationResponse` | `TransformationView` | `CodeDiffView`, `TransformationDetail`, `SnapshotTestsPanel` |
| `/projects/:id/transform-batch` | POST | `{ project_id, processed, results }` | `BatchMigrationPage` | `BatchProgressBar`, `FileQueueTable`, `LiveLog` |
| `/projects/:id/dashboard` | GET | `DashboardResponse` | `MigrationDashboard` | `ProgressRing`, `RiskDistributionChart`, `ConfidenceDistributionChart`, `MigrationChecklist`, `BlockersPanel`, `RecentTransformations`, `MoneySavedCalculator` |
| `/health` | GET | `HealthResponse` | `AppHeader` (status dot) | -- |

## Appendix B: TypeScript Type Definitions

These mirror the Pydantic models from `/Users/paulaldea/git/code-analysis/app/models/schemas.py`:

```typescript
// Enums
type MigrationStatus = "pending" | "analyzing" | "ready" | "in_progress" | "completed" | "failed";
type ConfidenceTier = "tier_1_auto_apply" | "tier_2_spot_check" | "tier_3_review_required" | "tier_4_manual_only";
type RiskLevel = "low" | "medium" | "high" | "critical";

// Domain models
interface DeadCodeItem {
  file_path: string;
  name: string;
  kind: "function" | "class" | "import" | "variable";
  line_start: number;
  line_end: number;
  reason: string;
  lines_saved: number;
}

interface DependencyNode {
  file_path: string;
  imports: string[];
  imported_by: string[];
  external_deps: string[];
  migration_order: number | null;
}

interface RiskAssessment {
  file_path: string;
  risk_level: RiskLevel;
  risk_score: number;
  factors: string[];
  test_coverage_estimate: string;
  semantic_complexity: string;
  recommended_tier: ConfidenceTier;
}

interface Transformation {
  id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  original_code: string;
  transformed_code: string;
  confidence_tier: ConfidenceTier;
  confidence_score: number;
  reasoning: string;
  change_type: "syntax" | "semantic" | "api_change" | "behavioral";
  requires_test: boolean;
}

interface SnapshotTest {
  file_path: string;
  test_name: string;
  test_code: string;
  covers_functions: string[];
}

interface MigrationPlanStep {
  order: number;
  file_path: string;
  risk_level: RiskLevel;
  estimated_transformations: number;
  dependencies: string[];
  blocking: string[];
}

// Request types
interface ProjectCreate {
  name: string;
  description?: string;
  source_language?: string;   // default: "python2"
  target_language?: string;   // default: "python3"
}

interface MigrateBatchRequest {
  project_id: string;
  file_paths?: string[] | null;
}

// Response types
interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  source_language: string;
  target_language: string;
  status: MigrationStatus;
  created_at: string;
  file_count: number;
  total_lines: number;
  dead_code_lines: number;
  migrated_files: number;
}

interface AnalysisResponse {
  project_id: string;
  total_files: number;
  total_lines: number;
  dead_code: DeadCodeItem[];
  dead_code_lines: number;
  dead_code_percentage: number;
  dependency_graph: Record<string, DependencyNode>;
  risk_assessment: RiskAssessment[];
  migration_plan: MigrationPlanStep[];
  summary: string;
}

interface FileTransformationResponse {
  project_id: string;
  file_path: string;
  transformations: Transformation[];
  snapshot_tests: SnapshotTest[];
  overall_confidence: number;
  overall_tier: ConfidenceTier;
  original_lines: number;
  transformed_lines: number;
}

interface DashboardResponse {
  project_id: string;
  project_name: string;
  status: MigrationStatus;
  total_files: number;
  migrated_files: number;
  migration_percentage: number;
  total_lines: number;
  dead_code_lines: number;
  lines_after_cleanup: number;
  risk_distribution: Record<string, number>;
  confidence_distribution: Record<string, number>;
  migration_plan: MigrationPlanStep[];
  blockers: string[];
  recent_transformations: Transformation[];
}

interface HealthResponse {
  status: string;
  version: string;
  features: string[];
}
```

## Appendix C: Recommended Tech Stack

| Category | Library | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.x | UI framework |
| Language | TypeScript | 5.x | Type safety |
| Routing | React Router | 6.x | Client-side routing |
| Styling | Tailwind CSS | 3.x | Utility-first CSS (supplement with custom CSS vars above) |
| State/Data | TanStack Query | 5.x | Server state management, caching, refetching |
| Local State | Zustand | 4.x | Client-side state (approval statuses, UI preferences) |
| Code Editor | Monaco Editor | `@monaco-editor/react` 4.x | Code diff display |
| Charts | Recharts | 2.x | Bar, pie, area charts |
| Graph | D3.js | 7.x | Dependency graph visualization |
| Icons | Lucide React | latest | Consistent icon set |
| Animations | Framer Motion | 11.x | Page transitions, layout animations |
| Confetti | canvas-confetti | 1.x | Completion celebration |
| HTTP | Axios or fetch | -- | API calls (TanStack Query wraps this) |
| Build | Vite | 5.x | Fast development and production builds |

## Appendix D: File Structure for Frontend Project

```
src/
  App.tsx
  main.tsx
  index.css                         -- Tailwind base + custom CSS vars
  api/
    client.ts                       -- Axios/fetch instance with base URL
    projects.ts                     -- API functions for project endpoints
    analysis.ts                     -- API functions for analysis endpoints
    transformation.ts               -- API functions for transformation endpoints
    dashboard.ts                    -- API functions for dashboard endpoints
  types/
    index.ts                        -- All TypeScript interfaces (Appendix B)
  hooks/
    useCountUp.ts                   -- Animated counter hook
    useScrollSync.ts                -- Monaco editor scroll sync hook
    useAutoRefresh.ts               -- Dashboard polling hook
  pages/
    ProjectsPage.tsx                -- "/"
    ProjectDetailPage.tsx           -- "/projects/:id"
    TransformationView.tsx          -- "/projects/:id/transform/:filePath"
    BatchMigrationPage.tsx          -- "/projects/:id/batch"
    MigrationDashboard.tsx          -- "/projects/:id/dashboard"
  components/
    layout/
      AppHeader.tsx
      Sidebar.tsx
      StatusBar.tsx
      PageHeader.tsx
    common/
      Button.tsx                    -- cs-btn variants
      Badge.tsx                     -- cs-badge variants
      Card.tsx                      -- cs-card
      StatCard.tsx                  -- Animated stat card
      Modal.tsx                     -- Modal overlay
      Tabs.tsx                      -- cs-tabs
      ProgressBar.tsx               -- cs-progress-bar
      Spinner.tsx
      Skeleton.tsx                  -- Loading shimmer
    projects/
      ProjectCard.tsx
      CreateProjectModal.tsx
      QuickStatsBar.tsx
    analysis/
      AnalysisTabs.tsx
      DeadCodePanel.tsx
      DependencyGraph.tsx           -- D3 force graph
      RiskHeatMap.tsx
      MigrationPlan.tsx
    transformation/
      CodeDiffView.tsx              -- Dual Monaco editors
      TransformationSummaryBar.tsx
      TransformationDetail.tsx
      TransformationActions.tsx     -- Approve/reject inline controls
      SnapshotTestsPanel.tsx
      SnapshotTestCard.tsx
    batch/
      BatchProgressBar.tsx
      FileQueueTable.tsx
      LiveLog.tsx
    dashboard/
      ProgressRing.tsx
      RiskDistributionChart.tsx
      ConfidenceDistributionChart.tsx
      MigrationVelocityChart.tsx
      MigrationChecklist.tsx
      BlockersPanel.tsx
      RecentTransformations.tsx
      MoneySavedCalculator.tsx
      MigrationPipeline.tsx         -- Wow factor pipeline viz
  stores/
    transformationStore.ts          -- Zustand store for approval states
    uiStore.ts                      -- Theme, sidebar collapsed state
  utils/
    formatters.ts                   -- Time, number, file size formatting
    tierColors.ts                   -- Tier/risk color lookup maps
```

---

This specification covers every page, every component, every data binding point to the backend API, and every visual detail needed for a frontend developer to build the CodeShift AI frontend. The design system is internally consistent -- confidence tier colors and risk level colors propagate identically across the dependency graph, the transformation view, the dashboard charts, and all badge components. The "wow factor" elements (animated dependency graph playback, live transformation counter, money saved calculator, completion confetti) are designed to make a hackathon demo memorable while the core user flows (upload -> analyze -> review -> migrate) remain straightforward and efficient.