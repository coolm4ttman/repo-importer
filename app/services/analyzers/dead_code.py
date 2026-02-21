"""Dead code detection using AST analysis.

Identifies unreachable functions, unused imports, and orphaned classes
BEFORE migration begins — so teams don't waste effort migrating code
that should be deleted.
"""

from __future__ import annotations

import ast
import os
from collections import defaultdict

from app.models.schemas import DeadCodeItem


def detect_dead_code(project_dir: str) -> list[DeadCodeItem]:
    """Scan all Python files and find dead code across the project."""
    all_definitions: dict[str, list[_Definition]] = {}
    all_references: set[str] = set()
    all_imports: dict[str, list[_Import]] = {}

    py_files = _collect_python_files(project_dir)

    # Pass 1: collect all definitions and references
    for fpath in py_files:
        rel_path = os.path.relpath(fpath, project_dir)
        try:
            with open(fpath) as f:
                source = f.read()
            tree = ast.parse(source, filename=fpath)
        except (SyntaxError, UnicodeDecodeError):
            continue

        defs, refs, imports = _analyze_file(tree, rel_path)
        all_definitions[rel_path] = defs
        all_references.update(refs)
        all_imports[rel_path] = imports

    # Pass 2: find definitions never referenced anywhere
    dead: list[DeadCodeItem] = []

    for fpath, defs in all_definitions.items():
        for d in defs:
            if d.name.startswith("_") and not d.name.startswith("__"):
                # Private names — only need to be referenced in the same file
                file_refs = {r for r in all_references if r.startswith(fpath + ":")}
                if not any(r.endswith(":" + d.name) for r in file_refs):
                    dead.append(DeadCodeItem(
                        file_path=fpath,
                        name=d.name,
                        kind=d.kind,
                        line_start=d.line_start,
                        line_end=d.line_end,
                        reason=f"Private {d.kind} '{d.name}' is never referenced in its file",
                        lines_saved=d.line_end - d.line_start + 1,
                    ))
            elif d.name not in all_references and not _is_entrypoint(d):
                dead.append(DeadCodeItem(
                    file_path=fpath,
                    name=d.name,
                    kind=d.kind,
                    line_start=d.line_start,
                    line_end=d.line_end,
                    reason=f"{d.kind.title()} '{d.name}' is defined but never used anywhere in the project",
                    lines_saved=d.line_end - d.line_start + 1,
                ))

    # Check unused imports
    for fpath, imports in all_imports.items():
        for imp in imports:
            # Check if imported name is used as a reference in the same file
            file_refs = {r for r in all_references if r.startswith(fpath + ":")}
            if not any(r.endswith(":" + imp.name) for r in file_refs) and imp.name not in all_references:
                dead.append(DeadCodeItem(
                    file_path=fpath,
                    name=imp.name,
                    kind="import",
                    line_start=imp.line,
                    line_end=imp.line,
                    reason=f"Import '{imp.name}' is never used",
                    lines_saved=1,
                ))

    return dead


class _Definition:
    __slots__ = ("name", "kind", "line_start", "line_end")

    def __init__(self, name: str, kind: str, line_start: int, line_end: int):
        self.name = name
        self.kind = kind
        self.line_start = line_start
        self.line_end = line_end


class _Import:
    __slots__ = ("name", "line")

    def __init__(self, name: str, line: int):
        self.name = name
        self.line = line


def _collect_python_files(directory: str) -> list[str]:
    files = []
    for root, _, filenames in os.walk(directory):
        for fname in filenames:
            if fname.endswith(".py"):
                files.append(os.path.join(root, fname))
    return files


def _analyze_file(tree: ast.AST, rel_path: str):
    defs: list[_Definition] = []
    refs: set[str] = set()
    imports: list[_Import] = []

    # Collect definitions with class-qualified method names
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            defs.append(_Definition(
                name=node.name,
                kind="class",
                line_start=node.lineno,
                line_end=node.end_lineno or node.lineno,
            ))
            for item in ast.iter_child_nodes(node):
                if isinstance(item, ast.FunctionDef):
                    defs.append(_Definition(
                        name=f"{node.name}.{item.name}",
                        kind="method",
                        line_start=item.lineno,
                        line_end=item.end_lineno or item.lineno,
                    ))
        elif isinstance(node, ast.FunctionDef):
            defs.append(_Definition(
                name=node.name,
                kind="function",
                line_start=node.lineno,
                line_end=node.end_lineno or node.lineno,
            ))

    # Collect references and imports via full walk
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            refs.add(node.id)
            refs.add(f"{rel_path}:{node.id}")
        elif isinstance(node, ast.Attribute):
            refs.add(node.attr)
            refs.add(f"{rel_path}:{node.attr}")
            # Track ClassName.method patterns for qualified method references
            if isinstance(node.value, ast.Name):
                qualified = f"{node.value.id}.{node.attr}"
                refs.add(qualified)
                refs.add(f"{rel_path}:{qualified}")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.asname or alias.name
                imports.append(_Import(name=name, line=node.lineno))
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                name = alias.asname or alias.name
                imports.append(_Import(name=name, line=node.lineno))

    return defs, refs, imports


def _is_entrypoint(d: _Definition) -> bool:
    """Check if this looks like an entrypoint that wouldn't have in-project callers."""
    entrypoint_names = {"main", "setup", "teardown", "run", "cli", "app", "create_app"}
    return (
        d.name in entrypoint_names
        or d.name.startswith("__")  # dunder methods
        or d.name.startswith("test_")  # test functions
    )
