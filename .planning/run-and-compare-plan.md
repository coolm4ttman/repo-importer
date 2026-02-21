# Plan: Run & Compare — Behavioral Equivalence Verification

## Goal
After migrating Python 2 → Python 3, let users run both versions and compare stdout/stderr/exit codes to verify behavioral equivalence.

## Architecture

```
New files:
  app/services/code_executor.py      — subprocess runner with resource limits + timeout
  app/services/output_comparator.py  — diff stdout/stderr, score similarity
  frontend/src/pages/RunComparePage.tsx — side-by-side results UI

Modified files:
  app/core/config.py                 — execution settings (timeout, memory, python paths)
  app/models/schemas.py              — ExecutionResult, RunCompareRequest/Response models
  app/services/project_manager.py    — run_and_compare() orchestrator method
  app/api/routes.py                  — POST /projects/{id}/run-compare/{file_path}
  frontend/src/api/types.ts          — TypeScript types for execution results
  frontend/src/api/client.ts         — runAndCompare() client method
  frontend/src/App.tsx               — route for /projects/:id/run-compare/*
```

---

## Step 1 — Backend: Config + Models

### `app/core/config.py`
Add to Settings dataclass:
```python
code_execution_timeout: int = field(
    default_factory=lambda: int(os.getenv("CODE_EXECUTION_TIMEOUT", "30"))
)
code_execution_memory_mb: int = field(
    default_factory=lambda: int(os.getenv("CODE_EXECUTION_MEMORY_MB", "256"))
)
python2_path: str = field(
    default_factory=lambda: os.getenv("PYTHON2_PATH", "python2")
)
python3_path: str = field(
    default_factory=lambda: os.getenv("PYTHON3_PATH", "python3")
)
max_output_bytes: int = field(
    default_factory=lambda: int(os.getenv("MAX_OUTPUT_BYTES", str(10 * 1024 * 1024)))
)
```

### `app/models/schemas.py`
```python
class RunCompareRequest(BaseModel):
    timeout_seconds: int = 30
    stdin_input: str | None = None

class ExecutionResult(BaseModel):
    exit_code: int | None
    stdout: str
    stderr: str
    execution_time_ms: float
    timed_out: bool
    truncated: bool  # if output exceeded max_output_bytes

class RunCompareResponse(BaseModel):
    project_id: str
    file_path: str
    py2: ExecutionResult
    py3: ExecutionResult
    outputs_match: bool
    exit_codes_match: bool
    diff_lines: list[str]       # unified diff of stdout
    similarity_pct: float       # 0-100
    warnings: list[str]
```

---

## Step 2 — Backend: Code Executor Service

### `app/services/code_executor.py`

Core function:
```python
async def execute_python(
    code_path: Path,
    interpreter: str,       # "python2" or "python3"
    timeout: int = 30,
    memory_mb: int = 256,
    stdin_input: str | None = None,
    max_output: int = 10_485_760,
) -> ExecutionResult:
```

Implementation details:
- Use `asyncio.create_subprocess_exec` for non-blocking execution
- Set `preexec_fn` with `resource.setrlimit` for RLIMIT_CPU
- **macOS fix**: RLIMIT_AS fails on macOS — only use RLIMIT_CPU on Darwin, use both RLIMIT_CPU + RLIMIT_AS on Linux (platform.system() check)
- Capture stdout/stderr via PIPE
- Truncate output if > max_output_bytes, set `truncated=True`
- On `asyncio.TimeoutError`: kill process group (`os.killpg`) not just process, return partial output + `timed_out=True`
- Use `start_new_session=True` so child processes are in their own process group for clean cleanup
- Run code in a **temp directory copy** (copy the project's `source/` or `migrated/` dir so imports between files work)
- Set `cwd` to the temp dir so relative imports resolve
- Use `tempfile.TemporaryDirectory()` context manager for automatic cleanup

Security measures:
- **Sanitize env vars**: pass explicit `env` dict with only `PATH`, `HOME`, `LANG`, `PYTHONPATH` — strip `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`
- CPU limits via `resource` module
- Timeout via asyncio
- Temp dir cleaned up via context manager (even on crash)
- No network isolation (MVP — document as limitation)

### Interpreter availability check
Add a utility function `check_interpreter(path: str) -> bool` that runs `{interpreter} --version` and returns True/False. Call this before execution and return a clear error if Python 2 is not installed.

---

## Step 3 — Backend: Output Comparator

### `app/services/output_comparator.py`

```python
def compare_outputs(py2: ExecutionResult, py3: ExecutionResult) -> dict:
    # Returns: outputs_match, diff_lines, similarity_pct, warnings
```

- Use `difflib.unified_diff` on stdout lines
- Similarity via `difflib.SequenceMatcher.ratio() * 100`
- Warnings for common false positives:
  - Dict ordering differences (Py2 dicts are unordered)
  - Unicode prefix differences (`u"foo"` vs `"foo"` in repr output)
  - `<type 'int'>` vs `<class 'int'>` differences
  - Integer division differences (`5/2` = 2 vs 2.5)
- **Migration gap detection** in stderr:
  - `NameError` for Py2-only builtins (`reduce`, `raw_input`, `xrange`, `basestring`, `cmp`, `long`, `execfile`, `reload`)
  - `ModuleNotFoundError` for Py2-only modules (`cPickle`, `cStringIO`, `ConfigParser`, `Queue`, `HTMLParser`)
  - Add targeted diagnostic messages (e.g., "Migration missed converting `cPickle` → `pickle`")
- **Pre-run static warnings** (scan source before execution):
  - `raw_input(` / `input(` in Py2 → "File reads from stdin, may hang without input"
  - `import random` / `datetime.now()` / `time.time()` → "Non-deterministic output possible"

---

## Step 4 — Backend: Project Manager Integration

### `app/services/project_manager.py`

Add method:
```python
async def run_and_compare(
    project_id: str,
    file_path: str,
    request: RunCompareRequest,
) -> RunCompareResponse:
```

- Validate project exists using existing `get_project()` pattern
- **Use `_safe_path()`** for both source and migrated paths (path traversal protection)
- Validate file has been transformed: check `project["files"].get(file_path, {}).get("migrated")` AND verify migrated file exists on disk
- Check interpreter availability before execution
- Create temp dirs via `tempfile.TemporaryDirectory()`, copy full `source/` and `migrated/` dirs (for inter-file imports)
- Execute both in parallel via `asyncio.gather`
- Compare outputs via `output_comparator`
- Return RunCompareResponse

---

## Step 5 — Backend: API Endpoint

### `app/api/routes.py`

```python
@router.post("/projects/{project_id}/run-compare/{file_path:path}", response_model=RunCompareResponse)
async def run_and_compare(
    project_id: str,
    file_path: str,
    body: RunCompareRequest = RunCompareRequest(),
) -> RunCompareResponse:
```

- Follow existing error handling pattern: `get_project()` + `try/except ValueError` → 404, `except Exception` → 500
- Add `RunCompareRequest` and `RunCompareResponse` to schema imports
- Add `"run_and_compare"` to the features list in the health endpoint

---

## Step 6 — Frontend: Types + Client

### `frontend/src/api/types.ts`
Add `ExecutionResult` and `RunCompareResponse` interfaces mirroring the Pydantic models.

### `frontend/src/api/client.ts`
Add:
```typescript
runAndCompare: (projectId: string, filePath: string, options?: {
  timeout_seconds?: number;
  stdin_input?: string;
}) => request<RunCompareResponse>(
    `/projects/${projectId}/run-compare/${filePath}`,
    { method: "POST", body: JSON.stringify(options ?? {}) }
  ),
```

---

## Step 7 — Frontend: Run & Compare Page

### `frontend/src/pages/RunComparePage.tsx`

Layout:
- Header with file name + "Run Comparison" button
- Two-column layout: Python 2 output (left) vs Python 3 output (right)
- Each column shows: exit code badge, stdout in a code block, stderr in a collapsible section
- Top summary bar: match/mismatch badge, similarity %, execution times
- Diff view toggle: show unified diff of stdout with green/red highlighting
- Warnings section at bottom for known false positives / migration gap diagnostics
- Loading state with spinner while executing

### Router (`frontend/src/App.tsx`)
Add route using `/*` wildcard pattern (NOT `:file`) so file paths with slashes work:
```tsx
<Route path="/projects/:id/run-compare/*" element={<RunComparePage />} />
```
Extract file path via `useParams()["*"]` in the component, consistent with `TransformationPage`.

### Navigation
Add a "Run & Compare" button on the `TransformationPage` action bar (near Split View / Unified Diff buttons), linking to `/projects/${id}/run-compare/${filePath}`.

---

## Edge Cases (from review)
1. **Python 2 not installed** — check interpreter availability, show clear error in UI
2. **RLIMIT_AS fails on macOS** — platform check: only use RLIMIT_CPU on Darwin
3. **Environment variable leakage** — sanitize env dict passed to subprocess
4. **Process group cleanup** — use `start_new_session=True` + `os.killpg` on timeout
5. **File imports other project files** — copy full source/migrated dir, not just single file
6. **Unmigrated dependencies** — warn if imported files missing from migrated/ dir
7. **stdin-blocking code** — static scan for `raw_input`/`input`, warn before execution
8. **Infinite loops** — timeout + process group kill
9. **Large output** — truncation with flag
10. **File I/O side effects** — run in temp dir via `TemporaryDirectory()` context manager
11. **Concurrent transform + run-compare** — acceptable for MVP (each uses own temp dir)
12. **Non-deterministic output** — static detection of `random`/`datetime.now()`/`time.time()`
