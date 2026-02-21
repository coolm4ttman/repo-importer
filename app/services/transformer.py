"""AI-powered code transformation engine.

Hybrid approach: deterministic AST-based rules for high-confidence syntax
changes, LLM-based transformation for semantic changes — each transformation
tagged with a confidence tier and reasoning.
"""

from __future__ import annotations

import ast
import re
import uuid

from app.core.config import settings
from app.models.schemas import ConfidenceTier, Transformation

# ── Deterministic rules (Tier 1 — auto-apply) ──────────────────────────

DETERMINISTIC_RULES: list[tuple[str, str, str, str]] = [
    # (regex_pattern, replacement, description, change_type)
    # NOTE: print >> must come BEFORE general print to avoid mis-matching
    (r'\bprint\s*>>\s*(\w+)\s*,\s*(.*?)$', r'print(\2, file=\1)', "print >> to print(file=)", "syntax"),
    (r'\bprint\s+([^(].*?)$', r'print(\1)', "print statement to function", "syntax"),
    (r'\bxrange\s*\(', 'range(', "xrange to range", "syntax"),
    (r'\braw_input\s*\(', 'input(', "raw_input to input", "syntax"),
    (r'([\w.]+)\.has_key\(([^)]+)\)', r'\2 in \1', "dict.has_key() to 'in' operator", "syntax"),
    (r'(?<!["\w])long(?!\w)', 'int', "long type to int", "syntax"),
    (r'(?<!["\w])unicode(?!\w)', 'str', "unicode to str", "syntax"),
    (r'(?<!["\w])basestring(?!\w)', 'str', "basestring to str", "syntax"),
    (r'\.iteritems\(\)', '.items()', "dict.iteritems() to items()", "syntax"),
    (r'\.itervalues\(\)', '.values()', "dict.itervalues() to values()", "syntax"),
    (r'\.iterkeys\(\)', '.keys()', "dict.iterkeys() to keys()", "syntax"),
    (r'\.viewitems\(\)', '.items()', "dict.viewitems() to items()", "syntax"),
    (r'\.viewvalues\(\)', '.values()', "dict.viewvalues() to values()", "syntax"),
    (r'\.viewkeys\(\)', '.keys()', "dict.viewkeys() to keys()", "syntax"),
    (r'\braise\s+(\w+)\s*,\s*(.*?)$', r'raise \1(\2)', "old-style raise to new raise", "syntax"),
    (r'\bexcept\s+(\w+)\s*,\s*(\w+)\s*:', r'except \1 as \2:', "old except syntax", "syntax"),
    (r'from\s+itertools\s+import\s+izip\b', 'from builtins import zip', "izip to zip", "syntax"),
    (r'\bizip\(', 'zip(', "izip to zip", "syntax"),
    (r'\bimap\(', 'map(', "imap to map", "syntax"),
    (r'\bifilter\(', 'filter(', "ifilter to filter", "syntax"),
    (r'\bsys\.maxint\b', 'sys.maxsize', "sys.maxint to sys.maxsize", "syntax"),
    (r'(?<![\w.])cmp\(', '(lambda a, b: (a > b) - (a < b))(', "cmp() replacement", "semantic"),
    (r'import\s+cPickle', 'import pickle', "cPickle to pickle", "syntax"),
    (r'from\s+cPickle\s+import', 'from pickle import', "cPickle to pickle", "syntax"),
    (r'import\s+cStringIO', 'import io', "cStringIO to io", "syntax"),
    (r'from\s+cStringIO\s+import\s+StringIO', 'from io import StringIO', "cStringIO to io", "syntax"),
]


def apply_deterministic_rules(source: str, file_path: str) -> list[Transformation]:
    """Apply all deterministic Tier-1 rules and return transformations."""
    transformations: list[Transformation] = []
    lines = source.splitlines()

    for line_idx, line in enumerate(lines, start=1):
        for pattern, replacement, description, change_type in DETERMINISTIC_RULES:
            match = re.search(pattern, line)
            if match:
                # Skip general print rule on lines with unbalanced parens
                # (multiline statements) — let LLM tier handle those
                if description == "print statement to function":
                    if line.count("(") > line.count(")"):
                        continue
                new_line = re.sub(pattern, replacement, line)
                if new_line != line:
                    transformations.append(Transformation(
                        id=str(uuid.uuid4())[:8],
                        file_path=file_path,
                        line_start=line_idx,
                        line_end=line_idx,
                        original_code=line.strip(),
                        transformed_code=new_line.strip(),
                        confidence_tier=ConfidenceTier.TIER_1_AUTO,
                        confidence_score=0.95,
                        reasoning=f"Deterministic rule: {description}",
                        change_type=change_type,
                        requires_test=change_type == "semantic",
                    ))
    return transformations


# ── LLM-powered transformation (Tier 2-4) ──────────────────────────────

TRANSFORM_PROMPT = """You are a Python 2 to Python 3 migration expert. Analyze the following code and identify ALL semantic changes needed beyond simple syntax fixes.

For each change, provide:
1. The exact original code snippet
2. The transformed code
3. A confidence score (0.0-1.0) based on how certain you are the behavior is preserved
4. The reasoning for the change
5. Whether this change needs a test to verify

Focus on:
- bytes/str boundary issues
- integer division semantics (/ vs //)
- iterator vs list returns (map, filter, zip, dict.keys/values/items)
- metaclass syntax changes
- module reorganization (urllib, configparser, etc.)
- exception chaining
- octal literal format changes
- comparison operators (__cmp__ removed)

IMPORTANT: Only output changes that are NOT covered by these already-applied deterministic rules:
- print statement -> print()
- xrange -> range
- raw_input -> input
- has_key -> in
- iteritems/itervalues/iterkeys -> items/values/keys
- unicode/basestring -> str
- except X, e -> except X as e
- cPickle -> pickle / cStringIO -> io

Return your analysis as a JSON array of objects with these fields:
- original_code: string
- transformed_code: string
- line_start: int
- line_end: int
- confidence_score: float (0.0-1.0)
- reasoning: string
- change_type: "semantic" | "api_change" | "behavioral"
- requires_test: boolean

If no additional changes are needed, return an empty array: []

Code to analyze:
```python
{code}
```

File context: {file_path}

Return ONLY the JSON array, no markdown fences."""


async def apply_llm_transformations(
    source: str,
    file_path: str,
) -> list[Transformation]:
    """Use Gemini to identify semantic transformations beyond deterministic rules."""
    if not settings.gemini_api_key:
        return [Transformation(
            file_path=file_path,
            line_start=0,
            line_end=0,
            original_code="",
            transformed_code="",
            confidence_tier=ConfidenceTier.TIER_4_MANUAL,
            confidence_score=0.0,
            reasoning="GEMINI_API_KEY not set — skipping LLM analysis. Set the key for semantic transformation.",
            change_type="semantic",
        )]

    import json
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = TRANSFORM_PROMPT.format(code=source, file_path=file_path)

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )

        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]

        changes = json.loads(text)
        if not isinstance(changes, list):
            changes = []

    except Exception as e:
        return [Transformation(
            file_path=file_path,
            line_start=0,
            line_end=0,
            original_code="",
            transformed_code="",
            confidence_tier=ConfidenceTier.TIER_4_MANUAL,
            confidence_score=0.0,
            reasoning=f"LLM analysis failed: {e}",
            change_type="semantic",
        )]

    transformations: list[Transformation] = []
    for change in changes:
        score = float(change.get("confidence_score", 0.5))
        tier = _score_to_tier(score)
        transformations.append(Transformation(
            id=str(uuid.uuid4())[:8],
            file_path=file_path,
            line_start=change.get("line_start", 0),
            line_end=change.get("line_end", 0),
            original_code=change.get("original_code", ""),
            transformed_code=change.get("transformed_code", ""),
            confidence_tier=tier,
            confidence_score=score,
            reasoning=change.get("reasoning", ""),
            change_type=change.get("change_type", "semantic"),
            requires_test=change.get("requires_test", True),
        ))

    return transformations


def _score_to_tier(score: float) -> ConfidenceTier:
    if score >= 0.9:
        return ConfidenceTier.TIER_1_AUTO
    if score >= 0.7:
        return ConfidenceTier.TIER_2_SPOT
    if score >= 0.4:
        return ConfidenceTier.TIER_3_REVIEW
    return ConfidenceTier.TIER_4_MANUAL
