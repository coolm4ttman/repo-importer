"""Sandboxed Python code executor with resource limits and timeout."""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import resource
import signal
import time
from pathlib import Path

from app.models.schemas import ExecutionResult

logger = logging.getLogger(__name__)


async def check_interpreter(path: str) -> bool:
    """Check whether a Python interpreter is available at the given path.

    Runs ``{path} --version`` and returns True if it exits successfully.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            path,
            "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=10)
        return proc.returncode == 0
    except (FileNotFoundError, OSError, asyncio.TimeoutError):
        return False


def _build_preexec(timeout: int, memory_mb: int):
    """Return a preexec_fn that sets resource limits in the child process."""

    def _set_limits() -> None:
        # CPU time limit (works on all POSIX systems including macOS)
        resource.setrlimit(resource.RLIMIT_CPU, (timeout, timeout))

        # Virtual memory limit -- only on Linux; macOS ignores / errors on RLIMIT_AS
        if platform.system() == "Linux":
            mem_bytes = memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))

    return _set_limits


def _sanitized_env(code_dir: Path) -> dict[str, str]:
    """Build a minimal environment dict for the child process.

    Only propagates safe variables -- secrets like API keys are stripped.
    """
    safe_keys = ("PATH", "HOME", "LANG")
    env: dict[str, str] = {}
    for key in safe_keys:
        value = os.environ.get(key)
        if value is not None:
            env[key] = value

    # Set PYTHONPATH to the code directory so sibling imports resolve
    env["PYTHONPATH"] = str(code_dir)
    return env


async def execute_python(
    code_path: Path,
    interpreter: str,
    timeout: int = 30,
    memory_mb: int = 256,
    stdin_input: str | None = None,
    max_output: int = 10_485_760,
) -> ExecutionResult:
    """Execute a Python file under the given interpreter with resource limits.

    Parameters
    ----------
    code_path:
        Absolute path to the ``.py`` file to run.
    interpreter:
        Path or name of the Python interpreter (e.g. ``"python2"``).
    timeout:
        Maximum wall-clock seconds before the process is killed.
    memory_mb:
        Maximum virtual memory in MiB (Linux only).
    stdin_input:
        Optional string piped to the process's stdin.
    max_output:
        Maximum bytes kept for stdout / stderr.  Output beyond this is
        truncated and the ``truncated`` flag is set.

    Returns
    -------
    ExecutionResult
    """

    cwd = code_path.parent
    env = _sanitized_env(cwd)
    stdin_bytes = stdin_input.encode() if stdin_input else None

    timed_out = False
    truncated = False
    stdout_bytes = b""
    stderr_bytes = b""
    exit_code: int | None = None

    start = time.monotonic()

    try:
        proc = await asyncio.create_subprocess_exec(
            interpreter,
            str(code_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin_bytes is not None else asyncio.subprocess.DEVNULL,
            cwd=str(cwd),
            env=env,
            start_new_session=True,
            preexec_fn=_build_preexec(timeout, memory_mb),
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(input=stdin_bytes),
                timeout=timeout,
            )
            exit_code = proc.returncode
        except asyncio.TimeoutError:
            timed_out = True
            # Kill the entire process group
            try:
                pgid = os.getpgid(proc.pid)
                os.killpg(pgid, signal.SIGKILL)
            except (ProcessLookupError, OSError):
                # Process already exited
                pass

            # Drain any partial output
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=2
                )
            except (asyncio.TimeoutError, Exception):
                stdout_bytes = b""
                stderr_bytes = b""

            exit_code = proc.returncode

    except FileNotFoundError:
        elapsed_ms = (time.monotonic() - start) * 1000
        return ExecutionResult(
            exit_code=None,
            stdout="",
            stderr=f"Interpreter not found: {interpreter}",
            execution_time_ms=round(elapsed_ms, 2),
            timed_out=False,
            truncated=False,
        )
    except OSError as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        return ExecutionResult(
            exit_code=None,
            stdout="",
            stderr=f"Failed to start process: {exc}",
            execution_time_ms=round(elapsed_ms, 2),
            timed_out=False,
            truncated=False,
        )

    elapsed_ms = (time.monotonic() - start) * 1000

    # Truncate oversized output
    if len(stdout_bytes) > max_output:
        stdout_bytes = stdout_bytes[:max_output]
        truncated = True
    if len(stderr_bytes) > max_output:
        stderr_bytes = stderr_bytes[:max_output]
        truncated = True

    stdout_str = stdout_bytes.decode("utf-8", errors="replace")
    stderr_str = stderr_bytes.decode("utf-8", errors="replace")

    return ExecutionResult(
        exit_code=exit_code,
        stdout=stdout_str,
        stderr=stderr_str,
        execution_time_ms=round(elapsed_ms, 2),
        timed_out=timed_out,
        truncated=truncated,
    )
