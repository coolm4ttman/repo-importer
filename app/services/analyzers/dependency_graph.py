"""Dependency graph analysis for migration ordering.

Builds a full import graph across the project and computes
a topologically sorted migration order — leaf modules first,
core modules last — to minimize breakage during incremental migration.
"""

from __future__ import annotations

import ast
import os
from collections import defaultdict, deque

from app.models.schemas import DependencyNode


def build_dependency_graph(project_dir: str) -> dict[str, DependencyNode]:
    """Build the full dependency graph and compute migration order."""
    py_files = _collect_python_files(project_dir)
    module_map = _build_module_map(py_files, project_dir)

    # Parse imports for each file
    imports_map: dict[str, set[str]] = defaultdict(set)
    imported_by_map: dict[str, set[str]] = defaultdict(set)
    external_deps: dict[str, set[str]] = defaultdict(set)

    for fpath in py_files:
        rel_path = os.path.relpath(fpath, project_dir)
        try:
            with open(fpath) as f:
                source = f.read()
            tree = ast.parse(source, filename=fpath)
        except (SyntaxError, UnicodeDecodeError):
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    _resolve_import(
                        alias.name, rel_path, module_map,
                        imports_map, imported_by_map, external_deps,
                    )
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    _resolve_import(
                        node.module, rel_path, module_map,
                        imports_map, imported_by_map, external_deps,
                    )

    # Compute topological migration order (leaves first)
    all_files = {os.path.relpath(f, project_dir) for f in py_files}
    order, circular_deps = _topological_sort(all_files, imports_map)

    if circular_deps:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            "Circular dependencies detected among %d files: %s",
            len(circular_deps),
            ", ".join(sorted(circular_deps)),
        )

    graph: dict[str, DependencyNode] = {}
    for rel_path in all_files:
        graph[rel_path] = DependencyNode(
            file_path=rel_path,
            imports=sorted(imports_map.get(rel_path, set())),
            imported_by=sorted(imported_by_map.get(rel_path, set())),
            external_deps=sorted(external_deps.get(rel_path, set())),
            migration_order=order.get(rel_path),
            circular_deps=sorted(circular_deps & imports_map.get(rel_path, set())) if rel_path in circular_deps else [],
        )

    return graph


def get_migration_order(graph: dict[str, DependencyNode]) -> list[str]:
    """Return files in recommended migration order (leaves first)."""
    ordered = sorted(
        graph.values(),
        key=lambda n: (n.migration_order if n.migration_order is not None else 9999, n.file_path),
    )
    return [n.file_path for n in ordered]


def _collect_python_files(directory: str) -> list[str]:
    files = []
    for root, _, filenames in os.walk(directory):
        for fname in filenames:
            if fname.endswith(".py"):
                files.append(os.path.join(root, fname))
    return files


def _build_module_map(files: list[str], project_dir: str) -> dict[str, str]:
    """Map module dotted paths to relative file paths."""
    module_map: dict[str, str] = {}
    for fpath in files:
        rel = os.path.relpath(fpath, project_dir)
        # e.g., "utils/helpers.py" -> "utils.helpers"
        module = rel.replace(os.sep, ".").removesuffix(".py")
        if module.endswith(".__init__"):
            module = module.removesuffix(".__init__")
        module_map[module] = rel
    return module_map


def _resolve_import(
    module_name: str,
    current_file: str,
    module_map: dict[str, str],
    imports_map: dict[str, set[str]],
    imported_by_map: dict[str, set[str]],
    external_deps: dict[str, set[str]],
):
    # Try to find it in project modules
    parts = module_name.split(".")
    for i in range(len(parts), 0, -1):
        candidate = ".".join(parts[:i])
        if candidate in module_map:
            target = module_map[candidate]
            if target != current_file:
                imports_map[current_file].add(target)
                imported_by_map[target].add(current_file)
            return

    # External dependency
    external_deps[current_file].add(parts[0])


def _topological_sort(
    files: set[str],
    imports_map: dict[str, set[str]],
) -> tuple[dict[str, int], set[str]]:
    """Kahn's algorithm — returns (migration order, circular_dep_files).

    Migration order maps file -> int (0 = migrate first).
    circular_dep_files is the set of files involved in dependency cycles.
    """
    in_degree: dict[str, int] = {f: 0 for f in files}

    # Build reverse adjacency list: dependents_map[dep] = set of files that import dep
    dependents_map: defaultdict[str, set[str]] = defaultdict(set)
    for f, deps in imports_map.items():
        for dep in deps:
            if dep in in_degree:
                in_degree[f] = in_degree.get(f, 0) + 1
                dependents_map[dep].add(f)

    queue = deque(f for f, d in in_degree.items() if d == 0)
    order: dict[str, int] = {}
    idx = 0

    while queue:
        node = queue.popleft()
        order[node] = idx
        idx += 1
        # Efficiently find files that import this node
        for f in dependents_map.get(node, set()):
            in_degree[f] -= 1
            if in_degree[f] == 0:
                queue.append(f)

    # Cycle detection: files not in order have circular deps
    circular_deps = {f for f in files if f not in order}
    for f in sorted(circular_deps):
        order[f] = idx
        idx += 1

    return order, circular_deps
