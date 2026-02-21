"""Output comparison and migration-gap detection for Run & Compare."""

from __future__ import annotations

import difflib
import re

from app.models.schemas import ExecutionResult

# ---------------------------------------------------------------------------
# Known Py2-only builtins and modules for migration-gap detection
# ---------------------------------------------------------------------------

_PY2_BUILTINS = {
    "reduce",
    "raw_input",
    "xrange",
    "basestring",
    "cmp",
    "long",
    "execfile",
    "reload",
}

_PY2_MODULES = {
    "cPickle": "pickle",
    "cStringIO": "io.StringIO",
    "ConfigParser": "configparser",
    "Queue": "queue",
    "HTMLParser": "html.parser",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compare_outputs(py2: ExecutionResult, py3: ExecutionResult) -> dict:
    """Compare execution results and return match info, diff, and warnings.

    Returns a dict with keys:
        outputs_match (bool), diff_lines (list[str]),
        similarity_pct (float 0-100), warnings (list[str])
    """

    py2_lines = py2.stdout.splitlines(keepends=True)
    py3_lines = py3.stdout.splitlines(keepends=True)

    # Unified diff of stdout
    diff_lines = list(
        difflib.unified_diff(
            py2_lines,
            py3_lines,
            fromfile="python2 stdout",
            tofile="python3 stdout",
        )
    )

    # Similarity score
    matcher = difflib.SequenceMatcher(None, py2.stdout, py3.stdout)
    similarity_pct = round(matcher.ratio() * 100, 2)

    outputs_match = py2.stdout == py3.stdout

    warnings = _detect_false_positives(py2.stdout, py3.stdout, diff_lines)
    warnings.extend(_detect_migration_gaps(py3.stderr))

    return {
        "outputs_match": outputs_match,
        "diff_lines": [line.rstrip("\n") for line in diff_lines],
        "similarity_pct": similarity_pct,
        "warnings": warnings,
    }


def scan_pre_run_warnings(source_code: str) -> list[str]:
    """Static scan of source code for patterns that may cause issues at runtime.

    Returns a list of human-readable warning strings.
    """
    warnings: list[str] = []

    if re.search(r"\braw_input\s*\(", source_code):
        warnings.append(
            "File uses raw_input() -- execution may hang without stdin input."
        )
    if re.search(r"\binput\s*\(", source_code):
        warnings.append(
            "File uses input() -- execution may hang without stdin input."
        )

    if re.search(r"\bimport\s+random\b", source_code):
        warnings.append(
            "File imports random -- output may be non-deterministic."
        )
    if re.search(r"\bdatetime\.now\s*\(", source_code):
        warnings.append(
            "File calls datetime.now() -- output may be non-deterministic."
        )
    if re.search(r"\btime\.time\s*\(", source_code):
        warnings.append(
            "File calls time.time() -- output may be non-deterministic."
        )

    return warnings


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _detect_false_positives(
    py2_stdout: str, py3_stdout: str, diff_lines: list[str]
) -> list[str]:
    """Generate warnings for common benign Py2/Py3 output differences."""

    warnings: list[str] = []
    diff_text = "".join(diff_lines)

    # Dict ordering differences (Py2 dicts are unordered)
    if re.search(r"[{].*:.*[}]", diff_text):
        # Heuristic: if both outputs contain dict-like repr and only ordering differs
        py2_has_dict = re.search(r"[{].*:.*[}]", py2_stdout)
        py3_has_dict = re.search(r"[{].*:.*[}]", py3_stdout)
        if py2_has_dict and py3_has_dict:
            warnings.append(
                "Outputs contain dict repr -- ordering may differ between "
                "Python 2 (unordered) and Python 3 (insertion-ordered)."
            )

    # Unicode prefix differences: u"..." vs "..."
    if re.search(r"""u['"]""", diff_text) or re.search(r"""u['"]""", py2_stdout):
        warnings.append(
            'Unicode prefix difference detected (u"..." vs "...") -- '
            "likely cosmetic, not a behavioral change."
        )

    # Type repr differences: <type '...'> vs <class '...'>
    if re.search(r"<type\s+'", diff_text) or re.search(r"<class\s+'", diff_text):
        warnings.append(
            "Type representation difference detected (<type '...'> vs "
            "<class '...'>) -- cosmetic difference between Py2 and Py3."
        )

    # Integer division differences
    if re.search(r"\b\d+\b", diff_text):
        # Check if py2 has integer result where py3 has float
        py2_ints = re.findall(r"\b(\d+)\b", py2_stdout)
        py3_floats = re.findall(r"\b(\d+\.\d+)\b", py3_stdout)
        if py2_ints and py3_floats:
            warnings.append(
                "Possible integer division difference -- Python 2 uses "
                "floor division for / on ints, Python 3 uses true division."
            )

    return warnings


def _detect_migration_gaps(py3_stderr: str) -> list[str]:
    """Detect migration gaps from Python 3 stderr output."""

    warnings: list[str] = []

    # NameError for Py2-only builtins
    for builtin in _PY2_BUILTINS:
        if re.search(rf"NameError.*\b{builtin}\b", py3_stderr):
            warnings.append(
                f"Migration gap: NameError for '{builtin}' -- "
                f"this Python 2 builtin was not converted for Python 3."
            )

    # ModuleNotFoundError for Py2-only modules
    for py2_mod, py3_mod in _PY2_MODULES.items():
        if re.search(
            rf"(?:ModuleNotFoundError|ImportError).*\b{py2_mod}\b", py3_stderr
        ):
            warnings.append(
                f"Migration gap: '{py2_mod}' import failed -- "
                f"convert to '{py3_mod}' for Python 3."
            )

    return warnings
