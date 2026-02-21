"""Risk assessment engine for migration files.

Scores each file by semantic complexity, dependency fan-out,
Python 2-specific patterns, and test coverage signals.
Assigns a confidence tier recommendation for the transformation approach.
"""

from __future__ import annotations

import ast
import os
import re

from app.models.schemas import ConfidenceTier, DependencyNode, RiskAssessment, RiskLevel

# Patterns that indicate higher semantic risk in Python 2->3 migration
PY2_HIGH_RISK_PATTERNS = [
    (r'\bbasestring\b', "basestring usage (str/unicode split)"),
    (r'\bunicode\(', "explicit unicode() calls"),
    (r'\.encode\(.*\)\.decode\(', "encode/decode chains (bytes boundary)"),
    (r'\bexcept\s+\w+\s*,\s*\w+', "old-style except syntax"),
    (r'\bexec\s+["\']', "exec as statement"),
    (r'\braw_input\b', "raw_input (renamed to input)"),
    (r'\bxrange\b', "xrange (removed)"),
    (r'\.has_key\(', "dict.has_key() (removed)"),
    (r'\.iteritems\(', "dict.iteritems() (removed)"),
    (r'\.itervalues\(', "dict.itervalues() (removed)"),
    (r'\.iterkeys\(', "dict.iterkeys() (removed)"),
    (r'\breload\(', "reload() (moved to importlib)"),
    (r'\bapply\(', "apply() (removed)"),
    (r'\breduce\(', "reduce() (moved to functools)"),
    (r'__metaclass__\s*=', "__metaclass__ attribute (use metaclass= kwarg)"),
]

# Patterns that indicate migration has already started (positive signal)
PY2_POSITIVE_PATTERNS = [
    (r'from\s+__future__\s+import\s+', "future imports present (partial migration started)"),
]

PY2_SEMANTIC_RISK_PATTERNS = [
    (r'isinstance\(.*,\s*str\)', "isinstance str check (may miss bytes in py3)"),
    (r'type\(.*\)\s*(==|is)\s*str', "type comparison with str"),
    (r'__div__', "__div__ (truediv/floordiv split in py3)"),
    (r'sys\.maxint', "sys.maxint (removed in py3, use sys.maxsize)"),
    (r'cPickle', "cPickle (merged into pickle in py3)"),
    (r'cStringIO', "cStringIO (merged into io in py3)"),
    (r'thread\b(?!ing)', "thread module (renamed to _thread)"),
    (r'commands\.', "commands module (removed, use subprocess)"),
]


def assess_risks(
    project_dir: str,
    dep_graph: dict[str, DependencyNode],
) -> list[RiskAssessment]:
    """Assess migration risk for each file in the project."""
    results: list[RiskAssessment] = []

    for rel_path, node in dep_graph.items():
        full_path = os.path.join(project_dir, rel_path)
        try:
            with open(full_path) as f:
                source = f.read()
        except (FileNotFoundError, UnicodeDecodeError):
            continue

        factors: list[str] = []
        score = 0.0

        # Factor 1: Python 2 patterns
        py2_hits = _scan_patterns(source, PY2_HIGH_RISK_PATTERNS)
        semantic_hits = _scan_patterns(source, PY2_SEMANTIC_RISK_PATTERNS)
        positive_hits = _scan_patterns(source, PY2_POSITIVE_PATTERNS)
        if py2_hits:
            factors.extend(f"Py2 pattern: {desc}" for _, desc in py2_hits)
            score += min(len(py2_hits) * 0.08, 0.3)
        if semantic_hits:
            factors.extend(f"Semantic risk: {desc}" for _, desc in semantic_hits)
            score += min(len(semantic_hits) * 0.12, 0.35)
        if positive_hits:
            factors.extend(f"Positive signal: {desc}" for _, desc in positive_hits)
            score = max(score - 0.05, 0.0)

        # Factor 2: File size / complexity
        lines = source.count("\n") + 1
        if lines > 1000:
            factors.append(f"Large file ({lines} lines)")
            score += 0.1
        elif lines > 500:
            score += 0.05

        # Factor 3: Dependency fan-out
        fan_out = len(node.imported_by)
        if fan_out > 5:
            factors.append(f"High dependency fan-out ({fan_out} dependents)")
            score += 0.15
        elif fan_out > 2:
            factors.append(f"Moderate dependency fan-out ({fan_out} dependents)")
            score += 0.05

        # Factor 4: Dynamic features
        try:
            tree = ast.parse(source)
            dynamic_score, dynamic_factors = _check_dynamic_features(tree)
            score += dynamic_score
            factors.extend(dynamic_factors)
        except SyntaxError:
            factors.append("File has syntax errors (cannot parse AST)")
            score += 0.2

        # Factor 5: Test coverage signal
        has_tests = _has_test_file(rel_path, dep_graph)
        coverage_estimate = "has_tests" if has_tests else "no_tests_found"
        if not has_tests:
            factors.append("No corresponding test file found")
            score += 0.1

        # Clamp and classify
        score = min(score, 1.0)
        risk_level = _score_to_level(score)
        tier = _score_to_tier(score)

        complexity = "high" if semantic_hits or score > 0.6 else ("medium" if score > 0.3 else "low")

        results.append(RiskAssessment(
            file_path=rel_path,
            risk_level=risk_level,
            risk_score=round(score, 3),
            factors=factors,
            test_coverage_estimate=coverage_estimate,
            semantic_complexity=complexity,
            recommended_tier=tier,
        ))

    results.sort(key=lambda r: r.risk_score)
    return results


def _scan_patterns(source: str, patterns: list[tuple[str, str]]) -> list[tuple[str, str]]:
    hits = []
    for pattern, desc in patterns:
        if re.search(pattern, source):
            hits.append((pattern, desc))
    return hits


def _check_dynamic_features(tree: ast.AST) -> tuple[float, list[str]]:
    score = 0.0
    factors: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == "eval":
            factors.append("Uses eval()")
            score += 0.15
        elif isinstance(node, ast.Name) and node.id == "exec":
            factors.append("Uses exec()")
            score += 0.15
        elif isinstance(node, ast.Name) and node.id in ("getattr", "setattr", "delattr"):
            if not factors or "dynamic attribute" not in factors[-1]:
                factors.append("Uses dynamic attribute access")
                score += 0.05
        elif isinstance(node, ast.Name) and node.id == "__import__":
            factors.append("Uses __import__() (dynamic imports)")
            score += 0.1

    return min(score, 0.3), factors


def _has_test_file(file_path: str, graph: dict[str, DependencyNode]) -> bool:
    base = os.path.splitext(os.path.basename(file_path))[0]
    test_names = {f"test_{base}.py", f"{base}_test.py", f"tests/test_{base}.py"}
    return any(any(tn in key for tn in test_names) for key in graph)


def _score_to_level(score: float) -> RiskLevel:
    if score >= 0.7:
        return RiskLevel.CRITICAL
    if score >= 0.45:
        return RiskLevel.HIGH
    if score >= 0.2:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _score_to_tier(score: float) -> ConfidenceTier:
    if score >= 0.7:
        return ConfidenceTier.TIER_4_MANUAL
    if score >= 0.45:
        return ConfidenceTier.TIER_3_REVIEW
    if score >= 0.2:
        return ConfidenceTier.TIER_2_SPOT
    return ConfidenceTier.TIER_1_AUTO
