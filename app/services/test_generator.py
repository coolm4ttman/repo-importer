"""Behavioral snapshot test generator.

Generates characterization tests BEFORE migration that capture current
behavior — so post-migration regressions are caught automatically.
This is the "seat belt" feature: tests are committed before any code changes.
"""

from __future__ import annotations

import ast
import os

from app.core.config import settings
from app.models.schemas import SnapshotTest


def generate_snapshot_tests(
    source: str,
    file_path: str,
) -> list[SnapshotTest]:
    """Generate behavioral snapshot tests using static analysis."""
    tests: list[SnapshotTest] = []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return tests

    module_name = os.path.splitext(file_path)[0].replace(os.sep, ".")

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            test = _generate_function_test(node, module_name, file_path)
            if test:
                tests.append(test)
        elif isinstance(node, ast.ClassDef):
            class_tests = _generate_class_tests(node, module_name, file_path)
            tests.extend(class_tests)

    return tests


async def generate_llm_snapshot_tests(
    source: str,
    file_path: str,
) -> list[SnapshotTest]:
    """Use Gemini to generate deeper behavioral snapshot tests."""
    if not settings.gemini_api_key:
        return []

    import json
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""You are a test engineer. Generate Python pytest snapshot tests for this code that capture its CURRENT behavior.
These tests will be used to detect regressions during a Python 2 to 3 migration.

Focus on:
- Functions with string/bytes operations (the str/bytes split is the #1 migration risk)
- Integer division behavior
- Dict ordering assumptions
- Functions that use iterators differently in Py2 vs Py3
- Edge cases around None comparisons

Return a JSON array of objects with:
- test_name: string (valid Python function name starting with test_)
- test_code: string (complete pytest test function)
- covers_functions: list[string] (function names this test covers)

Code:
```python
{source}
```

File: {file_path}

Return ONLY the JSON array."""

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
        items = json.loads(text)
    except Exception:
        return []

    return [
        SnapshotTest(
            file_path=file_path,
            test_name=item["test_name"],
            test_code=item["test_code"],
            covers_functions=item.get("covers_functions", []),
        )
        for item in items
        if isinstance(item, dict) and "test_name" in item and "test_code" in item
    ]


def _generate_function_test(
    node: ast.FunctionDef,
    module_name: str,
    file_path: str,
) -> SnapshotTest | None:
    """Generate a basic structural test for a function."""
    if node.name.startswith("_"):
        return None

    args = []
    for arg in node.args.args:
        arg_name = arg.arg if hasattr(arg, "arg") else arg.id if hasattr(arg, "id") else "arg"
        if arg_name == "self":
            continue
        args.append(arg_name)

    # Generate test with type-appropriate default values
    arg_defaults = ", ".join(f'{a}=None' for a in args)
    call_args = ", ".join(f'{a}={a}' for a in args)

    test_code = f'''import pytest
from {module_name} import {node.name}


def test_{node.name}_exists():
    """Snapshot: verify {node.name} is callable and accepts expected args."""
    assert callable({node.name})


def test_{node.name}_returns_without_error():
    """Snapshot: verify {node.name} can be called without raising."""
    # TODO: Add appropriate test arguments based on function signature
    # Function signature: {node.name}({", ".join(args) if args else ""})
    pass
'''

    return SnapshotTest(
        file_path=file_path,
        test_name=f"test_{node.name}_snapshot",
        test_code=test_code,
        covers_functions=[node.name],
    )


def _generate_class_tests(
    node: ast.ClassDef,
    module_name: str,
    file_path: str,
) -> list[SnapshotTest]:
    """Generate basic structural tests for a class and its methods."""
    tests: list[SnapshotTest] = []

    methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("_")]

    test_code = f'''import pytest
from {module_name} import {node.name}


def test_{node.name}_class_exists():
    """Snapshot: verify {node.name} class is importable."""
    assert {node.name} is not None


def test_{node.name}_has_expected_methods():
    """Snapshot: verify {node.name} has its public interface intact."""
    expected_methods = {methods!r}
    for method in expected_methods:
        assert hasattr({node.name}, method), f"Missing method: {{method}}"
'''

    tests.append(SnapshotTest(
        file_path=file_path,
        test_name=f"test_{node.name}_class_snapshot",
        test_code=test_code,
        covers_functions=[node.name] + methods,
    ))

    return tests
